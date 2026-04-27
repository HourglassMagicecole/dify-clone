# MAI Studio 고객사 배포 가이드 (Rocky Linux 9)

MAI Studio를 고객사 서버(Rocky Linux 9)에 배포하기 위한 단계별 가이드.

- **예시 도메인**: `mai-studio.lcampus.co.kr`
- **대상 OS**: Rocky Linux 9 (RHEL 9 계열)
- **예상 소요 시간**: 약 2~3시간 (DNS 전파 대기 포함)

---

## 배포 아키텍처

```
브라우저
   │ HTTPS (443)
   ▼
[호스트 nginx]                        ← SSL 종단 (호스트 80/443 listen). certbot으로 인증서 관리.
   │ HTTP (127.0.0.1:8080)             /etc/nginx/conf.d/*.conf
   ▼
[Docker nginx 컨테이너]                ← 호스트 8080:컨테이너 80 매핑. 서비스 내부 라우팅.
   │
   ├─→ api:5001            (Dify API / Console)
   ├─→ web-edu:3001        (교육용 프론트 UI)
   ├─→ worker              (비동기 작업)
   ├─→ sandbox             (코드 실행)
   └─→ plugin-daemon       (모델 프로바이더 플러그인)
        │
        ▼
[미들웨어]: Postgres, Redis, Elasticsearch, Weaviate 등
```

**핵심**: SSL은 **호스트 nginx**가 담당하고, Docker 내부의 nginx 컨테이너는 HTTP만 받습니다. 인증서 발급/갱신은 Docker 바깥(호스트)에서 certbot으로 관리합니다.

---

## 0단계 — 사전 준비 체크리스트

배포를 시작하기 전에 아래가 모두 준비되어야 합니다.

- [ ] **서버 인스턴스 확보** (권장 사양: vCPU 4, RAM 16GB, Disk 100GB+). 고객사 인프라가 AWS EC2면 `t3.xlarge` 이상. 온프렘/다른 클라우드여도 동일 사양 기준 적용.
- [ ] **네트워크 인바운드 규칙** (AWS 보안 그룹, 온프렘 방화벽, 또는 고객사 네트워크 정책에 동일하게 적용)
  - 22/tcp (SSH) — 운영자 IP만
  - 80/tcp (HTTP) — `0.0.0.0/0` (certbot 검증용, 발급 후에는 443으로 리다이렉트됨)
  - 443/tcp (HTTPS) — `0.0.0.0/0` 또는 고객사 IP 대역
- [ ] **DNS 레코드** — 고객사 DNS 관리자에게 아래 추가 요청
  ```
  mai-studio.lcampus.co.kr  A  <서버 공인 IP 또는 Elastic IP>
  ```
