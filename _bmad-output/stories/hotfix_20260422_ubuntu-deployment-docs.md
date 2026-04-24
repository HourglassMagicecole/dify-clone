# Hotfix: Ubuntu 22.04/24.04 배포 가이드 및 이전 노트 신규 작성

## 목적
현재 배포 문서(`docs/deployment-guide.md`, `docs/migration-notes.md`)는 Amazon Linux 2023(AL2023) 전용이다. 고객사가 Ubuntu 환경을 선택할 경우 그대로 적용 불가(패키지 매니저·Docker 설치 방식·SELinux 부재·기본 사용자 차이). Ubuntu 버전 가이드를 별도 파일로 추가해 OS별 분기를 제공한다. 기존 AL2023 문서는 그대로 유지한다.

## 수정 범위
신규 파일 2개. 기존 문서는 **건드리지 않는다**.

- `docs/deployment-guide-ubuntu.md` (신규)
- `docs/migration-notes-ubuntu.md` (신규)

지원 OS: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS (한 문서에서 두 버전 공통 안내, 차이 지점만 주석으로 분기).

## AC

### `docs/deployment-guide-ubuntu.md` 신규 작성
- [ ] 기존 `docs/deployment-guide.md`의 모든 섹션을 미러링 (0~10단계, 운영 관리, 트러블슈팅, 보안 권장, 빠른 참조, 최종 체크리스트, 변경 이력)
- [ ] 상단 메타에서 "대상 OS: Ubuntu 22.04 LTS / 24.04 LTS" 명시
- [ ] **1단계(서버 기본 설정)**: `dnf` 명령을 `apt-get`/`apt`로 전환, `git make curl vim` 설치 절차 유지
- [ ] **2단계(Docker 설치)**: Docker 공식 APT 저장소 방식 사용
  - GPG 키 등록 (`/etc/apt/keyrings/docker.asc`)
  - `sources.list.d/docker.list` 추가 시 `$(. /etc/os-release && echo "$VERSION_CODENAME")` 동적 코드네임 치환
  - `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin` 일괄 apt 설치
  - 기존 AL2023에서 수동 설치하던 compose v2/buildx 수동 블록은 **백업 경로**로만 남기고 (저장소 설치가 기본)
  - `docker-compose` shim(`/usr/local/bin/docker-compose`) 설치 블록은 그대로 유지 (Makefile 호환)
  - 사용자를 `docker` 그룹에 추가하는 절차 유지 (기본 계정은 `ubuntu`)
  - 설치 검증 블록에 `docker buildx version` 포함 (0.17.0 이상 확인)
- [ ] **기본 사용자**: AL2023의 `ec2-user` 관련 언급을 모두 `ubuntu`로 변경
- [ ] **방화벽 섹션**: `firewalld` 언급을 `ufw`로 교체
  - AL2023 가이드와 동일하게 "AWS SG가 1차 방화벽"임을 유지
  - ufw가 활성 시 80/443 허용 방법만 간단히 제시
- [ ] **SELinux 섹션(7단계)**: Ubuntu는 SELinux를 기본 사용하지 않으므로 **제거**. 대체로 AppArmor가 있으나 Docker/nginx 기본 정책은 127.0.0.1 프록시를 차단하지 않음을 1~2문장으로 명시. 기존 번호 매김(8→7, 9→8, 10→9)은 뒤로 앞당겨 재조정
- [ ] **certbot 설치(구 8단계 → 새 7단계)**: `apt install -y certbot python3-certbot-nginx`를 기본 경로로. snap 대안은 보조 경로로 짧게만 기재
- [ ] **nginx 리버스 프록시 설정**: `/etc/nginx/conf.d/*.conf` 경로를 Ubuntu에서도 유효하게 사용. Ubuntu 관례인 `sites-available/sites-enabled`는 한 줄 주석으로만 언급, 실제 절차는 `conf.d` 통일 (AL2023 가이드와 동일 구조 유지)
- [ ] **트러블슈팅 섹션**: 
  - `502 Bad Gateway` 원인에서 SELinux `setsebool` 조치를 삭제하고, Ubuntu에서 자주 나는 원인(`ufw` 차단, docker 그룹 미반영 로그인 재접속) 위주로 교체
  - `compose build requires buildx 0.17.0 or later` 케이스는 그대로 유지하되 해결책을 apt `docker-buildx-plugin` 재설치로 변경
- [ ] **최종 배포 체크리스트 > OS 및 런타임** 항목 Ubuntu 기준으로 수정:
  - "AL2023 최신 패치" → "Ubuntu 22.04/24.04 최신 패치"
  - "SELinux `httpd_can_network_connect` 활성화" 항목 삭제
