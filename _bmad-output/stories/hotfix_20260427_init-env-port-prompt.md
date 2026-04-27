# Hotfix: init-env.sh가 EXPOSE_NGINX_PORT/SSL_PORT를 대화형으로 입력받음

## 목적

운영자가 첫 배포 시 `docker/.env`를 수동 편집해 `EXPOSE_NGINX_PORT`, `EXPOSE_NGINX_SSL_PORT`를 호스트 nginx와 충돌하지 않는 값(보통 8080/8443)으로 변경하는 단계가 deployment-guide 4단계에 있다. 이 단계가:

1. **운영자가 빠뜨릴 수 있다** — 4단계를 놓치고 5단계(`make docker-first-deploy`)로 진행하면 docker nginx가 80/443에 바인딩되어 호스트 nginx와 충돌
2. **init-env.sh 재실행 시 reset된다** — 4월 24일 Rocky hotfix 4차 개정에서 발견된 문제. 두 포트는 init-env.sh의 백업 키 13개 목록에 없어 매번 `.env.example` 기본값(80/443)으로 덮어씌워짐

이전 hotfix(`makefile-first-deploy-target`)는 `docker-up`/`docker-build`에서 `init-docker-env` 의존성을 제거해 일상 운영 시 reset 부작용을 회피했지만, 의도적으로 `init-docker-env`가 호출되는 경로(`docker-first-deploy`, `docker-build-no-cache`, 운영자가 명시적으로 `make init-docker-env` 실행)에서는 여전히 reset된다.

근본 해결: init-env.sh에서 두 포트를 **대화형으로 입력받아** 운영자 의도를 명시적으로 확보한다.

## 수정 범위 (Lightweight)

2개 파일 수정.

### docker/init-env.sh
- `.env` 동기화 단계 직후, SECRET_KEY 생성 단계 직전에 **두 포트 대화형 입력 블록 신규 추가**
- 동작:
  - 두 포트 각각에 대해 운영자에게 입력 요청 (`read -r` 사용)
  - **항상 물음** (`.env` 신규/기존 무관 — 사용자 결정)
  - **default 표시는 항상 80 / 443** (사용자 결정 — 권장값 표시 없음)
  - 빈 입력 → default(80/443) 적용
  - 비숫자 또는 1~65535 범위 외 입력 → 안내 메시지 + 재입력 요청 (loop)
  - 결정된 값을 macOS/Linux 공통 sed 패턴으로 `docker/.env`에 반영 (다른 13개 백업 키와 동일 패턴)
- **무인 배포 호환성은 고려하지 않음** (사용자 결정 — tty 검사 등 비대화형 분기 없음)

### docs/deployment-guide.md
- 4단계 `.env` 카탈로그에서 `EXPOSE_NGINX_PORT` / `EXPOSE_NGINX_SSL_PORT` 항목에 "init-docker-env 실행 시 대화형으로 묻습니다 (빈 입력은 default 80/443)" 한 줄 안내 추가
- 5단계(`docker-first-deploy`) 박스 또는 인접한 곳에 대화형 프롬프트 동작 예시 한 줄 추가 (운영자가 5단계 진행 중 무엇을 보게 될지 미리 알림)
- 4단계의 "포트 수정 누락 시" 트러블슈팅 블록은 유효성 유지 — 새 대화형 입력은 보완 메커니즘이지 기존 안내를 대체하지 않음

## AC

