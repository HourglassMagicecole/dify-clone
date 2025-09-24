# Story 0: 인프라 및 환경 구축 (필수 선행 작업)

## Story 0.1: 개발 환경 설정 및 검증

인프라 엔지니어로서,
모든 개발자가 일관된 환경에서 작업할 수 있도록 개발 환경을 구축하고 싶다.
이를 통해 환경 차이로 인한 문제를 사전에 방지할 수 있다.

**사전 조건**: 없음 (첫 번째 Story)

**수락 기준**:
1. 개발 환경 요구사항 문서 작성
   - Python 3.11-3.13 설치 가이드
   - Node.js >=22.11.0 설치 가이드
   - UV 패키지 관리자 설정
   - pnpm 패키지 관리자 설정
2. Docker Desktop 설치 및 설정 가이드
3. 로컬 개발 환경 스크립트 작성
   - setup-dev-env.sh (Mac/Linux)
   - setup-dev-env.ps1 (Windows)
4. 환경 검증 스크립트 작성
   - 모든 필수 도구 버전 확인
   - 네트워크 연결 테스트
5. 개발자 온보딩 문서 작성

**통합 검증**:
- IV1: 기존 Dify 프로젝트 정상 실행 확인
- IV2: 모든 개발 도구 호환성 검증
- IV3: 3명의 개발자가 30분 내 환경 구축 완료

## Story 0.2: 데이터베이스 마이그레이션 및 스키마 구축

데이터베이스 관리자로서,
교육 플랫폼에 필요한 모든 테이블을 생성하고 관리하고 싶다.
이를 통해 애플리케이션이 데이터를 안전하게 저장할 수 있다.

**사전 조건**: Story 0.1 완료 (개발 환경 구축)

**수락 기준**:
1. 교육용 11개 테이블 마이그레이션 스크립트 작성
   - education_sessions
   - education_enrollments
   - resource_tags
   - learning_progress
   - education_templates
   - education_api_keys
   - education_usage_limits
   - education_usage_stats
   - education_activity_logs
   - user_education_roles
   - education_achievements
2. Flask-Migrate 마이그레이션 파일 생성
3. 롤백 스크립트 작성
4. 테스트 데이터 시드 스크립트 작성
5. 데이터베이스 백업/복구 절차 문서화

**통합 검증**:
- IV1: 기존 Dify 테이블과 충돌 없음 확인
- IV2: 외래 키 제약 조건 정상 작동
- IV3: 마이그레이션 롤백 테스트 성공
- IV4: 50명 사용자 동시 접속 부하 테스트

## Story 0.3: 백엔드 API Blueprint 구성

백엔드 개발자로서,
교육 전용 API 엔드포인트를 구성하고 기존 시스템과 통합하고 싶다.
이를 통해 프론트엔드가 필요한 모든 API를 사용할 수 있다.

**사전 조건**: Story 0.2 완료 (데이터베이스 구축)

**수락 기준**:
1. /edu/api/* Blueprint 생성 및 등록
   - URL 충돌 방지 전략 구현
   - api/controllers/edu/ 디렉토리 구조 생성
2. 교육 API 엔드포인트 구현
   - 사용자 관리 API
   - 세션 관리 API
   - 학습 진도 API
   - 템플릿 관리 API
   - API Key 관리 API
   - 사용량 통계 API
3. 교육 서비스 레이어 구현
   - api/services/education_service.py
   - api/services/session_service.py
   - api/services/progress_service.py
4. API 문서 자동 생성 (OpenAPI/Swagger)
5. Postman 컬렉션 생성

**통합 검증**:
- IV1: Dify 기존 API와 충돌 없음 확인
- IV2: 모든 엔드포인트 응답 시간 3초 이내
- IV3: API 권한 체크 정상 작동
- IV4: Rate limiting 테스트

## Story 0.4: CI/CD 파이프라인 구축

DevOps 엔지니어로서,
자동화된 빌드, 테스트, 배포 파이프라인을 구축하고 싶다.
이를 통해 안정적이고 빠른 배포가 가능하다.

**사전 조건**: Story 0.3 완료 (API Blueprint 구성)

**수락 기준**:
1. GitHub Actions 워크플로우 구성
   - 백엔드 테스트 자동화
   - 프론트엔드 테스트 자동화
   - 린트 및 코드 품질 검사
2. Docker 이미지 자동 빌드
   - 멀티스테이지 빌드 최적화
   - 이미지 크기 최소화
   - 보안 스캔 통합
3. 배포 자동화 스크립트
   - Blue-Green 배포 구현
   - 자동 롤백 메커니즘
   - 헬스체크 구현
4. 환경별 설정 관리
   - 개발/스테이징/프로덕션 분리
   - 시크릿 관리 (GitHub Secrets)
5. 모니터링 및 알림 설정

**통합 검증**:
- IV1: PR 생성 시 자동 테스트 실행
- IV2: 메인 브랜치 머지 시 자동 배포
- IV3: 롤백 시나리오 테스트
- IV4: 무중단 배포 검증

## Story 0.5: Dify API 통합 검증 및 모의 데이터 구축

통합 엔지니어로서,
Dify 백엔드 API와의 완벽한 통합을 검증하고 테스트 데이터를 준비하고 싶다.
이를 통해 개발 중 실제와 유사한 환경에서 테스트할 수 있다.

**사전 조건**: Story 0.4 완료 (CI/CD 구축)

**수락 기준**:
1. Dify API 통합 테스트 스위트 작성
   - Agent 생성/조회/수정/삭제
   - Workflow 실행 및 모니터링
   - RAG 파이프라인 테스트
   - 파일 업로드/다운로드
2. API 클라이언트 SDK 개발 (api-only-education-platform.md 기반)
   - TypeScript 타입 정의
   - 에러 처리 및 재시도 로직 (MAX_RETRIES=3, RETRY_DELAY=1000ms)
   - Rate limit 처리 (429 상태 코드)
   - 응답 캐싱 전략
   - 사용자 알림 메커니즘
3. 모의 데이터 생성
   - 샘플 Agent 10개
   - 샘플 Workflow 5개
   - 샘플 RAG 데이터셋 3개
   - 테스트 사용자 50명
4. 성능 벤치마크 수립 (k6 부하 테스트)
   - API 응답 시간 기준선: p90 < 3초, p95 < 5초
   - LLM 응답 시간: p90 < 30초
   - 동시 접속 한계 테스트: 50명 점진적 증가 (10→20→30→40→50)
   - 에러율 임계값: < 1% (정상), > 5% (위험)
   - CPU 사용률: < 70% (정상), > 85% (위험)
   - 메모리: < 2GB (정상), > 3GB (위험)
5. k6 부하 테스트 스크립트 구현
   - 교육 참가자 시나리오: 로그인 → 세션 참가 → Agent 생성 5단계 → LLM 호출 → Workflow 생성
   - 실시간 WebSocket 모니터링 테스트
   - 자동 스케일링 트리거 설정 (CPU > 80% 5분 지속 시)
   - 테스트 실행: `k6 run -e API_URL=http://localhost:5001 tests/load/education-session.js`
6. 통합 문제 트러블슈팅 가이드

**통합 검증**:
- IV1: 모든 Dify API 엔드포인트 호출 성공
- IV2: 50명 동시 접속 시나리오 성공 (점진적 부하 증가 테스트)
- IV3: 에러 복구 시나리오 테스트 (재시도 로직 검증)
- IV4: 네트워크 지연 시뮬레이션 테스트

---
