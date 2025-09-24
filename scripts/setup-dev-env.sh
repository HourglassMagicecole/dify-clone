#!/bin/bash

# Dify 클론 프로젝트 개발 환경 설정 스크립트 (Mac/Linux)
# 이 스크립트는 개발에 필요한 모든 도구를 자동으로 설치하고 설정합니다.

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 진행 상황 표시
progress() {
    echo -e "${BLUE}>>> $1${NC}"
}

# OS 감지
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        log_error "지원하지 않는 운영체제입니다: $OSTYPE"
        exit 1
    fi
}

# 명령어 존재 확인
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 버전 비교 함수
version_ge() {
    test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Homebrew 설치 (macOS)
install_homebrew() {
    if ! command_exists brew; then
        progress "Homebrew 설치 중..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Homebrew 경로 추가
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi

        log_success "Homebrew 설치 완료"
    else
        log_info "Homebrew가 이미 설치되어 있습니다"
        brew update
    fi
}

# 시스템 패키지 업데이트 (Linux)
update_system_packages() {
    progress "시스템 패키지 업데이트 중..."

    if command_exists apt-get; then
        sudo apt-get update
        sudo apt-get upgrade -y
        sudo apt-get install -y curl wget git build-essential software-properties-common
    elif command_exists yum; then
        sudo yum update -y
        sudo yum install -y curl wget git gcc gcc-c++ make
    elif command_exists dnf; then
        sudo dnf update -y
        sudo dnf install -y curl wget git gcc gcc-c++ make
    else
        log_warning "지원하는 패키지 관리자를 찾을 수 없습니다"
    fi

    log_success "시스템 패키지 업데이트 완료"
}

# Python 설치
install_python() {
    progress "Python 3.12 설치 확인 중..."

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

    if [[ -z "$python_cmd" ]]; then
        log_info "Python 3.11-3.13이 설치되어 있지 않습니다. 설치 중..."

        if [[ "$OS" == "macos" ]]; then
            brew install python@3.12
            python_cmd="python3.12"
        elif [[ "$OS" == "linux" ]]; then
            if command_exists apt-get; then
                sudo apt-get install -y python3.12 python3.12-dev python3.12-venv
                python_cmd="python3.12"
            elif command_exists yum || command_exists dnf; then
                # CentOS/RHEL/Fedora에서 Python 3.12 설치
                if command_exists dnf; then
                    sudo dnf install -y python3.12 python3.12-devel
                else
                    sudo yum install -y python312 python312-devel
                fi
                python_cmd="python3.12"
            fi
        fi

        log_success "Python 3.12 설치 완료"
    else
        log_success "Python $python_version이 이미 설치되어 있습니다 ($python_cmd)"
    fi

    # Python 심볼릭 링크 생성 (필요한 경우)
    if [[ "$python_cmd" != "python3" ]] && ! command_exists python3; then
        if [[ "$OS" == "linux" ]]; then
            sudo ln -sf $(which $python_cmd) /usr/bin/python3
        fi
    fi

    export PYTHON_CMD=$python_cmd
}

# Node.js 설치
install_nodejs() {
    progress "Node.js 설치 확인 중..."

    local node_version=""
    local required_version="22.11.0"

    if command_exists node; then
        node_version=$(node --version | sed 's/v//')

        if version_ge "$node_version" "$required_version"; then
            log_success "Node.js $node_version이 이미 설치되어 있습니다"
            return
        else
            log_warning "Node.js 버전이 낮습니다 ($node_version < $required_version)"
        fi
    fi

    log_info "Node.js $required_version 이상 설치 중..."

    if [[ "$OS" == "macos" ]]; then
        brew install node
    elif [[ "$OS" == "linux" ]]; then
        # NodeSource 저장소 추가 및 Node.js 설치
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        if command_exists apt-get; then
            sudo apt-get install -y nodejs
        fi
    fi

    log_success "Node.js 설치 완료"
}

# UV 설치
install_uv() {
    progress "UV 패키지 관리자 설치 확인 중..."

    if command_exists uv; then
        log_success "UV가 이미 설치되어 있습니다"
        uv --version
        return
    fi

    log_info "UV 설치 중..."

    if [[ "$OS" == "macos" ]]; then
        brew install uv
    else
        # Linux에서 공식 설치 스크립트 사용
        curl -LsSf https://astral.sh/uv/install.sh | sh

        # PATH에 UV 추가
        export PATH="$HOME/.cargo/bin:$PATH"

        # 셸 설정 파일에 PATH 추가
        if [[ -f "$HOME/.bashrc" ]]; then
            echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> "$HOME/.bashrc"
        fi
        if [[ -f "$HOME/.zshrc" ]]; then
            echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> "$HOME/.zshrc"
        fi
    fi

    log_success "UV 설치 완료"
}

# pnpm 설치
install_pnpm() {
    progress "pnpm 패키지 관리자 설치 확인 중..."

    if command_exists pnpm; then
        log_success "pnpm이 이미 설치되어 있습니다"
        pnpm --version
        return
    fi

    log_info "pnpm 설치 중..."

    # corepack을 통한 설치 시도
    if command_exists corepack; then
        corepack enable
        corepack prepare pnpm@latest --activate
    else
        # npm을 통한 설치
        if command_exists npm; then
            npm install -g pnpm
        else
            log_error "npm이 설치되어 있지 않아 pnpm을 설치할 수 없습니다"
            exit 1
        fi
    fi

    log_success "pnpm 설치 완료"
}

# Docker 설치 확인
check_docker() {
    progress "Docker 설치 확인 중..."

    if command_exists docker; then
        if docker --version >/dev/null 2>&1; then
            log_success "Docker가 설치되어 있습니다"
            docker --version
        else
            log_warning "Docker가 설치되어 있지만 실행되지 않습니다"
            log_info "Docker Desktop을 실행하거나 Docker 서비스를 시작하세요"
        fi
    else
        log_warning "Docker가 설치되어 있지 않습니다"
        log_info "docs/dev-setup/docker-setup.md를 참조하여 Docker를 설치하세요"
    fi

    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose를 사용할 수 있습니다"
    else
        log_warning "Docker Compose를 사용할 수 없습니다"
    fi
}

# 프로젝트 의존성 설치
install_project_dependencies() {
    progress "프로젝트 의존성 설치 중..."

    # 프로젝트 루트 디렉터리로 이동
    cd "$(dirname "$0")/.."

    # API 의존성 설치 (UV 사용)
    if [[ -f "api/pyproject.toml" ]]; then
        log_info "API 의존성 설치 중..."
        uv sync --project api
        log_success "API 의존성 설치 완료"
    fi

    # Web 의존성 설치 (pnpm 사용)
    if [[ -f "web/package.json" ]]; then
        log_info "Web 의존성 설치 중..."
        cd web && pnpm install && cd ..
        log_success "Web 의존성 설치 완료"
    fi
}

# 환경 변수 설정
setup_environment_variables() {
    progress "환경 변수 설정 중..."

    local env_file="docker/.env.edu"

    if [[ ! -f "$env_file" ]]; then
        log_info ".env.edu 파일 생성 중..."

        cat > "$env_file" << EOF
# 교육용 환경 변수 설정
EDU_SESSION_SECRET=$(openssl rand -hex 32)
EDU_MAX_USERS=50
EDU_MAX_CONCURRENT_REQUESTS=50
EDU_API_RATE_LIMIT=1000
EDU_CORS_ORIGINS=http://localhost:3001
EDU_MONITORING_ENABLED=true
EDU_LOG_LEVEL=info

# 데이터베이스 설정
DB_USERNAME=postgres
DB_PASSWORD=difyai123456
DB_HOST=db
DB_PORT=5432
DB_DATABASE=dify

# Redis 설정
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=difyai123456
REDIS_DB=0

# API 설정
API_URL=http://localhost:5001
WEB_URL=http://localhost:3000
EDU_WEB_URL=http://localhost:3001
EOF

        log_success ".env.edu 파일 생성 완료"
    else
        log_info ".env.edu 파일이 이미 존재합니다"
    fi

    # 셸 환경 변수 추가
    local shell_config=""
    if [[ -f "$HOME/.zshrc" ]]; then
        shell_config="$HOME/.zshrc"
    elif [[ -f "$HOME/.bashrc" ]]; then
        shell_config="$HOME/.bashrc"
    fi

    if [[ -n "$shell_config" ]]; then
        if ! grep -q "PYTHONPATH" "$shell_config"; then
            echo 'export PYTHONPATH="${PYTHONPATH}:$(pwd)/api"' >> "$shell_config"
        fi

        if ! grep -q "UV_PYTHON" "$shell_config"; then
            echo 'export UV_PYTHON=$(which python3)' >> "$shell_config"
        fi

        log_success "셸 환경 변수 설정 완료"
    fi
}

# 설치 완료 확인
verify_installation() {
    progress "설치 확인 중..."

    local errors=0

    # Python 확인
    if command_exists python3; then
        local python_version=$(python3 --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
        if [[ $python_version =~ ^3\.(1[1-3])\. ]]; then
            log_success "✓ Python $python_version"
        else
            log_error "✗ Python 버전이 요구사항에 맞지 않습니다 ($python_version)"
            errors=$((errors + 1))
        fi
    else
        log_error "✗ Python이 설치되지 않았습니다"
        errors=$((errors + 1))
    fi

    # Node.js 확인
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        if version_ge "$node_version" "22.11.0"; then
            log_success "✓ Node.js $node_version"
        else
            log_error "✗ Node.js 버전이 요구사항에 맞지 않습니다 ($node_version)"
            errors=$((errors + 1))
        fi
    else
        log_error "✗ Node.js가 설치되지 않았습니다"
        errors=$((errors + 1))
    fi

    # UV 확인
    if command_exists uv; then
        log_success "✓ UV $(uv --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")"
    else
        log_error "✗ UV가 설치되지 않았습니다"
        errors=$((errors + 1))
    fi

    # pnpm 확인
    if command_exists pnpm; then
        log_success "✓ pnpm $(pnpm --version)"
    else
        log_error "✗ pnpm이 설치되지 않았습니다"
        errors=$((errors + 1))
    fi

    # Docker 확인
    if command_exists docker; then
        if docker --version >/dev/null 2>&1; then
            log_success "✓ Docker $(docker --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")"
        else
            log_warning "⚠ Docker가 설치되어 있지만 실행되지 않습니다"
        fi
    else
        log_warning "⚠ Docker가 설치되어 있지 않습니다"
    fi

    return $errors
}