### docker/init-env.sh
- [ ] `.env` 동기화 직후 + SECRET_KEY 생성 직전 위치에 두 포트 대화형 입력 블록이 추가됨
- [ ] 두 포트 각각에 대해 `read -r` 기반 입력 요청. 프롬프트 형식: `Enter EXPOSE_NGINX_PORT (default 80):` / `Enter EXPOSE_NGINX_SSL_PORT (default 443):`
- [ ] `.env` 신규 생성 시에도 기존 `.env`가 있을 때도 **항상 입력 요청**
- [ ] **default 표시는 항상 80 / 443** (현재 `.env` 값을 default로 표시하지 않음 — 사용자 결정)
- [ ] 빈 입력 시 default(80/443) 적용
- [ ] 비숫자 입력 시 `❌ 숫자만 입력 가능합니다. 다시 입력하세요.` 안내 후 재입력 (loop). 1~65535 범위 외도 동일
- [ ] 검증 통과한 값을 macOS/Linux 공통 sed 패턴(다른 13개 백업 키와 동일 분기)으로 `docker/.env`의 `EXPOSE_NGINX_PORT=`, `EXPOSE_NGINX_SSL_PORT=` 행에 반영
- [ ] tty 검사(`[ -t 0 ]`) 또는 무인 배포용 환경 변수/플래그 **없음** (사용자 결정)
- [ ] 입력 블록 전후로 시각적 구분(echo 빈 줄 + 안내 헤더 한 줄) 추가 — 다른 init-env.sh 단계 출력과 일관

### docs/deployment-guide.md
- [ ] 4단계 `.env` 카탈로그의 `EXPOSE_NGINX_PORT` / `EXPOSE_NGINX_SSL_PORT` 설명에 "`make init-docker-env` 또는 `make docker-first-deploy` 실행 시 대화형으로 묻습니다. 빈 입력은 default 80/443" 한 줄 안내
- [ ] 5단계(`docker-first-deploy`) 박스 또는 인접 위치에 대화형 프롬프트 예시 노출 (운영자가 무엇을 보게 될지 미리 알림)
- [ ] 4단계 "포트 수정 누락 시 / init-env.sh 동기화 주의" 기존 트러블슈팅/경고 블록은 그대로 유지 (이번 변경은 보완)
- [ ] 변경 이력에 2026-04-27 항목 추가

### 공통
- [ ] 다른 docker target(`docker-down`, `docker-restart`, `docker-clean`, `docker-prune`, `deploy-*`)은 절대 건드리지 말 것
- [ ] 다른 init-env.sh 단계(13개 백업 키 복원, SECRET_KEY 생성, API_KEY 생성, 관리자 계정 처리 등)는 변경 없음
- [ ] `make -n docker-first-deploy` dry-run에서 init-env.sh 호출 흐름은 유지 (Makefile 변경 없음)
- [ ] init-env.sh를 수동 실행해 두 포트 프롬프트가 실제로 표시되고 빈 입력/숫자 입력/비숫자 입력 3가지 케이스가 의도대로 동작
- [ ] Lint: 해당 없음 (bash + docs)
- [ ] 자동 회귀 테스트: 해당 없음 (Lightweight, bash 대화형 입력 자동 테스트 부적합)

## User Briefing

### 확인 방법

1. `bash docker/init-env.sh`를 직접 실행 — `.env` 동기화 직후 두 포트 프롬프트가 순서대로 나타남
2. 빈 입력 시나리오: 그냥 Enter → default 80/443이 적용되고 다음 단계 진행
3. 숫자 입력 시나리오: `8080` 입력 → 그대로 적용. `docker/.env`에서 `EXPOSE_NGINX_PORT=8080` 확인
4. 비숫자 시나리오: `abc` 입력 → 안내 메시지 + 재입력 요청
5. `make docker-first-deploy` 흐름에서 자연스럽게 프롬프트가 노출됨 (init-docker-env가 처음 단계로 호출됨)

### 알려진 제약

