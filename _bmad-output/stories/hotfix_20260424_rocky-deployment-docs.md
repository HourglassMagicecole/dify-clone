# Hotfix: Rocky Linux 9 배포 가이드 및 이전 노트 신규 작성

## 목적
고객사가 **Rocky Linux 9** 환경을 선택함. 기존 배포 문서(`docs/deployment-guide.md`, `docs/migration-notes.md`)는 Amazon Linux 2023(AL2023) 전용으로, Rocky 9은 RHEL 계열이라 대부분 유사하지만 아래 차이로 그대로 적용 불가:

- AL2023의 `dnf install -y docker`가 Rocky에는 없음 → Docker CE 공식 저장소 수동 등록 필요
- Rocky는 `firewalld` 기본 활성 → HTTP/HTTPS 허용 필수
- Rocky 기본 저장소에 `certbot` 없음 → EPEL 저장소 활성화 필요
- Rocky 9은 `crb` (CodeReady Builder) 저장소 활성화 권장 (일부 의존성)
- AL2023이 전제한 "AWS EC2 + 보안 그룹" 문맥을 고객사 인프라 일반 용어로 조정 필요

Rocky 9 버전 가이드를 별도 파일로 추가해 OS별 분기를 제공한다. 기존 AL2023 · Ubuntu 문서는 그대로 유지한다.

## 수정 범위
신규 파일 2개. 기존 문서는 **건드리지 않는다**.

- `docs/deployment-guide-rocky.md` (신규)
- `docs/migration-notes-rocky.md` (신규)

지원 OS: **Rocky Linux 9만** (Rocky 8 EOL 임박, Rocky 10은 범위 외. 본문에서도 9 전용으로 명시).

## AC

### `docs/deployment-guide-rocky.md` 신규 작성
- [ ] 기존 `docs/deployment-guide.md`의 모든 섹션 미러링 (0~10단계, 운영 관리, 트러블슈팅, 보안 권장, 빠른 참조, 최종 체크리스트, 변경 이력)
- [ ] 상단 메타에서 "대상 OS: **Rocky Linux 9** (RHEL 9 계열)" 명시. Rocky 8/10은 범위 외임을 한 줄 덧붙임
- [ ] 문서 상단 "참조 배포" 블록에 "AL2023 버전: `deployment-guide.md`, Ubuntu 버전: `deployment-guide-ubuntu.md` 참조" 한 줄 추가
- [ ] **0단계 사전 준비**: "AWS EC2" 고정 표현을 "고객사 인프라 (AWS EC2 등)"로 일반화. "AWS 보안 그룹" 언급은 유지하되 "AWS 외 환경이면 해당 방화벽/네트워크 정책"이라는 한 줄 병기
- [ ] **1단계(서버 기본 설정)**: `dnf` 명령은 그대로 유지 (AL2023과 동일). 기본 사용자는 `rocky`로 명시 (AL2023의 `ec2-user` 대신). `timedatectl` 블록 그대로 유지
- [ ] **1단계 방화벽 섹션**: Rocky는 `firewalld` **기본 활성**임을 강조. 아래 블록 필수 포함
  ```bash
  sudo systemctl status firewalld
  sudo firewall-cmd --permanent --add-service=http
  sudo firewall-cmd --permanent --add-service=https
  sudo firewall-cmd --reload
  sudo firewall-cmd --list-all
  ```
- [ ] **2단계(Docker 설치)**: AL2023의 `dnf install -y docker` 경로 **삭제**. Docker CE 공식 저장소 방식으로 전환
  - 구버전 제거 블록 (`docker docker-client docker-common docker-latest podman-docker` 등)
  - `dnf-plugins-core` 설치 후 `dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo` 등록 (CentOS 저장소가 Rocky 9 호환)
  - `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin` 일괄 `dnf install`
  - `sudo systemctl enable --now docker`, `sudo usermod -aG docker $USER`
  - `docker-compose` shim(`/usr/local/bin/docker-compose`) 블록 유지 (Makefile 호환)
  - Buildx 수동 설치/Compose 수동 설치 블록은 **완전 삭제** (저장소 방식으로 충분). AL2023에 있던 "2차 — GitHub 릴리스 수동 설치" 대체 블록은 백업 경로로만 짧게 언급
  - 설치 검증 블록에 `docker buildx version` 포함 (0.17.0 이상 확인)
