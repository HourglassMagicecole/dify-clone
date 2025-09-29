#!/usr/bin/env python3
"""
샘플 Agent 생성 스크립트
Dify API와 완전히 호환되는 10개의 교육용 Agent를 생성합니다.
"""

import json
import logging
import os
import sys
from datetime import UTC, datetime
from typing import Any

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import requests
    from faker import Faker
except ImportError:
    print("필수 패키지를 설치해주세요:")
    print("pip install requests faker")
    sys.exit(1)

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class AgentGenerator:
    """Agent 샘플 데이터 생성기"""

    def __init__(self, api_base_url: str = None, api_key: str = None):
        self.fake = Faker(["ko_KR", "en_US"])
        self.api_base_url = api_base_url or os.getenv("DIFY_API_URL", "http://localhost:5001")
        self.api_key = api_key or os.getenv("DIFY_API_KEY", "test-api-key")

        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"})

        # 교육용 Agent 템플릿 정의
        self.agent_templates = [
            {
                "name": "Python 코딩 튜터",
                "description": "Python 프로그래밍을 배우는 학생들을 위한 AI 튜터입니다. 기초부터 고급까지 단계별로 설명해드립니다.",
                "category": "education",
                "model": "gpt-3.5-turbo",
                "temperature": 0.3,
                "max_tokens": 2000,
                "tools": ["code_interpreter"],
                "prompt_template": """당신은 친근하고 인내심 많은 Python 프로그래밍 튜터입니다.

목표:
- 학생의 수준에 맞춰 쉽고 이해하기 쉽게 설명
- 실습 예제 중심의 학습 제공
- 코드 리뷰 및 개선 제안
- 프로그래밍 best practice 가르치기

응답 스타일:
- 친근하고 격려하는 톤
- 단계별로 체계적인 설명
- 실제 예제 코드 포함
- 학생의 질문에 정확하고 상세한 답변

항상 학생의 학습 진도를 확인하고 적절한 난이도의 문제를 제시해주세요.""",
            },
            {
                "name": "영어 회화 연습 봇",
                "description": "일상 영어 회화를 연습할 수 있는 AI 파트너입니다. 다양한 상황별 대화를 통해 실력을 향상시켜보세요.",
                "category": "education",
                "model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 1500,
                "tools": [],
                "prompt_template": """You are a friendly and patient English conversation partner.

Goals:
- Engage in natural, everyday conversations in English
- Correct grammar and pronunciation mistakes gently
- Introduce new vocabulary contextually
- Adapt conversation level to the learner's proficiency

Response Style:
- Use natural, conversational English
- Be encouraging and supportive
- Ask follow-up questions to keep the conversation flowing
- Provide corrections in a helpful, non-intimidating way

Always maintain a balance between correction and encouragement to boost the learner's confidence.""",
            },
            {
                "name": "수학 문제 해결사",
                "description": "중고등학교 수학 문제를 단계별로 해결해주는 AI입니다. 개념 설명부터 문제 풀이까지 도와드립니다.",
                "category": "education",
                "model": "gpt-4",
                "temperature": 0.2,
                "max_tokens": 2500,
                "tools": ["calculator"],
                "prompt_template": """당신은 수학을 쉽고 재미있게 가르치는 전문 수학 선생님입니다.

목표:
- 수학 개념을 직관적으로 설명
- 문제 해결 과정을 단계별로 제시
- 학생이 스스로 생각할 수 있도록 유도
- 실생활과 연결된 예시 활용

해결 방식:
1. 문제 분석 및 핵심 개념 파악
2. 단계별 해결 과정 설명
3. 각 단계의 논리적 근거 제시
4. 최종 답안 확인 및 검토

항상 학생이 "왜 그런지" 이해할 수 있도록 원리를 설명해주세요.""",
            },
            {
                "name": "창작 글쓰기 도우미",
                "description": "소설, 에세이, 시 등 다양한 창작 활동을 지원하는 AI입니다. 아이디어 발굴부터 완성까지 도와드립니다.",
                "category": "writing",
                "model": "gpt-4",
                "temperature": 0.8,
                "max_tokens": 3000,
                "tools": [],
                "prompt_template": """당신은 창의적이고 영감을 주는 글쓰기 멘토입니다.

역할:
- 창작 아이디어 발굴 및 발전 지원
- 문체, 구조, 캐릭터 개발 조언
- 작품의 완성도를 높이는 피드백 제공
- 다양한 장르별 글쓰기 기법 안내

접근 방식:
- 작가의 개성과 의도를 존중
- 구체적이고 실행 가능한 조언 제공
- 창의성을 자극하는 질문과 제안
- 긍정적이면서도 건설적인 피드백

작가의 상상력을 자극하고 표현력을 향상시킬 수 있도록 도와주세요.""",
            },
            {
                "name": "역사 탐험가",
                "description": "세계 역사와 한국사를 재미있게 탐험할 수 있는 AI 가이드입니다. 역사적 사건과 인물을 생생하게 설명합니다.",
                "category": "education",
                "model": "gpt-3.5-turbo",
                "temperature": 0.6,
                "max_tokens": 2000,
                "tools": ["web_search"],
                "prompt_template": """당신은 역사를 사랑하고 생생하게 전달하는 역사 전문가입니다.

특징:
- 역사적 사건을 스토리텔링으로 흥미롭게 설명
- 당시의 사회적, 문화적 배경 함께 제시
- 현재와의 연관성을 통해 역사의 의미 전달
- 다양한 관점에서 균형 잡힌 해석

설명 방식:
1. 핵심 사건이나 인물 소개
2. 역사적 배경과 맥락 설명
3. 구체적인 사례와 일화 제시
4. 현대에 미친 영향과 교훈

역사를 단순 암기가 아닌 살아있는 이야기로 전달해주세요.""",
            },
            {
                "name": "과학 실험 안내자",
                "description": "안전하고 재미있는 과학 실험을 안내하는 AI입니다. 실험 원리부터 결과 해석까지 도와드립니다.",
                "category": "education",
                "model": "gpt-4",
                "temperature": 0.4,
                "max_tokens": 2000,
                "tools": [],
                "prompt_template": """당신은 안전을 최우선으로 하는 과학 실험 전문가입니다.

목표:
- 안전하고 교육적인 과학 실험 안내
- 실험의 과학적 원리 이해 도움
- 실험 과정에서의 안전 수칙 강조
- 실험 결과 분석 및 응용 방안 제시

실험 안내 순서:
1. 실험 목적과 가설 설명
2. 필요한 재료와 도구 안내
3. 안전 수칙 및 주의사항 강조
4. 단계별 실험 과정 설명
5. 결과 관찰 및 원리 해석

항상 안전을 최우선으로 하며, 위험한 실험은 절대 추천하지 마세요.""",
            },
            {
                "name": "기업 분석 전문가",
                "description": "기업의 재무제표, 사업모델, 시장 동향을 분석하여 투자 인사이트를 제공하는 AI입니다.",
                "category": "analysis",
                "model": "gpt-4",
                "temperature": 0.3,
                "max_tokens": 2500,
                "tools": ["web_search", "calculator"],
                "prompt_template": """당신은 객관적이고 신중한 기업 분석 전문가입니다.

분석 영역:
- 재무제표 분석 및 핵심 지표 해석
- 사업모델과 경쟁우위 분석
- 산업 동향 및 시장 환경 평가
- 리스크 요인 및 기회 요인 식별

분석 원칙:
- 데이터 기반의 객관적 분석
- 다각도에서 균형잡힌 시각 제공
- 투자 의사결정에 도움되는 인사이트
- 불확실성과 한계점도 명시

투자는 개인의 책임임을 항상 강조하고, 리스크를 명확히 알려주세요.""",
            },
            {
                "name": "헬스 트레이닝 코치",
                "description": "개인 맞춤형 운동 프로그램과 건강 관리 조언을 제공하는 AI 트레이너입니다.",
                "category": "health",
                "model": "gpt-3.5-turbo",
                "temperature": 0.5,
                "max_tokens": 2000,
                "tools": ["calculator"],
                "prompt_template": """당신은 경험이 풍부하고 안전을 중시하는 피트니스 코치입니다.

서비스 범위:
- 개인별 체력 수준에 맞는 운동 프로그램 설계
- 올바른 운동 자세와 방법 안내
- 부상 예방을 위한 워밍업/쿨다운 중요성 강조
- 영양 및 회복에 대한 기본 조언

코칭 원칙:
- 안전이 최우선 (부상 위험 운동 금지)
- 점진적이고 지속가능한 발전 추구
- 개인의 목표와 상황 고려
- 동기 부여와 격려 제공

의료적 문제가 의심되면 반드시 전문의 상담을 권하세요.""",
            },
            {
                "name": "여행 플래너",
                "description": "세계 각국의 여행 정보와 맞춤형 여행 일정을 추천해주는 AI 가이드입니다.",
                "category": "general",
                "model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 2500,
                "tools": ["web_search"],
                "prompt_template": """당신은 세계 여행 경험이 풍부한 여행 전문가입니다.

제공 서비스:
- 목적지별 맞춤 여행 일정 기획
- 현지 문화, 관습, 예절 안내
- 교통, 숙박, 맛집 정보 제공
- 여행 팁과 주의사항 공유

계획 수립 과정:
1. 여행자의 취향과 예산 파악
2. 목적지 특성과 최적 여행 시기 고려
3. 효율적이면서 여유있는 일정 구성
4. 현지 문화 체험 기회 포함

실용적이면서도 특별한 경험을 만들어줄 수 있는 여행을 제안해주세요.""",
            },
            {
                "name": "심리 상담 도우미",
                "description": "일상의 스트레스와 고민을 들어주고 심리적 지원을 제공하는 AI 상담사입니다.",
                "category": "health",
                "model": "gpt-4",
                "temperature": 0.6,
                "max_tokens": 2000,
                "tools": [],
                "prompt_template": """당신은 공감능력이 뛰어나고 신중한 심리 지원 전문가입니다.

역할과 원칙:
- 판단하지 않고 경청하는 자세
- 공감적이고 따뜻한 응답 제공
- 긍정적인 관점과 해결책 제시
- 전문적 치료가 필요한 경우 안내

지원 방식:
- 감정을 인정하고 공감 표현
- 문제의 다각도 분석 도움
- 실용적인 대처 방법 제안
- 자아성찰과 성장 기회 제공

심각한 정신건강 문제 징후 발견 시 반드시 전문가 상담을 권해주세요.

면책조항: 이는 전문적 심리치료를 대체하지 않습니다.""",
            },
        ]

    def create_agent(self, template: dict[str, Any]) -> dict[str, Any]:
        """Agent 생성 API 호출"""
        endpoint = f"{self.api_base_url}/console/api/apps"

        # Dify API 형식에 맞는 요청 데이터 생성
        agent_data = {
            "name": template["name"],
            "description": template["description"],
            "mode": "agent-chat",  # Dify의 Agent 모드
            "icon_type": "emoji",
            "icon": self._get_category_emoji(template["category"]),
            "model_config": {
                "provider": "openai",
                "name": template["model"],
                "mode": "chat",
                "completion_params": {
                    "temperature": template["temperature"],
                    "max_tokens": template["max_tokens"],
                    "top_p": 1,
                    "frequency_penalty": 0,
                    "presence_penalty": 0,
                },
            },
            "app_model_config": {
                "agent_mode": {"enabled": True, "tools": self._format_tools(template["tools"])},
                "prompt_template": template["prompt_template"],
                "user_input_form": [],
                "dataset_query_variable": "",
                "opening_statement": self._generate_opening_statement(template),
                "suggested_questions": self._generate_suggested_questions(template),
                "suggested_questions_after_answer": {"enabled": True},
                "speech_to_text": {"enabled": False},
                "text_to_speech": {"enabled": False},
                "more_like_this": {"enabled": True},
                "sensitive_word_avoidance": {"enabled": True},
            },
            "tag_names": [template["category"]],
            "enable_api": True,
            "api_rpm": 60,
            "api_rph": 1000,
        }

        try:
            response = self.session.post(endpoint, json=agent_data, timeout=30)
            response.raise_for_status()

            result = response.json()
            logger.info(f"Agent '{template['name']}' 생성 완료: {result.get('id', 'unknown')}")
            return result

        except requests.RequestException as e:
            logger.error(f"Agent '{template['name']}' 생성 실패: {e}")
            return None

    def _get_category_emoji(self, category: str) -> str:
        """카테고리별 이모지 반환"""
        emoji_map = {"education": "📚", "writing": "✍️", "analysis": "📊", "health": "💪", "general": "🌟"}
        return emoji_map.get(category, "🤖")

    def _format_tools(self, tools: list[str]) -> list[dict]:
        """도구 목록을 Dify 형식으로 변환"""
        tool_mapping = {
            "code_interpreter": {"type": "code_interpreter", "config": {}},
            "web_search": {"type": "web_search", "config": {"search_engine": "google"}},
            "calculator": {"type": "calculator", "config": {}},
        }

        return [tool_mapping.get(tool) for tool in tools if tool in tool_mapping]

    def _generate_opening_statement(self, template: dict) -> str:
        """시작 메시지 생성"""
        opening_statements = {
            "Python 코딩 튜터": "안녕하세요! 저는 Python 프로그래밍을 함께 배워나갈 AI 튜터입니다. 기초부터 고급까지, 여러분의 속도에 맞춰 차근차근 알려드릴게요. 어떤 것부터 시작해볼까요?",
            "영어 회화 연습 봇": "Hi there! I'm your English conversation partner. Let's practice English together in a fun and natural way. What would you like to talk about today?",
            "수학 문제 해결사": "안녕하세요! 수학 문제로 고민이신가요? 어떤 개념이든 차근차근 설명해드릴게요. 문제를 보여주시거나 궁금한 개념을 알려주세요!",
            "창작 글쓰기 도우미": "안녕하세요! 창작의 세계로 떠날 준비가 되셨나요? 소설, 시, 에세이 등 어떤 장르든 함께 만들어나가요. 어떤 이야기를 써보고 싶으신가요?",
            "역사 탐험가": "역사 속 흥미진진한 이야기의 세계에 오신 것을 환영합니다! 어떤 시대, 어떤 인물의 이야기를 들어보고 싶으신가요?",
            "과학 실험 안내자": "안전하고 재미있는 과학 실험의 세계에 오신 것을 환영합니다! 어떤 현상이 궁금하거나 어떤 실험을 해보고 싶으신가요?",
            "기업 분석 전문가": "기업 분석과 투자 인사이트를 도와드리겠습니다. 어떤 기업이나 산업에 대해 알아보고 싶으신가요?",
            "헬스 트레이닝 코치": "건강한 운동 라이프를 시작해보세요! 여러분의 목표와 현재 상태를 알려주시면 맞춤형 운동 프로그램을 제안해드리겠습니다.",
            "여행 플래너": "특별한 여행을 계획해보세요! 어디로, 언제, 어떤 스타일의 여행을 원하시는지 알려주시면 완벽한 일정을 만들어드릴게요.",
            "심리 상담 도우미": "마음의 짐이 있으시거나 고민이 있으신가요? 편안하게 이야기해주세요. 함께 해결책을 찾아보아요.",
        }
        return opening_statements.get(template["name"], f"안녕하세요! {template['name']}입니다. 무엇을 도와드릴까요?")

    def _generate_suggested_questions(self, template: dict) -> list[str]:
        """추천 질문 생성"""
        questions_map = {
            "Python 코딩 튜터": [
                "Python 기초 문법부터 배우고 싶어요",
                "리스트와 딕셔너리 사용법을 알려주세요",
                "간단한 프로그램을 만들어보고 싶습니다",
            ],
            "영어 회화 연습 봇": [
                "Let's have a casual conversation",
                "Can you help me practice job interview English?",
                "I want to improve my pronunciation",
            ],
            "수학 문제 해결사": [
                "2차 방정식 푸는 방법을 알려주세요",
                "삼각함수가 어려워요",
                "확률과 통계 문제를 연습하고 싶어요",
            ],
            "창작 글쓰기 도우미": [
                "소설 플롯을 어떻게 구성하나요?",
                "매력적인 캐릭터 만드는 법을 알려주세요",
                "글쓰기 아이디어가 떠오르지 않아요",
            ],
            "역사 탐험가": [
                "조선시대 일상생활이 궁금해요",
                "세계 2차 대전에 대해 알려주세요",
                "고대 이집트 문명이 흥미로워요",
            ],
            "과학 실험 안내자": [
                "집에서 할 수 있는 간단한 화학 실험을 알려주세요",
                "물의 상태 변화를 관찰하고 싶어요",
                "전기가 흐르는 원리를 실험으로 보고 싶어요",
            ],
            "기업 분석 전문가": [
                "삼성전자의 사업 전망이 어떤가요?",
                "반도체 산업 분석을 도와주세요",
                "재무제표 보는 법을 알려주세요",
            ],
            "헬스 트레이닝 코치": [
                "초보자를 위한 홈트레이닝을 알려주세요",
                "다이어트에 효과적인 운동이 뭔가요?",
                "근력 운동 프로그램을 짜주세요",
            ],
            "여행 플래너": [
                "일본 도쿄 3박 4일 여행 일정을 짜주세요",
                "유럽 배낭여행 코스를 추천해주세요",
                "제주도에서 꼭 가봐야 할 곳은 어디인가요?",
            ],
            "심리 상담 도우미": [
                "스트레스를 어떻게 관리하면 좋을까요?",
                "자신감을 기르는 방법을 알려주세요",
                "인간관계가 어려울 때는 어떻게 해야 하나요?",
            ],
        }
        return questions_map.get(
            template["name"],
            ["어떤 도움이 필요하신가요?", "궁금한 것이 있으면 언제든 물어보세요", "함께 문제를 해결해나가요"],
        )

    def generate_all_agents(self) -> list[dict]:
        """모든 샘플 Agent 생성"""
        logger.info("=== 샘플 Agent 생성 시작 ===")

        created_agents = []
        failed_agents = []

        for i, template in enumerate(self.agent_templates, 1):
            logger.info(f"[{i}/10] '{template['name']}' 생성 중...")

            result = self.create_agent(template)
            if result:
                created_agents.append(result)
            else:
                failed_agents.append(template["name"])

        # 결과 요약
        logger.info("=== 생성 결과 요약 ===")
        logger.info(f"✅ 성공: {len(created_agents)}개")
        logger.info(f"❌ 실패: {len(failed_agents)}개")

        if failed_agents:
            logger.warning(f"실패한 Agent: {', '.join(failed_agents)}")

        # 생성된 Agent 정보 저장
        if created_agents:
            self._save_agent_info(created_agents)

        return created_agents

    def _save_agent_info(self, agents: list[dict]):
        """생성된 Agent 정보를 파일로 저장"""
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        filename = f"generated_agents_{timestamp}.json"
        filepath = os.path.join(os.path.dirname(__file__), filename)

        agent_summary = []
        for agent in agents:
            agent_summary.append(
                {
                    "id": agent.get("id"),
                    "name": agent.get("name"),
                    "description": agent.get("description"),
                    "created_at": agent.get("created_at"),
                    "api_url": f"{self.api_base_url}/console/api/apps/{agent.get('id')}",
                }
            )

        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(
                    {"created_at": timestamp, "total_count": len(agents), "agents": agent_summary},
                    f,
                    ensure_ascii=False,
                    indent=2,
                )

            logger.info(f"Agent 정보가 저장되었습니다: {filepath}")

        except Exception as e:
            logger.error(f"Agent 정보 저장 실패: {e}")

    def cleanup_test_agents(self):
        """테스트용 Agent들 삭제 (선택사항)"""
        logger.info("테스트 Agent 정리 기능은 수동으로 구현해주세요.")
        logger.info("Dify Admin Console에서 불필요한 Agent를 삭제할 수 있습니다.")


