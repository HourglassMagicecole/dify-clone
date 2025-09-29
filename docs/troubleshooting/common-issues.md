# 일반적인 문제 해결 가이드

Dify Clone Education Platform 사용 시 자주 발생하는 문제들과 빠른 해결 방법을 제공합니다.

## 목차
- [개발 환경 설정 문제](#개발-환경-설정-문제)
- [서버 시작 문제](#서버-시작-문제)
- [데이터베이스 연결 문제](#데이터베이스-연결-문제)
- [API 통신 문제](#api-통신-문제)
- [성능 및 속도 문제](#성능-및-속도-문제)
- [UI/UX 관련 문제](#uiux-관련-문제)
- [테스트 실행 문제](#테스트-실행-문제)
- [배포 및 운영 문제](#배포-및-운영-문제)

---

## 개발 환경 설정 문제

### 🔧 "uv not found" 에러
**증상:** `uv: command not found` 메시지
**원인:** UV 패키지 관리자가 설치되지 않음
**해결:**
```bash
# macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 설치 확인
uv --version
```

### 🔧 Python 버전 호환성 문제
**증상:** `Python 3.11+ required` 경고
**원인:** 지원되지 않는 Python 버전 사용
**해결:**
```bash
# Python 버전 확인
python --version

# uv로 Python 3.11 설치
uv python install 3.11

# 프로젝트에서 Python 버전 설정
uv python pin 3.11
```

### 🔧 Node.js/pnpm 설정 문제
**증상:** `pnpm: command not found`
**원인:** pnpm이 설치되지 않음
**해결:**
```bash
# Node.js 22.11.0+ 확인
node --version

# pnpm 설치
npm install -g pnpm

# 또는 Homebrew로 설치 (macOS)
brew install pnpm

# 프론트엔드 의존성 설치
cd web && pnpm install
```

### 🔧 환경 변수 설정 누락
**증상:** 서버 실행 시 설정 오류
**원인:** 필수 환경 변수 누락
**해결:**
```bash
# .env 파일 생성
cp .env.example .env

# 필수 환경 변수 설정
export DATABASE_URL="postgresql://user:pass@localhost:5432/dify_dev"
export REDIS_URL="redis://localhost:6379/0"
export OPENAI_API_KEY="your-api-key"

# 환경 변수 확인
echo $DATABASE_URL
```

---

## 서버 시작 문제

### 🚀 API 서버가 시작되지 않음
**증상:** `./dev/start-api` 실행 시 오류
**원인:** 포트 충돌 또는 의존성 문제
**해결:**
```bash
# 1. 포트 사용 확인
lsof -i :5001
kill -9 <PID>  # 필요시 프로세스 종료

# 2. 의존성 재설치
uv sync --dev

# 3. 데이터베이스 마이그레이션
uv run --project api flask db upgrade

# 4. API 서버 재시작
./dev/start-api
```

### 🚀 Celery Worker 시작 실패
**증상:** `./dev/start-worker` 명령어 실패
**원인:** Redis 연결 또는 설정 문제
**해결:**
```bash
# Redis 상태 확인
redis-cli ping

# Redis 서버 시작 (필요시)
redis-server

# Celery Worker 재시작
./dev/start-worker

# Worker 상태 확인
uv run --project api celery -A app.celery inspect active
```

### 🚀 프론트엔드 개발 서버 문제
**증상:** `pnpm dev` 실행 시 오류
**원인:** 패키지 의존성 또는 포트 충돌
**해결:**
```bash
cd web

# 의존성 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 포트 변경 (필요시)
pnpm dev --port 3001

# TypeScript 에러 확인
pnpm type-check
```

---

## 데이터베이스 연결 문제

### 🗄️ PostgreSQL 연결 실패
**증상:** `Connection to database failed`
**원인:** PostgreSQL 서버 미실행 또는 설정 문제
**해결:**
```bash
# PostgreSQL 상태 확인
pg_isready -h localhost -p 5432

# PostgreSQL 서버 시작
# macOS (Homebrew)
brew services start postgresql@14

# Linux (systemd)
sudo systemctl start postgresql

# Docker 사용 시
docker-compose up -d postgres

# 연결 테스트
psql -h localhost -U postgres -d dify_dev
```

### 🗄️ 마이그레이션 실행 문제
**증상:** `flask db upgrade` 실패
**원인:** 스키마 충돌 또는 권한 문제
**해결:**
```bash
# 현재 마이그레이션 상태 확인
uv run --project api flask db current

# 마이그레이션 히스토리 확인
uv run --project api flask db history

# 강제 마이그레이션 (주의: 데이터 손실 가능)
uv run --project api flask db stamp head
uv run --project api flask db upgrade

# 새로운 마이그레이션 생성
uv run --project api flask db migrate -m "Fix migration"
```

### 🗄️ 데이터베이스 초기화 문제
**증상:** 테이블이 생성되지 않음
**원인:** 초기 데이터 설정 문제
**해결:**
```bash
# 데이터베이스 완전 초기화 (개발 환경만)
dropdb dify_dev && createdb dify_dev

# 스키마 재생성
uv run --project api flask db init
uv run --project api flask db migrate -m "Initial migration"
uv run --project api flask db upgrade

# 샘플 데이터 생성
uv run --project api python api/scripts/seed_database.py
```

---

## API 통신 문제

### 🌐 CORS 에러
**증상:** 브라우저에서 `CORS policy` 에러
**원인:** Cross-Origin 요청 설정 문제
**해결:**
```python
# api/app.py에서 CORS 설정 확인
from flask_cors import CORS

CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:3001",
    "https://your-frontend-domain.com"
])
```

### 🌐 API 응답 지연
**증상:** API 요청이 30초 이상 소요
**원인:** 데이터베이스 쿼리 최적화 필요
**해결:**
```bash
# 느린 쿼리 로깅 활성화
export SQLALCHEMY_ECHO=True

# 프로파일링 활성화
export FLASK_PROFILE=True

# 성능 테스트 실행
k6 run tests/load/education-session.js

# 데이터베이스 인덱스 확인
uv run --project api python -c "
from app import create_app
app = create_app()
with app.app_context():
    from flask import current_app
    print('Database indexes:', current_app.db.engine.execute('SELECT * FROM pg_indexes').fetchall())
"
```

### 🌐 인증 토큰 문제
**증상:** 로그인 후에도 401 Unauthorized
**원인:** 토큰 형식 또는 헤더 설정 문제
**해결:**
```javascript
// 올바른 헤더 설정
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// 토큰 유효성 검사
const verifyToken = async (token) => {
  const response = await fetch('/edu/api/auth/verify', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.ok;
};
```

---

## 성능 및 속도 문제

### ⚡ 페이지 로딩 속도 문제
**증상:** 웹 페이지가 5초 이상 로딩됨
**원인:** 번들 크기 또는 이미지 최적화 문제
**해결:**
```bash
cd web

# 번들 분석
pnpm build
pnpm analyze

# 이미지 최적화 (Next.js)
# next.config.js에서 이미지 설정 확인
```

### ⚡ Agent 생성 속도 문제
**증상:** Agent 생성에 30초 이상 소요
**원인:** LLM API 호출 최적화 필요
**해결:**
```python
# 병렬 처리로 Agent 생성 최적화
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def create_agent_batch(agents_data):
    with ThreadPoolExecutor(max_workers=5) as executor:
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(executor, create_single_agent, agent_data)
            for agent_data in agents_data
        ]
        return await asyncio.gather(*tasks)
```

### ⚡ 데이터베이스 쿼리 최적화
**증상:** 특정 API가 느림 (> 3초)
**원인:** N+1 쿼리 문제
**해결:**
```python
# 잘못된 예 (N+1 문제)
users = User.query.all()
for user in users:
    print(user.agents)  # 각 사용자마다 추가 쿼리

# 올바른 예 (조인 로딩)
from sqlalchemy.orm import joinedload

users = User.query.options(joinedload(User.agents)).all()
for user in users:
    print(user.agents)  # 추가 쿼리 없음
```

---

## UI/UX 관련 문제

### 🎨 스타일링 문제
**증상:** CSS 스타일이 적용되지 않음
**원인:** Tailwind CSS 설정 또는 빌드 문제
**해결:**
```bash
cd web

# Tailwind CSS 빌드
pnpm build-css

# PostCSS 설정 확인
cat postcss.config.js

# 개발 서버 재시작
pnpm dev
```

### 🎨 반응형 디자인 문제
**증상:** 모바일에서 레이아웃 깨짐
**원인:** CSS 브레이크포인트 설정 문제
**해결:**
```css
/* tailwind.config.js에서 브레이크포인트 확인 */
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
    }
  }
}
```

### 🎨 다국어 지원 문제
**증상:** 번역 텍스트가 표시되지 않음
**원인:** i18n 설정 또는 번역 파일 누락
**해결:**
```bash
cd web

# 번역 파일 확인
ls i18n/

# 번역 키 누락 검사
pnpm i18n-check

# 개발 모드에서 번역 키 표시
export NEXT_PUBLIC_I18N_DEBUG=true
```

---

## 테스트 실행 문제

### 🧪 Unit 테스트 실패
**증상:** `pytest` 실행 시 오류
**원인:** 테스트 의존성 또는 환경 설정 문제
**해결:**
```bash
# 테스트 의존성 확인
uv sync --group test

# 테스트 데이터베이스 설정
export DATABASE_URL="postgresql://user:pass@localhost:5432/dify_test"
uv run --project api flask db upgrade

# 특정 테스트만 실행
uv run --project api pytest tests/unit_tests/test_auth.py -v

# 전체 테스트 실행
uv run --project api pytest tests/unit_tests/
```

### 🧪 통합 테스트 실패
**증상:** 통합 테스트에서 API 연결 실패
**원인:** 테스트 서버 설정 문제
**해결:**
```bash
# API 서버가 실행 중인지 확인
curl http://localhost:5001/health

# 테스트 환경 변수 설정
export TEST_API_URL="http://localhost:5001"

# 통합 테스트 실행
uv run --project api pytest tests/integration_tests/ -v
```

### 🧪 부하 테스트 문제
**증상:** k6 테스트가 실행되지 않음
**원인:** k6 설치 또는 설정 문제
**해결:**
```bash
# k6 설치 확인
k6 version

# k6 설치 (필요시)
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# 테스트 실행
cd tests/load
k6 run education-session.js
```

---

## 배포 및 운영 문제

### 🚢 Docker 빌드 실패
**증상:** `docker build` 명령어 실패
**원인:** Dockerfile 설정 또는 의존성 문제
**해결:**
```bash
# Docker 버전 확인
docker --version
docker-compose --version

# 이미지 재빌드 (캐시 없이)
docker-compose build --no-cache

# 로그 확인
docker-compose logs api
docker-compose logs worker

# 컨테이너 상태 확인
docker-compose ps
```

### 🚢 환경 변수 설정 문제
**증상:** 운영 환경에서 설정 오류
**원인:** 환경별 설정 파일 누락
**해결:**
```bash
# 환경별 설정 파일 생성
cp .env.example .env.production

# 필수 변수 설정 확인
cat << 'EOF' > check-env.sh
#!/bin/bash
required_vars=("DATABASE_URL" "REDIS_URL" "OPENAI_API_KEY")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var is not set"
        exit 1
    else
        echo "✅ $var is set"
    fi
done
EOF

chmod +x check-env.sh && ./check-env.sh
```

### 🚢 메모리 부족 문제
**증상:** 서버가 자주 재시작됨
**원인:** 메모리 누수 또는 설정 문제
**해결:**
```bash
# 메모리 사용량 모니터링
top -p $(pgrep -f "gunicorn")

# Gunicorn 설정 최적화
# gunicorn.conf.py
workers = 2  # 메모리가 부족할 경우 줄이기
max_requests = 1000  # 메모리 누수 방지
max_requests_jitter = 50

# 메모리 사용량 알림 설정
echo "*/5 * * * * /path/to/check-memory.sh" | crontab -
```

---

## 빠른 진단 도구

### 🔍 시스템 상태 점검
```bash
#!/bin/bash
# ./dev/health-check

echo "=== Dify Clone Health Check ==="

# API 서버 상태
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ API Server: Running"
else
    echo "❌ API Server: Down"
fi

# 데이터베이스 연결
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL: Connected"
else
    echo "❌ PostgreSQL: Disconnected"
fi

# Redis 연결
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Connected"
else
    echo "❌ Redis: Disconnected"
fi

# 프론트엔드 서버
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend: Running"
else
    echo "❌ Frontend: Down"
fi

echo "=== Resource Usage ==="
echo "CPU: $(top -l1 | grep "CPU usage" | awk '{print $3}' | cut -d% -f1)%"
echo "Memory: $(top -l1 | grep "PhysMem" | awk '{print $2}' | cut -d/ -f1)"
echo "Disk: $(df -h / | awk 'NR==2{print $5}')"
```

### 🔍 로그 분석 도구
```bash
#!/bin/bash
# ./dev/analyze-logs

echo "=== Recent Errors ==="
tail -50 api/logs/error.log | grep ERROR

echo "=== Performance Issues ==="
tail -100 api/logs/app.log | grep -E "(slow|timeout|exceeded)"

echo "=== Database Issues ==="
tail -50 api/logs/database.log | grep -E "(deadlock|timeout|failed)"
```

### 🔍 의존성 확인 도구
```bash
#!/bin/bash
# ./dev/check-deps

echo "=== Python Dependencies ==="
uv tree

echo "=== Node.js Dependencies ==="
cd web && pnpm list --depth=0

echo "=== System Dependencies ==="
which python3 uv node pnpm postgres redis-server
```

---

## 자주 묻는 질문 (FAQ)

### Q1: 개발 환경에서 HTTPS를 사용할 수 있나요?
**A:** 네, `mkcert`를 사용하여 로컬 SSL 인증서를 생성할 수 있습니다:
```bash
# mkcert 설치
brew install mkcert  # macOS
# Linux: curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"

# 로컬 CA 설치
mkcert -install

# 인증서 생성
mkcert localhost 127.0.0.1 ::1

# Next.js에서 HTTPS 사용
pnpm dev --experimental-https
```

### Q2: 데이터베이스 백업은 어떻게 하나요?
**A:** PostgreSQL 백업 스크립트를 사용하세요:
```bash
#!/bin/bash
# ./dev/backup-db

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="dify_dev"

mkdir -p $BACKUP_DIR

pg_dump $DB_NAME > "$BACKUP_DIR/backup_${TIMESTAMP}.sql"
echo "Backup created: $BACKUP_DIR/backup_${TIMESTAMP}.sql"
```

### Q3: API 응답이 느린 원인을 어떻게 찾나요?
**A:** 프로파일링 도구를 사용하세요:
```python
# Flask 프로파일링 활성화
export FLASK_PROFILE=1

# 또는 코드에서 직접 측정
import time
from functools import wraps

def measure_time(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = f(*args, **kwargs)
        end = time.time()
        print(f"{f.__name__} took {end-start:.2f}s")
        return result
    return wrapper
```

---

## 추가 지원

### 📞 지원 채널
- **GitHub Issues**: 버그 리포트 및 기능 요청
- **Discord**: 실시간 커뮤니티 지원
- **Documentation**: 상세한 기술 문서
- **Email**: 긴급 지원 요청

### 📚 유용한 리소스
- [API 문서](../api-documentation.md)
- [성능 최적화 가이드](performance.md)
- [보안 가이드](security.md)
- [배포 가이드](deployment.md)

### 🔧 개발 도구
- **VS Code Extensions**: Python, TypeScript, Docker
- **Database Tools**: PgAdmin, DBeaver
- **API Testing**: Postman, Insomnia
- **Monitoring**: Grafana, Prometheus

---

> 💡 **팁**: 문제가 지속되면 `./dev/collect-debug-info`를 실행하여 디버그 정보를 수집하고 지원팀에 제공해주세요.