- [ ] **3단계(소스 배포)**: AL2023 버전 그대로 (`/opt/mai-studio`, `chown $USER:$USER`, git clone, `git checkout moai-v2`)
- [ ] **4단계(환경 변수)**: AL2023 버전 그대로 (OS 무관). 포트 2개(`EXPOSE_NGINX_PORT=8080`, `EXPOSE_NGINX_SSL_PORT=8443`) 수정 지침 유지
- [ ] **5단계(Docker 스택 기동)**: AL2023 버전 그대로 (`make docker-up`, 관리자 대화형 입력, 자동 생성 키 백업 블록)
- [ ] **6단계(호스트 nginx 설치)**: `dnf install -y nginx`는 Rocky 9 기본 저장소에 있어 그대로 유효. 단, **EPEL 활성화 선행 권장** 한 줄 추가 (일부 nginx 모듈 대비)
  ```bash
  sudo dnf install -y epel-release
  sudo dnf config-manager --set-enabled crb
  sudo dnf install -y nginx
  ```
- [ ] **6-2 리버스 프록시 설정**: AL2023과 동일한 `/etc/nginx/conf.d/*.conf` 경로와 서버 블록 사용. server_name만 고객사 도메인으로 치환 안내
- [ ] **7단계(SELinux)**: AL2023과 **동일하게 유지**. Rocky 9도 Enforcing 기본이며 `setsebool -P httpd_can_network_connect 1` 필수임을 강조
- [ ] **8단계(certbot)**: EPEL 선행 + `dnf install -y certbot python3-certbot-nginx`를 기본 경로로. AL2023에 있던 "pip venv 방식"은 **보조 경로**로 짧게만 남김 (snap은 Rocky에서 비권장)
  ```bash
  sudo dnf install -y epel-release
  sudo dnf install -y certbot python3-certbot-nginx
  ```
- [ ] **9단계(관리자 로그인) / 10단계(검증 체크리스트)**: AL2023 그대로
- [ ] **운영 관리 / 업데이트 배포 / 백업 전략 / SSL 자동 갱신 / 로그 확인 / 모니터링**: AL2023 그대로 (OS 무관)
- [ ] **트러블슈팅 섹션**:
  - `502 Bad Gateway` 원인 목록에 **firewalld 차단** 추가 (AL2023은 해당 없음). `sudo firewall-cmd --list-all` 로 HTTP/HTTPS 서비스 포함 여부 확인
  - SELinux `setsebool` 원인은 AL2023과 동일하게 유지 (Rocky도 적용됨)
  - `compose build requires buildx 0.17.0 or later` 케이스 유지. 해결책은 `dnf install --allowerasing -y docker-buildx-plugin` (공식 저장소 재설치) 로 기재
  - "docker 그룹 미반영 로그인 재접속" 원인 추가
- [ ] **보안 권장 사항**:
  - SSH 섹션의 서비스명은 `sshd` 그대로 유지 (RHEL 계열)
  - fail2ban 설치: `sudo dnf install -y epel-release && sudo dnf install -y fail2ban`
  - 나머지는 AL2023 그대로
- [ ] **최종 배포 체크리스트 > OS 및 런타임** 항목 Rocky 기준으로 수정:
  - "Amazon Linux 2023 최신 패치" → "Rocky Linux 9 최신 패치"
  - "Docker 설치 (`sudo dnf install -y docker`)" → "Docker CE 설치 (공식 저장소)"
  - "firewalld: HTTP/HTTPS 허용" 항목 신규 추가
  - "EPEL 저장소 활성화" 항목 신규 추가
  - "SELinux `httpd_can_network_connect` 활성화" 항목 유지
