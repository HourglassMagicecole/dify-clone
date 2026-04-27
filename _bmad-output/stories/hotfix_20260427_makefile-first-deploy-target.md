# Hotfix: Makefile docker target 정리 + docker-first-deploy alias 추가

## 목적

배포 가이드 보강 과정에서 Makefile의 docker target 이름과 의존성이 운영자에게 혼란/부작용을 만든다는 문제가 드러났다. 핵심 이슈 3가지:

1. **이름이 의도를 가린다**: `docker-up`은 첫 배포에도 이미지 자동 빌드를 수행해 사실상 "첫 배포 + 일반 시작" 두 역할을 겸한다. 새 운영자는 "처음 배포는 build해야 하지 않나?"라는 직관으로 `docker-build`를 호출하기 쉽다.
2. **`init-docker-env` 의존성 부작용**: `docker-up`/`docker-build` 실행마다 `init-docker-env`가 `.env`를 `.env.example` 기준으로 부분 덮어쓰기 한다 (백업 대상은 보안/관리자 13개 키 한정). `EXPOSE_NGINX_PORT` 같은 운영자 수정 키는 매번 reset되어 4월 24일 Rocky hotfix 4차 개정에서 발견된 장애 재현됨.
3. **`docker-rebuild` 이름이 모호**: "rebuild"가 캐시 사용 여부를 명시하지 않아 `docker-build`와의 차이가 운영자에게 불분명.

## 수정 범위 (Lightweight)

5개 파일 수정. **코드 로직 변경 없음** — Makefile target alias rename + 의존성 정리 + docs 동기화.

### Makefile
- `docker-first-deploy` 신규 target 추가 (init-docker-env + docker-compose up -d)
- `docker-up`, `docker-build`에서 `init-docker-env` 의존성 제거
- `docker-rebuild` → `docker-build-no-cache` 이름 변경 (동작 동일 유지)
- `docker-clean-all`에 `docker builder prune -af` 추가 (builder cache까지 정리)
- `docker-clean-all` 안내 문구(line 149-150) 갱신: `docker-first-deploy` 권장, `docker-build-no-cache`는 보조
- help 섹션(line 327) 갱신
- `.PHONY` (line 348) 갱신

### docs/deployment-guide.md
- 5단계(Docker 스택 기동) 보강: `make docker-first-deploy` 권장 + docker-up/docker-build/docker-first-deploy/docker-build-no-cache 4개 명령 차이 표
- 운영 노트 추가: Dify 업스트림 머지 또는 `docker/.env.example` 갱신 후에는 `make init-docker-env`를 별도 실행해 새 환경변수를 동기화
- line 263-266 `docker-rebuild` 본문 언급 → `docker-build-no-cache`로 갱신

### CLAUDE.md
- line 95 (Quick Reference Commands): `make docker-rebuild` → `make docker-build-no-cache`
- line 114 (배포 명령): `docker-rebuild` 표현 갱신

### scripts/security-test.sh
- line 145 안내 문구의 `'make docker-rebuild'` → `'make docker-build-no-cache'`

### _bmad-output/research/codebase-analysis.md
- line 97 `make docker-rebuild` → `make docker-build-no-cache` 한 줄 갱신 (Phase 0 brownfield 산출물의 명령어 alias 정확성 유지)

## AC

### Makefile
- [ ] `docker-first-deploy` target 정의: `init-docker-env` 선행 의존성 + `cd docker && docker-compose up -d` 실행
- [ ] `docker-first-deploy`에 명확한 출력 메시지 ("🚀 First-time deployment ..." 등) + Next steps 안내
- [ ] `docker-up: init-docker-env` → `docker-up:` (의존성 제거)
- [ ] `docker-build: init-docker-env` → `docker-build:` (의존성 제거)
- [ ] `docker-rebuild` block 전체가 `docker-build-no-cache`로 이름 변경. 동작은 동일 (`build --no-cache`, `up -d --force-recreate`, image prune, builder prune)
- [ ] `docker-build-no-cache` 주석(현 line 59-65)도 갱신: "NOT for first-time deployment — use docker-first-deploy instead"
- [ ] `docker-clean-all`에 `docker builder prune -af` 한 줄 추가 (line ~145 부근)
- [ ] `docker-clean-all` 안내(line 149-150) 갱신: `docker-first-deploy` 권장 + `docker-build-no-cache`는 빌드 캐시 손상/릴리즈 빌드 시
- [ ] help 섹션(line 327)에 `docker-first-deploy` 추가, `docker-rebuild` → `docker-build-no-cache`
- [ ] `.PHONY`에 `docker-first-deploy` 추가, `docker-rebuild` → `docker-build-no-cache`

