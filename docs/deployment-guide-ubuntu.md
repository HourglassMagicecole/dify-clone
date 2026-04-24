# MAI Studio 고객사 배포 가이드 (Ubuntu)

MAI Studio를 고객사의 AWS EC2 서버(Ubuntu 22.04 LTS / 24.04 LTS)에 배포하기 위한 단계별 가이드.

- **예시 도메인**: `mai-studio.lcampus.co.kr`
- **참조 배포**: `moai.magicecole.com` (매직에콜 운영 서버 — 동일 패턴, AL2023 기반)
- **대상 OS**: Ubuntu 22.04 LTS / 24.04 LTS (Debian 계열)
- **AL2023 버전**: `deployment-guide.md` 참조
- **예상 소요 시간**: 약 2~3시간 (DNS 전파 대기 포함)

---

## 배포 아키텍처

```
브라우저
   │ HTTPS (443)
   ▼
[호스트 nginx]                        ← SSL 종단. certbot으로 인증서 관리.
   │ HTTP (127.0.0.1:8080)             /etc/nginx/conf.d/*.conf
   ▼
[Docker nginx 컨테이너]                ← 80 포트만 사용. 내부 라우팅.
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

- [ ] **EC2 인스턴스 확보** (권장: `t3.xlarge` 이상 — vCPU 4, RAM 16GB, Disk 100GB+)
- [ ] **AWS 보안 그룹(SG) 인바운드 규칙**
  - 22/tcp (SSH) — 운영자 IP만
  - 80/tcp (HTTP) — `0.0.0.0/0` (certbot 검증용, 발급 후에는 443으로 리다이렉트됨)
  - 443/tcp (HTTPS) — `0.0.0.0/0` 또는 고객사 IP 대역
- [ ] **DNS 레코드** — 고객사 DNS 관리자에게 아래 추가 요청
  ```
  mai-studio.lcampus.co.kr  A  <EC2 공인 IP 또는 Elastic IP>
  ```
- [ ] **운영자 이메일 주소** (Let's Encrypt 만료 알림용)
- [ ] **SSH 접속 키**
- [ ] **저장소 접근 권한** (GitHub 또는 내부 Git)

**DNS 전파 확인**:
```bash
dig +short mai-studio.lcampus.co.kr
# → EC2 IP가 반환되어야 함. 반환되지 않으면 certbot 7단계에서 실패.
```

---

## 1단계 — 서버 기본 설정

SSH 접속 후 실행. Ubuntu 기본 계정은 `ubuntu`.

```bash
# 1-1. OS 업데이트
sudo apt-get update
sudo apt-get upgrade -y

# 1-2. 필수 도구 설치
sudo apt-get install -y git make curl vim ca-certificates gnupg lsb-release

# 1-3. 시간대 확인 (Dify 로그/일정 정확도를 위해)
sudo timedatectl set-timezone Asia/Seoul
date   # KST 시간 확인
```

### 방화벽 정책

Ubuntu에서도 **AWS 보안 그룹이 1차 방화벽**입니다. OS 레벨 방화벽은 `ufw`(Uncomplicated Firewall)가 기본 제공되지만, 대부분 비활성 상태입니다.

```bash
# ufw 상태 확인
sudo ufw status

# ufw가 활성 상태(active)라면 HTTP/HTTPS 허용
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# 비활성(inactive)이면 AWS SG만으로 충분하므로 그대로 둡니다.
```

---

## 2단계 — Docker 설치

Ubuntu에서는 **Docker 공식 APT 저장소**를 사용해 엔진 + Compose v2 + Buildx를 한 번에 설치합니다.

```bash
# 2-1. 혹시 설치되어 있는 구버전 제거 (있으면 제거, 없으면 통과)
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y $pkg 2>/dev/null || true
done

# 2-2. Docker 공식 GPG 키 등록
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 2-3. Docker APT 저장소 등록 (Ubuntu 22.04/24.04 코드네임 자동 치환)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

# 2-4. Docker 엔진 + Compose v2 + Buildx 플러그인 일괄 설치
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

sudo systemctl enable --now docker