- [ ] 변경 이력 테이블에 `2026-04-24 | Rocky Linux 9 버전 초안 작성` 행 포함
- [ ] 문서 전반에서 `ec2-user` → `rocky`로 치환 (기본 계정 명시)

### `docs/migration-notes-rocky.md` 신규 작성
- [ ] 기존 `docs/migration-notes.md`의 모든 섹션 미러링 (이전 성격, 정리 필요성, 6단계 작업 순서, 마무리, 최종 체크리스트, 변경 이력)
- [ ] 상단 메타에 "도착 서버: 고객사 Rocky Linux 9" 명시
- [ ] `deployment-guide.md` 참조 링크를 모두 `deployment-guide-rocky.md`로 교체
- [ ] **4단계(고객사 서버에서 SSL 발급)** 안의 SSH 접속 예시 사용자명: `ec2-user@` → `rocky@`
- [ ] **6단계(매직에콜 서버 정리)**: 매직에콜 서버 OS는 변경 없으므로 AL2023 기준 명령 그대로 유지. 단 머리말에 "매직에콜 서버는 AL2023 그대로, 고객사 서버만 Rocky 9" 한 줄 명시
- [ ] **DNS 변경 전 사전 검증 섹션**: `/etc/hosts` 편집의 sed 구문에서 macOS/Linux 구분 부분은 유지 (로컬 PC는 OS 무관)
- [ ] 변경 이력 테이블에 `2026-04-24 | Rocky Linux 9 환경용 초안 작성` 행 포함

### 공통
- [ ] 기존 `docs/deployment-guide.md`, `docs/migration-notes.md`, `docs/deployment-guide-ubuntu.md`, `docs/migration-notes-ubuntu.md`는 **이 hotfix에서 수정하지 않음**. 커밋 직전 `git diff` 로 변경 0 확인
- [ ] 두 신규 파일 모두 UTF-8 인코딩, 마크다운 헤더 레벨 구조가 원본과 일치
- [ ] Lint 대상 아님 (docs만). 프런트/백엔드 테스트 영향 없음

## User Briefing

### 확인 방법
1. `docs/deployment-guide-rocky.md` 파일이 존재하고, 섹션 구성이 기존 AL2023 버전과 동일한지 확인
2. 2단계(Docker 설치)가 **Docker CE 공식 저장소 방식**으로 작성되었는지 확인 (`docker config-manager --add-repo .../docker-ce.repo`)
3. 1단계 방화벽 블록에 `firewalld` 서비스 활성화 및 HTTP/HTTPS 허용 명령이 포함되었는지
4. 8단계 certbot 앞에 `epel-release` 설치 블록이 있는지
5. 7단계 SELinux 조치(`setsebool -P httpd_can_network_connect 1`) 유지 여부
6. 기본 사용자 이름이 `rocky`로 일관되게 쓰였는지
7. `docs/migration-notes-rocky.md` 파일이 존재하고, `deployment-guide-rocky.md`로 링크가 바뀌어 있는지
8. `git diff docs/deployment-guide.md docs/migration-notes.md docs/deployment-guide-ubuntu.md docs/migration-notes-ubuntu.md` 결과가 비어 있는지

### 알려진 제약
- 실제 Rocky Linux 9 서버에서 가이드대로 배포해 끝까지 검증한 결과는 아님. 문서상 일관성·명령어 정확성 기준 초안. 첫 번째 실배포 시 환경 특유 이슈가 발견되면 추가 hotfix로 보완한다.
- Rocky 8 / Rocky 10은 지원 범위 외로 문서에 명시. 고객사가 향후 8 또는 10을 요구할 경우 별도 hotfix로 대응.
- AWS 외 환경(온프렘, Azure, GCP 등)에서는 보안 그룹 대신 해당 방화벽/네트워크 정책을 적용해야 한다는 점만 한 줄로 병기.
- CentOS용 Docker 저장소(`linux/centos/docker-ce.repo`)를 Rocky 9에 사용. Docker 공식이 Rocky 전용 저장소를 별도 제공하지 않아 이 관행을 따르며, 실패 시 RHEL 저장소로 폴백하는 한 줄 대안만 남긴다.

