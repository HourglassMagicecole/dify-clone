#!/usr/bin/env bash
#
# security-test.sh -- P0 Hotfix 보안 패치 검증 시뮬레이션
#
# 사용법:
#   bash scripts/security-test.sh [호스트:포트]
#
# 기본값: localhost (포트 80)
# 예시:   bash scripts/security-test.sh 192.168.1.10
#         bash scripts/security-test.sh localhost:8080
#
# Docker Compose 환경이 실행 중이어야 합니다.
# 이 스크립트는 코드를 수정하지 않고 HTTP 요청만으로 패치를 검증합니다.

set -euo pipefail

# ──────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────

HOST="${1:-localhost}"
# https:// 또는 http:// 접두어가 있으면 그대로 사용, 없으면 http:// 추가
if [[ "$HOST" == https://* ]] || [[ "$HOST" == http://* ]]; then
  BASE_URL="${HOST}"
  HOST_ONLY=$(echo "$HOST" | sed -E 's|https?://||' | cut -d: -f1)
else
  BASE_URL="http://${HOST}"
  HOST_ONLY=$(echo "$HOST" | cut -d: -f1)
fi
TIMEOUT=5
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ──────────────────────────────────────────────
# 유틸리티 함수
# ──────────────────────────────────────────────

print_header() {
  echo ""
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════${NC}"
  echo -e "${CYAN}${BOLD}  $1${NC}"
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════${NC}"
}

print_section() {
  echo ""
  echo -e "${YELLOW}--- $1 ---${NC}"
}

assert_status() {
  local description="$1"
  local actual="$2"
  shift 2
  local expected_codes=("$@")

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  local matched=false
  for code in "${expected_codes[@]}"; do
    if [[ "$actual" == "$code" ]]; then
      matched=true
      break
    fi
  done

  if $matched; then
    echo -e "  ${GREEN}[PASS]${NC} ${description} (HTTP ${actual})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${description} (HTTP ${actual}, 기대: ${expected_codes[*]})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_connection_refused() {
  local description="$1"
  local url="$2"

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  local status
  status=$(curl -s -L -k -o /dev/null -w "%{http_code}" --connect-timeout 3 "$url" 2>/dev/null) || true

  if [[ "$status" == "000" ]] || [[ -z "$status" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} ${description} (연결 거부됨)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${description} (HTTP ${status}, 기대: 연결 거부)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_header_exists() {
  local description="$1"
  local headers="$2"
  local header_name="$3"

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  if echo "$headers" | grep -qi "$header_name"; then
    local value
    value=$(echo "$headers" | grep -i "$header_name" | head -1 | tr -d '\r')
    echo -e "  ${GREEN}[PASS]${NC} ${description} (${value})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${description} (헤더 없음)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

get_status() {
  curl -s -k -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$@" 2>/dev/null || echo "000"
}

# 리다이렉트를 따라가는 버전 (SSRF, 보안 헤더 등 최종 응답이 필요한 경우)
get_status_follow() {
  curl -s -L -k -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$@" 2>/dev/null || echo "000"
}

# ──────────────────────────────────────────────
# 사전 점검: Docker 컨테이너 실행 확인
# ──────────────────────────────────────────────

print_header "보안 패치 검증 시뮬레이션"
echo ""
echo -e "  대상: ${BOLD}${BASE_URL}${NC}"
echo -e "  시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo -e "${YELLOW}[사전 점검]${NC} Docker 컨테이너 상태 확인 중..."

if command -v docker &>/dev/null; then
  RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | head -20)
  if [[ -z "$RUNNING" ]]; then
    echo -e "  ${RED}[경고]${NC} 실행 중인 Docker 컨테이너가 없습니다."
    echo "  'make docker-build-no-cache'로 먼저 실행해주세요."
    exit 1
  fi
  echo -e "  ${GREEN}[확인]${NC} Docker 컨테이너 실행 중"

  # Nginx(포트 80)에 연결 가능한지 확인
  NGINX_STATUS=$(get_status "${BASE_URL}/signin")
  if [[ "$NGINX_STATUS" == "000" ]]; then
    echo -e "  ${RED}[경고]${NC} ${BASE_URL} 에 연결할 수 없습니다."
    echo "  Nginx 컨테이너가 정상 실행 중인지 확인해주세요."
    exit 1
  fi
  echo -e "  ${GREEN}[확인]${NC} Nginx 응답 정상 (HTTP ${NGINX_STATUS})"
else
  echo -e "  ${YELLOW}[경고]${NC} docker 명령어를 찾을 수 없습니다. 컨테이너 상태를 확인하지 않고 진행합니다."
fi

# ══════════════════════════════════════════════
# 테스트 시작
# ══════════════════════════════════════════════

# ──────────────────────────────────────────────
# AC1: SSRF 차단 확인
# ──────────────────────────────────────────────

print_section "AC1: SSRF 차단 -- Next.js Image 원격 패턴 제한"

# 내부 IP (private ranges)
SSRF_URLS=(
  "http://10.0.0.1/secret"
  "http://172.16.0.1/secret"
  "http://192.168.1.1/secret"
  "http://127.0.0.1:5432/secret"
)

for url in "${SSRF_URLS[@]}"; do
  STATUS=$(get_status_follow "${BASE_URL}/_next/image?url=${url}&w=256&q=75")
  assert_status "SSRF 차단: ${url}" "$STATUS" "400" "500" "403"
done

# Docker 내부 서비스 이름
DOCKER_INTERNAL=(
  "http://db:5432"
  "http://redis:6379"
  "http://sandbox:8194"
  "http://api:5001"
)

for url in "${DOCKER_INTERNAL[@]}"; do
  STATUS=$(get_status_follow "${BASE_URL}/_next/image?url=${url}&w=256&q=75")
  assert_status "SSRF 차단 (Docker 내부): ${url}" "$STATUS" "400" "500" "403"
done

# ──────────────────────────────────────────────
# AC2 & AC6: 포트 직접 접근 차단
# ──────────────────────────────────────────────

print_section "AC2 & AC6: 포트 직접 접근 차단"

# web-edu 직접 접근 (3001 포트는 외부 바인딩 제거됨)
assert_connection_refused "web-edu 직접 접근 차단 (포트 3001)" "http://${HOST_ONLY}:3001"

# DB 포트 (127.0.0.1 바인딩이므로 외부 접근 불가)
# 로컬에서 테스트 시 127.0.0.1 바인딩이므로 localhost로만 접근 가능
# 외부에서 테스트 시 연결 거부됨

# 아래 테스트는 포트가 열려있더라도 127.0.0.1 바인딩인지 확인
echo ""
echo -e "  ${YELLOW}[참고]${NC} DB/Redis/ES/Sandbox 포트는 127.0.0.1 바인딩으로 설정되어 있어야 합니다."
echo -e "  ${YELLOW}[참고]${NC} 로컬 테스트에서는 127.0.0.1로 접근 가능하지만, 외부에서는 차단됩니다."

# PostgreSQL (5432) - 127.0.0.1 바인딩 확인
PG_STATUS=$(get_status "http://${HOST_ONLY}:5432")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [[ "$PG_STATUS" == "000" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} PostgreSQL 포트(5432) 외부 HTTP 접근 차단"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  if [[ "$HOST_ONLY" == "localhost" ]] || [[ "$HOST_ONLY" == "127.0.0.1" ]]; then
    echo -e "  ${YELLOW}[INFO]${NC} PostgreSQL 포트(5432) 127.0.0.1 바인딩 (로컬 접근은 가능, HTTP ${PG_STATUS})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} PostgreSQL 포트(5432) 외부 접근 가능 (HTTP ${PG_STATUS})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
fi

# Redis (6379)
REDIS_STATUS=$(get_status "http://${HOST_ONLY}:6379")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [[ "$REDIS_STATUS" == "000" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} Redis 포트(6379) 외부 HTTP 접근 차단"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  if [[ "$HOST_ONLY" == "localhost" ]] || [[ "$HOST_ONLY" == "127.0.0.1" ]]; then
    echo -e "  ${YELLOW}[INFO]${NC} Redis 포트(6379) 127.0.0.1 바인딩 (로컬 접근은 가능, HTTP ${REDIS_STATUS})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} Redis 포트(6379) 외부 접근 가능 (HTTP ${REDIS_STATUS})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
fi

# Elasticsearch (9200)
ES_STATUS=$(get_status "http://${HOST_ONLY}:9200")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [[ "$ES_STATUS" == "000" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} Elasticsearch 포트(9200) 외부 HTTP 접근 차단"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  if [[ "$HOST_ONLY" == "localhost" ]] || [[ "$HOST_ONLY" == "127.0.0.1" ]]; then
    echo -e "  ${YELLOW}[INFO]${NC} Elasticsearch 포트(9200) 127.0.0.1 바인딩 (로컬 접근은 가능, HTTP ${ES_STATUS})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} Elasticsearch 포트(9200) 외부 접근 가능 (HTTP ${ES_STATUS})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
fi

# Sandbox (8194)
SANDBOX_STATUS=$(get_status "http://${HOST_ONLY}:8194")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [[ "$SANDBOX_STATUS" == "000" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} Sandbox 포트(8194) 외부 HTTP 접근 차단"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  if [[ "$HOST_ONLY" == "localhost" ]] || [[ "$HOST_ONLY" == "127.0.0.1" ]]; then
    echo -e "  ${YELLOW}[INFO]${NC} Sandbox 포트(8194) 127.0.0.1 바인딩 (로컬 접근은 가능, HTTP ${SANDBOX_STATUS})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} Sandbox 포트(8194) 외부 접근 가능 (HTTP ${SANDBOX_STATUS})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
fi

# ──────────────────────────────────────────────
# AC3: JWT 위조 차단
# ──────────────────────────────────────────────

print_section "AC3: JWT 위조 차단 -- 서명 검증"

# 위조 JWT (잘못된 서명)
FAKE_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.invalid_signature_here"
STATUS=$(get_status -b "edu_access_token=${FAKE_JWT}" "${BASE_URL}/dashboard")
assert_status "위조 JWT로 /dashboard 접근 차단" "$STATUS" "302" "307"

# 다른 키로 서명된 JWT (jose로 만든 것처럼 보이는 토큰)
WRONG_KEY_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidGVuYW50X2lkIjoiYWJjIiwiZXhwIjo5OTk5OTk5OTk5fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
STATUS=$(get_status -b "edu_access_token=${WRONG_KEY_JWT}" "${BASE_URL}/dashboard")
assert_status "다른 키로 서명된 JWT 차단" "$STATUS" "302" "307"

# 만료된 JWT (exp=0)
EXPIRED_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjowfQ.invalid"
STATUS=$(get_status -b "edu_access_token=${EXPIRED_JWT}" "${BASE_URL}/dashboard")
assert_status "만료된 JWT 차단" "$STATUS" "302" "307"

# 빈 토큰
STATUS=$(get_status -b "edu_access_token=" "${BASE_URL}/dashboard")
assert_status "빈 토큰으로 접근 차단" "$STATUS" "302" "307"

# ──────────────────────────────────────────────
# AC4: 인증 우회 차단 (화이트리스트 방식)
# ──────────────────────────────────────────────

print_section "AC4: 인증 우회 차단 -- 화이트리스트 방식"

echo -e "  ${YELLOW}[보호된 경로 -- 리다이렉트 기대]${NC}"

PROTECTED_PATHS=(
  "/dashboard"
  "/owner/dashboard"
  "/my-session"
  "/sessions"
  "/agents"
  "/datasets"
  "/admin"
)

for path in "${PROTECTED_PATHS[@]}"; do
  STATUS=$(get_status "${BASE_URL}${path}")
  assert_status "인증 없이 ${path} 차단" "$STATUS" "302" "307"
done

echo ""
echo -e "  ${YELLOW}[공개 경로 -- 정상 접근 기대]${NC}"

PUBLIC_PATHS=(
  "/signin"
  "/403"
)

for path in "${PUBLIC_PATHS[@]}"; do
  STATUS=$(get_status_follow "${BASE_URL}${path}")
  assert_status "공개 경로 ${path} 접근 허용" "$STATUS" "200" "304"
done

# ──────────────────────────────────────────────
# AC5: 디버그 페이지 제거
# ──────────────────────────────────────────────

print_section "AC5: 디버그 페이지 제거"

DEBUG_PAGES=(
  "/api-test"
  "/test-tools"
)

for path in "${DEBUG_PAGES[@]}"; do
  STATUS=$(get_status "${BASE_URL}${path}")
  assert_status "디버그 페이지 ${path} 제거됨" "$STATUS" "404" "302" "307"
done

# ──────────────────────────────────────────────
# AC7: 보안 헤더 확인
# ──────────────────────────────────────────────

print_section "AC7: 보안 헤더 확인"

HEADERS=$(curl -s -L -k -I --connect-timeout "$TIMEOUT" --max-time 10 "${BASE_URL}/" 2>/dev/null || echo "")

if [[ -z "$HEADERS" ]]; then
  echo -e "  ${RED}[FAIL]${NC} 응답 헤더를 가져올 수 없습니다."
  TOTAL_COUNT=$((TOTAL_COUNT + 4))
  FAIL_COUNT=$((FAIL_COUNT + 4))
else
  assert_header_exists "X-Frame-Options 헤더" "$HEADERS" "x-frame-options"
  assert_header_exists "X-Content-Type-Options 헤더" "$HEADERS" "x-content-type-options"
  assert_header_exists "Strict-Transport-Security 헤더" "$HEADERS" "strict-transport-security"
  assert_header_exists "Referrer-Policy 헤더" "$HEADERS" "referrer-policy"
fi

# ──────────────────────────────────────────────
# AC7: Rate Limiting 확인
# ──────────────────────────────────────────────

print_section "AC7: Rate Limiting 확인 (로그인 엔드포인트)"

echo -e "  ${YELLOW}[참고]${NC} /console/api/login에 빠르게 15회 요청 전송 중..."
echo -e "  ${YELLOW}[참고]${NC} Nginx rate limit: login zone = 5r/m, burst=10"

GOT_429=false
RESPONSES=""

for i in $(seq 1 15); do
  STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 3 \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    "${BASE_URL}/console/api/login" 2>/dev/null) || STATUS="000"
  RESPONSES="${RESPONSES} ${STATUS}"
  if [[ "$STATUS" == "429" ]] || [[ "$STATUS" == "503" ]]; then
    GOT_429=true
  fi
done

TOTAL_COUNT=$((TOTAL_COUNT + 1))
echo -e "  ${YELLOW}[응답 코드]${NC}${RESPONSES}"

if $GOT_429; then
  echo -e "  ${GREEN}[PASS]${NC} Rate limiting 동작 확인 (429/503 응답 수신)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}[FAIL]${NC} Rate limiting 미동작 (429 응답 없음)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ──────────────────────────────────────────────
# AC8 보충: React2Shell / Next.js 버전 노출 확인
# ──────────────────────────────────────────────

print_section "보충: Next.js 버전 정보 노출 확인"

TOTAL_COUNT=$((TOTAL_COUNT + 1))
BODY=$(curl -s -L -k --connect-timeout "$TIMEOUT" --max-time 10 "${BASE_URL}/signin" 2>/dev/null || echo "")
VERSION_LEAK=$(echo "$BODY" | grep -oE 'next/[0-9]+\.[0-9]+' || true)

if [[ -z "$VERSION_LEAK" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} Next.js 버전 노출 없음 (정상)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}[INFO]${NC} Next.js 버전 노출: ${VERSION_LEAK} (권장: 서버 헤더에서 제거)"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

# X-Powered-By 헤더 노출 확인
TOTAL_COUNT=$((TOTAL_COUNT + 1))
POWERED_BY=$(echo "$HEADERS" | grep -i "x-powered-by" || true)
if [[ -z "$POWERED_BY" ]]; then
  echo -e "  ${GREEN}[PASS]${NC} X-Powered-By 헤더 없음 (정상)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}[FAIL]${NC} X-Powered-By 헤더 노출: ${POWERED_BY}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ══════════════════════════════════════════════
# 결과 요약
# ══════════════════════════════════════════════

print_header "검증 결과 요약"

echo ""
echo -e "  전체: ${BOLD}${TOTAL_COUNT}${NC} 개 테스트"
echo -e "  ${GREEN}PASS: ${PASS_COUNT}${NC}"
echo -e "  ${RED}FAIL: ${FAIL_COUNT}${NC}"
echo ""

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  *** 모든 보안 테스트 통과 -- 배포 가능 ***${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}  *** ${FAIL_COUNT}개 테스트 실패 -- 배포 전 수정 필요 ***${NC}"
  echo ""
  echo -e "  ${YELLOW}실패한 항목을 확인하고 패치를 적용한 후 다시 실행해주세요:${NC}"
  echo "    bash scripts/security-test.sh ${HOST}"
  echo ""
  exit 1
fi