# 2-5. 현재 사용자(ubuntu)를 docker 그룹에 추가 (sudo 없이 docker 명령 실행 가능)
sudo usermod -aG docker $USER
# ⚠️ 그룹 변경 적용을 위해 반드시 로그아웃 후 재접속 필요
```

### 백업 경로 — 저장소 방식이 불가할 때만

위 저장소 설치가 정상 동작하면 Compose v2/Buildx는 이미 함께 설치된 상태입니다. 만약 제한된 환경(오프라인, 프록시 등)으로 저장소 설치가 불가할 때만 아래 수동 설치를 사용합니다.

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

## 4단계 — 환경 변수 설정 (도메인/포트만 수정)

### 자동 처리되는 값 (손대지 말 것)

`make docker-up` 실행 시 `docker/init-env.sh`가 **아래 값들을 자동 생성**합니다. 직접 수정할 필요가 없고, 오히려 수동으로 건드리지 않는 것이 안전합니다.

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

### 사용자가 직접 수정해야 하는 값 (포트 2개만)

`make docker-up`을 **실행하기 전에 먼저 `.env` 파일을 만들고 아래 값만 수정**하면 됩니다. 실질적으로는 **호스트 nginx와의 포트 충돌 방지** 용도 2개뿐입니다.

```bash
cd /opt/mai-studio

# .env 파일 생성 (스크립트가 실행될 때도 만들지만, 먼저 만들어 수정 후 진행)
cp docker/.env.example docker/.env
chmod 600 docker/.env
vim docker/.env
```

수정할 값:

| 키 | 수정할 값 | 이유 |
|---|---|---|
| `EXPOSE_NGINX_PORT` | `8080` | **호스트의 80은 호스트 nginx가 사용**하므로 변경 필수 |
| `EXPOSE_NGINX_SSL_PORT` | `8443` | 호스트의 443도 호스트 nginx가 사용. 충돌 방지용 변경 |

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

### 💡 만약 OAuth 콜백 URL 등에서 http:// 생성 문제가 발생한다면

드물게 Flask가 `X-Forwarded-Proto` 헤더를 인식하지 못해 OAuth redirect URL이 `http://`로 생성되는 케이스가 있습니다. 그때만 `CONSOLE_API_URL`을 **명시적으로** 설정:

```bash
CONSOLE_API_URL=https://mai-studio.lcampus.co.kr
```

단, 6단계에서 호스트 nginx 프록시 설정에 `proxy_set_header X-Forwarded-Proto $scheme;`가 포함되어 있으면 대부분 해결됩니다.

### ⚠️ 절대 주의사항

- `SECRET_KEY`, `API_KEY_ENCRYPTION_KEY`는 **최초 생성 후 절대 변경 금지**. 변경하면 DB에 암호화된 모든 API 키가 복호화 불가능해집니다.
- `docker/.env`는 **절대 Git에 커밋하지 않음**. 이미 `.gitignore` 처리되어 있습니다.
- `.env` 파일은 **별도의 안전한 곳에 백업** (1Password, AWS Secrets Manager 등). 특히 자동 생성된 키들을 잃어버리면 DB 복구가 불가능합니다.

---

## 5단계 — Docker 스택 최초 기동

```bash
cd /opt/mai-studio
make docker-up
```

> 💡 **왜 `make docker-rebuild`가 아닌 `make docker-up`인가?**
> 새 서버는 어차피 빌드 캐시가 없어 두 명령의 결과가 **사실상 동일**합니다. 그런데 `docker-rebuild`는 `--no-cache` + `--force-recreate`를 쓰기 때문에 불필요하게 느리고, pull 가능한 공식 이미지조차 무조건 재빌드하지 않습니다 (애초에 공식 이미지는 빌드 대상이 아님). 첫 배포에는 `docker-up`이 효율적입니다.
>
> `docker-rebuild`는 `make docker-clean-all`로 볼륨까지 리셋한 뒤나, 빌드 캐시가 꼬여 문제가 생겼을 때 사용합니다.

### 이때 일어나는 일

1. `docker/init-env.sh` 실행:
   - `SECRET_KEY`, `API_KEY_ENCRYPTION_KEY`, 각종 비밀번호 자동 생성
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

# api 컨테이너 로그 모니터링 (Ctrl+C로 종료)
docker-compose logs -f api

# HTTP 응답 확인 (호스트 8080 포트 — EXPOSE_NGINX_PORT로 지정한 포트)
curl -I http://127.0.0.1:8080
# → HTTP/1.1 200 또는 302 응답
```

### 자동 생성된 키 백업 (중요!)

스크립트가 자동 생성한 키를 안전한 곳에 **즉시 백업**:

```bash
grep -E "^(SECRET_KEY|API_KEY_ENCRYPTION_KEY|DB_PASSWORD|REDIS_PASSWORD|ELASTICSEARCH_PASSWORD|SANDBOX_API_KEY|PLUGIN_DAEMON_KEY|PLUGIN_DIFY_INNER_API_KEY|INITIAL_ADMIN_EMAIL)=" docker/.env
```

→ 이 출력을 1Password / AWS Secrets Manager / 고객사 보안 저장소에 저장.

이 시점에서는 아직 HTTPS 접속이 불가능합니다. 호스트 nginx 설정 후 가능해집니다.

---

## 6단계 — 호스트 nginx 설치 및 리버스 프록시 설정

### 6-1. nginx 설치

```bash
sudo apt-get install -y nginx
sudo systemctl enable --now nginx