## Dev Agent Record

### 구현 요약
- 생성 파일: `docs/deployment-guide-rocky.md`, `docs/migration-notes-rocky.md`
- AL2023 원본 대비 주요 치환/추가 목록:
  - `ec2-user` → `rocky`
  - Docker 설치: `dnf install -y docker` → Docker CE 공식 저장소 등록 + `docker-ce/cli/containerd.io/docker-buildx-plugin/docker-compose-plugin` 일괄
  - Buildx 수동 설치 블록 제거 (저장소로 해결)
  - 1단계 방화벽: firewalld 비활성 전제 → firewalld 기본 활성 전제로 반전, HTTP/HTTPS 허용 블록 필수화
  - 6단계 nginx: `epel-release` + `crb` 활성화 선행 추가
  - 8단계 certbot: `epel-release` 필수 전제 추가, pip venv 방식은 보조 경로로 축소
  - 트러블슈팅 502 원인에 firewalld 차단/Docker 그룹 미반영 추가
  - 보안 fail2ban 설치 블록에 epel 선행
  - OS 명칭 전반에서 AL2023 → Rocky Linux 9
  - 0단계 "AWS EC2" 표현을 "고객사 인프라" 일반화 (AWS SG 언급은 유지하되 비-AWS 환경 병기)
  - migration-notes-rocky 4단계 SSH 예시 `ec2-user@` → `rocky@`
  - 전역 참조 `deployment-guide.md` → `deployment-guide-rocky.md` (migration-notes-rocky.md 전역)

### 품질 검사
- Lint: 해당 없음 (docs-only)
- 테스트: 해당 없음 (docs-only)
- `git diff docs/deployment-guide.md docs/migration-notes.md docs/deployment-guide-ubuntu.md docs/migration-notes-ubuntu.md`: 변경 0 확인 (diff empty)
- 신규 파일 2개 존재 확인:
  - `docs/deployment-guide-rocky.md` (894 lines)
  - `docs/migration-notes-rocky.md` (312 lines)
- 금지 패턴 스캔 결과:
  - `ec2-user`: 두 파일 모두 0건
  - `dnf install -y docker` (AL2023 Docker 설치 패턴): 0건
  - `apt-get`, `ufw `, `AppArmor` (Ubuntu 전용 패턴): 0건
  - migration-notes-rocky.md에서 단독 `deployment-guide.md` 링크 참조: 0건 (모두 `deployment-guide-rocky.md`로 링크)
- 변경 이력 테이블에 `2026-04-24` 행 두 파일 모두 포함 확인

### User Briefing
- 실행 방법: 실제 Rocky Linux 9 서버에서 `docs/deployment-guide-rocky.md` 0단계부터 따라 배포
- 구현 요약: 위 "구현 요약" 참조
- 알려진 제약:
  - 실제 Rocky 9 서버 배포 검증 미완료 (문서 초안, 첫 실배포 후 추가 hotfix로 보완 예정)
  - Rocky 8/10 지원 범위 외
  - CentOS용 Docker 저장소를 Rocky 9에 사용 (공식 관행)

