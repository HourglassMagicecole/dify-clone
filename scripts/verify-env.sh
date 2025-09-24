#!/bin/bash

# Dify 클론 프로젝트 환경 검증 스크립트
# 개발에 필요한 모든 도구와 서비스가 올바르게 설치되고 실행되는지 확인합니다.

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 아이콘 정의
CHECK_MARK="✓"
CROSS_MARK="✗"
WARNING_MARK="⚠"
INFO_MARK="ℹ"

# 전역 변수
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 로그 함수들
log_header() {
    echo -e "${CYAN}=================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}=================================${NC}"
    echo
}

log_section() {
    echo -e "${PURPLE}### $1${NC}"
    echo
}

log_check() {
    echo -n "  $1... "
}

log_pass() {
    echo -e "${GREEN}${CHECK_MARK} $1${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_fail() {
    echo -e "${RED}${CROSS_MARK} $1${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

log_warn() {
    echo -e "${YELLOW}${WARNING_MARK} $1${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
}

log_info() {
    echo -e "${BLUE}${INFO_MARK} $1${NC}"
}

log_detail() {
    echo -e "    ${NC}$1"
}

# 명령어 존재 확인
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 버전 비교 함수
version_ge() {
    test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# 포트가 사용 중인지 확인
port_in_use() {
    local port=$1
    if command_exists netstat; then
        netstat -tuln | grep ":$port " >/dev/null 2>&1
    elif command_exists ss; then
        ss -tuln | grep ":$port " >/dev/null 2>&1
    elif command_exists lsof; then
        lsof -i ":$port" >/dev/null 2>&1
    else
        return 1
    fi
}

# 네트워크 연결 테스트
test_network_connection() {
    local host=$1
    local port=$2
    local timeout=${3:-5}

    if command_exists nc; then
        nc -z -w "$timeout" "$host" "$port" >/dev/null 2>&1
    elif command_exists telnet; then
        timeout "$timeout" bash -c "echo >/dev/tcp/$host/$port" >/dev/null 2>&1
    elif command_exists curl; then
        curl -s --connect-timeout "$timeout" "http://$host:$port" >/dev/null 2>&1
    else
        return 1
    fi
}

# Python 버전 확인
check_python() {
    log_section "Python 환경 확인"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "Python 설치 여부"

    local python_cmd=""
    local python_version=""

    # Python 명령어 찾기
    for cmd in python3.12 python3 python; do
        if command_exists "$cmd"; then
            python_version=$($cmd --version 2>&1 | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
            if [[ $python_version =~ ^3\.(1[1-3])\. ]]; then
                python_cmd=$cmd
                break
            fi
        fi
    done

    if [[ -n "$python_cmd" ]]; then
        log_pass "Python $python_version ($python_cmd)"
        log_detail "경로: $(which $python_cmd)"

        # pip 확인
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "pip 확인"
        if $python_cmd -m pip --version >/dev/null 2>&1; then
            local pip_version=$($python_cmd -m pip --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
            log_pass "pip $pip_version"
        else
            log_fail "pip을 사용할 수 없습니다"
        fi

        # 가상환경 모듈 확인
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "venv 모듈 확인"
        if $python_cmd -m venv --help >/dev/null 2>&1; then
            log_pass "venv 모듈 사용 가능"
        else
            log_warn "venv 모듈을 사용할 수 없습니다"
        fi

    else
        log_fail "Python 3.11-3.13이 설치되지 않았습니다"
        log_detail "setup-dev-env.sh 스크립트를 실행하세요"
    fi

    echo
}

# Node.js 및 npm 확인
check_nodejs() {
    log_section "Node.js 환경 확인"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "Node.js 설치 여부"

    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        local required_version="22.11.0"

        if version_ge "$node_version" "$required_version"; then
            log_pass "Node.js v$node_version"
            log_detail "경로: $(which node)"

            # npm 확인
            TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
            log_check "npm 확인"
            if command_exists npm; then
                local npm_version=$(npm --version)
                log_pass "npm v$npm_version"
                log_detail "경로: $(which npm)"
            else
                log_fail "npm이 설치되지 않았습니다"
            fi

            # npx 확인
            TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
            log_check "npx 확인"
            if command_exists npx; then
                log_pass "npx 사용 가능"
            else
                log_warn "npx를 사용할 수 없습니다"
            fi

        else
            log_fail "Node.js 버전이 요구사항에 맞지 않습니다 (v$node_version < v$required_version)"
            log_detail "Node.js v22.11.0 이상을 설치하세요"
        fi
    else
        log_fail "Node.js가 설치되지 않았습니다"
        log_detail "setup-dev-env.sh 스크립트를 실행하세요"
    fi

    echo
}

# UV 패키지 관리자 확인
check_uv() {
    log_section "UV 패키지 관리자 확인"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "UV 설치 여부"

    if command_exists uv; then
        local uv_version=$(uv --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
        log_pass "UV v$uv_version"
        log_detail "경로: $(which uv)"

        # UV Python 설정 확인
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "UV Python 설정"
        local uv_python=$(uv python list 2>/dev/null | head -n 1)
        if [[ -n "$uv_python" ]]; then
            log_pass "UV Python 설정됨"
            log_detail "$uv_python"
        else
            log_warn "UV Python이 설정되지 않았습니다"
        fi
    else
        log_fail "UV가 설치되지 않았습니다"
        log_detail "setup-dev-env.sh 스크립트를 실행하세요"
    fi

    echo
}

# pnpm 확인
check_pnpm() {
    log_section "pnpm 패키지 관리자 확인"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "pnpm 설치 여부"

    if command_exists pnpm; then
        local pnpm_version=$(pnpm --version)
        log_pass "pnpm v$pnpm_version"
        log_detail "경로: $(which pnpm)"

        # pnpm 저장소 확인
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "pnpm 저장소 접근"
        if pnpm config get registry >/dev/null 2>&1; then
            local registry=$(pnpm config get registry)
            log_pass "저장소 접근 가능"
            log_detail "Registry: $registry"
        else
            log_warn "pnpm 저장소 설정을 확인할 수 없습니다"
        fi
    else
        log_fail "pnpm이 설치되지 않았습니다"
        log_detail "setup-dev-env.sh 스크립트를 실행하세요"
    fi

    echo
}

# Docker 확인
check_docker() {
    log_section "Docker 환경 확인"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "Docker 설치 여부"

    if command_exists docker; then
        if docker --version >/dev/null 2>&1; then
            local docker_version=$(docker --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
            log_pass "Docker v$docker_version"
            log_detail "경로: $(which docker)"

            # Docker 실행 상태 확인
            TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
            log_check "Docker 서비스 상태"
            if docker info >/dev/null 2>&1; then
                log_pass "Docker 서비스 실행 중"

                # Docker Compose 확인
                TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                log_check "Docker Compose 확인"
                if docker compose version >/dev/null 2>&1; then
                    local compose_version=$(docker compose version --short)
                    log_pass "Docker Compose v$compose_version"
                elif command_exists docker-compose; then
                    local compose_version=$(docker-compose --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
                    log_pass "Docker Compose v$compose_version (레거시)"
                else
                    log_fail "Docker Compose를 사용할 수 없습니다"
                fi

                # Docker 권한 확인 (Linux만)
                if [[ "$OSTYPE" == "linux-gnu"* ]]; then
                    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                    log_check "Docker 권한 확인"
                    if docker ps >/dev/null 2>&1; then
                        log_pass "Docker 권한 정상"
                    else
                        log_fail "Docker 권한 부족"
                        log_detail "sudo usermod -aG docker $USER 실행 후 재로그인하세요"
                    fi
                fi

            else
                log_fail "Docker 서비스가 실행되지 않습니다"
                log_detail "Docker Desktop을 실행하거나 Docker 서비스를 시작하세요"
            fi
        else
            log_fail "Docker 실행 오류"
        fi
    else
        log_fail "Docker가 설치되지 않았습니다"
        log_detail "docs/dev-setup/docker-setup.md를 참조하여 설치하세요"
    fi

    echo
}

# Git 확인
check_git() {
    log_section "Git 확인"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "Git 설치 여부"

    if command_exists git; then
        local git_version=$(git --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
        log_pass "Git v$git_version"
        log_detail "경로: $(which git)"

        # Git 설정 확인
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "Git 사용자 설정"
        local git_user=$(git config --global user.name 2>/dev/null || echo "")
        local git_email=$(git config --global user.email 2>/dev/null || echo "")

        if [[ -n "$git_user" && -n "$git_email" ]]; then
            log_pass "Git 사용자 설정 완료"
            log_detail "사용자: $git_user <$git_email>"
        else
            log_warn "Git 사용자 설정이 필요합니다"
            log_detail "git config --global user.name '이름'"
            log_detail "git config --global user.email '이메일'"
        fi
    else
        log_fail "Git이 설치되지 않았습니다"
    fi

    echo
}

# 환경 변수 확인
check_environment_variables() {
    log_section "환경 변수 확인"

    # PYTHONPATH 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "PYTHONPATH 설정"
    if [[ -n "$PYTHONPATH" ]]; then
        log_pass "PYTHONPATH 설정됨"
        log_detail "PYTHONPATH: $PYTHONPATH"
    else
        log_warn "PYTHONPATH가 설정되지 않았습니다"
        log_detail "export PYTHONPATH=\"\${PYTHONPATH}:\$(pwd)/api\"를 ~/.bashrc에 추가하세요"
    fi

    # UV_PYTHON 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "UV_PYTHON 설정"
    if [[ -n "$UV_PYTHON" ]]; then
        log_pass "UV_PYTHON 설정됨"
        log_detail "UV_PYTHON: $UV_PYTHON"
    else
        log_warn "UV_PYTHON이 설정되지 않았습니다"
        log_detail "export UV_PYTHON=\$(which python3)을 ~/.bashrc에 추가하세요"
    fi

    # .env.edu 파일 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check ".env.edu 파일 확인"
    if [[ -f "docker/.env.edu" ]]; then
        log_pass ".env.edu 파일 존재"

        # 필수 환경 변수 확인
        local required_vars=("EDU_SESSION_SECRET" "DB_USERNAME" "DB_PASSWORD" "REDIS_HOST")
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" "docker/.env.edu"; then
                log_detail "✓ $var 설정됨"
            else
                log_warn "$var가 .env.edu에 설정되지 않았습니다"
            fi
        done
    else
        log_warn ".env.edu 파일이 존재하지 않습니다"
        log_detail "setup-dev-env.sh 스크립트를 실행하여 생성하세요"
    fi

    echo
}

# 프로젝트 의존성 확인
check_project_dependencies() {
    log_section "프로젝트 의존성 확인"

    # API 의존성 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "API 의존성 (Python)"
    if [[ -f "api/pyproject.toml" ]]; then
        if uv run --project api python -c "import flask, sqlalchemy, celery" >/dev/null 2>&1; then
            log_pass "API 의존성 설치됨"
        else
            log_fail "API 의존성 누락"
            log_detail "uv sync --project api 명령어를 실행하세요"
        fi
    else
        log_warn "API 프로젝트를 찾을 수 없습니다"
    fi

    # Web 의존성 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "Web 의존성 (Node.js)"
    if [[ -f "web/package.json" ]]; then
        if [[ -d "web/node_modules" ]]; then
            log_pass "Web 의존성 설치됨"
        else
            log_fail "Web 의존성 누락"
            log_detail "cd web && pnpm install 명령어를 실행하세요"
        fi
    else
        log_warn "Web 프로젝트를 찾을 수 없습니다"
    fi

    echo
}

# 포트 사용 확인
check_ports() {
    log_section "포트 사용 상황 확인"

    local ports=(5001 3000 3001 6379 6380 5432)
    local port_names=("API" "Web" "Web-Edu" "Redis" "Redis-Edu" "PostgreSQL")

    for i in "${!ports[@]}"; do
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "${port_names[$i]} 포트 (${ports[$i]})"

        if port_in_use "${ports[$i]}"; then
            log_warn "포트 ${ports[$i]}가 사용 중입니다"
        else
            log_pass "포트 ${ports[$i]} 사용 가능"
        fi
    done

    echo
}

# 네트워크 연결 테스트
check_network() {
    log_section "네트워크 연결 테스트"

    # 인터넷 연결 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "인터넷 연결"
    if test_network_connection "8.8.8.8" 53; then
        log_pass "인터넷 연결 정상"
    else
        log_fail "인터넷 연결 불가"
    fi

    # Docker Hub 연결 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "Docker Hub 연결"
    if test_network_connection "registry-1.docker.io" 443; then
        log_pass "Docker Hub 연결 정상"
    else
        log_warn "Docker Hub 연결 실패"
    fi

    # npm 레지스트리 연결 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "npm 레지스트리 연결"
    if test_network_connection "registry.npmjs.org" 443; then
        log_pass "npm 레지스트리 연결 정상"
    else
        log_warn "npm 레지스트리 연결 실패"
    fi

    echo
}

# 시스템 리소스 확인
check_system_resources() {
    log_section "시스템 리소스 확인"

    # 메모리 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "시스템 메모리"

    if command_exists free; then
        local total_mem=$(free -m | awk 'NR==2{printf "%.1f", $2/1024}')
        if (( $(echo "$total_mem >= 4.0" | bc -l) )); then
            log_pass "${total_mem}GB 메모리 (권장: 4GB 이상)"
        else
            log_warn "${total_mem}GB 메모리 (권장: 4GB 이상)"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        local total_mem=$(sysctl -n hw.memsize | awk '{printf "%.1f", $1/1024/1024/1024}')
        if (( $(echo "$total_mem >= 4.0" | bc -l) )); then
            log_pass "${total_mem}GB 메모리 (권장: 4GB 이상)"
        else
            log_warn "${total_mem}GB 메모리 (권장: 4GB 이상)"
        fi
    else
        log_info "메모리 정보를 확인할 수 없습니다"
    fi

    # 디스크 공간 확인
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_check "디스크 공간"
    local disk_usage=$(df . | awk 'NR==2 {print $4}')
    local available_gb=$(echo "scale=1; $disk_usage/1024/1024" | bc)

    if (( $(echo "$available_gb >= 2.0" | bc -l) )); then
        log_pass "${available_gb}GB 사용 가능 (권장: 2GB 이상)"
    else
        log_warn "${available_gb}GB 사용 가능 (권장: 2GB 이상)"
    fi

    echo
}

# 개발 도구 확인
check_dev_scripts() {
    log_section "개발 도구 스크립트 확인"

    local scripts=("dev/start-api" "dev/start-worker" "dev/reformat")

    for script in "${scripts[@]}"; do
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        log_check "$script 스크립트"

        if [[ -f "$script" && -x "$script" ]]; then
            log_pass "실행 가능"
        elif [[ -f "$script" ]]; then
            log_warn "파일 존재하지만 실행 권한 없음"
            log_detail "chmod +x $script 명령어로 권한 부여"
        else
            log_fail "스크립트 파일이 존재하지 않습니다"
        fi
    done

    echo
}

# 요약 출력
print_summary() {
    log_header "환경 검증 결과"

    echo -e "${GREEN}통과: $PASSED_CHECKS${NC}"
    echo -e "${RED}실패: $FAILED_CHECKS${NC}"
    echo -e "${YELLOW}경고: $WARNING_CHECKS${NC}"
    echo -e "${BLUE}총 검사: $TOTAL_CHECKS${NC}"
    echo

    local success_rate=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)

    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 환경 검증 완료! 성공률: ${success_rate}%${NC}"
        echo -e "${GREEN}개발 환경이 모든 요구사항을 충족합니다.${NC}"

        if [[ $WARNING_CHECKS -gt 0 ]]; then
            echo -e "${YELLOW}⚠️  $WARNING_CHECKS개의 경고사항을 확인하고 개선하세요.${NC}"
        fi
    else
        echo -e "${RED}❌ 환경 검증 실패! $FAILED_CHECKS개 항목 수정 필요${NC}"
        echo -e "${YELLOW}setup-dev-env.sh 스크립트를 실행하거나 수동으로 설치하세요.${NC}"
    fi

    echo
    echo "상세한 설치 가이드:"
    echo "- 개발 환경 요구사항: docs/dev-setup/requirements.md"
    echo "- Docker 설치: docs/dev-setup/docker-setup.md"
    echo "- 온보딩 가이드: docs/dev-setup/onboarding.md"
    echo
}

# 메인 함수
main() {
    log_header "Dify 클론 프로젝트 환경 검증"

    # 프로젝트 루트 디렉터리로 이동
    cd "$(dirname "$0")/.."

    # 모든 검증 실행
    check_python
    check_nodejs
    check_uv
    check_pnpm
    check_docker
    check_git
    check_environment_variables
    check_project_dependencies
    check_ports
    check_network
    check_system_resources
    check_dev_scripts

    # 결과 요약
    print_summary

    # 종료 코드 설정
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# 스크립트 시작
main "$@"