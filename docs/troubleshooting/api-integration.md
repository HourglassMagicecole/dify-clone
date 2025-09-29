# API 통합 문제 해결 가이드

Dify Clone Education Platform API 통합 관련 일반적인 문제와 해결 방법을 제공합니다.

## 목차
- [인증 및 권한 문제](#인증-및-권한-문제)
- [Agent API 연동 문제](#agent-api-연동-문제)
- [Workflow 실행 문제](#workflow-실행-문제)
- [RAG 파이프라인 문제](#rag-파이프라인-문제)
- [WebSocket 연결 문제](#websocket-연결-문제)
- [파일 업로드 문제](#파일-업로드-문제)
- [Rate Limiting 문제](#rate-limiting-문제)

## 인증 및 권한 문제

### 1. 401 Unauthorized 에러
```
문제: API 요청 시 401 Unauthorized 응답
원인: 유효하지 않거나 만료된 인증 토큰
```

**해결 방법:**
```bash
# 1. 토큰 유효성 확인
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5001/edu/api/auth/verify

# 2. 새 토큰 발급
curl -X POST http://localhost:5001/edu/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "user", "password": "password"}'

# 3. 토큰 갱신
curl -X POST http://localhost:5001/edu/api/auth/refresh \
     -H "Authorization: Bearer REFRESH_TOKEN"
```

### 2. 403 Forbidden 에러
```
문제: 권한이 있는 사용자임에도 403 응답
원인: 역할 기반 접근 제어 설정 문제
```

**해결 방법:**
```python
# 사용자 역할 확인
import requests

response = requests.get(
    "http://localhost:5001/edu/api/users/me",
    headers={"Authorization": f"Bearer {token}"}
)
user_info = response.json()
print(f"User role: {user_info.get('role')}")
```

## Agent API 연동 문제

### 1. Agent 생성 실패 (HTTP 500)
```
문제: Agent 생성 시 서버 내부 오류
원인: 모델 설정 오류 또는 리소스 부족
```

**해결 방법:**
```python
# 1. 최소 설정으로 Agent 생성 테스트
minimal_agent = {
    "name": "test-agent",
    "description": "Test agent",
    "model": "gpt-3.5-turbo",  # 확인된 모델 사용
    "temperature": 0.7,
    "max_tokens": 1000
}

# 2. 시스템 리소스 확인
uv run --project api python -c "
import psutil
print(f'CPU: {psutil.cpu_percent()}%')
print(f'Memory: {psutil.virtual_memory().percent}%')
"
```

### 2. Agent 응답 시간 지연
```
문제: Agent 응답이 30초 이상 지연
원인: LLM 모델 과부하 또는 네트워크 지연
```

**해결 방법:**
```python
# 1. 타임아웃 설정
import requests

response = requests.post(
    "http://localhost:5001/v1/chat/completions",
    json=payload,
    headers=headers,
    timeout=60  # 60초 타임아웃
)

# 2. 스트리밍 응답 사용
payload = {
    "inputs": {"message": "Hello"},
    "response_mode": "streaming"
}
```

## Workflow 실행 문제

### 1. Workflow 실행 중단
```
문제: Workflow가 중간에 실행 중단
원인: 노드 간 데이터 타입 불일치 또는 의존성 문제
```

**해결 방법:**
```python
# 1. Workflow 상태 확인
response = requests.get(
    f"http://localhost:5001/v1/workflows/{workflow_id}/status",
    headers=headers
)
status = response.json()
print(f"Current step: {status.get('current_step')}")
print(f"Error: {status.get('error')}")

# 2. 단계별 디버깅
for step in workflow_steps:
    print(f"Testing step: {step['name']}")
    # 각 단계별 개별 테스트
```

### 2. 노드 연결 오류
```
문제: 노드 간 데이터 전달 실패
원인: 출력 스키마와 입력 스키마 불일치
```

**해결 방법:**
```python
# 노드 스키마 검증
def validate_node_connection(output_node, input_node):
    output_schema = output_node.get('output_schema', {})
    input_schema = input_node.get('input_schema', {})

    for key, value_type in input_schema.items():
        if key not in output_schema:
            print(f"Missing key: {key}")
            return False
        if output_schema[key] != value_type:
            print(f"Type mismatch: {key}")
            return False

    return True
```

## RAG 파이프라인 문제

### 1. 벡터 검색 결과 부정확
```
문제: RAG 검색 결과가 질문과 관련성이 낮음
원인: 임베딩 모델 설정 또는 청킹 전략 문제
```

**해결 방법:**
```python
# 1. 임베딩 모델 확인
response = requests.get(
    "http://localhost:5001/console/api/datasets/{dataset_id}/embedding-model",
    headers=headers
)
print(f"Current embedding model: {response.json()}")

# 2. 검색 파라미터 조정
rag_config = {
    "top_k": 5,  # 검색 결과 수 조정
    "similarity_threshold": 0.7,  # 유사도 임계값 조정
    "rerank": True  # 재순위 활성화
}
```

### 2. 문서 처리 실패
```
문제: 업로드된 문서가 벡터화되지 않음
원인: 문서 형식 지원 문제 또는 처리 큐 과부하
```

**해결 방법:**
```bash
# 1. 지원되는 문서 형식 확인
curl http://localhost:5001/console/api/datasets/supported-formats

# 2. 처리 상태 확인
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:5001/console/api/datasets/{dataset_id}/documents/{doc_id}/status

# 3. Celery 워커 상태 확인
./dev/check-worker-status
```

## WebSocket 연결 문제

### 1. WebSocket 연결 실패
```
문제: WebSocket 연결이 즉시 끊어짐
원인: 인증 토큰 또는 프록시 설정 문제
```

**해결 방법:**
```javascript
// 1. 연결 재시도 로직
const connectWebSocket = (token, retries = 3) => {
  const ws = new WebSocket(
    `ws://localhost:5001/ws/education/realtime?token=${token}`
  );

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (retries > 0) {
      setTimeout(() => connectWebSocket(token, retries - 1), 1000);
    }
  };

  return ws;
};

// 2. 네트워크 환경 확인
fetch('/ws/health-check')
  .then(response => response.json())
  .then(data => console.log('WebSocket server status:', data));
```

### 2. 실시간 메시지 지연
```
문제: WebSocket 메시지가 3초 이상 지연됨
원인: 서버 부하 또는 메시지 큐 적체
```

**해결 방법:**
```javascript
// 메시지 레이턴시 측정
const measureLatency = () => {
  const startTime = Date.now();

  ws.send(JSON.stringify({
    type: 'ping',
    timestamp: startTime
  }));

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'pong') {
      const latency = Date.now() - data.timestamp;
      console.log(`WebSocket latency: ${latency}ms`);
    }
  });
};
```

## 파일 업로드 문제

### 1. 대용량 파일 업로드 실패
```
문제: 10MB 이상 파일 업로드 시 413 오류
원인: 서버 업로드 제한 설정
```

**해결 방법:**
```python
# 청크 단위 업로드
def upload_large_file(file_path, chunk_size=1024*1024):  # 1MB chunks
    with open(file_path, 'rb') as f:
        chunk_number = 0

        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break

            response = requests.post(
                f"http://localhost:5001/files/upload-chunk",
                files={'chunk': chunk},
                data={
                    'chunk_number': chunk_number,
                    'total_chunks': total_chunks,
                    'file_name': os.path.basename(file_path)
                },
                headers=headers
            )

            chunk_number += 1
```

### 2. 파일 처리 지연
```
문제: 업로드 후 파일 처리가 완료되지 않음
원인: 백그라운드 작업 큐 문제
```

**해결 방법:**
```bash
# 1. Celery 워커 상태 확인
uv run --project api celery -A app.celery inspect active

# 2. 처리 큐 확인
uv run --project api python -c "
from app.celery import celery
print('Pending tasks:', celery.control.inspect().active())
"

# 3. 수동 파일 처리 트리거
curl -X POST http://localhost:5001/files/{file_id}/process \
     -H "Authorization: Bearer TOKEN"
```

## Rate Limiting 문제

### 1. 429 Too Many Requests
```
문제: API 호출 시 429 응답
원인: 요청 속도 제한 초과
```

**해결 방법:**
```python
import time
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# 재시도 전략 설정
def create_session_with_retries():
    session = requests.Session()

    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    return session

# 사용법
session = create_session_with_retries()
response = session.get(url, headers=headers)
```

### 2. API 호출 최적화
```python
# 배치 요청으로 최적화
def batch_agent_creation(agents_data, batch_size=5):
    results = []

    for i in range(0, len(agents_data), batch_size):
        batch = agents_data[i:i+batch_size]

        # 배치 요청
        response = requests.post(
            "http://localhost:5001/console/api/apps/batch",
            json={"agents": batch},
            headers=headers
        )

        results.extend(response.json()['results'])

        # 배치 간 대기
        time.sleep(1)

    return results
```

## 일반적인 디버깅 도구

### 1. API 응답 로깅
```python
import logging
import requests

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
requests_log = logging.getLogger("requests.packages.urllib3")
requests_log.setLevel(logging.DEBUG)
requests_log.propagate = True
```

### 2. 네트워크 연결 테스트
```bash
# API 서버 연결 확인
curl -I http://localhost:5001/health

# DNS 해상도 확인
nslookup localhost

# 포트 연결 확인
telnet localhost 5001
```

### 3. 성능 모니터링
```python
import time
import functools

def monitor_performance(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()

        print(f"{func.__name__} executed in {end_time - start_time:.2f} seconds")
        return result

    return wrapper

# 사용 예
@monitor_performance
def create_agent(agent_data):
    return requests.post(url, json=agent_data, headers=headers)
```

## 추가 리소스

- [Dify API 문서](../api-documentation.md)
- [성능 최적화 가이드](performance.md)
- [에러 코드 참조](error-codes.md)
- [개발 환경 설정](../setup-guide.md)

## 지원 요청

문제가 지속되는 경우:
1. 로그 파일 확인: `api/logs/`
2. 시스템 상태 점검: `./dev/health-check`
3. GitHub Issues에 버그 리포트 제출
4. 개발팀에 Slack 메시지 전송