### 이슈 기록
- Rocky Linux 9의 기본 계정명을 `rocky`로 기재했으나, 실제 고객사 클라우드 제공자의 공식 이미지(AWS Marketplace Rocky AMI, Azure/GCP Rocky 이미지 등)에 따라 기본 계정이 다를 가능성이 있음. 고객사가 Rocky 공식 이미지를 사용하면 `rocky`가 맞으나, 자체 커스텀 이미지 사용 시 실제 SSH 접속 시점에 계정명 확인 필요. 본문에서는 공식 이미지 기준 단정 표현 사용, 배포자가 실제 접속 시 계정명을 자연스럽게 치환하도록 의존함.
- Docker 공식이 Rocky 전용 저장소를 별도 제공하지 않아 CentOS용 `docker-ce.repo`를 Rocky 9에 그대로 사용. 이는 Docker 커뮤니티 공식 권장 방식이며 Rocky 9는 CentOS Stream 9와 동일한 ABI라 안정적으로 동작. "알려진 제약" 섹션과 2단계 본문에 근거 주석 포함.
- 6-1에서 EPEL/CRB 활성화를 nginx 설치 블록 앞으로 끌어올림. 원래 AL2023 가이드는 8단계(certbot)에서만 EPEL 언급하지만, Rocky 9는 EPEL 없이는 certbot·fail2ban이 모두 실패하므로 앞단으로 이동. 단 CRB는 엄밀히는 nginx 기본 설치에 필수는 아니나 추후 모듈 확장 대비 함께 활성화 (한 번만 실행).
- 최종 체크리스트에 "firewalld HTTP/HTTPS 허용"과 "EPEL + CRB 저장소 활성화" 항목을 OS 및 런타임 섹션에 신규 추가. AL2023 체크리스트와 달리 Rocky는 이 두 항목이 누락되면 502가 재현됨.

## Lifecycle Log

### BUG_TRIAGE — 2026-04-24
- P1, Lightweight 경로 (docs 신규 2개, 런타임 영향 0)
- Ubuntu Hotfix(`hotfix_20260422_ubuntu-deployment-docs.md`)와 동일한 네이밍 방식 채택: 기존 파일 유지 + Rocky 9 버전 신규 추가
- 대상 OS 협소화: Rocky 9 단독 (8/10 제외)
- 스토리 작성 완료 (리더 직접)

### HOTFIX_IMPL — 2026-04-24
- Lightweight docs-only. 신규 2파일 작성. 기존 AL2023/Ubuntu 문서 무변경(git diff 0). Dev Agent Record 채움.

### HOTFIX_USER_VERIFY (1차) → HOTFIX_IMPL (2차 개정) — 2026-04-24
- 실배포 검증 중 발견된 피드백 반영 (범위 ①):
  - 보안 5번 "API 컨테이너 비-root 실행 (미완료 과제)" 블록을 한 줄에서 현상·임시 우회·근본 해결 예정 3개 절로 확장
  - 트러블슈팅에 "`make docker-clean-all` 권한 거부로 실패" 블록 신규 추가 (증상 로그·우회 명령·안전 주석·근본 원인 교차 참조)
  - 변경 이력에 2026-04-24 개정 행 1줄 추가
- AC 영향: "기존 AL2023/Ubuntu 문서 무변경" 조건은 그대로 유지 (이번 수정은 Rocky 가이드 단독)
- 범위 ②(3개 OS 가이드 일괄) / 범위 ③(entrypoint.sh gosu 패턴 코드 수정)은 별도 Hotfix로 예약 — 사용자 선택 대기

### HOTFIX_USER_VERIFY (2차) → HOTFIX_IMPL (3차 개정) — 2026-04-24
- 실배포 필드 피드백 2건 추가 반영:
  - **4단계 신규 블록**: "`make docker-up` 이후 포트 수정이 누락된 걸 발견했다면" — `.env` 값 확인/수정/`docker-compose up -d --force-recreate nginx` 3단계 절차. `restart` 대비 `force-recreate` 필수성 주석 포함. 이유: 실제 배포에서 4단계 `.env` 수정을 빠뜨린 채 `make docker-up` 을 실행해 nginx 가 80/443에 바인딩된 사례 재현.
  - **트러블슈팅 블록 전체 재작성**: 기존 2단계(sudo rm → up) 를 **4+1단계**(`docker-compose down → sudo rm → git restore → up → 검증`)로 확장. 사유: 실제 배포에서 컨테이너 실행 중 `sudo rm -rf docker/volumes/` 실행 → Docker daemon이 root 권한으로 마운트 경로 자동 재생성 → 이후 `git restore` 가 막히는 순서 오류 재현. 또한 `docker/volumes/` 에 포함된 Git-tracked 파일(sandbox `conf/config.yaml` 등)이 함께 삭제되어 sandbox PANIC 재시작 루프에 빠지는 부작용 확인. `git restore` 단계와 검증(`ls` + `git status`)을 필수로 편입.
  - 변경 이력에 2026-04-24 (3차) 개정 행 1줄 추가
