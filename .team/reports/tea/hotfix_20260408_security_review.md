# TEA Scoped Re-Review 결과

## 판정: PASS

---

## 이전 이슈 해결 상태

| # | 이전 이슈 | 해결됨 | 근거 |
|---|----------|--------|------|
| 1 | middleware.test.ts가 jose 서명 검증을 실제로 검증하지 못함 (가짜 토큰, await 미사용) | YES | `jest.mock('jose')` 적용 (라인 16-18), `mockedJwtVerify`로 타입 안전한 모킹 (라인 28), 모든 테스트에서 `await middleware(request)` 사용. `mockResolvedValueOnce`/`mockRejectedValueOnce`로 jose의 비동기 동작을 정확히 시뮬레이션. |
| 2 | IDOR 방어 테스트 전무 | YES | `test_users_authorization.py`: student→타인 403, admin→타인 200, 자기→200 검증. `test_resource_tags_authorization.py`: account_id IDOR 방어, 세션 비멤버 403, 삭제 권한 403/200 검증. |
| 3 | AC 커버리지 0% (자동화 가능 AC 중 유효 테스트 없음) | YES | AC3 (JWT 서명 검증) 6개 시나리오, AC4 (화이트리스트) 6개 경로, AC8 (IDOR/인가) 7개 시나리오가 테스트로 커버됨. |

---

## AC별 테스트 커버리지

| AC | 검증 기준 | 테스트 여부 | 파일:라인 |
|----|----------|-----------|----------|
| AC1: SSRF 차단 | 내부 IP 요청 시 400 에러 | NO (설정 레벨, N/A) | - |
| AC2: Docker 보안 | 포트/키 변경 | N/A (인프라) | - |
| AC3: JWT — 유효 JWT 통과 | `jwtVerify` 성공 시 `NextResponse.next()` | YES | `web-edu/__tests__/middleware.test.ts:83-99` |
| AC3: JWT — 위조 서명 거부 | `jwtVerify` 실패(invalid sig) 시 `/signin` 리다이렉트 | YES | `web-edu/__tests__/middleware.test.ts:102-117` |
| AC3: JWT — 만료 거부 | `jwtVerify` 실패(expired) 시 `/signin` 리다이렉트 | YES | `web-edu/__tests__/middleware.test.ts:119-135` |
| AC3: JWT — 토큰 없음 | 토큰 미포함 시 `/signin` 리다이렉트 | YES | `web-edu/__tests__/middleware.test.ts:137-155` |
| AC3: JWT — 호출 인자 검증 | `jwtVerify`에 토큰, Uint8Array 키, `{algorithms: ['HS256']}` 전달 | YES | `web-edu/__tests__/middleware.test.ts:92-96` |
| AC4: 화이트리스트 — PUBLIC_PATHS | `/signin`, `/signup`, `/callback`, `/403` 토큰 없이 접근 허용 | YES | `web-edu/__tests__/middleware.test.ts:56-78` |
| AC4: 화이트리스트 — 비-public 경로 보호 | `/`, `/about`, `/owner`, `/owner/dashboard`, `/my-session`, `/sessions` 토큰 없이 리다이렉트 | YES | `web-edu/__tests__/middleware.test.ts:159-175` |
| AC4: 화이트리스트 — 리다이렉트 URL 파라미터 | 보호 경로에서 리다이렉트 시 `redirect=` 파라미터 포함 | YES | `web-edu/__tests__/middleware.test.ts:179-188` |
| AC5: 디버그 페이지 제거 | /api-test, /test-tools 404 | NO (빌드 레벨, CI로 검증 권장) | - |
| AC6: Docker 인프라 | 포트 제한, 비밀번호 강화 | N/A (인프라) | - |
| AC7: Nginx 보안 | 보안 헤더, rate limiting | N/A (인프라) | - |
| AC8: IDOR — student→타인 조회 403 | `GET /users/<other_id>` normal role 시 403 | YES | `api/tests/.../test_users_authorization.py:106-121` |
| AC8: IDOR — admin→타인 조회 200 | `GET /users/<other_id>` admin role 시 200 | YES | `api/tests/.../test_users_authorization.py:123-146` |
| AC8: IDOR — 자기 조회 200 | `GET /users/<own_id>` 시 200 | YES | `api/tests/.../test_users_authorization.py:148-167` |
| AC8: bulk — student 거부 | `admin_required` 데코레이터 normal role 시 403 | YES | `api/tests/.../test_users_authorization.py:173-205` |
| AC8: bulk — admin 허용 | `admin_required` 데코레이터 admin role 시 통과 | YES | `api/tests/.../test_users_authorization.py:207-228` |
| AC8: resource_tags IDOR | body의 account_id 무시, current_user.id 사용 검증 | YES | `api/tests/.../test_resource_tags_authorization.py:46-92` |
| AC8: resource_tags 멤버십 | 세션 비멤버 요청 시 403 | YES | `api/tests/.../test_resource_tags_authorization.py:98-122` |
| AC8: resource_tags 삭제 권한 | 비생성자 비admin 삭제 시 403, admin 삭제 시 200 | YES | `api/tests/.../test_resource_tags_authorization.py:128-183` |
| AC8: passport exp 필수 | exp 없는 JWT 발행 시 ValueError | YES (기존) | `api/tests/.../test_passport.py:34-38` |
| AC9: 비-root 컨테이너 | whoami != root | N/A (인프라) | - |

