# EduAI Studio 롤백 절차 문서

## 개요
이 문서는 EduAI Studio 프로젝트의 각 Story별 구체적인 롤백 절차를 정의합니다.

## 롤백 전략 원칙

### 기본 원칙
1. **독립적 프론트엔드**: web-edu는 기존 시스템과 독립적으로 롤백 가능
2. **데이터베이스 보호**: 교육용 테이블만 영향을 받도록 격리
3. **무중단 롤백**: Blue-Green 배포로 서비스 중단 최소화
4. **Feature 플래그**: 기능별 활성화/비활성화 제어

### Feature 플래그 시스템
```typescript
// web-edu/config/features.ts
export const FEATURES = {
  AGENT_WIZARD: process.env.NEXT_PUBLIC_FEATURE_AGENT_WIZARD === 'true',
  WORKFLOW_EDITOR: process.env.NEXT_PUBLIC_FEATURE_WORKFLOW_EDITOR === 'true',
  RAG_VISUALIZER: process.env.NEXT_PUBLIC_FEATURE_RAG_VISUALIZER === 'true',
  ADMIN_DASHBOARD: process.env.NEXT_PUBLIC_FEATURE_ADMIN_DASHBOARD === 'true',
}
```

## Story별 롤백 절차

### Story 0: 인프라 및 환경 구축 롤백

#### Story 0.1: 개발 환경 설정 롤백

##### 롤백 트리거
- [ ] 필수 도구 버전 충돌
- [ ] Docker 설치 실패
- [ ] 환경 검증 스크립트 오류

##### 롤백 단계
1. **즉시 조치** (5분 이내)
   ```bash
   # 개발 환경 초기화
   rm -rf ~/.uv  # UV 캐시 삭제
   rm -rf node_modules  # Node 모듈 삭제
   ```
2. **도구 재설치**
   - 검증된 버전으로 재설치
   - Python 3.11.x 고정 사용
   - Node.js 22.11.0 고정 사용

#### Story 0.2: 데이터베이스 마이그레이션 롤백

##### 롤백 트리거
- [ ] 마이그레이션 실패
- [ ] FK 제약 조건 오류
- [ ] 기존 테이블 충돌

##### 롤백 단계
1. **즉시 조치** (5분 이내)
   ```bash
   # 교육 테이블 롤백
   ./rollback_education_tables.sh

   # 확인
   uv run --project api flask db current
   ```
2. **데이터 정리**
   ```sql
   -- 잔여 데이터 삭제
   DROP TABLE IF EXISTS education_sessions CASCADE;
   DROP TABLE IF EXISTS education_enrollments CASCADE;
   -- ... 나머지 테이블들
   ```

#### Story 0.3: 백엔드 Blueprint 롤백

##### 롤백 트리거
- [ ] URL 충돌 발생
- [ ] Blueprint 등록 실패
- [ ] API 엔드포인트 오작동

##### 롤백 단계
1. **Blueprint 제거** (즉시)
   ```python
   # api/app_factory.py에서 edu_bp 제거
   # app.register_blueprint(edu_bp) 라인 주석 처리
   ```
2. **서버 재시작**
   ```bash
   docker-compose restart api
   ```

#### Story 0.4: CI/CD 롤백

##### 롤백 트리거
- [ ] GitHub Actions 실패
- [ ] Docker 빌드 오류
- [ ] 배포 실패

##### 롤백 단계
1. **Workflow 비활성화**
   ```bash
   # GitHub에서 workflow 비활성화
   mv .github/workflows/edu-ci-cd.yml .github/workflows/edu-ci-cd.yml.bak
   ```
2. **수동 배포 전환**
   - 기존 수동 배포 프로세스 사용

#### Story 0.5: API 통합 검증 롤백

##### 롤백 트리거
- [ ] Dify API 호환성 문제
- [ ] SDK 오작동
- [ ] 테스트 데이터 오류

##### 롤백 단계
1. **테스트 데이터 삭제**
   ```bash
   # 샘플 데이터 제거
   ./scripts/cleanup_test_data.sh
   ```
2. **SDK 롤백**
   ```bash
   # 이전 버전 SDK로 롤백
   git checkout HEAD~1 -- web-edu/services/DifyAPIService.ts
   ```

---

