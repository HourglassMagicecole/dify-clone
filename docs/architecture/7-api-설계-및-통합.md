# 7. API 설계 및 통합

## Blueprint URL 충돌 완전 해결

**문제**: Flask Blueprint 등록 순서만으로는 URL 우선순위를 보장하지 않습니다.

**해결책 1: URL Rule 명시적 정의**

```python
# api/app_factory.py 수정
from werkzeug.routing import Rule

# 방법 1: Werkzeug Rule 사용 (예시)
app.url_map.add(Rule('/edu/api/<path:subpath>', endpoint='edu'))
app.url_map.add(Rule('/v1/<path:subpath>', endpoint='service_api'))
app.url_map.add(Rule('/console/api/<path:subpath>', endpoint='console'))
app.url_map.add(Rule('/api/<path:subpath>', endpoint='web'))  # 나머지

# 방법 2: URL prefix 완전 분리 (권장)
app.register_blueprint(edu_bp, url_prefix='/edu/api')  # /edu/api/* (충돌 없음)
app.register_blueprint(service_api_bp, url_prefix='/v1')  # /v1/*
app.register_blueprint(console_api_bp, url_prefix='/console/api')  # /console/api/*
app.register_blueprint(files_bp, url_prefix='/files')  # /files/*
app.register_blueprint(web_bp, url_prefix='/api')      # /api/* (나머지)

# 방법 3: before_request 핸들러로 라우팅 (예시)
@app.before_request
def route_education_api():
    if request.path.startswith('/edu/api/'):
        return edu_bp.handle_request()
```

**권장 해결책**: 방법 2 (URL prefix 완전 분리)를 사용하여 `/edu/api/*` 경로로 교육 API를 완전히 분리합니다.

## 새로운 API 엔드포인트

### 교육 전용 API 요약

| 연동 | 기본 경로 | PRD Story | 주요 기능 |
|------|----------|--------------|------------|
| 인증 관리 | `/edu/api/auth/*` | Story 1.2 | 로그인, JWT, 세션 관리 |
| Agent 관리 | `/edu/api/agents/*` | Story 1.3 | Agent CRUD, 템플릿 관리 |
| 사용자 관리 | `/edu/api/users/*` | Story 1.9 | 계정 CRUD, CSV 일괄, 권한 |
| 세션 관리 | `/edu/api/sessions/*` | Story 1.9 | 세션 생성, 참가자 관리 |
| 학습 진도 | `/edu/api/progress/*` | Story 1.4 | 진도 추적, 통계, 배지 |
| Workflow 관리 | `/edu/api/workflows/*` | Story 1.5 | Workflow CRUD, 실행 상태 |
| RAG 관리 | `/edu/api/datasets/*` | Story 1.6 | 데이터셋 CRUD, 벡터 검색 |
| 교육 자료 | `/edu/api/templates/*` | Story 1.10 | 템플릿 Agent/Workflow |
| 튜토리얼 | `/edu/api/tutorials/*` | Story 1.10 | 튜토리얼 콘텐츠, 퀴즈 |
| 성취 시스템 | `/edu/api/achievements/*` | Story 1.10 | 배지, 진행률 추적 |
| API Key | `/edu/api/keys/*` | Story 1.9 | 중앙 Key 관리 |
| 사용량 관리 | `/edu/api/usage/*` | Story 1.9 | 제한 설정, 통계 |
| 모니터링 | `/edu/api/monitoring/*` | Story 1.9 | 실시간 모니터링, SSE |
| 성능 메트릭 | `/edu/api/metrics/*` | Story 1.11 | 성능 측정, 로그 집계 |


## 기존 Dify API 활용

기존 Dify API를 100% 재사용하여 검증된 기능을 활용합니다:
- Agent 관리: `/console/api/apps`
- Workflow: `/v1/workflows/run`
- RAG: `/console/api/datasets`
- Chat: `/v1/chat/completions`
- Files: `/files/upload`

---