- [ ] **미들웨어/Docker 스택 구성·`.env` 전략·포트 설정·백업 스크립트**는 AL2023 버전과 **완전 동일**하게 유지 (OS 무관)
- [ ] 변경 이력 테이블에 `2026-04-22 | Ubuntu 22.04/24.04 버전 초안 작성` 행 포함
- [ ] 문서 상단 "참조 배포" 블록에 "AL2023 버전: `deployment-guide.md` 참조" 한 줄 추가

### `docs/migration-notes-ubuntu.md` 신규 작성
- [ ] 기존 `docs/migration-notes.md`의 모든 섹션 미러링 (이전 성격, 정리 필요성, 6단계 작업 순서, 마무리, 최종 체크리스트, 변경 이력)
- [ ] 상단 메타에 "도착 서버: 고객사 Ubuntu 22.04/24.04" 명시
- [ ] `deployment-guide.md` 참조 링크를 모두 `deployment-guide-ubuntu.md`로 교체
- [ ] **4단계(고객사 서버에서 SSL 발급)** 안의 SSH 접속 예시 사용자명: `magic@` → `ubuntu@`
- [ ] **6단계(매직에콜 서버 정리)**: 매직에콜 서버 OS는 변경 없으므로 AL2023 기준 명령 그대로 유지. 단 머리말에 "매직에콜 서버는 AL2023 그대로, 고객사 서버만 Ubuntu" 한 줄 명시
- [ ] **DNS 변경 전 사전 검증 섹션**: `/etc/hosts` 편집의 sed 구문에서 macOS/Linux 구분 부분은 유지 (로컬 PC는 OS 무관)
- [ ] 변경 이력 테이블에 `2026-04-22 | Ubuntu 22.04/24.04 환경용 초안 작성` 행 포함

### 공통
- [ ] 기존 `docs/deployment-guide.md`, `docs/migration-notes.md`는 **이 hotfix에서 수정하지 않음**. 커밋 직전 `git diff docs/deployment-guide.md docs/migration-notes.md`로 변경 0을 확인
- [ ] 두 신규 파일 모두 UTF-8 인코딩, 마크다운 헤더 레벨 구조가 원본과 일치
- [ ] Lint 대상 아님 (docs만). 프런트/백엔드 테스트 영향 없음

## User Briefing

### 확인 방법
1. `docs/deployment-guide-ubuntu.md` 파일이 존재하고, 섹션 구성이 기존 AL2023 버전과 동일한지 확인
2. 2단계(Docker 설치)가 **apt 저장소 방식**으로 작성되었는지 확인 (`apt-get install docker-ce docker-compose-plugin docker-buildx-plugin ...`)
3. SELinux 섹션이 제거되고 단계 번호가 재조정되었는지 확인
4. 기본 사용자 이름이 `ubuntu`로 일관되게 쓰였는지 확인
5. `docs/migration-notes-ubuntu.md` 파일이 존재하고, `deployment-guide-ubuntu.md`로 링크가 바뀌어 있는지 확인
6. `git diff docs/deployment-guide.md docs/migration-notes.md` 결과가 비어 있는지 확인 (기존 파일 무변경)

### 알려진 제약
- 실제 Ubuntu 서버에서 가이드대로 배포해 끝까지 검증한 결과는 아님. 문서상 일관성·명령어 정확성 기준 초안. 첫 번째 실배포 시 환경 특유 이슈가 발견되면 추가 hotfix로 보완한다.
- snap 방식 certbot과 apt 방식 certbot 중 **apt를 기본 권장**하되 snap 옵션도 짧게 남긴다.
- AppArmor 특별 설정은 필요 없는 것으로 기술한다 (기본 정책이 Docker/nginx 동작을 막지 않음). 실제 이슈 발생 시 별도 hotfix 대상.

## Dev Agent Record