### docs/deployment-guide.md
- [ ] 5단계(Docker 스택 기동)에 `make docker-first-deploy`를 첫 배포 권장 명령으로 명시
- [ ] `docker-up` / `docker-build` / `docker-first-deploy` / `docker-build-no-cache` 4개 명령의 차이를 한눈에 보는 표 또는 bullet 리스트 추가
- [ ] line 263-266의 `docker-rebuild` 본문 언급을 `docker-build-no-cache`로 모두 치환 (정합성 유지)
- [ ] 운영 노트 추가: "Dify 업스트림 머지 또는 `docker/.env.example` 갱신 후에는 `make init-docker-env`를 별도 실행해 새 환경변수를 `docker/.env`에 동기화한다." (5단계 또는 운영 관리 섹션 적절한 위치)
- [ ] 문서 내 `docker-rebuild` grep 결과 0건 (이번 hotfix 적용 후)

### CLAUDE.md
- [ ] line 95 주석과 명령 모두 `docker-build-no-cache`로 변경
- [ ] line 114 배포 절차 표현 `make docker-build-no-cache`로 변경

### scripts/security-test.sh
- [ ] line 145 안내 문구 `'make docker-rebuild'` → `'make docker-build-no-cache'`

### _bmad-output/research/codebase-analysis.md
- [ ] line 97 한 줄 갱신

### 공통
- [ ] 최종 grep 검증: `grep -rn "docker-rebuild" --include="*.md" --include="*.sh" --include="Makefile" --include="*.yaml" --include="*.yml"` 결과가 `_bmad-output/stories/hotfix_*.md`(historical snapshot)와 `.team/progress.md`(체크포인트 자동 기록)만 남는다
- [ ] `make help` 출력에 `docker-first-deploy`가 보이고 `docker-rebuild`는 없으며 `docker-build-no-cache`로 표시
- [ ] `make -n docker-first-deploy` dry-run으로 Makefile 문법 정합성 검증
- [ ] `make -n docker-up` dry-run에서 `init-env.sh`가 호출되지 않음 (의존성 제거 확인)
- [ ] Lint: 해당 없음 (Makefile + docs)
- [ ] 자동 회귀 테스트: 해당 없음 (Lightweight, target alias rename은 자동 테스트 부적합)

## User Briefing

### 확인 방법
1. `make help` 결과에 `docker-first-deploy`가 새로 등장하고 `docker-rebuild` 자리에는 `docker-build-no-cache`가 표시
2. `grep -A1 "^docker-up:\|^docker-build:\|^docker-first-deploy:" Makefile`로 의존성 차이 확인 (up/build에는 의존성 없음, first-deploy에만 init-docker-env)
3. `grep -A 8 "^docker-clean-all:" Makefile`에 `docker builder prune -af` 한 줄 포함
4. `docs/deployment-guide.md` 5단계에 `make docker-first-deploy` 권장 + 4개 명령 비교 표 + `init-docker-env` 별도 실행 운영 노트
5. `grep -rn "docker-rebuild" --include="*.md" --include="*.sh" --include="Makefile"` 결과가 historical hotfix 파일과 `.team/progress.md`만 남음

### 알려진 제약
- 실제 Docker 환경에서 `make docker-first-deploy`를 끝까지 실행해 검증한 결과는 아니다. dry-run(`make -n`)과 Makefile 문법 정합성, grep 검증 기준의 정적 검증이다. 실배포 검증은 다음 운영 사이클에서 자연 수행된다.
- `docker-rebuild`에 손에 익은 운영자는 이 변경 후 `make docker-rebuild`가 실패한다 (Lightweight라 transition alias는 두지 않음). 변경 사실은 deployment-guide와 CLAUDE.md를 통해 전파.
- `_bmad-output/stories/hotfix_*.md` (5개 과거 hotfix 기록)는 historical snapshot이라 갱신 대상에서 제외. 과거 문서에서 `docker-rebuild`를 보면 현재는 `docker-build-no-cache`임을 운영자가 인지해야 함 (현 시점 표준은 새 가이드/CLAUDE.md가 단일 소스).

## Dev Agent Record

### 구현 요약 (2026-04-27)

5개 파일 수정. **코드 로직 변경 없음** — Makefile target alias rename + 의존성 정리 + 5개 파일 docs 동기화.

