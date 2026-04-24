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
- `git diff docs/deployment-guide.md docs/migration-notes.md docs/deployment-guide-ubuntu.md docs/migration-notes-ubuntu.md`: 변경 0 기대
- 금지 패턴 스캔 (예정):
  - deployment-guide-rocky.md: `ec2-user` 0건, AL2023 단순 참조 0건(단, 비교 각주 허용)
  - migration-notes-rocky.md: `ec2-user@` 0건 (4단계), 단독 `deployment-guide.md` 참조 0건
- 변경 이력 테이블에 `2026-04-24` 행 두 파일 모두 포함 확인

### User Briefing
- 실행 방법: 실제 Rocky Linux 9 서버에서 `docs/deployment-guide-rocky.md` 0단계부터 따라 배포
- 구현 요약: 위 "구현 요약" 참조
- 알려진 제약:
  - 실제 Rocky 9 서버 배포 검증 미완료 (문서 초안, 첫 실배포 후 추가 hotfix로 보완 예정)
  - Rocky 8/10 지원 범위 외
  - CentOS용 Docker 저장소를 Rocky 9에 사용 (공식 관행)

### 이슈 기록
- (구현 단계에서 추가)

## Lifecycle Log

### BUG_TRIAGE — 2026-04-24
- P1, Lightweight 경로 (docs 신규 2개, 런타임 영향 0)
- Ubuntu Hotfix(`hotfix_20260422_ubuntu-deployment-docs.md`)와 동일한 네이밍 방식 채택: 기존 파일 유지 + Rocky 9 버전 신규 추가
- 대상 OS 협소화: Rocky 9 단독 (8/10 제외)
- 스토리 작성 완료 (리더 직접)
