# Hotfix: yahoo_finance_analytics 도구에 분기별 재무 데이터 추가

## 증상
사용자가 "주식분석가" 에이전트(gpt-5-mini + yahoo_finance_{ticker,analytics,news})에서 "최근 4개 분기 매출·EPS를 표로 그려줘"와 같이 분기별 재무 데이터를 요청하면, 에이전트가 **"진행할까요?" 재확인 질문을 반복**하면서 실제 작업을 수행하지 못하는 루프에 빠짐 (사용자 대화 로그상 5회 이상 반복, 토큰 38K까지 누적).

- 재현: `/agents/{id}/chat` 에서 해당 에이전트와 대화 시, "최근 4개 분기 매출 EPS 표" 요구 후 "진행해" 응답 → 에이전트가 "K-IFRS 연결 기준으로 가져올까요?", "IR/DART에서 직접 조회할까요?" 등 확인 반복, 실제 표 미제공
- 모델이 내부적으로 "현재 호출한 Yahoo Finance API 응답에는 분기별 손익(매출·EPS) 세부 수치가 포함되어 있지 않습니다"라고 명시 → 도구 반환 범위의 한계를 모델이 정확히 인식

## 원인 (확정)
현재 플랫폼이 제공하는 Yahoo Finance 도구 3종이 **분기별 재무 데이터를 반환하지 않음**:

| 도구 | 현재 반환 | 분기 재무 |
|------|----------|----------|
| `yahoo_finance_ticker` | `Ticker(sym).info` (TTM/연간 스냅샷 flat dict) | 없음 |
| `yahoo_finance_analytics` | `yfinance.download(sym)` (OHLCV 가격 히스토리 기간 통계) | 없음 |
| `yahoo_finance_news` | 뉴스 리스트 | 해당 없음 |

`api/core/tools/builtin_tool/providers/yahoo/tools/analytics.py`는 이름은 "analytics"이나 실구현은 **주가·거래량 통계만 제공**. 반면 yfinance 라이브러리의 `Ticker(sym).quarterly_income_stmt`, `Ticker(sym).earnings_dates`는 한국 주식(`005930.KS`)에 대해서도 최근 6분기의 Total Revenue / Operating Income / Net Income / Basic EPS / Diluted EPS 및 분기별 EPS 컨센서스 추정치를 **정상적으로 반환함**(API 컨테이너에서 실측으로 확인). 즉 라이브러리가 데이터를 제공할 수 있는데 **도구 코드가 호출하지 않음**.

모델은 도구 응답에 해당 데이터가 없음을 인식하고 외부 출처(DART/IR)를 제안하지만, 그런 도구는 실제로 존재하지 않아 결국 사용자 확인 루프로 귀결.

## 수정 범위
- `api/core/tools/builtin_tool/providers/yahoo/tools/analytics.py`
  - 기존 가격 통계 로직 유지
  - `Ticker(sym).quarterly_income_stmt` 호출 → 최근 4분기(또는 가용 최대치 ≤4)의 **Total Revenue / Operating Income / Net Income / Basic EPS / Diluted EPS** 추출
  - `Ticker(sym).earnings_dates` 호출 → **과거 4분기 실적 EPS + 가장 가까운 미래 분기 EPS 컨센서스** 추출
  - NaN은 제외(또는 `null`), 날짜는 ISO `YYYY-MM-DD`, 금액은 float (KRW 원 단위 그대로)
  - 예외 처리: DataFrame 비어 있으면 해당 키 생략 + 경고성 필드 없이 조용히 빠짐. HTTPError/ReadTimeout은 기존과 동일 메시지
  - JSON 응답 구조 (예시):
    ```json
    {
      "analytics": [ ... 기존 가격 통계 ... ],
      "quarterly_financials": [
        {"period_end": "2025-12-31", "total_revenue": ..., "operating_income": ..., "net_income": ..., "basic_eps": ..., "diluted_eps": ...},
        ...
      ],
      "earnings_history_and_estimates": {
        "reported": [{"earnings_date": "2026-01-28", "reported_eps": 2909.0, "eps_estimate": 2325.47, "surprise_pct": 25.09}, ...],
        "upcoming": [{"earnings_date": "2026-04-29", "eps_estimate": 5088.89}]
      }
    }
    ```