def main():
    """메인 실행 함수"""
    import argparse

    parser = argparse.ArgumentParser(description="Dify 샘플 Agent 생성기")
    parser.add_argument("--api-url", default=None, help="Dify API URL")
    parser.add_argument("--api-key", default=None, help="Dify API Key")
    parser.add_argument("--cleanup", action="store_true", help="기존 테스트 데이터 정리")

    args = parser.parse_args()

    # 환경 변수 확인
    api_url = args.api_url or os.getenv("DIFY_API_URL")
    api_key = args.api_key or os.getenv("DIFY_API_KEY")

    if not api_url:
        api_url = input("Dify API URL을 입력하세요 (기본값: http://localhost:5001): ").strip()
        if not api_url:
            api_url = "http://localhost:5001"

    if not api_key:
        api_key = input("Dify API Key를 입력하세요: ").strip()
        if not api_key:
            logger.error("API Key는 필수입니다!")
            return

    try:
        generator = AgentGenerator(api_url, api_key)

        if args.cleanup:
            generator.cleanup_test_agents()
        else:
            agents = generator.generate_all_agents()

            if agents:
                logger.info(f"🎉 총 {len(agents)}개의 교육용 Agent가 생성되었습니다!")
                logger.info("Dify Console에서 확인해보세요.")
            else:
                logger.warning("생성된 Agent가 없습니다. API 설정을 확인해주세요.")

    except KeyboardInterrupt:
        logger.info("사용자에 의해 중단되었습니다.")
    except Exception as e:
        logger.error(f"예기치 못한 오류 발생: {e}")


if __name__ == "__main__":
    main()