# 기동 확인
sudo systemctl status nginx
curl -I http://127.0.0.1   # nginx 기본 페이지 응답
```

### 6-2. 리버스 프록시 설정 파일 작성

Ubuntu는 관례적으로 `sites-available`/`sites-enabled` 구조를 쓰지만, 이 프로젝트는 AL2023 버전과 통일해 `/etc/nginx/conf.d/*.conf`에 바로 둡니다. (기본 `nginx.conf`에서 `include /etc/nginx/conf.d/*.conf;`가 이미 적용되어 있어 그대로 동작합니다.)

```bash
sudo vim /etc/nginx/conf.d/mai-studio.lcampus.co.kr.conf
```

아래 내용 입력:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mai-studio.lcampus.co.kr;

    # 7단계에서 certbot이 여기에 SSL 설정과 80→443 리다이렉트를 자동 추가합니다.

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

> 📌 Ubuntu에서 AppArmor가 기본 활성되어 있지만, Docker와 nginx의 기본 프로파일은 127.0.0.1 로컬 루프백 프록시를 차단하지 않습니다. AL2023과 달리 별도 SELinux `setsebool` 조치는 필요 없습니다.

---

## 7단계 — SSL 인증서 발급 (Let's Encrypt)

### 7-1. certbot 설치

Ubuntu는 공식 APT 저장소의 `certbot` 패키지를 기본 경로로 사용합니다.

```bash
sudo apt-get install -y certbot python3-certbot-nginx

# 설치 검증
certbot --version
```

**보조 경로 — snap 방식** (apt 저장소 사용이 어려울 때만):

```bash
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

### 7-2. 인증서 발급

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

### 7-3. 발급 검증

```bash
# 인증서 정보
sudo certbot certificates

# HTTPS 접속 확인
curl -I https://mai-studio.lcampus.co.kr
# → HTTP/2 200

# 자동 갱신 타이머 확인
systemctl list-timers | grep certbot
# → certbot.timer 또는 certbot-renew.timer 보여야 함

# 갱신 테스트 (실제 갱신은 안 함, 시뮬레이션만)
sudo certbot renew --dry-run
```

---

## 8단계 — 관리자 계정 확인 및 로그인

관리자 계정은 **5단계(`make docker-up`) 실행 시 이미 자동 생성**됩니다. 별도 등록 절차 없이 바로 로그인 가능합니다.

```
URL:      https://mai-studio.lcampus.co.kr
Email:    (5단계에서 입력한 관리자 이메일)
Password: (5단계에서 입력한 비밀번호)
```

### 비밀번호를 잊었거나 계정을 재생성하고 싶을 때

```bash
cd /opt/mai-studio/docker

# 현재 저장된 관리자 정보 확인
grep INITIAL_ADMIN docker/.env

# 새 관리자 이메일/비밀번호를 docker/.env에 수정한 후 재시작
vim docker/.env
docker-compose restart api
```

### 추가 테넌트/관리자가 필요한 경우

```bash
cd /opt/mai-studio/docker
docker-compose exec api flask init-tenant \
  --email another-admin@lcampus.co.kr \
  --password '<강력한 비밀번호>' \
  --name "Another Admin"
```

---

## 9단계 — 배포 후 검증 체크리스트

### 9-1. 기본 기능

- [ ] `https://mai-studio.lcampus.co.kr` 접속 시 로그인 페이지 정상 표시
- [ ] 관리자 로그인 성공
- [ ] 워크스페이스/앱 생성 동작
- [ ] SSL 인증서 유효 (브라우저 자물쇠 아이콘 녹색)
- [ ] HTTP 접속 시 HTTPS로 자동 리다이렉트

### 9-2. 모델 프로바이더

- [ ] OpenAI, Anthropic 등 모델 프로바이더 플러그인 설치 확인
- [ ] API Key 등록 동작
- [ ] 테스트 대화 정상 동작

### 9-3. 교육 도메인 기능

- [ ] 세션 생성/관리
- [ ] 역할 기반 접근 제어 (Owner/Instructor/Student)
- [ ] 사용량 추적 동작
- [ ] LMS SSO 연동 (해당되는 경우)

### 9-4. 성능/안정성

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

### 업데이트 배포

```bash
cd /opt/mai-studio
git pull origin moai-v2

# 전체 서비스 재배포 (API + Worker + web-edu)
make deploy-all

# DB 마이그레이션이 필요한 경우
cd docker
docker-compose exec api flask db upgrade
```

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

**Ubuntu에서 흔한 원인**:

1. **docker 그룹 미반영** — `sudo usermod -aG docker $USER` 후 재로그인을 하지 않아 `docker` 명령이 실패하면서 컨테이너가 기동되지 않은 상태. SSH를 한 번 끊고 다시 접속하세요.
2. **`ufw`로 HTTP/HTTPS 차단** — `sudo ufw status`가 active인데 80/443 허용 규칙이 없으면 프록시 경로가 막힙니다.
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```
3. **Docker nginx 컨테이너 다운** — `docker-compose ps`로 상태 확인.
4. **8080 포트가 열려있지 않음** — `sudo ss -tlnp | grep 8080`.
5. **로그 확인** — `sudo tail -50 /var/log/nginx/error.log`.

### certbot 발급 실패

- DNS 전파 확인: `dig +short mai-studio.lcampus.co.kr`
- AWS SG에 80 포트가 열려있는지 확인 (certbot HTTP-01 검증용)
- 방화벽에 80 포트 허용되어 있는지: `sudo ss -tlnp | grep :80` 또는 `sudo ufw status`

### `compose build requires buildx 0.17.0 or later`

Docker Compose v2가 내부적으로 buildx를 호출하지만, buildx 플러그인이 구버전이거나 미설치일 때 발생합니다. Docker 공식 APT 저장소의 `docker-buildx-plugin`을 재설치하면 해결됩니다.

```bash
sudo apt-get update
sudo apt-get install --reinstall -y docker-buildx-plugin
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
sudo systemctl restart ssh
```

### 2. fail2ban 설치 (SSH 무차별 대입 방지)

```bash
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 3. 파일 권한

```bash
chmod 600 /opt/mai-studio/docker/.env
```

### 4. AWS 보안 그룹 최소화

- SSH(22)는 운영자 IP로만 제한
- 불필요한 포트 모두 차단

### 5. API 컨테이너 비-root 실행 (미완료 과제)

현재 API 컨테이너가 root로 실행되는 이슈가 있음. `entrypoint.sh`의 `gosu` 패턴으로 전환 필요 (별도 Hotfix 예정).

### 6. 정기적인 보안 업데이트

```bash
# 주 1회 실행 권장
sudo apt-get update
sudo apt-get upgrade -y
docker-compose pull   # 이미지 업데이트
make deploy-all
```

---

## 빠른 참조

### 자주 쓰는 명령

| 목적 | 명령 |
|---|---|
| 전체 시작 | `make docker-up` |
| 전체 재배포 | `make deploy-all` |
| API만 재배포 | `make deploy-api` |
| web-edu만 재배포 | `make deploy-web` |
| 중지 | `make docker-down` |
| 재시작 | `make docker-restart` |
| DB 마이그레이션 | `cd docker && docker-compose exec api flask db upgrade` |
| 로그 확인 | `cd docker && docker-compose logs -f` |
| 호스트 nginx 리로드 | `sudo systemctl reload nginx` |
| 인증서 갱신 테스트 | `sudo certbot renew --dry-run` |

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
- [ ] AWS SG: 22/80/443 인바운드 허용
- [ ] EC2 스펙: vCPU 4, RAM 16GB, Disk 100GB 이상

### OS 및 런타임
- [ ] Ubuntu 22.04/24.04 최신 패치 적용
- [ ] Docker + Compose v2 설치 (공식 APT 저장소)
- [ ] Buildx 플러그인 설치 (≥ 0.17.0)
- [ ] `docker-compose` shim 설치 (Makefile 호환)
- [ ] 호스트 nginx 설치
- [ ] certbot 설치 (apt 기본, snap 보조)

### 애플리케이션
- [ ] 소스 배포 (`/opt/mai-studio`, `moai-v2` 브랜치)
- [ ] `docker/.env` 포트 값 2개 수정 (`EXPOSE_NGINX_PORT=8080`, `EXPOSE_NGINX_SSL_PORT=8443`)
- [ ] Docker 스택 기동 (`make docker-up`) — 관리자 계정 대화형 입력 완료
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
| 2026-04-22 | Ubuntu 22.04/24.04 버전 초안 작성 (AL2023 버전 미러링, apt/ufw/AppArmor 반영) | — |