- **Makefile**:
  - `docker-first-deploy` target 신규 추가 (`init-docker-env` 의존성 + `docker-compose up -d` + "🚀 First-time deployment ..." 메시지 + Next steps 4줄 안내)
  - `docker-up: init-docker-env` → `docker-up:` (의존성 제거), `docker-build: init-docker-env` → `docker-build:` (의존성 제거). 두 target의 헤더 주석에 "Does not run init-docker-env, so operator-edited keys in docker/.env are preserved" 안내 추가
  - `docker-rebuild` → `docker-build-no-cache` 이름 변경 (동작 동일: `build --no-cache`, `up -d --force-recreate`, image prune `-f`, builder prune `-f`). 주석의 "use docker-up instead" → "use docker-first-deploy instead"
  - `docker-clean-all`에 `docker builder prune -af` 한 줄 추가, 종료 안내(line ~149)는 `docker-first-deploy` 권장 + `docker-build-no-cache`는 보조로 갱신
  - help 섹션 갱신 (`docker-first-deploy` 추가, `docker-rebuild` → `docker-build-no-cache`, 정렬 너비 통일), `.PHONY` 갱신 (`docker-first-deploy` 추가, `docker-rebuild` → `docker-build-no-cache`)
- **docs/deployment-guide.md**:
  - 5단계 권장 명령을 `make docker-up` → `make docker-first-deploy`로 교체. "왜 docker-first-deploy인가?" 박스 + **4개 명령 차이 비교 표**(init-docker-env 실행 여부 / 빌드 옵션 / 주 용도) + **운영 노트**(`docker/.env.example` 갱신 후 `make init-docker-env` 별도 실행) 신설
  - 4단계 카탈로그 line 205, nginx 포트 노출 변경 절(line 321), 9단계 line 517, 보안 권장 5번 line 848, 빠른 참조 표 line 870, 최종 체크리스트 line 918 등의 `docker-up`/`docker-rebuild` 인용을 의미에 맞게 `docker-first-deploy`/`docker-build-no-cache`로 보정
  - 운영 주의(line 341)는 의미 변경에 맞춰 "init-docker-env/docker-first-deploy/docker-build-no-cache 재실행 시 포트 초기화 → 운영 중 재기동은 `docker-up` 또는 `docker-compose restart/up -d <서비스>`"로 갱신
  - 변경 이력에 2026-04-27 항목 추가 (구 alias 단어를 본문에 노출하지 않는 톤으로 작성)
- **CLAUDE.md**:
  - line 95: `make docker-rebuild         # 캐시 없이 재빌드` → `make docker-build-no-cache  # 캐시 없이 재빌드`
  - line 114: `` `make docker-rebuild` `` → `` `make docker-build-no-cache` ``
- **scripts/security-test.sh**:
  - line 145: `'make docker-rebuild'` → `'make docker-build-no-cache'`
- **_bmad-output/research/codebase-analysis.md**:
  - line 97: `- \`make docker-rebuild\` - 캐시 없이 재빌드` → `- \`make docker-build-no-cache\` - 캐시 없이 재빌드`

### 품질 검사

검증 항목 6개 모두 PASS. 명령 출력 핵심 라인:

1. **`make help`**:
   ```
   make docker-first-deploy  - First-time deployment (init-docker-env + start stack)
   make docker-up            - Start Docker containers (no init, preserves docker/.env)
   make docker-build         - Build images with cache and start (fast, auto-cleanup)
   make docker-build-no-cache - Rebuild images without cache (slow, for corrupted cache or release builds)
   ```
   `docker-rebuild` 항목 없음, `docker-first-deploy` 신규 표시 확인. **PASS**

2. **`make -n docker-first-deploy`** 핵심 출력:
   ```
   echo "🔧 Initializing Docker production environment..."
   ./docker/init-env.sh
   echo "🚀 First-time deployment — starting Docker containers..."
   cd docker && docker-compose up -d
   ```
   `init-env.sh` + `docker-compose up -d` 모두 표시. **PASS**

3. **`make -n docker-up`** 핵심 출력:
   ```
   echo "🚀 Starting Docker containers..."
   cd docker && docker-compose up -d
   ```
   `init-env.sh` 호출 없음 확인. **PASS**

4. **`make -n docker-build`** 핵심 출력:
   ```
   echo "🔨 Building Docker images..."
   cd docker && docker-compose up -d --build
   echo "🧹 Cleaning unused images..."
   docker image prune -f
   ```
   `init-env.sh` 호출 없음 + `--build` 포함 확인. **PASS**

5. **`grep -A 18 "^docker-clean-all:" Makefile`**:
   ```
   @echo "🧹 Pruning Docker builder cache..."
   @docker builder prune -af
   ```
   `docker builder prune -af` 한 줄 포함 확인. **PASS**

6. **`grep -rn "docker-rebuild" --include="*.md" --include="*.sh" --include="Makefile" --include="*.yaml" --include="*.yml" .`**:
   - 잔존 위치: `_bmad-output/stories/hotfix_*.md` 5건 (historical) + `.team/progress.md` 1건 — **허용된 historical 파일에 한정**
   - 그 외 잔존: 0건. 검증 명령 `... | grep -v "_bmad-output/stories/hotfix_" | grep -v ".team/progress.md"` 결과 빈 출력. **PASS**