- [ ] **운영자 이메일 주소** (Let's Encrypt 만료 알림용)
- [ ] **SSH 접속 키**
- [ ] **저장소 접근 권한** (GitHub 또는 내부 Git)

**DNS 전파 확인**:
```bash
dig +short mai-studio.lcampus.co.kr
# → 서버 IP가 반환되어야 함. 반환되지 않으면 certbot 8단계에서 실패.
```

---

## 1단계 — 서버 기본 설정

SSH 접속 후 실행. Rocky Linux 9의 기본 계정은 `rocky`.

```bash
# 1-1. OS 업데이트
sudo dnf update -y

# 1-2. 필수 도구 설치
sudo dnf install -y git make curl vim

# 1-3. 시간대 확인 (Dify 로그/일정 정확도를 위해)
sudo timedatectl set-timezone Asia/Seoul
date   # KST 시간 확인
```

### 방화벽 정책

Rocky Linux 9는 **`firewalld`가 기본 활성** 상태로 설치됩니다 (AL2023와 다른 점). AWS 환경이라도 서버 내부의 firewalld가 80/443을 막고 있으면 호스트 nginx로 들어오는 트래픽이 차단됩니다. 반드시 HTTP/HTTPS를 허용해야 합니다.

```bash
# firewalld 상태 확인 — active (running) 이어야 함
sudo systemctl status firewalld

# HTTP/HTTPS 허용 (영구 규칙)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# 적용 결과 확인 (services 줄에 http, https가 보여야 함)
sudo firewall-cmd --list-all
```

> 📌 AWS EC2라면 AWS 보안 그룹이 **1차 방화벽**이지만, Rocky는 **OS 레벨 firewalld**가 **2차 방화벽**으로 함께 작동합니다. 둘 다 허용되어야 통신이 됩니다. 온프렘/비-AWS 환경에서는 고객사 네트워크 정책과 firewalld **둘 다** HTTP/HTTPS를 허용하도록 확인하세요.

---

## 2단계 — Docker 설치

Rocky Linux 9의 기본 저장소에는 Docker 엔진이 없고 Podman만 있습니다 (AL2023과 가장 큰 차이). Docker CE 공식 저장소를 등록해 엔진 + Compose v2 + Buildx를 한 번에 설치합니다.

```bash
# 2-1. 구버전/충돌 패키지 제거 (있으면 제거, 없으면 통과)
for pkg in docker docker-client docker-client-latest docker-common \
           docker-latest docker-latest-logrotate docker-logrotate \
           docker-engine podman-docker runc; do
  sudo dnf remove -y $pkg 2>/dev/null || true
done

# 2-2. dnf-plugins-core 설치 (저장소 관리 플러그인)
sudo dnf install -y dnf-plugins-core

# 2-3. Docker CE 공식 저장소 등록
# Docker 공식이 Rocky 전용 저장소를 별도 제공하지 않으므로 CentOS용 repo를 사용합니다.
# Rocky 9은 RHEL/CentOS Stream 9와 동일한 ABI이므로 정상 동작합니다.
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 2-4. Docker 엔진 + Compose v2 + Buildx 플러그인 일괄 설치
sudo dnf install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

sudo systemctl enable --now docker

# 2-5. 현재 사용자(rocky)를 docker 그룹에 추가 (sudo 없이 docker 명령 실행 가능)
sudo usermod -aG docker $USER
# ⚠️ 그룹 변경 적용을 위해 반드시 로그아웃 후 재접속 필요
```

### 백업 경로 — 저장소 방식이 불가할 때만

위 저장소 설치가 정상 동작하면 Compose v2/Buildx는 이미 함께 설치된 상태입니다. 만약 제한된 환경(오프라인, 프록시, CentOS repo 접근 불가 등)으로 저장소 설치가 불가할 때만 아래 수동 설치를 사용합니다.

```bash
# (백업) Compose v2 CLI 플러그인 수동 설치
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose

# (백업) Buildx 플러그인 수동 설치
LATEST_BUILDX=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest \
  | grep '"tag_name"' | head -1 | cut -d'"' -f4)
curl -SL "https://github.com/docker/buildx/releases/download/${LATEST_BUILDX}/buildx-${LATEST_BUILDX}.linux-amd64" \
  -o $DOCKER_CONFIG/cli-plugins/docker-buildx
chmod +x $DOCKER_CONFIG/cli-plugins/docker-buildx
```

### docker-compose shim 설치 (Makefile 호환)

프로젝트 Makefile은 하이픈형 `docker-compose` 명령을 호출하므로 shim이 필요합니다.

```bash
sudo tee /usr/local/bin/docker-compose >/dev/null <<'EOF'
#!/bin/sh
exec docker compose "$@"
EOF
sudo chmod +x /usr/local/bin/docker-compose
```

### 설치 검증

```bash
docker --version
docker compose version
docker-compose version   # shim 동작 확인
docker buildx version    # 0.17.0 이상이어야 함
```

---

## 3단계 — 소스 코드 배포

```bash
# 3-1. 배포 디렉토리 생성
sudo mkdir -p /opt/mai-studio
sudo chown -R $USER:$USER /opt/mai-studio

# 3-2. 저장소 클론
cd /opt
git clone <repo-url> mai-studio
cd mai-studio

# 3-3. 운영 브랜치 체크아웃
git checkout moai-v2
git pull origin moai-v2
```

---

## 4단계 — `.env` 환경변수 카탈로그 (참고용)

> 📖 **이 단계에서는 실제 작업이 없습니다.** 5단계에서 `.env`를 다루기 전에 키별 의미를 미리 훑어두는 참고 자료입니다. 실제 `.env` 생성·수정과 포트 변경은 모두 5단계에서 진행됩니다.

### 자동 처리되는 값 (손대지 말 것)

`make docker-first-deploy`(또는 `make init-docker-env`) 실행 시 `docker/init-env.sh`가 **아래 값들을 자동 생성**합니다. 직접 수정할 필요가 없고, 오히려 수동으로 건드리지 않는 것이 안전합니다.

| 키 | 자동 처리 방식 |
|---|---|
| `SECRET_KEY` | `openssl rand -base64 42`로 자동 생성 |
| `API_KEY_ENCRYPTION_KEY` | Fernet 호환 키 자동 생성 |
| `DB_PASSWORD` | `openssl rand -hex 32` 자동 생성 |
| `REDIS_PASSWORD` | 자동 생성 + `CELERY_BROKER_URL` 자동 동기화 |
| `ELASTICSEARCH_PASSWORD` | 자동 생성 |
| `SANDBOX_API_KEY` | 자동 생성 + `CODE_EXECUTION_API_KEY` 자동 동기화 |
| `PLUGIN_DAEMON_KEY` | 자동 생성 |
| `PLUGIN_DIFY_INNER_API_KEY` | 자동 생성 |
| `INITIAL_ADMIN_EMAIL/PASSWORD/NAME` | **대화형 프롬프트로 입력** (5단계에서) |

> 📌 **보존 로직**: 재실행 시에도 기존 값이 있으면 건드리지 않습니다. 최초 1회만 생성됩니다.

### 수정할 필요 없는 값 (기본값 그대로 OK)

| 키 | 기본값 | 그대로 둬도 되는 이유 |
|---|---|---|
| `CONSOLE_API_URL` | 공란 | 빈 값이면 요청이 들어온 도메인을 자동으로 사용 (`request.host_url`). 단일 도메인 배포이므로 자동 처리됨 |
| `SERVICE_API_URL` | 공란 | 동일 — "If empty, it is the same domain" |
| `APP_API_URL` | 공란 | 동일 |
| `APP_WEB_URL` | 공란 | 동일 |
| `NGINX_SERVER_NAME` | `_` | catch-all. Docker nginx는 호스트 nginx 뒤에서 모든 Host 헤더를 받으므로 도메인 매칭이 필요 없음 |
| `NGINX_HTTPS_ENABLED` | `false` | 호스트 nginx가 SSL 종단하므로 그대로 둠 |
| `NGINX_PORT` | `80` | 컨테이너 내부 포트. 바꿀 필요 없음 |
| `CERTBOT_DOMAIN`, `CERTBOT_EMAIL` | 공란 | 이 프로젝트는 **호스트 certbot**을 쓰므로 무시 |
| 기타 모든 값 | 기본값 | 특수 요구사항 없으면 그대로 |


### 5단계에서 변경할 값 (nginx 포트 2개)

호스트 nginx와의 포트 충돌을 피하기 위해 5단계에서 다음 두 값을 입력합니다 (실수했을 때의 복구 절차는 5단계 `nginx 포트 노출 복구` 절 참조).

| 키 | 변경할 값 | 이유 |
|---|---|---|
| `EXPOSE_NGINX_PORT` | `8080` | **호스트의 80은 호스트 nginx가 사용**하므로 변경 필수 |
| `EXPOSE_NGINX_SSL_PORT` | `8443` | 호스트의 443도 호스트 nginx가 사용. 충돌 방지용 변경 |

> 💡 **두 포트는 `make init-docker-env` 또는 `make docker-first-deploy` 실행 시 대화형으로 묻습니다.** 빈 입력은 default 80/443. 운영 환경에서는 위 표대로 `8080`/`8443`을 입력하세요. 자세한 프롬프트 흐름은 [5단계 — 포트 대화형 입력](#5단계--docker-스택-최초-기동) 참조.


### ⚠️ 절대 주의사항

- `SECRET_KEY`, `API_KEY_ENCRYPTION_KEY`는 **최초 생성 후 절대 변경 금지**. 변경하면 DB에 암호화된 모든 API 키가 복호화 불가능해집니다.
- `docker/.env`는 **절대 Git에 커밋하지 않음**. 이미 `.gitignore` 처리되어 있습니다.
- `.env` 파일은 **별도의 안전한 곳에 백업** 특히 자동 생성된 키들을 잃어버리면 DB 복구가 불가능합니다.

---

## 5단계 — Docker 스택 최초 기동

> 📖 키별 의미와 보존 정책은 [4단계 카탈로그](#4단계--env-환경변수-카탈로그-참고용)를 참조하세요. 이 단계는 실제 명령 실행과 `.env` 수정을 다룹니다.

```bash
cd /opt/mai-studio
make docker-first-deploy
```

> 💡 **첫 배포에는 반드시 `make docker-first-deploy`를 사용하세요.**
> 이 명령은 `init-docker-env`(키/비밀번호 자동 생성 + 관리자 계정 대화형 입력)를 먼저 실행한 뒤 스택을 기동합니다. 새 서버는 빌드 캐시가 없으므로 `docker-build-no-cache`처럼 `--no-cache`를 쓸 이유도 없고, 공식 이미지(postgres/redis 등)는 어차피 빌드 대상이 아니라 pull로 받습니다. 따라서 첫 배포는 `docker-first-deploy`가 가장 빠르고 정확합니다.
>
> `docker-build-no-cache`는 `make docker-clean-all`로 볼륨까지 리셋한 뒤나, 빌드 캐시가 꼬여 문제가 생겼을 때만 사용합니다.

### 4개 명령의 차이 (한눈에)

| 명령 | init-docker-env | 빌드 옵션 | 주 용도 |
|---|---|---|---|
| `make docker-first-deploy` | ✅ 실행 | 캐시 사용 | **첫 배포** (docker/.env 없을 때) |
| `make docker-up` | ❌ 미실행 | 빌드 안 함 (없는 것만) | 일반 시작/재시작 (운영자 수정 키 보존) |
| `make docker-build` | ❌ 미실행 | `--build`로 항상 빌드 (캐시 사용) | 코드 변경 후 재빌드 + 시작 |
| `make docker-build-no-cache` | ✅ 실행 | `--no-cache` + `--force-recreate` | 빌드 캐시 손상 시·릴리즈 빌드 |

> ⚠️ **운영 노트** — Dify 업스트림 머지 또는 `docker/.env.example` 갱신 후에는 `make init-docker-env`를 **별도 실행**해 새 환경변수를 `docker/.env`에 동기화하세요. `docker-up`/`docker-build`는 init을 타지 않으므로, 새로 추가된 환경변수가 자동 반영되지 않습니다.

### 이때 일어나는 일

1. `docker/init-env.sh` 실행:
   - `SECRET_KEY`, `API_KEY_ENCRYPTION_KEY`, 각종 비밀번호 자동 생성
   - **호스트 포트 대화형 입력** (Docker nginx의 호스트 노출 포트):
     ```
     🌐 호스트 포트 설정 (EXPOSE_NGINX_PORT / EXPOSE_NGINX_SSL_PORT)
     Enter EXPOSE_NGINX_PORT (default 80): 8080
     Enter EXPOSE_NGINX_SSL_PORT (default 443): 8443
     ```
     - 빈 입력은 default 80/443 적용
     - 비숫자 또는 1~65535 범위 외 입력 시 재입력 요청
     - 운영 환경에서는 호스트 nginx와 충돌 회피를 위해 `8080`/`8443`을 명시 입력
   - **관리자 계정 대화형 입력**:
     ```
     관리자 이메일: admin@lcampus.co.kr
     관리자 비밀번호 (최소 8자): ********
     비밀번호 확인: ********
     관리자 이름 (선택, Enter로 이메일에서 추출): LCampus Admin
     ```
2. 모든 Docker 서비스 기동 (api, worker, web-edu, nginx, postgres, redis, elasticsearch, plugin-daemon 등)
3. 최초 접속 시 지정한 이메일/비밀번호로 관리자 계정이 **자동 생성**됨

### 기동 확인

```bash
cd docker

# 모든 컨테이너 Up 상태 확인 (최초 1~3분 소요 — 이미지 pull + 초기화)
docker-compose ps
# → 권장대로 init-env.sh 프롬프트에서 8080/8443을 입력했다면
#   nginx 컨테이너의 PORTS는 0.0.0.0:8080->80/tcp, ...:8443->443/tcp 여야 합니다.
#   다른 값(예: 0.0.0.0:80->80/tcp)이 보이면 다음 "nginx 포트 노출 복구" 절을 따라 수정합니다.

# api 컨테이너 로그 모니터링 (Ctrl+C로 종료)
docker-compose logs -f api

# HTTP 응답 확인 (현재는 호스트 80 포트에 떠 있음)
curl -I http://127.0.0.1
# → HTTP/1.1 200 또는 302 응답
```

### 자동 생성된 키 백업 (중요!)

스크립트가 자동 생성한 키를 안전한 곳에 **즉시 백업**:

```bash
grep -E "^(SECRET_KEY|API_KEY_ENCRYPTION_KEY|DB_PASSWORD|REDIS_PASSWORD|ELASTICSEARCH_PASSWORD|SANDBOX_API_KEY|PLUGIN_DAEMON_KEY|PLUGIN_DIFY_INNER_API_KEY|INITIAL_ADMIN_EMAIL)=" docker/.env
```

### nginx 포트 노출 복구 (실수로 default 80/443 또는 다른 값을 입력한 경우)

`init-env.sh` 프롬프트에서 빈 입력으로 default 80/443이 적용됐거나, 의도와 다른 포트를 입력한 경우 이 절을 따릅니다. (권장 흐름대로 8080/8443을 입력했다면 이 절은 건너뜁니다.)

실수한 상태로 6단계로 가면 호스트 nginx가 80/443에 listen할 자리가 없어 **포트 충돌로 nginx 설치/기동에 실패**하므로, .env를 수정하고 nginx 컨테이너만 재생성합니다.

```bash
# 1) .env 수정
vim /opt/mai-studio/docker/.env
# EXPOSE_NGINX_PORT=8080
# EXPOSE_NGINX_SSL_PORT=8443

# 2) nginx 컨테이너만 재생성
#    ⚠️ restart 가 아닌 up -d --force-recreate 가 필수
#    restart 는 기존 컨테이너 스펙을 그대로 두어 .env 변경이 반영되지 않습니다
cd /opt/mai-studio/docker
docker-compose up -d --force-recreate nginx

# 3) 확인 — 0.0.0.0:8080->80/tcp 로 바뀌어야 함
docker-compose ps nginx
curl -I http://127.0.0.1:8080   # → 307 Temporary Redirect (Docker nginx 응답)
curl -I http://127.0.0.1        # → curl: (7) Failed to connect (호스트 nginx 자리 비어 있음)
```

**또는 더 간단히**: `make init-docker-env`를 다시 실행해 프롬프트에서 8080/8443을 명시 입력 → `cd /opt/mai-studio/docker && docker-compose up -d --force-recreate nginx`로 적용해도 동일한 결과가 됩니다.

**⚠️ 운영 중 재기동에는 `make docker-up`을 사용하세요** — `init-docker-env`/`docker-first-deploy`는 매번 두 포트를 묻고, 빈 입력 시 default 80/443으로 reset됩니다.

이 시점에서는 아직 HTTPS 접속이 불가능합니다. 호스트 nginx 설정 후 가능해집니다.

---

## 6단계 — 호스트 nginx 설치 및 리버스 프록시 설정

### 6-1. EPEL/CRB 저장소 활성화 + nginx 설치

Rocky Linux 9에서 nginx는 기본 저장소에 있지만, 이후 8단계 certbot 및 일부 모듈이 EPEL 및 CRB(CodeReady Builder) 저장소를 필요로 하므로 **여기서 함께 활성화**해 둡니다.

```bash
# 6-1-1. EPEL + CRB 저장소 활성화
sudo dnf install -y epel-release
sudo dnf config-manager --set-enabled crb

# 6-1-2. nginx 설치 및 기동
sudo dnf install -y nginx
sudo systemctl enable --now nginx

# 기동 확인
sudo systemctl status nginx
curl -I http://127.0.0.1   # nginx 기본 페이지 응답
```

### 6-2. 리버스 프록시 설정 파일 작성

Rocky에서는 `/etc/nginx/conf.d/*.conf`에 설정을 바로 둡니다 (기본 `nginx.conf`에서 `include /etc/nginx/conf.d/*.conf;`가 이미 적용되어 있어 그대로 동작).

```bash
sudo vim /etc/nginx/conf.d/mai-studio.lcampus.co.kr.conf
```

아래 내용 입력:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mai-studio.lcampus.co.kr;

    # 8단계에서 certbot이 여기에 SSL 설정과 80→443 리다이렉트를 자동 추가합니다.

    client_max_body_size 100M;   # 파일 업로드/RAG 대응

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        # 프록시 헤더
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 지원 (스트리밍 응답)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # LLM 응답 타임아웃 여유
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 60s;

        # 버퍼링 비활성화 (스트리밍 응답을 위해)
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### 6-3. 설정 검증 및 적용

```bash
sudo nginx -t                          # 문법 검증 (successful 나와야 함)
sudo systemctl reload nginx            # 무중단 재적용

# HTTP로 도메인 접속 확인 (SSL 전이므로 80)
curl -I http://mai-studio.lcampus.co.kr
# → 200 또는 302. 실패하면 DNS가 아직 전파 안 된 것
```

---

## 7단계 — SELinux 설정 ⚠️

**Rocky Linux 9는 기본 SELinux Enforcing 모드**입니다 (AL2023와 동일). 이 상태에서는 nginx가 로컬 127.0.0.1:8080으로 프록시 연결을 시도할 때 **차단됩니다** (`502 Bad Gateway`).

```bash
# 현재 SELinux 상태 확인
getenforce   # → Enforcing 이면 아래 조치 필요

# nginx가 네트워크 연결 열 수 있도록 허용 (영구 설정)
sudo setsebool -P httpd_can_network_connect 1

# 적용 확인
sudo getsebool httpd_can_network_connect
# → httpd_can_network_connect --> on
```

설정 후 nginx 리로드 불필요 — 즉시 반영.

---

## 8단계 — SSL 인증서 발급 (Let's Encrypt)

### 8-1. certbot 설치

Rocky Linux 9에서 `certbot` 패키지는 **EPEL 저장소**에 있습니다. 6단계에서 이미 `epel-release`를 활성화했으므로 바로 설치됩니다.

```bash
# EPEL이 이미 활성화된 상태여야 함 (6-1에서 처리)
sudo dnf install -y certbot python3-certbot-nginx

# 설치 검증
certbot --version
```

**보조 경로 — pip venv 방식** (EPEL 접근 불가 환경에서만):

```bash
sudo dnf install -y python3 python3-pip augeas-libs
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot

certbot --version
```

> 📌 Ubuntu 가이드에서 사용하는 `snap` 방식은 Rocky 9에서 권장되지 않습니다 (snapd 기본 미설치, classic confinement 지원 제한). Rocky에서는 EPEL의 apt-style 패키지가 1차 경로입니다.

### 8-2. 인증서 발급

```bash
sudo certbot --nginx \
  -d mai-studio.lcampus.co.kr \
  --email <운영자 이메일> \
  --agree-tos \
  --no-eff-email \
  --redirect
```

**옵션 설명**:
- `--nginx`: nginx 설정을 certbot이 자동 수정
- `-d`: 발급 대상 도메인
- `--redirect`: HTTP 요청을 HTTPS로 자동 리다이렉트

성공 시 certbot이 자동으로:
- `/etc/letsencrypt/live/mai-studio.lcampus.co.kr/fullchain.pem`, `privkey.pem` 생성
- `/etc/nginx/conf.d/mai-studio.lcampus.co.kr.conf`에 `listen 443 ssl`, `ssl_certificate ...`, HTTP→HTTPS 리다이렉트 블록 추가
- `systemd timer`로 자동 갱신 등록

### 8-3. 발급 검증

```bash
# 인증서 정보
sudo certbot certificates

# HTTPS 접속 확인
curl -I https://mai-studio.lcampus.co.kr
# → HTTP/2 200

# 자동 갱신 타이머 확인
systemctl list-timers | grep certbot
# → certbot-renew.timer 보여야 함

# 갱신 테스트 (실제 갱신은 안 함, 시뮬레이션만)
sudo certbot renew --dry-run
```

---

## 9단계 — 관리자 계정 확인 및 로그인

관리자 계정은 **5단계(`make docker-first-deploy`) 실행 시 이미 자동 생성**됩니다. 별도 등록 절차 없이 바로 로그인 가능합니다.

```
URL:      https://mai-studio.lcampus.co.kr
Email:    (5단계에서 입력한 관리자 이메일)
Password: (5단계에서 입력한 비밀번호)
```

### 소유자 비밀번호를 잊었을 때

```bash
cd /opt/mai-studio/docker

# 현재 저장된 관리자 정보 확인
grep INITIAL_ADMIN docker/.env

# 새 관리자 이메일/비밀번호를 docker/.env에 수정한 후 재시작
vim docker/.env
docker-compose restart api
```

---

## 10단계 — 배포 후 검증 체크리스트

### 10-1. 기본 기능

- [ ] `https://mai-studio.lcampus.co.kr` 접속 시 로그인 페이지 정상 표시
- [ ] 관리자 로그인 성공
- [ ] 워크스페이스/앱 생성 동작
- [ ] SSL 인증서 유효 (브라우저 자물쇠 아이콘 녹색)
- [ ] HTTP 접속 시 HTTPS로 자동 리다이렉트

### 10-2. 모델 프로바이더

- [ ] OpenAI, Anthropic 등 모델 프로바이더 플러그인 설치 확인
- [ ] API Key 등록 동작
- [ ] 테스트 대화 정상 동작

### 10-3. 교육 도메인 기능

- [ ] 세션 생성/관리
- [ ] 역할 기반 접근 제어 (Owner/Instructor/Student)
- [ ] 사용량 추적 동작
- [ ] LMS SSO 연동 (해당되는 경우)

### 10-4. 성능/안정성

- [ ] 파일 업로드 (100MB 이내) 동작
- [ ] LLM 스트리밍 응답 정상
- [ ] 서버 재부팅 후 자동 기동 확인
  ```bash
  sudo reboot
  # 재접속 후:
  docker-compose -f /opt/mai-studio/docker/docker-compose.yaml ps
  ```

---

## 운영 관리

### 백업 전략

**주기적 백업 대상** (최소 일 1회):

| 대상 | 경로 | 중요도 |
|---|---|---|
| Postgres DB | `docker/volumes/db/` | ⭐⭐⭐ 최고 |
| 앱 저장소 (업로드 파일) | `docker/volumes/app/` | ⭐⭐⭐ 최고 |
| `.env` 파일 | `docker/.env` | ⭐⭐⭐ 최고 (SECRET_KEY 포함) |
| Elasticsearch 인덱스 | `docker/volumes/elasticsearch/` | ⭐⭐ (재인덱싱 가능) |

**백업 스크립트 예시** (`/opt/mai-studio/scripts/backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/backup/mai-studio/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Postgres 덤프
docker-compose -f /opt/mai-studio/docker/docker-compose.yaml exec -T db \
  pg_dump -U postgres dify > "$BACKUP_DIR/postgres.sql"

# 앱 파일 백업
tar -czf "$BACKUP_DIR/app-volumes.tar.gz" \
  -C /opt/mai-studio/docker/volumes app

# .env 백업 (별도 안전한 곳으로)
cp /opt/mai-studio/docker/.env "$BACKUP_DIR/.env"

# 7일 이상 된 백업 삭제
find /backup/mai-studio -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
```

crontab 등록:
```bash
sudo crontab -e
# 추가:
0 3 * * * /opt/mai-studio/scripts/backup.sh >> /var/log/mai-studio-backup.log 2>&1
```

### SSL 인증서 자동 갱신

certbot 설치 시 `systemd timer`가 자동 등록됩니다. 별도 작업 불필요.

확인:
```bash
systemctl list-timers | grep certbot
```

수동 갱신:
```bash
sudo certbot renew
```

### 로그 확인

```bash
cd /opt/mai-studio/docker

# 전체 로그 (실시간)
docker-compose logs -f

# 특정 서비스만
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f web-edu

# 호스트 nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 모니터링 메트릭

```bash
# 컨테이너 리소스 사용량
docker stats

# 디스크 사용량
df -h
docker system df

# 메모리/CPU
top
free -h
```

---

## 트러블슈팅

### 502 Bad Gateway

**Rocky Linux 9에서 흔한 원인 — 순서대로 확인**:

1. **SELinux가 nginx의 로컬 프록시를 차단** (AL2023과 동일한 원인)
   ```bash
   getenforce
   # Enforcing 이면:
   sudo setsebool -P httpd_can_network_connect 1
   ```
2. **firewalld가 HTTP/HTTPS 차단** (Rocky 특유 — AL2023에는 없음)
   ```bash
   sudo firewall-cmd --list-all
   # services에 http https 보이지 않으면:
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   ```
3. **docker 그룹 미반영** — `sudo usermod -aG docker $USER` 후 재로그인을 하지 않아 `docker` 명령이 실패하면서 컨테이너가 기동되지 않은 상태. SSH를 한 번 끊고 다시 접속하세요.
4. **Docker nginx 컨테이너 다운** — `docker-compose ps`로 상태 확인.
5. **8080 포트가 열려있지 않음** — `sudo ss -tlnp | grep 8080`.
6. **로그 확인** — `sudo tail -50 /var/log/nginx/error.log`.

### certbot 발급 실패

- DNS 전파 확인: `dig +short mai-studio.lcampus.co.kr`
- 네트워크 인바운드 규칙(AWS SG 등)에 80/tcp가 열려있는지 확인 (certbot HTTP-01 검증용)
- OS 방화벽에 80 포트가 허용되어 있는지: `sudo firewall-cmd --list-all`
- 호스트 nginx가 80 포트에서 listen 중인지: `sudo ss -tlnp | grep :80`
- EPEL 저장소 활성화 상태 재확인: `dnf repolist | grep epel`

### `compose build requires buildx 0.17.0 or later`

Docker Compose v2가 내부적으로 buildx를 호출하지만, buildx 플러그인이 구버전이거나 미설치일 때 발생합니다. Docker CE 공식 저장소의 `docker-buildx-plugin`을 재설치하면 해결됩니다.

```bash
sudo dnf install --allowerasing -y docker-buildx-plugin
docker buildx version   # 0.17.0 이상 확인
```

저장소 방식이 불가한 환경이라면 2단계 백업 경로의 수동 설치 블록을 사용해 `~/.docker/cli-plugins/docker-buildx`를 최신으로 덮어쓰세요.

### 컨테이너 기동 실패

```bash
# 상세 로그 확인
docker-compose logs api | tail -100

# 흔한 원인: API_KEY_ENCRYPTION_KEY 미설정
grep API_KEY_ENCRYPTION_KEY docker/.env
# 비어있으면:
docker-compose exec api python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 결과를 docker/.env에 붙여넣고 재시작
```

### `make docker-clean-all` 권한 거부로 실패

다음 같은 에러로 `make docker-clean-all`이 중단되는 경우:

```
rm: cannot remove 'docker/volumes/app/storage/privkeys/.../private.pem': 허가 거부
make: *** [Makefile:138: docker-clean-all] 오류 1
```

**원인**: API 컨테이너가 root로 실행되어 볼륨 내부 파일이 root 소유로 생성되고, `rm`이 일반 계정으로 실행되므로 삭제에 실패합니다 (보안 권장 5번 참조).

**올바른 수습 순서** — 아래 순서를 반드시 지킬 것:

```bash
cd /opt/mai-studio/docker

# 1) 컨테이너 전부 중지
#    ⚠️ 이 단계를 건너뛰고 바로 sudo rm 으로 넘어가면, Docker daemon 이
#    사라진 마운트 경로를 root 권한으로 자동 재생성해 이후 git restore 가 막힙니다
docker-compose down

# 2) root 소유 파일 강제 삭제
cd /opt/mai-studio
sudo rm -rf docker/volumes/

# 3) Git-tracked 설정 파일 복원 (매우 중요)
#    docker/volumes/ 안에는 런타임 데이터뿐 아니라 저장소에 커밋된
#    sandbox config 등 설정 파일이 함께 들어있습니다. rm 으로 함께 지워진 것을 복원합니다:
git restore docker/volumes/

# 3-1) 복원 검증 — 최소 아래 파일들이 존재해야 함
ls docker/volumes/sandbox/conf/config.yaml
ls docker/volumes/sandbox/dependencies/python-requirements.txt
git status   # "nothing to commit, working tree clean" 이 이상적

# 4) 스택 재기동
cd docker
docker-compose up -d

# 5) 2분 정도 대기 후 상태 확인
sleep 120
docker-compose ps
docker-compose logs --tail=20 sandbox
# → "config init success" + /health 200 응답 반복이면 정상
```

⚠️ 반드시 `cd /opt/mai-studio` 한 상태에서 **상대 경로** `docker/volumes/`로만 실행하세요. 절대 경로(`/docker/volumes/`) 오타는 엉뚱한 곳을 지울 수 있습니다.

⚠️ 3단계(git restore)를 건너뛰면 sandbox 컨테이너가 `[PANIC]failed to init config: open conf/config.yaml: no such file or directory` 로 재시작 루프에 빠집니다.

근본 원인(API 비-root 실행)은 보안 권장 5번 참조. 별도 Hotfix로 해결 예정.

### 디스크 용량 부족

```bash
# Docker 사용량 확인
docker system df

# 미사용 이미지/컨테이너 정리
docker system prune -a --volumes

# 로그 로테이션 (/etc/docker/daemon.json)
sudo tee /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker
```

---

## 보안 권장 사항

### 1. SSH 설정 강화

```bash
sudo vim /etc/ssh/sshd_config
```
변경:
```
PermitRootLogin no
PasswordAuthentication no    # 키 인증만 허용
```
적용:
```bash
sudo systemctl restart sshd
```

### 2. fail2ban 설치 (SSH 무차별 대입 방지)

Rocky 9에서 fail2ban은 EPEL 저장소에 있습니다.

```bash
# EPEL이 이미 활성화된 상태여야 함 (6-1에서 처리)
sudo dnf install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 3. 파일 권한

```bash
chmod 600 /opt/mai-studio/docker/.env
```

### 4. 네트워크 인바운드 규칙 최소화

- SSH(22)는 운영자 IP로만 제한 (AWS 보안 그룹 / 온프렘 방화벽 모두)
- 불필요한 포트 모두 차단
- firewalld도 동일 원칙으로 최소 허용 유지

### 5. API 컨테이너 비-root 실행 (미완료 과제)

**현상**: API 컨테이너가 현재 root로 실행됩니다. 그 결과 `docker/volumes/app/storage/privkeys/` 아래 Fernet private key 파일이 root 소유로 생성되어, 일반 계정으로 볼륨 디렉토리를 삭제·백업·이동하려 할 때 권한 거부가 발생합니다. 특히 `make docker-clean-all` 마지막 단계의 `rm -rf docker/volumes/`가 실패해 전체 정리가 중단됩니다.

**임시 우회**: root 권한으로 강제 삭제 후 재시작합니다. 트러블슈팅 섹션 "`make docker-clean-all` 권한 거부로 실패" 블록 참조.

```bash
cd /opt/mai-studio
sudo rm -rf docker/volumes/
make docker-first-deploy
```

**근본 해결 예정**: `api/docker/entrypoint.sh`에 `gosu` 패턴을 도입해 컨테이너 내부에서 non-root 사용자로 프로세스를 전환합니다. 기존 볼륨 파일 소유권 마이그레이션 전략을 포함한 별도 Hotfix로 처리합니다 (이 가이드 범위 밖).

### 6. 정기적인 보안 업데이트

```bash
# 주 1회 실행 권장
sudo dnf update -y --security
docker-compose pull   # 이미지 업데이트
make deploy-all
```

---

## 빠른 참조

### 자주 쓰는 명령

| 목적 | 명령 |
|---|---|
| 첫 배포 | `make docker-first-deploy` |
| 전체 시작 (운영 중) | `make docker-up` |
| 전체 재배포 | `make deploy-all` |
| API만 재배포 | `make deploy-api` |
| web-edu만 재배포 | `make deploy-web` |
| 중지 | `make docker-down` |
| 재시작 | `make docker-restart` |
| DB 마이그레이션 | `cd docker && docker-compose exec api flask db upgrade` |
| 로그 확인 | `cd docker && docker-compose logs -f` |
| 호스트 nginx 리로드 | `sudo systemctl reload nginx` |
| 인증서 갱신 테스트 | `sudo certbot renew --dry-run` |
| firewalld 상태 | `sudo firewall-cmd --list-all` |

### 주요 파일 위치

| 용도 | 경로 |
|---|---|
| Docker 환경변수 | `/opt/mai-studio/docker/.env` |
| 호스트 nginx 설정 | `/etc/nginx/conf.d/mai-studio.lcampus.co.kr.conf` |
| SSL 인증서 | `/etc/letsencrypt/live/mai-studio.lcampus.co.kr/` |
| Docker 볼륨 (DB 등) | `/opt/mai-studio/docker/volumes/` |
| nginx 로그 | `/var/log/nginx/` |

---

## 최종 배포 체크리스트

배포 완료 전 아래 항목을 모두 확인.

### 인프라
- [ ] DNS A 레코드 등록 및 전파 완료
- [ ] 네트워크 인바운드 규칙(AWS SG 또는 고객사 방화벽): 22/80/443 허용
- [ ] 서버 스펙: vCPU 4, RAM 16GB, Disk 100GB 이상

### OS 및 런타임
- [ ] Rocky Linux 9 최신 패치 적용
- [ ] firewalld: HTTP/HTTPS 허용 (`firewall-cmd --add-service=http/https`)
- [ ] EPEL + CRB 저장소 활성화
- [ ] Docker CE 설치 (공식 저장소: `docker-ce` + `docker-ce-cli` + `containerd.io`)
- [ ] Compose v2 플러그인 설치 (`docker-compose-plugin`)
- [ ] Buildx 플러그인 설치 (`docker-buildx-plugin`, ≥ 0.17.0)
- [ ] `docker-compose` shim 설치 (Makefile 호환)
- [ ] 호스트 nginx 설치
- [ ] certbot 설치 (EPEL `certbot` + `python3-certbot-nginx`)
- [ ] SELinux `httpd_can_network_connect` 활성화

### 애플리케이션
- [ ] 소스 배포 (`/opt/mai-studio`, `moai-v2` 브랜치)
- [ ] `init-docker-env` 프롬프트에서 `EXPOSE_NGINX_PORT=8080`, `EXPOSE_NGINX_SSL_PORT=8443` 입력 (실수했으면 5단계 "nginx 포트 노출 복구" 절 참조)
- [ ] Docker 스택 기동 (`make docker-first-deploy`) — 관리자 계정 대화형 입력 완료
- [ ] 자동 생성된 키 별도 백업 (`SECRET_KEY`, `API_KEY_ENCRYPTION_KEY`, DB/Redis/ES 비밀번호 등)
- [ ] 모든 컨테이너 `Up` 상태 확인
- [ ] 호스트 nginx `/etc/nginx/conf.d/*.conf` 작성
- [ ] SSL 인증서 발급 및 HTTPS 동작 확인

### 운영 준비
- [ ] 관리자 계정 로그인 확인
- [ ] 모델 프로바이더 API Key 등록
- [ ] 백업 스크립트 + crontab 등록
- [ ] 인증서 자동 갱신 timer 확인
- [ ] 로그 로테이션 설정
- [ ] fail2ban 설치
- [ ] SSH 비밀번호 로그인 비활성화

### 검증
- [ ] 브라우저에서 HTTPS 접속 정상
- [ ] 로그인/워크스페이스 생성 동작
- [ ] 모델 호출 테스트 성공
- [ ] 교육 도메인 핵심 기능 동작 확인
- [ ] 서버 재부팅 후 자동 복구 확인

---

## 문의/이슈

배포 중 문제 발생 시:
- 프로젝트 저장소 Issue 등록
- 운영자: `<운영자 이메일>`

## 변경 이력

| 날짜 | 내용 | 작성자 |
|---|---|---|
| 2026-04-24 | Rocky Linux 9 버전 초안 작성 (AL2023 버전 미러링, Docker CE 저장소/firewalld/EPEL·CRB 반영, Rocky 8·10은 범위 외) | — |
| 2026-04-24 | 보안 5번(API 비-root 미완료 과제) 블록 확장: 증상·임시 우회·근본 해결 예정 명시. 트러블슈팅에 "`make docker-clean-all` 권한 거부" 블록 신규 추가 | — |
| 2026-04-24 | 실배포 필드 피드백 반영: 4단계에 "`make docker-up` 이후 포트 수정 누락 시 복구" 블록 신규(nginx 컨테이너 force-recreate 절차). 트러블슈팅 "권한 거부" 블록 재작성(올바른 순서 `down → rm → git restore → up` + git-tracked 파일 복원 + 검증 단계) | — |
| 2026-04-24 | 4단계에 "⚠️ 중요 — `init-env.sh`가 `.env`를 `.env.example` 기반으로 동기화" 경고 블록 신규. 포트 키가 백업 대상 13개에 없어 `.env` 수동 수정이 `make docker-up` 시 되돌려지는 실제 동작을 명시. 운영 중 재기동은 `make docker-up` 대신 `docker-compose restart/up -d <서비스>` 사용 권고. 근본 해결은 차기 Hotfix 예약 | — |
| 2026-04-24 | 배포 아키텍처 다이어그램의 nginx 포트 표기 수정 (Docker nginx 컨테이너의 호스트 노출 포트 = 8080 명시). 4단계 사전 수정 안내(.env 미리 만들고 포트 수정) 제거, "init-env.sh 보존 정책" 절로 축약. 5단계에 "nginx 포트 노출 변경" 절 신설(force-recreate 절차 + 운영 중 `make docker-up` 재실행 주의 통합). 사전/사후 두 갈래 안내를 사후 수정 단일 경로로 통합 | — |
| 2026-04-24 | 4단계의 역할을 "행동 단계"에서 "참고 카탈로그"로 재정의: 제목 → `.env 환경변수 카탈로그 (참고용)`, 첫머리에 "이 단계에서 작업 없음, 5단계에서 실제 수정" 안내 박스. 4단계 내부 절 톤도 행동 → 참고로 조정(`사용자가 직접 수정해야 하는 값` → `5단계에서 변경할 값 미리보기`). 5단계 시작에 4단계 카탈로그 역참조 안내 추가. 단계 번호는 유지 | — |
| 2026-04-27 | Makefile docker target 정리 hotfix 반영: 5단계 권장 명령을 `make docker-first-deploy`로 교체(init-docker-env + 스택 기동), `docker-up`/`docker-build`는 init을 타지 않도록 의미 변경, 캐시 없는 재빌드 명령 이름을 `docker-build-no-cache`로 통일(구 명칭 → 신규 이름). 4개 명령 차이 비교 표 신설 + 운영 노트(`docker/.env.example` 갱신 시 `make init-docker-env` 별도 실행) 추가. 빠른 참조/체크리스트의 명령어 일관성 보정 | — |
| 2026-04-27 | `init-docker-env`에 `EXPOSE_NGINX_PORT`/`EXPOSE_NGINX_SSL_PORT` 대화형 입력 추가. 4단계 카탈로그의 두 포트 항목에 "init 실행 시 대화형 입력" 안내 한 줄 추가, 5단계 "이때 일어나는 일" 박스에 포트 프롬프트 예시 추가. 4단계의 "포트 수정 누락 시" 트러블슈팅 블록은 보완 메커니즘으로서 그대로 유지 | — |
| 2026-04-27 | 5단계 포트 흐름을 권장 입력(8080/8443) 단일 경로로 정리. "nginx 포트 노출 변경" 절을 "nginx 포트 노출 복구"로 재정의(실수 시 절차로 명확화) + `make init-docker-env` 재실행 보조 경로 추가. 운영 주의 박스를 한 문장으로 단순화. 체크리스트 한 줄 갱신 | — |