- `api/core/tools/builtin_tool/providers/yahoo/tools/analytics.yaml`
  - `description.llm`에 "주가 통계 + 최근 4분기 연결 재무(매출, 영업이익, 순이익, 기본/희석 EPS) + 다음 분기 EPS 컨센서스"를 명시 → 모델이 이 도구로 분기 재무를 얻을 수 있음을 인지하게
  - (선택) `include_financials` 파라미터를 두어 on/off 제어 — 단, 기본 `true`가 되어 기존 에이전트들이 재구성 없이 혜택을 받게 함. 파라미터 추가가 복잡하다면 무조건 포함이어도 OK — Dev 판단
- 테스트: `api/tests/unit_tests/core/tools/builtin_tool/providers/yahoo/` (경로 부재 시 신규 생성)
  - yfinance `Ticker`를 모킹하여 `quarterly_income_stmt`, `earnings_dates` 반환 검증
  - `download`도 모킹하여 기존 가격 통계 필드 유지 검증 (회귀 가드)
  - NaN 포함 케이스, 빈 DataFrame 케이스
  - symbol 누락/오류 케이스

## AC (Acceptance Criteria)
- [ ] `yahoo_finance_analytics` 응답에 `quarterly_financials` (최근 ≤4분기) 및 `earnings_history_and_estimates` 섹션 포함
- [ ] 각 분기 항목에 `period_end`, `total_revenue`, `operating_income`, `net_income`, `basic_eps`, `diluted_eps` 키 존재 (있는 값만, NaN은 제외하거나 null)
- [ ] `earnings_history_and_estimates.upcoming`에 가장 가까운 미래 분기 1건 이상 포함 (컨센서스 EPS 제공 시)
- [ ] **기존 `analytics` 키(가격 통계)는 구조·값 그대로 유지** — 회귀 없음
- [ ] yfinance 호출 실패 시 (HTTPError/ReadTimeout) 기존과 동일한 에러 메시지 반환
- [ ] `analytics.yaml`의 `description.llm` 에 분기 재무 포함 여부가 명시되어 모델이 이 도구로 분기 재무를 가져올 수 있음을 알 수 있음
- [ ] 단위 테스트 추가 — yfinance 모킹으로 최소 4건(정상 / NaN 포함 / 빈 DataFrame / 호출 실패)
- [ ] scoped lint(`make lint` 관련 파일만) / type-check(`make type-check` 관련 파일만) / pytest 통과

## User Briefing
### 확인 방법
1. `make deploy-api` 로 API 재배포 (web-edu가 아닌 api 변경이므로)
2. 브라우저에서 "주식분석가" 에이전트 접속, **새 대화 생성**
3. "삼성전자 최근 4개 분기 매출과 EPS를 표로 그려줘" 또는 유사 질문
4. 에이전트가 재확인 질문 없이 실제 분기 데이터(매출/영업이익/순이익/EPS)를 표로 제공하는지 확인
5. 다음 분기 EPS 컨센서스 추정치도 함께 언급되는지 확인

### 알려진 제약사항
- yfinance의 분기 데이터는 Yahoo Finance 의존 — 일부 종목·분기에서 NaN(아직 미공시)일 수 있음. 이 경우 해당 분기는 응답에서 제외 또는 null. 사용자 측에서 "공시 미발표"로 자연스럽게 해석됨.
- 한국 주식(KS/KQ)의 경우 분기 재무가 Yahoo에 올라오는 데 약간의 지연(수일~수주)이 있을 수 있음. 실시간 공시(DART 수준)는 아님.
- EPS 단위는 원(KRW). 미국 주식은 USD. 모델이 상황에 맞게 표시.

## Dev Agent Record

### 수정/신규 파일

