# 성능 문제 해결 가이드

Dify Clone Education Platform의 성능 관련 문제 진단 및 해결 방법을 제공합니다.

## 목차
- [응답 시간 최적화](#응답-시간-최적화)
- [동시 접속 처리](#동시-접속-처리)
- [메모리 사용량 최적화](#메모리-사용량-최적화)
- [CPU 사용률 최적화](#cpu-사용률-최적화)
- [데이터베이스 성능](#데이터베이스-성능)
- [캐시 최적화](#캐시-최적화)
- [LLM 응답 최적화](#llm-응답-최적화)

## 응답 시간 최적화

### 1. 느린 API 응답 (P90 > 3초)

**진단 방법:**
```bash
# 1. k6 부하 테스트 실행
k6 run -e API_URL=http://localhost:5001 tests/load/education-session.js

# 2. 응답 시간 분석
grep "http_req_duration" k6-results.log | tail -10

# 3. 프로파일링 활성화
export FLASK_PROFILE=1
./dev/start-api
```

**해결 방법:**
```python
# 1. 데이터베이스 쿼리 최적화
from sqlalchemy import text
from app.extensions import db

# 느린 쿼리 로깅 활성화
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# 2. N+1 쿼리 문제 해결
from sqlalchemy.orm import joinedload

# 잘못된 예 (N+1 문제)
users = db.session.query(User).all()
for user in users:
    print(user.groups)  # 각 사용자마다 추가 쿼리

# 올바른 예 (조인 로딩)
users = db.session.query(User).options(joinedload(User.groups)).all()
```

**응답 시간 모니터링:**
```python
import time
from functools import wraps
from flask import g, request

def measure_response_time(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        g.start_time = time.time()
        response = f(*args, **kwargs)

        duration = time.time() - g.start_time
        if duration > 3.0:  # 3초 초과 시 로깅
            print(f"Slow request: {request.endpoint} took {duration:.2f}s")

        return response
    return decorated_function
```

### 2. LLM 응답 지연 (P90 > 30초)

**해결 방법:**
```python
# 1. 스트리밍 응답 구현
import asyncio
from flask import Response, stream_template

@app.route('/v1/chat/stream', methods=['POST'])
def chat_stream():
    def generate():
        # OpenAI 스트리밍 설정
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            stream=True
        )

        for chunk in response:
            if chunk.choices[0].delta.get('content'):
                yield f"data: {chunk.choices[0].delta.content}\n\n"

        yield "data: [DONE]\n\n"

    return Response(generate(), mimetype='text/plain')

# 2. 타임아웃 설정
import requests
from requests.adapters import HTTPAdapter

session = requests.Session()
adapter = HTTPAdapter(timeout=60)
session.mount('https://', adapter)
```

## 동시 접속 처리

### 1. 50명 동시 접속 처리 실패

**시스템 리소스 확인:**
```bash
# 1. 현재 연결 수 확인
netstat -an | grep :5001 | wc -l

# 2. 시스템 한계 확인
ulimit -n  # 파일 디스크립터 한계

# 3. 프로세스별 리소스 사용량
ps aux | grep gunicorn
```

**Gunicorn 설정 최적화:**
```python
# gunicorn.conf.py
bind = "0.0.0.0:5001"
workers = 4  # CPU 코어 수 * 2
worker_class = "gevent"  # 비동기 워커
worker_connections = 1000  # 워커당 연결 수
max_requests = 1000  # 메모리 누수 방지
max_requests_jitter = 50
preload_app = True  # 앱 사전 로드
timeout = 60
keepalive = 2
```

**연결 풀 최적화:**
```python
from sqlalchemy.pool import QueuePool

# 데이터베이스 연결 풀 설정
DATABASE_URL = "postgresql://user:pass@localhost/db"
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,  # 기본 연결 수
    max_overflow=30,  # 추가 연결 수
    pool_recycle=3600,  # 1시간마다 연결 재생성
    pool_pre_ping=True  # 연결 상태 확인
)
```

### 2. 동시성 병목 해결

**Redis 캐시 구현:**
```python
import redis
from functools import wraps

# Redis 클라이언트 설정
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    db=0,
    max_connections=100,
    socket_keepalive=True,
    socket_keepalive_options={}
)

def cache_result(expiration=300):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 캐시 키 생성
            cache_key = f"{f.__name__}:{hash(str(args) + str(kwargs))}"

            # 캐시에서 확인
            cached_result = redis_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)

            # 실행 및 캐시 저장
            result = f(*args, **kwargs)
            redis_client.setex(cache_key, expiration, json.dumps(result))
            return result
        return decorated_function
    return decorator
```

## 메모리 사용량 최적화

### 1. 메모리 누수 진단

**메모리 프로파일링:**
```bash
# 1. 메모리 사용량 모니터링
pip install memory-profiler
python -m memory_profiler app.py

# 2. 상세 메모리 분석
pip install pympler
```

```python
# 메모리 사용량 추적
from pympler import tracker, muppy, summary

tr = tracker.SummaryTracker()

@app.before_request
def before_request():
    if app.debug:
        tr.print_diff()

# 메모리 사용량 엔드포인트
@app.route('/debug/memory')
def memory_usage():
    all_objects = muppy.get_objects()
    sum1 = summary.summarize(all_objects)
    return {'memory_summary': summary.format_(sum1)}
```

**메모리 최적화 기법:**
```python
# 1. 제너레이터 사용 (대용량 데이터)
def get_users_generator():
    users = db.session.query(User).yield_per(100)
    for user in users:
        yield user.to_dict()

# 2. 명시적 객체 삭제
def process_large_dataset():
    try:
        data = load_large_data()
        result = process_data(data)
        return result
    finally:
        del data  # 명시적 메모리 해제
        gc.collect()  # 가비지 컬렉션 강제 실행
```

### 2. 메모리 사용량 경고 (> 2GB)

**메모리 모니터링 시스템:**
```python
import psutil
import threading
import time

class MemoryMonitor:
    def __init__(self, threshold_gb=2.0):
        self.threshold = threshold_gb * 1024 * 1024 * 1024  # GB to bytes
        self.monitoring = True

    def start_monitoring(self):
        threading.Thread(target=self._monitor_loop, daemon=True).start()

    def _monitor_loop(self):
        while self.monitoring:
            memory_info = psutil.virtual_memory()
            current_process = psutil.Process()
            process_memory = current_process.memory_info().rss

            if process_memory > self.threshold:
                self._trigger_memory_warning(process_memory)

            time.sleep(30)  # 30초마다 확인

    def _trigger_memory_warning(self, memory_usage):
        memory_gb = memory_usage / (1024 ** 3)
        print(f"⚠️ Memory usage warning: {memory_gb:.2f}GB")

        # 자동 최적화 트리거
        self._emergency_cleanup()

    def _emergency_cleanup(self):
        # 캐시 정리
        redis_client.flushdb()

        # 가비지 컬렉션
        import gc
        gc.collect()
```

## CPU 사용률 최적화

### 1. CPU 사용률 경고 (> 85%)

**CPU 집약적 작업 최적화:**
```python
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

# CPU 집약적 작업을 별도 프로세스로 처리
def cpu_intensive_task(data):
    # 복잡한 계산 작업
    return process_data(data)

@app.route('/api/process-data', methods=['POST'])
def process_data_endpoint():
    data_chunks = request.json.get('data')

    # 멀티프로세싱으로 처리
    with ProcessPoolExecutor(max_workers=multiprocessing.cpu_count()) as executor:
        results = list(executor.map(cpu_intensive_task, data_chunks))

    return {'results': results}
```

**비동기 처리:**
```python
from celery import Celery

# Celery 태스크로 무거운 작업 분리
@celery.task(bind=True)
def process_agent_creation(self, agent_data):
    try:
        # Agent 생성 로직
        agent = create_agent_with_llm(agent_data)
        return {'status': 'success', 'agent_id': agent.id}
    except Exception as exc:
        self.retry(countdown=60, max_retries=3)
```

### 2. 알고리즘 최적화

**효율적인 데이터 구조 사용:**
```python
# 1. 집합(Set) 연산 활용
# 느린 방법
def find_common_users(group1_users, group2_users):
    common = []
    for user in group1_users:
        if user in group2_users:
            common.append(user)
    return common

# 빠른 방법
def find_common_users_optimized(group1_users, group2_users):
    return list(set(group1_users) & set(group2_users))

# 2. 딕셔너리 기반 조회
# O(n) 시간복잡도를 O(1)로 개선
user_lookup = {user.id: user for user in users}
def get_user_by_id(user_id):
    return user_lookup.get(user_id)
```

## 데이터베이스 성능

### 1. 느린 쿼리 최적화

**인덱스 최적화:**
```sql
-- 자주 사용되는 쿼리 확인
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 필요한 인덱스 추가
CREATE INDEX CONCURRENTLY idx_education_sessions_user_id
ON education_sessions(user_id);

CREATE INDEX CONCURRENTLY idx_agents_created_at
ON agents(created_at DESC);

-- 복합 인덱스
CREATE INDEX CONCURRENTLY idx_user_sessions_status
ON education_sessions(user_id, status, created_at);
```

**쿼리 최적화:**
```python
# 1. 배치 로딩
from sqlalchemy.orm import selectinload

# N+1 문제 해결
agents = db.session.query(Agent)\
    .options(selectinload(Agent.templates))\
    .options(selectinload(Agent.executions))\
    .all()

# 2. 원시 SQL 사용 (복잡한 쿼리)
def get_user_statistics(user_id):
    result = db.session.execute(text("""
        SELECT
            COUNT(DISTINCT a.id) as agent_count,
            COUNT(DISTINCT w.id) as workflow_count,
            AVG(s.duration) as avg_session_duration
        FROM users u
        LEFT JOIN agents a ON u.id = a.user_id
        LEFT JOIN workflows w ON u.id = w.user_id
        LEFT JOIN education_sessions s ON u.id = s.user_id
        WHERE u.id = :user_id
    """), {'user_id': user_id}).fetchone()

    return dict(result)
```

### 2. 연결 풀 최적화

**PostgreSQL 설정 조정:**
```sql
-- postgresql.conf
max_connections = 200
shared_buffers = 256MB
work_mem = 4MB
maintenance_work_mem = 64MB
effective_cache_size = 1GB

-- 느린 쿼리 로깅
log_min_duration_statement = 1000  -- 1초 이상 쿼리 로깅
log_statement = 'mod'  -- INSERT, UPDATE, DELETE 로깅
```

## 캐시 최적화

### 1. Redis 캐시 전략

**계층적 캐시 구현:**
```python
class CacheManager:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        self.local_cache = {}  # L1 캐시 (인메모리)

    def get(self, key):
        # L1 캐시 확인
        if key in self.local_cache:
            return self.local_cache[key]

        # L2 캐시 (Redis) 확인
        value = self.redis_client.get(key)
        if value:
            # L1 캐시에 저장
            self.local_cache[key] = json.loads(value)
            return self.local_cache[key]

        return None

    def set(self, key, value, expiration=300):
        # 양쪽 캐시에 저장
        self.local_cache[key] = value
        self.redis_client.setex(key, expiration, json.dumps(value))
```

**캐시 무효화 전략:**
```python
from flask_caching import Cache

cache = Cache()

# 태그 기반 캐시 무효화
@cache.memoize(timeout=300, unless=lambda: current_user.is_anonymous)
def get_user_agents(user_id):
    return db.session.query(Agent).filter_by(user_id=user_id).all()

# 데이터 변경 시 캐시 무효화
@app.route('/api/agents', methods=['POST'])
def create_agent():
    agent = Agent(**request.json)
    db.session.add(agent)
    db.session.commit()

    # 관련 캐시 무효화
    cache.delete_memoized(get_user_agents, agent.user_id)

    return jsonify(agent.to_dict())
```

## LLM 응답 최적화

### 1. 응답 시간 단축

**프롬프트 최적화:**
```python
# 1. 짧고 명확한 프롬프트
def optimize_prompt(user_question, context):
    # 길고 복잡한 프롬프트 (비추천)
    # long_prompt = f"""
    # You are an advanced AI educational assistant with extensive knowledge...
    # [500+ words of instructions]
    # Question: {user_question}
    # """

    # 짧고 효과적인 프롬프트 (추천)
    optimized_prompt = f"""
    Answer this education question clearly and concisely:

    Context: {context[:200]}...
    Question: {user_question}

    Format: Brief explanation with examples.
    """

    return optimized_prompt

# 2. 토큰 수 제한
def create_llm_request(prompt):
    return {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500,  # 토큰 수 제한
        "temperature": 0.3,  # 일관된 응답을 위해 낮은 온도
        "top_p": 0.9
    }
```

### 2. 동시 LLM 요청 처리

**요청 큐잉 시스템:**
```python
import asyncio
from asyncio import Semaphore

class LLMRequestManager:
    def __init__(self, max_concurrent=10):
        self.semaphore = Semaphore(max_concurrent)
        self.request_queue = asyncio.Queue()

    async def process_request(self, prompt):
        async with self.semaphore:
            # OpenAI API 호출
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500
            )
            return response.choices[0].message.content

# 사용 예
llm_manager = LLMRequestManager(max_concurrent=5)

@app.route('/api/chat', methods=['POST'])
async def chat():
    prompt = request.json.get('prompt')
    response = await llm_manager.process_request(prompt)
    return {'response': response}
```

## 성능 모니터링

### 1. 실시간 성능 지표

**Flask 성능 미들웨어:**
```python
import time
from flask import g, request

@app.before_request
def before_request():
    g.start_time = time.time()

@app.after_request
def after_request(response):
    duration = time.time() - g.start_time

    # 성능 지표 수집
    if duration > 3.0:  # 3초 초과 시
        print(f"⚠️ Slow request: {request.endpoint} - {duration:.2f}s")

        # 메트릭 전송 (Prometheus/Grafana)
        performance_metrics.observe(duration, labels={
            'endpoint': request.endpoint,
            'method': request.method,
            'status': response.status_code
        })

    return response
```

### 2. 자동 스케일링 트리거

**리소스 기반 알림:**
```python
import psutil
import threading

def monitor_system_resources():
    while True:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent

        if cpu_percent > 85:
            trigger_scale_up_event('cpu', cpu_percent)

        if memory_percent > 80:
            trigger_scale_up_event('memory', memory_percent)

        time.sleep(30)

def trigger_scale_up_event(resource_type, usage):
    print(f"🚨 Auto-scaling trigger: {resource_type} usage at {usage}%")
    # 스케일링 로직 또는 알림 전송

# 백그라운드 모니터링 시작
threading.Thread(target=monitor_system_resources, daemon=True).start()
```

## 성능 최적화 체크리스트

### ✅ 애플리케이션 레벨
- [ ] 데이터베이스 쿼리 최적화 (N+1 문제 해결)
- [ ] 인덱스 적절히 설정
- [ ] Redis 캐시 구현
- [ ] 비동기 처리 (Celery) 활용
- [ ] 커넥션 풀 최적화

### ✅ 인프라 레벨
- [ ] Gunicorn 워커 수 조정
- [ ] 로드 밸런서 설정
- [ ] CDN 활용 (정적 파일)
- [ ] 데이터베이스 읽기 복제본 설정
- [ ] 자동 스케일링 구성

### ✅ 모니터링
- [ ] 성능 지표 대시보드 구축
- [ ] 알림 시스템 설정
- [ ] 로그 분석 자동화
- [ ] 정기 성능 테스트 실행

문제가 지속되면 `api/logs/performance.log`를 확인하고 개발팀에 문의하세요.