- **무인 배포 환경에서는 init-docker-env가 멈춥니다** (사용자 결정 — 무인 배포 고려 사항 아님). CI/CD에서 사용 시에는 별도 입력 자동화 필요 (`echo "8080\n8443" | make docker-first-deploy` 같은 회피책)
- **재실행 시에도 default가 항상 80/443입니다** (사용자 결정). 운영자가 8080/8443으로 운영 중인 환경에서 init-docker-env를 재실행하고 빈 입력을 하면 포트가 80/443으로 reset됩니다 → 운영자가 매번 명시적으로 8080/8443을 입력해야 보존됨. 운영 중 nginx 재기동은 `docker-compose restart nginx` 또는 `docker-compose up -d nginx`로 init-docker-env를 우회하는 것이 안전 (이전 hotfix가 docker-up/build에서 의존성 제거해둔 것도 같은 맥락)
- 두 포트 외 다른 운영자 수정 키(예: `LMS_*`, OAuth 클라이언트 ID 등)는 여전히 백업 대상 아님. 추가 키가 필요하면 별도 hotfix
- 입력 검증은 숫자 + 1~65535 범위만 (포트 충돌, 권한 검증, 사용 중 검증 등은 운영자 책임)

## Dev Agent Record

### 구현 요약

**변경 파일 2개 (총 +58 라인, -0 라인)**

1. **`docker/init-env.sh`** (+46 라인) — 동기화/생성 분기 직후(line 112), SECRET_KEY 분기(현 line 159) 직전에 두 포트 대화형 입력 블록 신규 추가 (`# 2-1. 호스트 nginx 포트 설정 (대화형)` 섹션, line 113~158).
   - `prompt_port` 헬퍼 함수: `read -r` + 정규식 `^[0-9]+$` + 1~65535 range 검증 + 검증 실패 시 `${RED}❌ 1~65535 범위의 숫자만 입력 가능합니다. 다시 입력하세요.${NC}` 안내 후 `while true` 재입력
   - 빈 입력 → default(80/443) 적용
   - sed 치환은 macOS/Linux 분기 (다른 13개 백업 키와 동일 패턴). `grep -q "^${KEY_NAME}=" docker/.env`로 라인 존재 여부 분기 → 없으면 append (안전)
   - 입력 블록 전후 시각적 구분: 안내 헤더(`🌐 호스트 포트 설정 ...`) + 빈 줄 + 결과 echo(`✅ EXPOSE_NGINX_PORT=X, EXPOSE_NGINX_SSL_PORT=Y 적용`)
   - 두 분기(신규/동기화) 외부에 위치 → `.env` 신규/기존 무관 항상 실행
   - 다른 단계(13개 백업 키 복원, SECRET_KEY/DB_PASSWORD/REDIS_PASSWORD/SANDBOX_API_KEY/PLUGIN_DAEMON_KEY/PLUGIN_DIFY_INNER_API_KEY/ELASTICSEARCH_PASSWORD/API_KEY_ENCRYPTION_KEY 생성, 관리자 계정 처리, 색상 변수) 모두 무변경

2. **`docs/deployment-guide.md`** (+12 라인) — 3개 위치 수정:
   - **4단계 카탈로그 (line 245)**: `EXPOSE_NGINX_PORT`/`EXPOSE_NGINX_SSL_PORT` 표 직후에 `> 💡 두 포트는 make init-docker-env 또는 make docker-first-deploy 실행 시 대화형으로 묻습니다. 빈 입력은 default 80/443. ...` 박스 추가
   - **5단계 "이때 일어나는 일" (line 285)**: 관리자 계정 입력 박스 직전에 "호스트 포트 대화형 입력" 박스 추가 (프롬프트 예시 + 빈 입력/검증 동작 + 운영 환경 권고)
   - **변경 이력 (line 971)**: 2026-04-27 항목 신규 추가
   - **4단계 "포트 수정 누락 시" 트러블슈팅 블록(line 341)은 그대로 유지** — 보완 메커니즘으로 명시

### 품질 검사

#### 검증 6개 항목 결과 (모두 PASS)

1. **빈 입력 시나리오** (`printf "\n\n..." | bash docker/init-env.sh`):
   - 출력: `✅ EXPOSE_NGINX_PORT=80, EXPOSE_NGINX_SSL_PORT=443 적용`
   - `.env`: `EXPOSE_NGINX_PORT=80` / `EXPOSE_NGINX_SSL_PORT=443` 확인 ✅