| 파일 | 상태 | 변경 요약 | 주요 라인 |
|------|------|-----------|-----------|
| `api/core/tools/builtin_tool/providers/yahoo/tools/analytics.py` | 수정 | `yfinance.Ticker`로 분기 재무/실적 데이터 추출하는 헬퍼 2개(`_extract_quarterly_financials`, `_extract_earnings_history_and_estimates`) 추가. 응답 JSON에 `quarterly_financials`, `earnings_history_and_estimates` 키 선택적 포함. 기존 가격 통계(`analytics` 키)는 100% 보존. | 1–20 (상수/임포트), 88–137 (`run` 확장), 140–259 (헬퍼 함수들) |
| `api/core/tools/builtin_tool/providers/yahoo/tools/analytics.yaml` | 수정 | `description.llm`/`description.human` 전 언어(en_US/pt_BR/zh_Hans/ko_KR) 갱신 — 분기 재무 + EPS 컨센서스 포함 명시. 모델이 이 도구로 분기 재무를 얻을 수 있음을 학습하도록. | 2–8 |
| `api/tests/unit_tests/core/tools/builtin_tool/providers/yahoo/test_analytics.py` | 신규 | yfinance 완전 모킹 기반 단위 테스트 4건. 상위 `__init__.py` 3개 함께 생성(패키지 인식용). | 전체 |

### 근본 원인 요약

`yahoo_finance_analytics` 도구는 이름과 달리 `yfinance.download()`(주가 OHLCV)만 호출해 분기 재무를 반환하지 않았음. 모델이 응답 범위의 한계를 인식하고 DART/IR 같은 존재하지 않는 대체 도구를 반복 제안 → 사용자 확인 루프 발생. 해결: 같은 도구가 `Ticker(sym).quarterly_income_stmt` + `Ticker(sym).earnings_dates`도 함께 호출해 **가격·재무·EPS 컨센서스**를 한 번에 제공하도록 확장.

### 구현 요점

- **yfinance 호출 방식**: 기존 `download()` 호출은 그대로 두고, 추가로 `Ticker(symbol)` 인스턴스를 만들어 `quarterly_income_stmt`(row=line item, col=분기 Timestamp)와 `earnings_dates`(index=Earnings Date, col=EPS Estimate/Reported EPS/Surprise(%))에 접근.
- **분기 선택 로직**: `quarterly_income_stmt.columns`를 내림차순 정렬하여 **최신 4분기**만 추출. 각 분기별로 Total Revenue(없으면 Operating Revenue fallback), Operating Income(Total Operating Income As Reported fallback), Net Income(Net Income Common Stockholders fallback), Basic EPS, Diluted EPS를 뽑음.
- **NaN/예외 처리 방침**: NaN 셀은 `pd.isna`로 감지해 해당 필드만 **제외**(키 자체 생략) — 프론트에서 "공시 미발표"로 자연 해석. `Ticker.quarterly_income_stmt`/`earnings_dates` 접근 시 어떤 예외든(HTTPError/AttributeError/일반 Exception) 해당 **섹션만** 조용히 스킵. 가격 통계 `analytics`는 항상 반환.
- **earnings 분기 로직**: `earnings_dates`의 각 행을 오늘 기준으로 과거/미래 분리. 과거는 `reported_eps` not NaN만 최신순 상위 4건, 미래는 `eps_estimate` not NaN만 가까운순 상위 3건.
- **응답 JSON 예시**(happy path):
  ```json
  {
    "analytics": [{"Start Date": "2026-01-01", "End Date": "2026-01-05", "Average Close": 11.5, ...}],
    "quarterly_financials": [
      {"period_end": "2025-12-31", "total_revenue": 80000000000000.0, "operating_income": 2500000000000.0, "net_income": 2000000000000.0, "basic_eps": 2909.0, "diluted_eps": 2850.0},
      {"period_end": "2025-09-30", ...}, {"period_end": "2025-06-30", ...}, {"period_end": "2025-03-31", ...}
    ],
    "earnings_history_and_estimates": {
      "reported": [{"earnings_date": "2026-04-16", "reported_eps": 2909.0, "eps_estimate": 2325.47, "surprise_pct": 25.09}, ...],
      "upcoming": [{"earnings_date": "2026-05-02", "eps_estimate": 5088.89}]
    }
  }
  ```

### 품질 검사 결과