- AC 영향: "기존 AL2023/Ubuntu 문서 무변경" 조건 그대로 유지 (이번 수정도 Rocky 가이드 단독)
- 이 두 블록은 실배포 필드에서 직접 재현된 장애 시나리오를 문서화한 것으로, 다음 배포자 또는 재배포 시 재발 방지 효과가 큼

### HOTFIX_USER_VERIFY (3차) → HOTFIX_IMPL (4차 개정) — 2026-04-24
- 근본 원인 추가 발견 및 경고 블록 반영:
  - 사용자 지적으로 `docker/init-env.sh` 동기화 로직 재검토 → `.env` 가 이미 있을 때 `cp docker/.env.example docker/.env`로 전체 덮어쓰기 후 13개 키만 복원하는 구조 확인 (라인 32~111). **`EXPOSE_NGINX_PORT`, `EXPOSE_NGINX_SSL_PORT` 는 백업 대상에 없음** → 4단계 안내에 따라 `.env` 를 수정해도 `make docker-up` 시 80/443 으로 되돌아가는 실제 동작 확인.
  - **4단계 "⚠️ 중요 — init-env.sh 동기화" 경고 블록 신규**: 백업 대상 13개 키 명시, 포트 2개가 누락됨을 명시, "실전 권장 경로" 로 복구 블록 연결, "운영 주의 — 운영 중 재기동 시 `make docker-up` 대신 `docker-compose restart/up -d <서비스명>` 사용" 권고, 근본 해결은 차기 Hotfix 예약이라는 메모.
  - 변경 이력에 2026-04-24 (4차) 개정 행 1줄 추가
- AC 영향: "기존 AL2023/Ubuntu 문서 무변경" 조건 그대로 유지 (이번 수정도 Rocky 가이드 단독)
- 근본 해결(`init-env.sh` 수정 또는 `.env.example` 기본값 변경)은 별도 Hotfix 범위. 사용자 결정 대기.

### HOTFIX_USER_VERIFY (4차) → HOTFIX_COMPLETE — 2026-04-24
- 사용자 검증 통과. 실제 고객사 Rocky Linux 9 서버(175.126.189.248)에 배포까지 성공적으로 완료.
  - HTTPS 최종 응답 확인: `curl -I https://mai-studio.lcampus.co.kr` → `HTTP/1.1 307 /signin` + HSTS 헤더
  - 배포 중 드러난 고객사 환경 특수성: firewalld Disabled, SELinux Disabled, 기본 계정 `mai`, 사설/국내 IDC 대역 공인 IP. 현 Rocky 가이드는 이 상황에서도 트러블슈팅 블록(SELinux/firewalld 경우 분기)을 통해 대응 가능했음.
  - 실배포에서 재현된 장애/혼란 2건은 가이드에 흡수 완료: (1) `.env` 수정이 `make docker-up` 시 덮여지는 동기화 동작 (라인 269 경고 블록), (2) `sudo rm -rf docker/volumes/` 후 git-tracked 파일 재복원 순서 (트러블슈팅 블록).
- 4차 개정 상태로 Approved, 커밋 진행.
- 별도 Hotfix triage(`.env.example` 기본값 변경 + `init-env.sh` 포트 백업 추가 + 3개 OS 가이드 정비 + API 비-root gosu 전환 + certbot timer start 가이드 보강 + SELinux Disabled 대응 문구 등)은 **사용자 결정에 따라 기록하지 않음**. 필요 시 추후 별도 triage로 수기 기록.