2. **숫자 입력 시나리오** (`printf "8080\n8443\n..."`):
   - 출력: `✅ EXPOSE_NGINX_PORT=8080, EXPOSE_NGINX_SSL_PORT=8443 적용`
   - `.env`: `EXPOSE_NGINX_PORT=8080` / `EXPOSE_NGINX_SSL_PORT=8443` 확인 ✅

3. **비숫자 입력 시나리오** (`printf "abc\n80\n443\n..."`):
   - 출력: `❌ 1~65535 범위의 숫자만 입력 가능합니다. 다시 입력하세요.` → `✅ EXPOSE_NGINX_PORT=80, EXPOSE_NGINX_SSL_PORT=443 적용`
   - 재입력 안내 후 정상 적용 확인 ✅

4. **range 외 입력 시나리오** (`printf "70000\n80\n443\n..."`):
   - 출력: `❌ 1~65535 범위의 숫자만 입력 가능합니다. 다시 입력하세요.` → `✅ EXPOSE_NGINX_PORT=80, EXPOSE_NGINX_SSL_PORT=443 적용`
   - range 검증 정상 동작 확인 ✅

5. **Makefile 흐름 검증** (`make -n docker-first-deploy`):
   - `./docker/init-env.sh` 호출 라인 그대로 출력됨 → Makefile 변경 없음 ✅

6. **다른 단계 무손상 검증** (`git diff docker/init-env.sh`):
   - `+46 -0` 한 블록만 추가, 13개 백업 키/SECRET_KEY/API_KEY/관리자 계정 처리 모두 무변경 확인 ✅

#### 기타
- **Lint**: 해당 없음 (bash + docs)
- **자동 테스트**: 해당 없음 (Lightweight, bash 대화형 입력)

### User Briefing

**실행 방법**:
- `make docker-first-deploy` (첫 배포) 또는 `bash docker/init-env.sh` (수동 실행) 시 `.env` 동기화/생성 직후, SECRET_KEY 생성 직전에 두 포트 프롬프트가 순서대로 등장합니다.
- 프롬프트 형식: `Enter EXPOSE_NGINX_PORT (default 80): ` / `Enter EXPOSE_NGINX_SSL_PORT (default 443): `
- 운영 환경에서는 `8080` / `8443` 입력 권장 (호스트 nginx 충돌 회피)
- 빈 입력 → default 80/443 적용 / 비숫자·범위 외 입력 → 재입력 요청

**AC별 구현 요약**:
- `docker/init-env.sh`: 두 포트 대화형 입력 블록(prompt_port 헬퍼 + while loop + sed 치환)이 동기화 분기 외부에 추가되어, `.env` 신규/기존 무관 항상 실행. 빈 입력은 80/443, 비숫자/range 외는 재입력. 검증 4개 케이스 모두 PASS
- `docs/deployment-guide.md`: 4단계 표 직후 안내 박스, 5단계 "이때 일어나는 일"에 프롬프트 예시 박스, 변경 이력에 2026-04-27 항목 추가. 기존 "포트 수정 누락 시" 트러블슈팅 블록은 보완 메커니즘으로 그대로 유지

### 이슈 기록

없음.

### 2차 개정 (HOTFIX_USER_FIX) — 2026-04-27