---

## 검증 기준별 판정

| # | 기준 | 판정 | 근거 |
|---|------|------|------|
| 1 | 보안 패치 회귀 테스트 | **PASS** | JWT 서명 검증(middleware.ts), IDOR 방어(users.py, resource_tags.py), 인가 강화(admin_required) 모든 보안 수정에 regression test 존재 |
| 2 | 부정 테스트 (Negative test) | **PASS** | 위조 JWT 거부, 만료 JWT 거부, student→타인 IDOR 403, 세션 비멤버 403, 비생성자 삭제 403 등 공격 시나리오 재현 테스트 포함 |
| 3 | 테스트 신뢰성 | **PASS** | jose를 jest.mock으로 모킹하여 비동기 동작을 제어하고 await 사용. API 테스트는 Flask test_client로 실제 라우팅 검증. 구현 세부가 아닌 HTTP 상태 코드와 응답 본문 검증 |
| 4 | AC 커버리지 | **PASS** | 자동화 가능한 AC(AC3, AC4, AC8) 모두 테스트로 커버됨. AC1(설정 레벨), AC5(빌드 레벨)는 단위 테스트 범위 밖이며 별도 검증 경로가 적절 |

---

## 테스트 품질 상세 분석

### middleware.test.ts

**강점:**
- jose를 `jest.mock`으로 모킹하여 `mockResolvedValueOnce`/`mockRejectedValueOnce`로 성공/실패 시나리오를 정밀하게 제어
- `expect(mockedJwtVerify).toHaveBeenCalledWith(token, expect.any(Uint8Array), { algorithms: ['HS256'] })` — 호출 인자까지 검증하여 알고리즘 다운그레이드 방지 확인
- PUBLIC_PATHS 4개 경로 + 서브패스(`/signin/callback`) 검증으로 startsWith 매칭 동작 확인
- 비-public 경로 6개(/, /about, /owner, /owner/dashboard, /my-session, /sessions)로 화이트리스트 전환 검증
- 리다이렉트 시 `redirect=` 쿼리 파라미터 포함 여부 검증

**주의사항:**
- NextResponse도 함께 모킹하고 있어서 실제 Next.js 미들웨어 런타임과의 통합은 검증하지 않음. 이는 단위 테스트의 합리적 범위 내.

### test_users_authorization.py

**강점:**
- Flask test_client를 사용한 실제 HTTP 라우팅 테스트 (IDOR 검증)
- jwt_required를 패치하여 request.user를 주입하는 방식이 깔끔
- TenantAccountJoin.role을 모킹하여 IDOR 분기 로직(`is_privileged_role`) 검증

**주의사항:**
- `TestBulkTaskAuthorization`은 엔드포인트가 아닌 데코레이터 단위 테스트로 구현됨. 데코레이터가 import 시점에 적용되므로 합리적인 선택이나, 엔드포인트에 데코레이터가 실제로 적용되어 있는지는 코드 리뷰로 확인 필요.

### test_resource_tags_authorization.py

**강점:**
- IDOR 방어의 핵심 — `add_tag.call_args`를 검사하여 서비스에 전달된 account_id가 current_user.id인지 직접 검증 (라인 85-92)
- 세션 멤버십(membership query → None → 403) 검증으로 비멤버 접근 차단 확인
- 삭제 권한에서 creator/admin 분기 모두 검증

---

## 새로 발견된 이슈

없음. 이전 리뷰에서 지적된 모든 Critical/High 이슈가 해결되었음.

---

## 권고사항

### Priority: Low (개선 사항, PASS 판정에 영향 없음)

1. **AC1 SSRF 차단 테스트**: `next.config.ts`의 `remotePatterns` 설정이 의도한 호스트만 포함하는지 확인하는 설정 스냅샷 테스트 또는 CI 스텝 추가를 고려할 수 있음.

2. **AC5 디버그 페이지 삭제 확인**: CI 파이프라인에서 `ls web-edu/app/api-test web-edu/app/test-tools` 결과가 비어 있는지 확인하는 스텝을 추가하면 실수로 재생성될 때 감지 가능.

3. **bulk task 엔드포인트 통합 테스트**: 현재 `admin_required` 데코레이터 단위 테스트로 검증되고 있으나, 향후 엔드포인트 레벨 통합 테스트를 추가하면 데코레이터 적용 누락을 방지할 수 있음.