# 메인 함수
main() {
    echo "======================================"
    echo "  Dify 클론 프로젝트 개발 환경 설정"
    echo "======================================"
    echo

    # OS 감지
    OS=$(detect_os)
    log_info "운영체제: $OS"

    # 관리자 권한 확인 (Linux에서만)
    if [[ "$OS" == "linux" ]]; then
        if [[ $EUID -eq 0 ]]; then
            log_error "이 스크립트를 root 권한으로 실행하지 마세요"
            exit 1
        fi

        # sudo 권한 확인
        if ! sudo -n true 2>/dev/null; then
            log_info "일부 패키지 설치를 위해 sudo 권한이 필요합니다"
            sudo true
        fi
    fi

    # 설치 과정 시작
    if [[ "$OS" == "macos" ]]; then
        install_homebrew
    else
        update_system_packages
    fi

    install_python
    install_nodejs
    install_uv
    install_pnpm
    check_docker

    # 프로젝트가 있는 경우에만 의존성 설치
    if [[ -f "$(dirname "$0")/../api/pyproject.toml" ]]; then
        install_project_dependencies
    fi

    setup_environment_variables

    echo
    echo "======================================"

    # 설치 확인
    if verify_installation; then
        log_success "🎉 개발 환경 설정이 완료되었습니다!"
        echo
        log_info "다음 단계:"
        echo "1. 셸을 다시 시작하거나 다음 명령어를 실행하세요:"
        echo "   source ~/.bashrc  (또는 source ~/.zshrc)"
        echo "2. Docker가 설치되지 않은 경우 docs/dev-setup/docker-setup.md를 참조하세요"
        echo "3. 환경 검증을 위해 다음 명령어를 실행하세요:"
        echo "   ./scripts/verify-env.sh"
        echo "4. 개발 서버 실행:"
        echo "   ./dev/start-api     # API 서버"
        echo "   ./dev/start-worker  # Celery 워커"
        echo "   cd web && pnpm dev  # 프론트엔드"
    else
        log_error "⚠️  일부 도구 설치에 실패했습니다"
        log_info "설치 로그를 확인하고 수동으로 설치하세요"
        exit 1
    fi

    echo "======================================"
}

# 스크립트 시작
main "$@"