- **사용자 피드백**: Makefile 3군데(`docker-first-deploy`/`docker-up`/`docker-build-no-cache`)의 Access 안내가 운영자가 `init-env.sh`에서 입력한 `EXPOSE_NGINX_PORT`를 반영하지 않음. 8080을 입력해도 `http://localhost`로만 안내되어 운영자가 헷갈림.
- **변경**: Makefile의 `docker-first-deploy` (line 36-48), `docker-up` (line 56-67), `docker-build-no-cache` (line 91-107) 안내 블록을 옵션 A(80은 `:port` 생략, 그 외는 `:port` 표시) 동적 패턴으로 교체. 한 shell 명령 내에서 line continuation(`\`)으로 PORT/SUFFIX 변수 공유. `.env` 없거나 빈 값이면 fallback 80. `docker-build-no-cache`에는 기존에 빠져 있던 `Access API` 한 줄도 추가 (다른 두 target과 일관).
- **변경 파일**: `Makefile` 1개 (3개 블록 동일 패턴, 약 +18 / -3 라인)
- **다른 파일 무변경**: `docker/init-env.sh` 무변경 (1차 구현 보존). `docs/deployment-guide.md` 무변경 (출력 예시 박스 grep 결과 0건 — 손댈 곳 없음 확인).

#### 검증 결과 (4 케이스 모두 PASS)

`sh -c '...옵션 A 블록...'` 단독 추출 방식으로 echo 블록만 실행해 검증 (docker-compose 호출 회피):

1. **`.env` 파일 없음 (fallback)**: `Access MAI: http://localhost` / `Access API: http://localhost/v1` ✅
2. **`EXPOSE_NGINX_PORT=80`**: `Access MAI: http://localhost` / `Access API: http://localhost/v1` (suffix 생략) ✅
3. **`EXPOSE_NGINX_PORT=8080`**: `Access MAI: http://localhost:8080` / `Access API: http://localhost:8080/v1` ✅
4. **`EXPOSE_NGINX_PORT=` (빈 값)**: `Access MAI: http://localhost` / `Access API: http://localhost/v1` (80 fallback) ✅

추가 확인:
- **3개 target 일관성**: `grep -B 1 -A 6 "Access MAI" Makefile` → 3군데 모두 동일 5줄 패턴 ✅
- **make dry-run**: `make -n docker-up` → PORT/SUFFIX 변수가 한 shell command 내에서 공유됨 (line continuation 정상) ✅
- **`docker/.env` 무손상**: 검증 전후 `diff` 결과 변경 없음 ✅

#### 이슈

없음.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-27 14:16
- Approved (2차) — 사용자 직접 검증. Makefile 3군데 옵션 A 패턴 + docker-build-no-cache Access API 추가 모두 수용. sanity check도 정상 (현재 .env=8080에서 :8080 표시 확인).


### HOTFIX_USER_FIX — 2026-04-27 14:02
- Makefile 3군데(docker-first-deploy/docker-up/docker-build-no-cache)에 옵션 A 패턴(80 생략, 그 외 :port) 일관 적용. docker-build-no-cache에 Access API 한 줄 추가. 검증 4 케이스(80/8080/빈 값/.env 없음) 모두 PASS. docs 영향 없음 확인.


### HOTFIX_USER_VERIFY — 2026-04-27 13:59
- CR — 사용자 피드백: Makefile 3군데(docker-first-deploy/docker-up/docker-build-no-cache)의 Access MAI/API 안내가 운영자 입력 포트를 반영하지 않음. 옵션 A(80은 생략, 그 외 :port 표시) + docker-build-no-cache에 Access API 추가 합의.


### HOTFIX_IMPL — 2026-04-27 13:38
- 2개 파일 수정 + Dev Agent Record 작성. init-env.sh line 115-157에 prompt_port 헬퍼 + 두 포트 호출 + 적용 안내 추가. 검증 6/6 PASS (빈 입력 / 8080·8443 / 비숫자 / range 외 / Makefile 호출 흐름 유지 / 다른 단계 무손상). 이슈 없음.


### BUG_TRIAGE — 2026-04-27 13:32
- P1, Lightweight. 사용자 결정 5건 합의: 무인 배포 미고려 / 항상 물음 / default 80·443만 표시 / 숫자 검증만 / Lightweight. 2개 파일 수정.

<!-- 리더가 상태 전환마다 추가 -->