## Story별 롤백 절차

### Story 1.1: 교육용 프론트엔드 프로젝트 초기 설정 (수정됨)

#### 롤백 트리거
- [ ] 빌드 실패 (3회 연속)
- [ ] 기존 API 연결 실패
- [ ] Docker 통합 실패

#### 롤백 단계
1. **즉시 조치** (5분 이내)
   ```bash
   # web-edu 컨테이너 중지
   docker-compose stop web-edu

   # nginx 설정 원복 (교육용 라우트 제거)
   cp /backup/nginx/default.conf.backup /etc/nginx/sites-enabled/default.conf
   nginx -s reload
   ```

2. **코드 롤백** (10분 이내)
   ```bash
   # Git 이전 커밋으로 롤백
   cd web-edu
   git revert HEAD --no-edit
   git push origin main

   # 의존성 캐시 정리
   rm -rf node_modules .next
   pnpm install
   ```

3. **검증**
   ```bash
   # 기존 시스템 정상 작동 확인
   curl -I http://localhost/api/health
   # 응답 코드 200 확인
   ```

### Story 1.2: 인증 및 사용자 관리 시스템 구현

#### 롤백 트리거
- [ ] JWT 토큰 검증 실패
- [ ] 권한 시스템 오작동
- [ ] 세션 관리 오류

#### 롤백 단계
1. **Feature 플래그 비활성화** (즉시)
   ```bash
   # .env.local
   NEXT_PUBLIC_FEATURE_EDU_AUTH=false

   # 서버 재시작
   docker-compose restart web-edu
   ```

2. **데이터베이스 롤백** (5분 이내)
   ```sql
   -- 교육용 권한 제거
   DELETE FROM user_roles WHERE role_name LIKE 'edu_%';

   -- 교육 세션 테이블 비활성화
   ALTER TABLE education_sessions RENAME TO education_sessions_rollback;
   ```

3. **캐시 정리**
   ```bash
   # Redis 세션 캐시 정리
   docker exec -it redis redis-cli
   > KEYS edu:session:* | xargs DEL
   > exit
   ```

### Story 1.3: 5단계 Agent 생성 마법사 구현

#### 롤백 트리거
- [ ] Agent 생성 API 호출 실패
- [ ] 데이터 정합성 오류
- [ ] UI 렌더링 문제

#### 롤백 단계
1. **기능 비활성화** (즉시)
   ```typescript
   // web-edu/app/(education)/agent-builder/page.tsx
   if (!FEATURES.AGENT_WIZARD) {
     return <LegacyAgentBuilder />; // 기존 UI로 폴백
   }
   ```

2. **임시 데이터 정리** (10분 이내)
   ```sql
   -- 불완전한 Agent 제거
   UPDATE agents
   SET deleted_at = NOW()
   WHERE created_by IN (
     SELECT user_id FROM user_groups WHERE group_type = 'education'
   ) AND created_at > '${ROLLBACK_TIMESTAMP}';
   ```

3. **사용자 알림**
   ```javascript
   // 교육 참가자에게 알림
   broadcastNotification({
     type: 'maintenance',
     message: '일시적인 문제로 기존 Agent 생성 화면으로 전환됩니다.',
     fallbackUrl: '/console/apps'
   });
   ```

### Story 1.4: 비주얼 Workflow 편집기 구현

#### 롤백 트리거
- [ ] React Flow 라이브러리 충돌
- [ ] 노드 연결 검증 오류
- [ ] 저장/불러오기 실패

#### 롤백 단계
1. **편집기 폴백** (즉시)
   ```bash
   # Feature 플래그로 기존 편집기 활성화
   export NEXT_PUBLIC_USE_LEGACY_WORKFLOW_EDITOR=true
   ```

2. **Workflow 데이터 보존**
   ```sql
   -- 교육용 Workflow를 읽기 전용으로 전환
   UPDATE workflows
   SET is_readonly = true
   WHERE created_via = 'edu_visual_editor';
   ```

3. **캐시 무효화**
   ```bash
   # CDN 캐시 제거
   curl -X PURGE https://cdn.example.com/web-edu/workflow-editor/*
   ```

### Story 1.5: RAG 파이프라인 시각화 대시보드 구현

