"""Regression tests for hotfix_20260414_agent-tool-call-leak.

Agent 채팅에서 두 번째 턴부터 응답 본문 맨 앞에 'Calling: <tools> for <args>'
라인이 리터럴 텍스트로 새어 나오던 버그에 대한 회귀 방지 테스트.

원인 계층 (B)/(C): base_agent_runner.organize_agent_history 가 과거 턴의
assistant 메시지를 LLM 프롬프트로 재조립할 때 'Calling: ...' 리터럴을
content 로 주입했고, 이미 저장된 answer/thought 에도 동일 라인이 남아 있어
LLM 이 패턴을 모방했다. 방어 필터가 이를 제거한다.
"""

from core.agent.base_agent_runner import _strip_tool_call_leak


class TestStripToolCallLeak:
    def test_none_returns_empty_string(self):
        assert _strip_tool_call_leak(None) == ""

    def test_empty_returns_empty(self):
        assert _strip_tool_call_leak("") == ""

    def test_plain_text_untouched(self):
        text = "다음은 Tesla 의 분석 결과입니다. 가격은 200 달러."
        assert _strip_tool_call_leak(text) == text

    def test_removes_leading_calling_line(self):
        contaminated = (
            "Calling: yahoo_finance_ticker, yahoo_finance_news for TSLA\n다음은 Tesla, Inc. 의 최근 시세입니다."
        )
        assert _strip_tool_call_leak(contaminated) == "다음은 Tesla, Inc. 의 최근 시세입니다."

    def test_removes_multiple_calling_lines(self):
        contaminated = "Calling: yahoo_finance_ticker for TSLA\nCalling: yahoo_finance_news for TSLA\n실제 응답 내용"
        assert _strip_tool_call_leak(contaminated) == "실제 응답 내용"

    def test_removes_calling_with_leading_whitespace(self):
        contaminated = "   Calling: tool_a for X\n본문"
        assert _strip_tool_call_leak(contaminated) == "본문"

    def test_preserves_word_calling_inside_sentence(self):
        """일반 영어 문장에서 'calling' 이 단어로 등장하면 제거하지 않는다."""
        text = "He was calling the function and it worked."
        assert _strip_tool_call_leak(text) == text

    def test_preserves_calling_not_at_line_start(self):
        text = "결과: Calling: this is inline, not a line start"
        assert _strip_tool_call_leak(text) == text

    def test_case_sensitive_lowercase_not_stripped(self):
        """소문자 'calling:' 은 내부 합성 로그 형식이 아니므로 보존."""
        text = "calling: not a real leak\n본문"
        # 이 형식은 Dify 내부 로그 패턴이 아니므로 건드리지 않는다
        assert "본문" in _strip_tool_call_leak(text)

    def test_calling_only_results_in_empty(self):
        contaminated = "Calling: yahoo_finance_ticker for TSLA"
        assert _strip_tool_call_leak(contaminated) == ""

    def test_strips_trailing_whitespace(self):
        assert _strip_tool_call_leak("  본문  ") == "본문"