### 구현 요약
- 생성 파일: docs/deployment-guide-ubuntu.md, docs/migration-notes-ubuntu.md
- 원본 대비 주요 치환 목록:
  - dnf → apt-get/apt
  - ec2-user → ubuntu
  - firewalld → ufw
  - SELinux 섹션 제거 + AppArmor 한 줄 언급 (6-3 절 말미)
  - certbot: apt 기본 + snap 보조
  - Docker: APT 공식 저장소 방식 (docker-ce/cli/containerd.io/docker-buildx-plugin/docker-compose-plugin 일괄) + 수동 설치는 백업 경로
  - nginx 설치: `dnf install -y nginx` → `apt-get install -y nginx`, sshd 재시작 서비스명 `sshd` → `ssh`
  - 보안 업데이트: `dnf update --security` → `apt-get update && apt-get upgrade -y`
  - 단계 번호 재조정: 기존 7(SELinux) 제거 → 8(certbot)→7, 9→8, 10→9
  - 최종 체크리스트 OS/런타임: "AL2023 최신 패치" → "Ubuntu 22.04/24.04 최신 패치", SELinux 항목 삭제
  - 502 트러블슈팅: SELinux 원인 제거 → ufw 차단/docker 그룹 재로그인 위주
  - buildx 오류 해결책: 수동 덮어쓰기 → apt `--reinstall docker-buildx-plugin` 기본
  - deployment-guide.md 참조 → deployment-guide-ubuntu.md (migration-notes-ubuntu.md 전역)
  - SSH 예시 magic@ → ubuntu@ (migration-notes-ubuntu.md 4단계 고객사 접속만, 6단계 매직에콜 접속의 magic@은 AC에 따라 유지)

### 품질 검사
- Lint: 해당 없음 (docs-only)
- 테스트: 해당 없음 (docs-only)
- `git diff docs/deployment-guide.md docs/migration-notes.md`: 변경 0 (기존 파일 무수정 확인)
- 신규 파일 2개 존재 확인:
  - `docs/deployment-guide-ubuntu.md` (26,682 bytes, 843 lines)
  - `docs/migration-notes-ubuntu.md` (11,348 bytes, 311 lines)
- 금지 패턴 스캔 결과:
  - deployment-guide-ubuntu.md: `dnf`/`ec2-user`/`firewalld`/`httpd_can_network_connect` 0건. `SELinux`/`setsebool`은 AppArmor 대비 설명 1건(허용된 예외)만 잔존.
  - migration-notes-ubuntu.md: 4단계 SSH 예시 `ubuntu@` 치환 완료. 단독 `deployment-guide.md` 참조 0건. 6-1의 `magic@<매직에콜 서버>`는 매직에콜(AL2023) 접속이므로 유지.
- 변경 이력 테이블에 `2026-04-22` 행 두 파일 모두 포함 확인

### User Briefing
- 실행 방법: 실제 Ubuntu 22.04/24.04 서버에서 `docs/deployment-guide-ubuntu.md` 0단계부터 따라 배포
- 구현 요약: 위 "구현 요약" 참조
- 알려진 제약:
  - 실제 Ubuntu 서버 배포 검증 미완료 (문서 초안, 첫 실배포 후 추가 hotfix로 보완 예정)
  - AppArmor 세부 대응은 필요 시 별도 hotfix
  - snap 옵션은 보조만 기재 (apt 기본)

### 이슈 기록
- migration-notes-ubuntu.md 6단계(매직에콜 서버 정리)의 SSH 예시 `ssh magic@<매직에콜 서버>`는 AC "4단계 magic@ → ubuntu@ 치환" 범위에 해당하지 않아 의도적으로 유지. 매직에콜 서버 운영 계정 관례를 따름.
- deployment-guide-ubuntu.md 396행의 "AL2023과 달리 별도 SELinux `setsebool` 조치는 필요 없습니다" 한 문장은 지시서의 허용 예외에 해당하여 유지.
- AC에서 구 7단계 SELinux 제거와 번호 재조정을 요구. 기존 7(SELinux)/8(certbot)/9(관리자)/10(검증) → 신 7(certbot)/8(관리자)/9(검증)로 재번호 적용. 본문 내 자기참조(예: "7단계에서 certbot이...") 및 migration 문서의 "deployment-guide-ubuntu.md 9단계" 링크도 새 번호로 맞춰 수정.

## Lifecycle Log

### HOTFIX_IMPL — 2026-04-22 10:11
- Lightweight docs-only. 신규 2파일 작성. 기존 AL2023 문서 무변경(git diff 0). Dev Agent Record 추가.


### BUG_TRIAGE — 2026-04-22
- P1, Lightweight 경로 (docs 신규 2개, 런타임 영향 0)
- 네이밍 방식 A 선택: 기존 파일 유지 + Ubuntu 버전 신규 추가
- 스토리 작성 완료 (리더 직접)

### HOTFIX_USER_VERIFY → HOTFIX_COMPLETE — 2026-04-24
- 사용자 검증 통과. 문서 내용 Approved.
- 후속 Hotfix로 Rocky Linux 9 전용 문서 신규 작성이 별도 개시됨 (`hotfix_20260424_rocky-deployment-docs.md`).
