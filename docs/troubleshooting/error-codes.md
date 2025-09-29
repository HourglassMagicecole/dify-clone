# 에러 코드 참조 가이드

Dify Clone Education Platform에서 발생하는 에러 코드와 해결 방법을 정리한 참조 문서입니다.

## 목차
- [HTTP 상태 코드](#http-상태-코드)
- [인증 및 권한 에러](#인증-및-권한-에러)
- [Agent 관련 에러](#agent-관련-에러)
- [Workflow 관련 에러](#workflow-관련-에러)
- [LLM 및 AI 에러](#llm-및-ai-에러)
- [데이터베이스 에러](#데이터베이스-에러)
- [파일 처리 에러](#파일-처리-에러)
- [시스템 에러](#시스템-에러)

## HTTP 상태 코드

### 4xx 클라이언트 에러

| 코드 | 설명 | 일반적 원인 | 해결 방법 |
|------|------|-------------|----------|
| 400 | Bad Request | 잘못된 요청 형식 | 요청 페이로드 검증 |
| 401 | Unauthorized | 인증 토큰 없음/무효 | 토큰 갱신 또는 재로그인 |
| 403 | Forbidden | 권한 부족 | 사용자 역할 확인 |
| 404 | Not Found | 리소스 없음 | URL 및 리소스 ID 확인 |
| 409 | Conflict | 리소스 충돌 | 중복 생성 시도 |
| 422 | Unprocessable Entity | 데이터 검증 실패 | 입력 데이터 형식 확인 |
| 429 | Too Many Requests | Rate limit 초과 | 요청 속도 조절 |

### 5xx 서버 에러

| 코드 | 설명 | 일반적 원인 | 해결 방법 |
|------|------|-------------|----------|
| 500 | Internal Server Error | 서버 내부 오류 | 로그 확인 및 재시작 |
| 502 | Bad Gateway | 프록시 연결 실패 | 업스트림 서버 상태 확인 |
| 503 | Service Unavailable | 서비스 일시 중단 | 서버 부하 또는 점검 |
| 504 | Gateway Timeout | 게이트웨이 타임아웃 | 처리 시간 초과 |

## 인증 및 권한 에러

### AUTH-001: 토큰 만료
```json
{
  "error": "AUTH-001",
  "message": "Access token has expired",
  "details": "Token expired at 2025-01-15T10:30:00Z"
}
```
**해결 방법:**
```python
# 토큰 갱신
response = requests.post('/edu/api/auth/refresh', {
    'refresh_token': refresh_token
})
new_token = response.json()['access_token']
```

### AUTH-002: 잘못된 인증 정보
```json
{
  "error": "AUTH-002",
  "message": "Invalid credentials provided",
  "details": "Username or password is incorrect"
}
```
**해결 방법:**
- 사용자명과 비밀번호 재확인
- 계정 잠금 상태 확인
- 비밀번호 재설정 필요 시 처리

### AUTH-003: 권한 부족
```json
{
  "error": "AUTH-003",
  "message": "Insufficient permissions",
  "details": "User role 'student' cannot access admin resources"
}
```
**해결 방법:**
```python
# 사용자 역할 확인
user_info = get_current_user()
if user_info.role not in ['admin', 'instructor']:
    raise PermissionError("Admin access required")
```

### AUTH-004: 세션 만료
```json
{
  "error": "AUTH-004",
  "message": "Session has expired",
  "details": "Please log in again"
}
```

## Agent 관련 에러

### AGENT-001: Agent 생성 실패
```json
{
  "error": "AGENT-001",
  "message": "Failed to create agent",
  "details": "Invalid model configuration: model 'gpt-4-invalid' not found"
}
```
**해결 방법:**
```python
# 지원되는 모델 확인
supported_models = ['gpt-3.5-turbo', 'gpt-4', 'claude-2']
if model not in supported_models:
    raise ValueError(f"Unsupported model: {model}")
```

### AGENT-002: Agent 실행 시간 초과
```json
{
  "error": "AGENT-002",
  "message": "Agent execution timeout",
  "details": "Agent response took longer than 60 seconds"
}
```
**해결 방법:**
```python
# 타임아웃 설정 조정
agent_config = {
    "timeout": 120,  # 2분으로 증가
    "max_retries": 3,
    "retry_delay": 5
}
```

### AGENT-003: Agent 템플릿 검증 실패
```json
{
  "error": "AGENT-003",
  "message": "Agent template validation failed",
  "details": "Missing required field: 'prompt_template'"
}
```

### AGENT-004: Agent 상태 충돌
```json
{
  "error": "AGENT-004",
  "message": "Agent state conflict",
  "details": "Cannot modify agent while it's running"
}
```

## Workflow 관련 에러

### WORKFLOW-001: 노드 연결 오류
```json
{
  "error": "WORKFLOW-001",
  "message": "Invalid node connection",
  "details": "Output type 'string' incompatible with input type 'number'"
}
```
**해결 방법:**
```python
def validate_node_connection(source_node, target_node):
    source_output = source_node['output_schema']
    target_input = target_node['input_schema']

    for key, expected_type in target_input.items():
        if key not in source_output:
            raise ValueError(f"Missing output key: {key}")
        if source_output[key] != expected_type:
            raise ValueError(f"Type mismatch: {key}")
```

### WORKFLOW-002: 순환 참조 감지
```json
{
  "error": "WORKFLOW-002",
  "message": "Circular dependency detected",
  "details": "Node 'A' -> 'B' -> 'C' -> 'A' creates a cycle"
}
```
**해결 방법:**
```python
def detect_cycles(workflow_nodes):
    # 위상 정렬로 순환 참조 검사
    from collections import defaultdict, deque

    graph = defaultdict(list)
    in_degree = defaultdict(int)

    # 그래프 구성
    for node in workflow_nodes:
        for dependency in node.get('dependencies', []):
            graph[dependency].append(node['id'])
            in_degree[node['id']] += 1

    # 큐에 진입 차수 0인 노드 추가
    queue = deque([node for node in workflow_nodes if in_degree[node['id']] == 0])
    processed = []

    while queue:
        current = queue.popleft()
        processed.append(current)

        for neighbor in graph[current['id']]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(processed) != len(workflow_nodes):
        raise ValueError("Circular dependency detected")
```

### WORKFLOW-003: 실행 중단
```json
{
  "error": "WORKFLOW-003",
  "message": "Workflow execution stopped",
  "details": "Node 'llm_processor' failed after 3 retry attempts"
}
```

### WORKFLOW-004: 리소스 부족
```json
{
  "error": "WORKFLOW-004",
  "message": "Insufficient resources for workflow",
  "details": "Not enough memory to process large dataset"
}
```

## LLM 및 AI 에러

### LLM-001: API 키 문제
```json
{
  "error": "LLM-001",
  "message": "Invalid API key",
  "details": "OpenAI API key is invalid or expired"
}
```
**해결 방법:**
```bash
# API 키 확인
export OPENAI_API_KEY="your-valid-api-key"
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     "https://api.openai.com/v1/models"
```

### LLM-002: 토큰 한계 초과
```json
{
  "error": "LLM-002",
  "message": "Token limit exceeded",
  "details": "Request tokens (4500) + response tokens (500) exceeds model limit (4096)"
}
```
**해결 방법:**
```python
def truncate_context(text, max_tokens=3000):
    # 토큰 수 계산 (대략적)
    estimated_tokens = len(text.split()) * 1.3

    if estimated_tokens > max_tokens:
        # 텍스트 자르기
        words = text.split()
        target_words = int(max_tokens / 1.3)
        return ' '.join(words[:target_words])

    return text
```

### LLM-003: 콘텐츠 필터링
```json
{
  "error": "LLM-003",
  "message": "Content filtered by AI safety",
  "details": "Request contains content that violates safety guidelines"
}
```

### LLM-004: 모델 과부하
```json
{
  "error": "LLM-004",
  "message": "Model temporarily unavailable",
  "details": "High demand, please try again in 30 seconds"
}
```
**해결 방법:**
```python
import time
import random

def retry_with_backoff(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except ModelOverloadError:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait_time)

    raise Exception("Max retries exceeded")
```

## 데이터베이스 에러

### DB-001: 연결 실패
```json
{
  "error": "DB-001",
  "message": "Database connection failed",
  "details": "Could not connect to PostgreSQL on localhost:5432"
}
```
**해결 방법:**
```bash
# PostgreSQL 상태 확인
pg_isready -h localhost -p 5432

# 서비스 재시작
sudo systemctl restart postgresql
```

### DB-002: 제약 조건 위반
```json
{
  "error": "DB-002",
  "message": "Constraint violation",
  "details": "UNIQUE constraint failed: users.email"
}
```

### DB-003: 트랜잭션 충돌
```json
{
  "error": "DB-003",
  "message": "Transaction conflict",
  "details": "Deadlock detected between transactions"
}
```
**해결 방법:**
```python
from sqlalchemy.exc import OperationalError

def safe_transaction(func):
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db.session.begin()
            result = func()
            db.session.commit()
            return result
        except OperationalError as e:
            db.session.rollback()
            if "deadlock" in str(e).lower() and attempt < max_retries - 1:
                time.sleep(0.1 * (2 ** attempt))  # 지수 백오프
                continue
            raise
```

### DB-004: 쿼리 타임아웃
```json
{
  "error": "DB-004",
  "message": "Query timeout",
  "details": "Query exceeded maximum execution time of 30 seconds"
}
```

## 파일 처리 에러

### FILE-001: 파일 크기 초과
```json
{
  "error": "FILE-001",
  "message": "File size exceeds limit",
  "details": "File size 15MB exceeds maximum allowed size of 10MB"
}
```
**해결 방법:**
```python
def validate_file_size(file_path, max_size_mb=10):
    file_size = os.path.getsize(file_path)
    max_size_bytes = max_size_mb * 1024 * 1024

    if file_size > max_size_bytes:
        raise ValueError(f"File size {file_size/1024/1024:.1f}MB exceeds limit of {max_size_mb}MB")
```

### FILE-002: 지원되지 않는 형식
```json
{
  "error": "FILE-002",
  "message": "Unsupported file format",
  "details": "File format '.xyz' is not supported. Allowed: .txt, .pdf, .docx, .md"
}
```

### FILE-003: 파일 손상
```json
{
  "error": "FILE-003",
  "message": "Corrupted file detected",
  "details": "File appears to be corrupted or incomplete"
}
```

### FILE-004: 처리 시간 초과
```json
{
  "error": "FILE-004",
  "message": "File processing timeout",
  "details": "File processing took longer than 5 minutes"
}
```

## 시스템 에러

### SYS-001: 메모리 부족
```json
{
  "error": "SYS-001",
  "message": "Insufficient memory",
  "details": "Available memory: 128MB, Required: 512MB"
}
```
**해결 방법:**
```python
import psutil

def check_memory_requirements(required_mb):
    available_mb = psutil.virtual_memory().available / 1024 / 1024

    if available_mb < required_mb:
        raise MemoryError(f"Insufficient memory: {available_mb:.0f}MB available, {required_mb}MB required")
```

### SYS-002: 디스크 공간 부족
```json
{
  "error": "SYS-002",
  "message": "Insufficient disk space",
  "details": "Free space: 100MB, Required: 500MB"
}
```

### SYS-003: CPU 과부하
```json
{
  "error": "SYS-003",
  "message": "CPU overload detected",
  "details": "CPU usage 95% for more than 5 minutes"
}
```

### SYS-004: 네트워크 연결 실패
```json
{
  "error": "SYS-004",
  "message": "Network connection failed",
  "details": "Could not reach external API endpoint"
}
```

## 교육 플랫폼 특화 에러

### EDU-001: 세션 정원 초과
```json
{
  "error": "EDU-001",
  "message": "Session capacity exceeded",
  "details": "Maximum 50 students per session, currently 50 enrolled"
}
```

### EDU-002: 학습 자료 접근 제한
```json
{
  "error": "EDU-002",
  "message": "Learning material access denied",
  "details": "Material requires instructor permission"
}
```

### EDU-003: 진도 동기화 실패
```json
{
  "error": "EDU-003",
  "message": "Progress sync failed",
  "details": "Could not update learning progress due to network error"
}
```

### EDU-004: 그룹 권한 충돌
```json
{
  "error": "EDU-004",
  "message": "Group permission conflict",
  "details": "User belongs to multiple groups with conflicting permissions"
}
```

## 에러 처리 모범 사례

### 1. 클라이언트 사이드 에러 처리
```javascript
class APIClient {
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json();

      switch (errorData.error) {
        case 'AUTH-001':
          // 토큰 만료 - 자동 갱신
          await this.refreshToken();
          break;

        case 'AGENT-002':
          // Agent 타임아웃 - 사용자 알림
          this.showTimeoutWarning();
          break;

        case 'FILE-001':
          // 파일 크기 초과 - 압축 제안
          this.suggestFileCompression();
          break;

        default:
          this.showGenericError(errorData.message);
      }

      throw new Error(errorData.message);
    }

    return response.json();
  }
}
```

### 2. 서버 사이드 에러 로깅
```python
import logging
from functools import wraps

logger = logging.getLogger(__name__)

def log_errors(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            # 구조화된 로깅
            logger.error(
                "Function error",
                extra={
                    'function': func.__name__,
                    'args': str(args),
                    'kwargs': str(kwargs),
                    'error_type': type(e).__name__,
                    'error_message': str(e),
                    'user_id': getattr(current_user, 'id', None),
                    'request_id': getattr(g, 'request_id', None)
                }
            )
            raise
    return wrapper
```

### 3. 사용자 친화적 에러 메시지
```python
ERROR_MESSAGES = {
    'AUTH-001': {
        'ko': '로그인이 만료되었습니다. 다시 로그인해주세요.',
        'en': 'Your session has expired. Please log in again.'
    },
    'AGENT-001': {
        'ko': 'AI 에이전트 생성에 실패했습니다. 설정을 확인해주세요.',
        'en': 'Failed to create AI agent. Please check your configuration.'
    }
}

def get_user_friendly_message(error_code, language='ko'):
    return ERROR_MESSAGES.get(error_code, {}).get(
        language,
        '알 수 없는 오류가 발생했습니다.'
    )
```

## 에러 코드 검색

특정 에러 코드를 빠르게 찾으려면:

```bash
# 에러 코드로 검색
grep -r "AGENT-001" docs/troubleshooting/
grep -r "LLM-002" api/logs/

# 에러 메시지로 검색
grep -r "Token limit exceeded" api/
```

## 추가 도움말

- 로그 파일 위치: `api/logs/error.log`
- 실시간 모니터링: `./dev/monitor-errors`
- 에러 대시보드: `http://localhost:3000/errors`
- 기술 지원: [GitHub Issues](https://github.com/your-repo/issues)