| 검사 | 범위 | 결과 |
|------|------|------|
| `ruff format --check` | `analytics.py`, `test_analytics.py` | 2 files already formatted |
| `ruff check` | `analytics.py`, `tests/.../yahoo/` | 0 errors (FURB118 × 2, I001 × 1 해결됨) |
| `pytest -v` | `tests/unit_tests/core/tools/builtin_tool/providers/yahoo/` | 4 passed (5.85s) |
| `basedpyright` (scoped) | `analytics.py`, `test_analytics.py` | 0 errors, 0 warnings, 0 notes |

### Regression test 판단 근거

네 개의 케이스가 각각 다른 **실패 모드**를 가드:

1. **정상 케이스** — `analytics`/`quarterly_financials`/`earnings_history_and_estimates` 세 키가 모두 존재하고, 각 분기값이 인덱스 순서대로 정확히 매핑됨을 단언. 특히 `analytics` 키의 기존 `Average Close`/`Start Date` 필드 존재를 검증하여 **가격 통계 회귀 방지**.
2. **NaN 혼합** — 일부 셀 NaN → 해당 키 **생략**(None으로 남기지 않음) 명시 검증. 프론트에서 undefined로 안전하게 표시되는 경로.
3. **빈 DataFrame** — `quarterly_income_stmt` empty이면 `quarterly_financials` 키 자체가 응답에 없어야 하고, `analytics`는 반드시 반환. "부분 데이터 가용" 시나리오 보호.
4. **earnings_dates 예외** — `@property`에서 RuntimeError raise로 실제 yfinance에서 발생 가능한 transient 에러 시뮬레이션. 해당 섹션만 빠지고 `analytics` + `quarterly_financials`는 정상 반환. 전체 응답 실패 방지.

모킹은 `unittest.mock.patch`로 `_ANALYTICS_PATH.download`와 `_ANALYTICS_PATH.Ticker`를 직접 치환 — **네트워크 호출 0건**. `Ticker.earnings_dates` 예외 케이스는 `type(mock).earnings_dates = property(...)` 트릭으로 속성 접근 자체를 예외로 만들어 실제 yfinance 오동작 재현.

### User Briefing

**확인 시나리오 (새 대화에서 재현):**

1. `make deploy-api` 로 API 재배포 (web-edu 변경 없음)
2. 브라우저에서 "주식분석가" 에이전트 접속 → **새 대화 생성** (기존 대화 컨텍스트 유지 시 캐시된 응답 영향 가능)
3. 입력: `"삼성전자 최근 4개 분기 매출과 EPS를 표로 그려줘"` 또는 `"005930.KS 분기 재무 보여줘"`
4. 기대 결과:
   - 에이전트가 "IR에서 가져올까요?"/"DART에서 조회할까요?" 같은 확인 질문 없이 **바로 표 제공**
   - 표에 `period_end`, 매출(원 단위), 영업이익, 순이익, 기본 EPS, 희석 EPS가 최대 4분기 포함
   - 다음 분기 EPS 컨센서스 추정치 언급 (예: "2026-04-29 예정 분기 EPS 컨센서스: 5,088.89원")
5. 실패 시 확인 포인트:
   - `docker logs docker-api-1 | grep yahoo` 로그에서 yfinance 호출 에러 확인
   - Yahoo Finance 자체가 해당 종목 분기 데이터를 아직 게시 안 했을 수 있음 → 미국 주식(AAPL)으로 교차 검증

**알려진 제약:**
- yfinance는 Yahoo Finance 의존 — 한국 주식은 분기 재무 공시 반영에 수일~수주 지연 가능. 실시간 공시(DART 수준) 아님.
- EPS 단위: 한국 주식은 KRW, 미국 주식은 USD. 모델이 문맥상 단위를 표기.
- 일부 라인 아이템(특히 Operating Income)은 yfinance 라벨 차이로 NaN이 될 수 있음 → 해당 필드만 응답에서 제외되어 모델이 "해당 분기 영업이익 미공시"로 자연스럽게 해석.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-17 14:55
- Approved — make deploy-api 재배포 후 에이전트 대화 검증 통과


### BUG_TRIAGE — 2026-04-17
- P1, Lightweight 경로 선택, API 컨테이너에서 yfinance 분기 데이터 가용성 검증 완료, 스토리 작성 완료

### HOTFIX_IMPL — 2026-04-17 14:38
- done — ruff PASS (scoped), pytest 4/4 PASS, regression test 4건 추가