- **Lint**: 해당 없음 (Makefile + docs 변경)
- **자동 회귀 테스트**: 해당 없음 (Lightweight, target alias rename은 자동 테스트 부적합)

### User Briefing

**실행 방법**:
1. `make help` 출력 확인 → `docker-first-deploy`가 새로 보이고 `docker-rebuild`는 사라지고 `docker-build-no-cache`로 표시됨
2. 다음 첫 배포 시 `make docker-up` 대신 `make docker-first-deploy`를 호출 (배포 가이드 5단계 갱신됨)
3. 운영 중 일반 시작/재시작은 `make docker-up`(이제 init-env.sh를 안 타서 운영자 수정 키 보존)
4. 빌드 캐시 손상이나 릴리즈 빌드 시에는 `make docker-build-no-cache`(이전 `docker-rebuild`)
5. Dify 업스트림 머지 또는 `docker/.env.example` 갱신 후에는 `make init-docker-env`를 별도 실행해 새 환경변수를 동기화

**AC별 구현 요약** (5개 파일):
- **Makefile**: `docker-first-deploy` 신규, `docker-up`/`docker-build`에서 init 의존성 제거, `docker-rebuild` → `docker-build-no-cache` 이름 변경, `docker-clean-all`에 builder cache prune 추가, help/.PHONY 갱신
- **docs/deployment-guide.md**: 5단계 권장 명령 교체 + 4개 명령 비교 표 + 운영 노트 + 본문 정합성 보정 + 변경 이력 항목 추가
- **CLAUDE.md**: line 95, line 114 두 줄에서 alias 갱신
- **scripts/security-test.sh**: line 145 안내 문구 alias 갱신
- **_bmad-output/research/codebase-analysis.md**: line 97 alias 갱신

### 이슈 기록

- **`docker-up` 의미 변경에 따른 docs/deployment-guide.md 본문 보정 범위 확대**:
  작업 지시는 line 263-266 + 운영 노트 + 4개 명령 비교 표를 명시했지만, `docker-up`이 더 이상 init-env.sh를 실행하지 않는다는 hotfix 본질에 따라 같은 파일 내 line 205(자동 처리되는 값 카탈로그), line 321(nginx 포트 노출 변경 절), line 341(운영 주의 박스), line 517(9단계), line 848(보안 권장 5번), line 870(빠른 참조 표), line 918(최종 체크리스트)도 정합성 차원에서 함께 보정했습니다. 모두 `docker-up` 또는 `docker-rebuild` 인용의 의미를 정확히 맞추는 변경이며 새로운 요구사항을 도입하지 않습니다. 작업 지시 "이 파일에 한정" 범위 내 처리.
- **변경 이력 항목 표현 조정**: 처음 추가한 변경 이력 줄에 `docker-rebuild` 토큰이 그대로 들어가 검증 6의 grep 0건 기준에 걸려 "구 명칭 → 신규 이름"으로 표현을 다듬었습니다(이력의 의미는 그대로 유지). 그 외 이슈 없음.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-27 12:11
- Approved — 사용자 직접 검증 (검증 6/6 PASS 결과 + Dev의 deployment-guide 정합성 보정 6곳 모두 수용)


### HOTFIX_IMPL — 2026-04-27 11:47
- 5개 파일 수정 + Dev Agent Record 작성. 검증 6/6 PASS (make help/dry-run 3종/clean-all builder prune/grep 잔존 0건). Dev 추가 보정: deployment-guide.md 동일 파일 내 정합성 보정 6곳(line 205, 321, 341, 517, 848, 870, 918). AC 영향 없음.


<!-- 리더가 상태 전환마다 추가 -->

### BUG_TRIAGE — 2026-04-27 11:36
- P1, Lightweight 경로 (Makefile alias rename + 의존성 정리 + docs 동기화, 런타임 영향 없음)
- 분류 근거: 코드 로직 변경 없음, 영향은 운영자 명령어 표면. 자동 회귀 테스트는 부적합 (Makefile 동작은 dry-run + grep 검증)
- 사용자 Q&A 5 라운드 합의:
  - Q1 (docker-rebuild 필요성): 보존 합의 → 이후 이름 변경(docker-build-no-cache)으로 대체
  - Q2 (`.env.example` 갱신 빈도): 6개월 5건 정기 갱신 확인 → init-docker-env 의존성 제거 후 운영 노트로 보완
  - Q3 (docker-clean-all 후 first-deploy 가능?): 가능 (clean-all이 이미지+볼륨+.env 다 지움) → clean-all에 builder cache prune 추가 합의
  - Q4 (docker-rebuild 이름 변경): docker-build-no-cache로 합의 (Docker 공식 옵션 명과 정렬)
  - Q5 (사용처 일괄 갱신): CLAUDE.md, scripts/security-test.sh, codebase-analysis.md, deployment-guide 모두 갱신 합의
