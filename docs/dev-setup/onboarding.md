# 개발자 온보딩 가이드

Dify 클론 프로젝트에 오신 것을 환영합니다! 이 가이드를 따라하면 **30분 이내**에 완전한 개발 환경을 구축하고 프로젝트를 실행할 수 있습니다.

## 📋 온보딩 체크리스트

완료된 항목에 체크하며 진행하세요:

### 사전 준비 (5분)
- [ ] 프로젝트 클론 완료
- [ ] 운영체제별 요구사항 확인
- [ ] 관리자 권한 준비 (필요시)

### 개발 환경 설정 (15분)
- [ ] Python 3.11-3.13 설치
- [ ] Node.js >=22.11.0 설치
- [ ] UV 패키지 관리자 설치
- [ ] pnpm 패키지 관리자 설치
- [ ] Docker Desktop 설치 및 실행

### 프로젝트 설정 (5분)
- [ ] 프로젝트 의존성 설치
- [ ] 환경 변수 설정
- [ ] 환경 검증 완료

### 첫 실행 (5분)
- [ ] API 서버 실행 확인
- [ ] 프론트엔드 실행 확인
- [ ] 모든 서비스 정상 동작 확인

---

## 🚀 빠른 시작

### 1단계: 자동 설정 스크립트 실행

**Mac/Linux 사용자:**
```bash
# 프로젝트 루트에서 실행
./scripts/setup-dev-env.sh
```

**Windows 사용자:**
```powershell
# PowerShell을 관리자 권한으로 실행
.\scripts\setup-dev-env.ps1
```

### 2단계: 환경 검증
```bash
# 모든 플랫폼
./scripts/verify-env.sh
```

### 3단계: 개발 서버 실행
```bash
# 터미널 1: API 서버
./dev/start-api

# 터미널 2: Celery 워커
./dev/start-worker

# 터미널 3: 프론트엔드
cd web && pnpm dev
```

🎉 **완료!** 다음 URL에서 애플리케이션에 접근하세요:
- Frontend: http://localhost:3000
- API: http://localhost:5001

---

## 📖 상세 설치 가이드

자동 스크립트가 실패하거나 수동 설치를 원한다면 다음 가이드를 참조하세요:

### 운영체제별 요구사항

| 운영체제 | 최소 버전 | 권장 사양 |
|----------|-----------|-----------|
| macOS | 10.15 (Catalina) | macOS 12+ (Monterey), 8GB RAM |
| Windows | Windows 10 Pro/Enterprise | Windows 11, WSL 2, 8GB RAM |
| Ubuntu | 20.04 LTS | Ubuntu 22.04 LTS, 8GB RAM |
| Other Linux | - | 최신 배포판, 8GB RAM |

### 필수 소프트웨어 설치

#### 1. Python 설치
```bash
# macOS (Homebrew)
brew install python@3.12

# Ubuntu/Debian
sudo apt install python3.12 python3.12-dev python3.12-venv

# Windows
# https://www.python.org/downloads/windows/ 에서 다운로드
```

#### 2. Node.js 설치
```bash
# macOS (Homebrew)
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows
# https://nodejs.org/ 에서 다운로드
```

#### 3. 패키지 관리자 설치
```bash
# UV (모든 플랫폼)
curl -LsSf https://astral.sh/uv/install.sh | sh  # Unix
# 또는 irm https://astral.sh/uv/install.ps1 | iex  # Windows

# pnpm (모든 플랫폼)
npm install -g pnpm
```

### Docker 설치

Docker 설치는 운영체제마다 다릅니다. 자세한 내용은 [Docker 설치 가이드](./docker-setup.md)를 참조하세요.

**요약:**
- **macOS/Windows**: Docker Desktop 설치
- **Linux**: Docker Engine + Docker Compose 설치

---

## 🔧 프로젝트 설정

### 의존성 설치

```bash
# 프로젝트 루트에서
cd dify-clone

# API 의존성 설치
uv sync --project api

# Web 의존성 설치
cd web && pnpm install && cd ..
```

### 환경 변수 설정

