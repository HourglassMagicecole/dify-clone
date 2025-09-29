# k6 Load Testing Suite

## Prerequisites

### Install k6

k6는 npm 패키지가 아니므로 별도로 설치해야 합니다.

#### macOS
```bash
brew install k6
# 또는
npm run install:k6:mac
```

#### Linux
```bash
curl -s https://get.k6.io | bash
# 또는
npm run install:k6:linux
```

#### Docker (Alternative)
```bash
docker pull grafana/k6
```

### Verify Installation
```bash
npm run verify:k6
```

## Test Execution

### 1. 교육 세션 테스트
```bash
npm run test:load
# 또는
k6 run -e API_URL=http://localhost:5001 education-session.js
```

### 2. 동시 사용자 테스트
```bash
npm run test:concurrent
# 또는
k6 run -e API_URL=http://localhost:5001 concurrent-users.js
```

### 3. WebSocket 테스트
```bash
npm run test:websocket
# 또는
k6 run -e API_URL=http://localhost:5001 websocket-test.js
```

### 4. 스트레스 테스트
```bash
npm run test:stress
# 또는
k6 run -e API_URL=http://localhost:5001 stress-test.js
```

### 5. 모든 테스트 실행
```bash
npm run test:all
```

## Performance Benchmarks

기본 성능 임계값:
- **API 응답 시간**: p90 < 3초, p95 < 5초
- **LLM 응답 시간**: p90 < 30초
- **동시 사용자**: 50명 (10→20→30→40→50 점진적 증가)
- **에러율**: < 1% (정상), > 5% (위험)
- **CPU 사용률**: < 70% (정상), > 85% (위험)
- **메모리**: < 2GB (정상), > 3GB (위험)

## Docker Execution

k6가 설치되지 않은 환경에서:
```bash
docker run --rm -i -e API_URL=http://host.docker.internal:5001 \
  -v $(pwd):/scripts \
  grafana/k6 run /scripts/education-session.js
```

## Reports

HTML 리포트 생성:
```bash
npm run report:html
```

Grafana Dashboard 연동:
- InfluxDB + Grafana를 설정한 경우
- `grafana-export.js`의 설정 참조

## Configuration

`.env` 파일로 설정 가능:
```bash
cp .env.example .env
```

환경 변수:
- `API_URL`: API 서버 주소
- `API_KEY`: API 인증 키
- `VUS`: Virtual Users 수
- `DURATION`: 테스트 지속 시간

## Troubleshooting

### k6 설치 실패
- macOS: Homebrew 설치 확인 (`brew --version`)
- Linux: curl 설치 확인 (`curl --version`)
- 권한 문제: sudo 사용

### API 연결 실패
- API 서버 실행 확인
- 방화벽/포트 설정 확인
- `.env` 파일 설정 확인

### 메모리 부족
- Virtual Users 수 줄이기
- 테스트 duration 줄이기
- 시스템 리소스 모니터링