#### 롤백 트리거
- [ ] 벡터 DB 연결 실패
- [ ] 임베딩 생성 오류
- [ ] 검색 성능 저하 (3초 초과)

#### 롤백 단계
1. **시각화 비활성화** (즉시)
   ```javascript
   // RAG 설정을 간단 모드로 전환
   localStorage.setItem('rag_mode', 'simple');
   window.location.reload();
   ```

2. **벡터 인덱스 보호**
   ```bash
   # 교육용 인덱스 읽기 전용 전환
   curl -X PUT "localhost:9200/edu_vectors/_settings" \
     -H 'Content-Type: application/json' \
     -d '{"index.blocks.write": true}'
   ```

### Story 1.6-1.10: 기타 Story 롤백

#### 공통 롤백 프로세스
1. **상태 저장**
   ```bash
   # 현재 상태 백업
   ./scripts/backup_current_state.sh
   ```

2. **점진적 롤백**
   ```bash
   # Story별 Feature 플래그 비활성화
   ./scripts/disable_feature.sh STORY_NAME
   ```

3. **모니터링**
   ```bash
   # 롤백 후 시스템 상태 확인
   ./scripts/health_check.sh --detailed
   ```

## 자동 롤백 시스템

### 헬스체크 기반 자동 롤백
```yaml
# docker-compose.yaml
services:
  web-edu:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

### 메트릭 기반 자동 롤백
```javascript
// monitoring/rollback-triggers.js
const THRESHOLDS = {
  errorRate: 0.05,      // 5% 이상 오류율
  responseTime: 3000,   // 3초 이상 응답시간
  availability: 0.95    // 95% 이하 가용성
};

async function checkMetrics() {
  const metrics = await getMetrics();

  if (metrics.errorRate > THRESHOLDS.errorRate) {
    await triggerRollback('HIGH_ERROR_RATE');
  }

  if (metrics.p95ResponseTime > THRESHOLDS.responseTime) {
    await triggerRollback('SLOW_RESPONSE');
  }

  if (metrics.availability < THRESHOLDS.availability) {
    await triggerRollback('LOW_AVAILABILITY');
  }
}
```

## 롤백 후 복구 절차

### 1. 근본 원인 분석
```bash
# 로그 수집
./scripts/collect_logs.sh --from "1 hour ago"

# 오류 분석
./scripts/analyze_errors.sh --verbose
```

### 2. 수정 및 테스트
```bash
# 로컬 환경에서 수정 테스트
docker-compose -f docker-compose.test.yaml up

# 부하 테스트
npm run test:load -- --users 50 --duration 10m
```

### 3. 점진적 재배포
```bash
# Canary 배포 (10% 트래픽)
./scripts/canary_deploy.sh --percentage 10

# 모니터링 (30분)
./scripts/monitor_canary.sh --duration 30m

# 전체 배포
./scripts/full_deploy.sh
```

## 비상 연락망

### 롤백 승인권자 (우선순위)
1. **Story 0 롤백**: 개발 팀장 즉시 승인 가능
2. **Story 1.1-1.5 롤백**: 개발 팀장 (10분 이내 응답)
3. **Story 1.6-1.11 롤백**: CTO (30분 이내 응답)
4. **전체 시스템 롤백**: 프로젝트 매니저 (1시간 이내 응답)

### 알림 채널
- **Slack**: #edu-platform-alerts
- **PagerDuty**: edu-platform-oncall
- **Email**: edu-platform-emergency@example.com

## 롤백 체크리스트

### 롤백 전
- [ ] Story 의존성 확인 (연쇄 롤백 필요 여부)
- [ ] 현재 상태 백업 완료
- [ ] 영향받는 사용자 식별
- [ ] 롤백 계획 검토
- [ ] 관련 팀 통보

### 롤백 중
- [ ] Feature 플래그 비활성화
- [ ] 데이터베이스 변경 롤백
- [ ] 캐시 정리
- [ ] 서비스 재시작

### 롤백 후
- [ ] 시스템 정상 작동 확인
- [ ] 사용자 알림 발송
- [ ] 사후 분석 보고서 작성
- [ ] 개선 계획 수립

---

*이 문서는 각 배포 시마다 업데이트되어야 하며, 실제 롤백 수행 시 교훈을 반영하여 지속적으로 개선되어야 합니다.*