```bash
# 개발용 환경 파일 생성 (처음 한 번만)
# 방법 1: 최소 설정으로 시작 (권장)
cat > .env.development << 'EOF'
# 개발 환경
FLASK_ENV=development
DEBUG=true

# 데이터베이스 (PostgreSQL 필요)
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=dify_dev
DB_USERNAME=postgres
DB_PASSWORD=your_password_here  # ← 실제 비밀번호로 변경!

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 보안
SECRET_KEY=dev-secret-key-change-in-production

# URLs
CONSOLE_API_URL=http://localhost:5001
CONSOLE_WEB_URL=http://localhost:3000

# OpenAI (선택사항)
OPENAI_API_KEY=sk-...  # ← OpenAI 사용시 실제 키 입력
EOF

# 방법 2: 전체 템플릿에서 시작
cp .env.example .env.development
# 그 다음 편집기로 열어서 필요한 값만 수정
```

**중요**: 실제 비밀번호와 API 키를 설정하세요:
- `DB_PASSWORD`: PostgreSQL 비밀번호
- `OPENAI_API_KEY`: OpenAI API 키 (있는 경우)
- `SECRET_KEY`: 보안을 위해 고유한 값으로 변경

---

## 🎯 개발 워크플로우

### 일반적인 개발 프로세스

1. **매일 시작할 때:**
   ```bash
   # 최신 코드 가져오기
   git pull origin main

   # 의존성 업데이트 확인
   uv sync --project api
   cd web && pnpm install && cd ..
   ```

2. **개발 서버 실행:**
   ```bash
   # 3개 터미널에서 각각 실행
   ./dev/start-api      # API 서버
   ./dev/start-worker   # Celery 워커
   cd web && pnpm dev   # 프론트엔드
   ```

3. **코드 작성 및 테스트:**
   ```bash
   # 코드 포매팅
   ./dev/reformat

   # 테스트 실행
   uv run --project api pytest tests/unit_tests/
   cd web && pnpm test && cd ..
   ```

4. **커밋 전 체크:**
   ```bash
   # 환경 검증
   ./scripts/verify-env.sh

   # 린팅 및 타입 체크
   ./dev/reformat
   uv run --directory api basedpyright
   cd web && pnpm lint && cd ..
   ```

### 브랜치 전략

- `main`: 프로덕션 준비된 코드
- `develop`: 개발 중인 코드
- `feature/기능명`: 새로운 기능 개발
- `bugfix/이슈번호`: 버그 수정

### 코드 리뷰 가이드라인

1. **PR 생성 전:**
   - 모든 테스트 통과 확인
   - 코드 포매팅 적용
   - 의미 있는 커밋 메시지 작성

2. **PR 제목 형식:**
   - `feat: 새로운 기능 추가`
   - `fix: 버그 수정`
   - `docs: 문서 업데이트`
   - `refactor: 코드 리팩터링`

---

## 🛠️ 문제 해결

### 자주 발생하는 문제들

#### 1. Python 버전 문제
```bash
# 문제: Python 버전이 맞지 않음
# 해결: pyenv 사용
pyenv install 3.12.7
pyenv local 3.12.7
```

#### 2. Node.js 버전 문제
```bash
# 문제: Node.js 버전이 낮음
# 해결: nvm 사용
nvm install 22
nvm use 22
```

#### 3. Docker 권한 문제 (Linux)
```bash
# 문제: permission denied while trying to connect to Docker daemon
# 해결: 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker
```

#### 4. 포트 충돌 문제
```bash
# 문제: 포트가 이미 사용 중
# 해결: 사용 중인 프로세스 확인 및 종료
lsof -i :5001  # macOS/Linux
netstat -ano | findstr :5001  # Windows
```

#### 5. UV 설치 실패
```bash
# 문제: UV 설치가 안됨
# 해결: 수동 설치
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.cargo/bin:$PATH"
```

#### 6. pnpm 설치 실패
```bash
# 문제: pnpm 설치가 안됨
# 해결: npm으로 설치
npm install -g pnpm
# 또는 corepack 사용
corepack enable
corepack prepare pnpm@latest --activate
```

### Docker 관련 문제

#### Docker Desktop이 시작되지 않는 경우
- **macOS**: Docker Desktop 재시작, 필요시 재설치
- **Windows**: WSL 2 상태 확인, Hyper-V 설정 확인
- **Linux**: Docker 서비스 상태 확인 (`sudo systemctl status docker`)

#### 컨테이너 빌드 실패
```bash
# Docker 캐시 정리
docker system prune -a

# 컨테이너 재빌드
docker compose build --no-cache
```

### 메모리 부족 문제

Docker Desktop 메모리 할당:
- **최소**: 4GB
- **권장**: 8GB

시스템 메모리가 부족한 경우:
- 불필요한 애플리케이션 종료
- Docker Desktop 메모리 제한 설정

---

## 📞 도움 요청

### 지원 채널

1. **기술적 문제**: GitHub Issues에 버그 리포트 작성
2. **문서 개선**: docs/ 폴더에 수정 제안 PR 생성
3. **질문**: GitHub Discussions 활용

### 이슈 리포트 템플릿

```markdown
## 문제 설명
[문제가 무엇인지 명확하게 설명]

## 재현 단계
1. [첫 번째 단계]
2. [두 번째 단계]
3. [세 번째 단계]

## 예상 결과
[무엇이 일어날 것으로 예상했는지]

## 실제 결과
[실제로 무엇이 일어났는지]

## 환경 정보
- OS: [예: macOS 14.0]
- Python: [예: 3.12.7]
- Node.js: [예: v22.11.0]
- Docker: [예: 24.0.7]

## 추가 정보
[스크린샷, 로그, 기타 컨텍스트]
```

---

## 🎓 학습 자료

### 필수 기술 스택 학습

1. **Backend (Python)**
   - [Flask 공식 문서](https://flask.palletsprojects.com/)
   - [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
   - [Celery 비동기 작업](https://docs.celeryproject.org/)

2. **Frontend (TypeScript/React)**
   - [Next.js 공식 가이드](https://nextjs.org/docs)
   - [React 19 문서](https://react.dev/)
   - [Tailwind CSS](https://tailwindcss.com/docs)

3. **DevOps & Tools**
   - [Docker 공식 튜토리얼](https://docs.docker.com/get-started/)
   - [UV 패키지 관리자](https://docs.astral.sh/uv/)
   - [pnpm 가이드](https://pnpm.io/motivation)

### 프로젝트 아키텍처 이해

- `docs/architecture/`: 전체 시스템 아키텍처
- `docs/prd/`: 제품 요구사항 문서
- `CLAUDE.md`: 프로젝트 개발 가이드라인

### 코딩 표준

- **Python**: Type hints 필수, Ruff 포매터 사용
- **TypeScript**: Strict mode, ESLint + Prettier
- **Git**: Conventional Commits 규칙 준수

---

## ✅ 30분 온보딩 체크포인트

### 10분 체크포인트
- [ ] 자동 설정 스크립트 실행 완료
- [ ] 모든 필수 도구 설치 완료
- [ ] Docker Desktop 실행 중

### 20분 체크포인트
- [ ] 프로젝트 의존성 설치 완료
- [ ] 환경 변수 설정 완료
- [ ] 환경 검증 스크립트 통과

### 30분 체크포인트
- [ ] API 서버 정상 실행 (http://localhost:5001)
- [ ] 프론트엔드 정상 실행 (http://localhost:3000)
- [ ] 모든 서비스 연동 확인

### 완료 후 다음 단계

1. **프로젝트 구조 파악**: 각 디렉터리의 역할 이해
2. **첫 번째 이슈 할당**: GitHub Issues에서 'good first issue' 태그 확인
3. **코드 리뷰 참여**: 다른 개발자의 PR 리뷰 경험
4. **개발 프로세스 숙지**: 브랜치 전략 및 배포 프로세스 이해

---

## 🎉 환영합니다!

축하합니다! Dify 클론 프로젝트 개발 환경 구축을 완료했습니다.

이제 다음과 같이 시작해보세요:

1. **코드 탐색**: API와 Web 디렉터리의 구조를 살펴보세요
2. **첫 번째 변경**: 간단한 텍스트 수정이나 스타일 변경으로 시작해보세요
3. **테스트 실행**: 기존 테스트를 실행하고 통과하는지 확인해보세요
4. **문서 기여**: 이 온보딩 가이드의 부족한 부분을 개선해보세요

질문이 있으시면 언제든 GitHub Issues나 Discussions를 활용해 주세요.

**Happy Coding!** 🚀