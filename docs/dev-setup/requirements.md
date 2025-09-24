# 개발 환경 요구사항

이 문서는 Dify 클론 프로젝트 개발에 필요한 모든 도구와 런타임 환경 설정 방법을 설명합니다.

## 필수 런타임 환경

### Python 3.11-3.13

Dify 백엔드는 Python 3.11 이상 3.13 이하 버전이 필요합니다.

#### macOS 설치

```bash
# Homebrew를 통한 설치 (권장)
brew install python@3.12

# 또는 pyenv 사용
brew install pyenv
pyenv install 3.12.7
pyenv global 3.12.7
```

#### Windows 설치

1. [Python 공식 웹사이트](https://www.python.org/downloads/windows/)에서 Python 3.12.x 다운로드
2. 설치 시 "Add Python to PATH" 옵션 체크
3. 설치 완료 후 PowerShell에서 확인:
```powershell
python --version
```

#### Linux (Ubuntu/Debian) 설치

```bash
# 시스템 패키지 업데이트
sudo apt update

# Python 3.12 설치
sudo apt install python3.12 python3.12-dev python3.12-venv

# 기본 Python 설정 (선택사항)
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
```

#### CentOS/RHEL/Fedora 설치

```bash
# Fedora
sudo dnf install python3.12 python3.12-devel

# CentOS/RHEL (EPEL 저장소 필요)
sudo yum install epel-release
sudo yum install python312 python312-devel
```

### Node.js >=22.11.0

프론트엔드 개발을 위해 Node.js 22.11.0 이상이 필요합니다.

#### macOS 설치

```bash
# Homebrew 사용 (권장)
brew install node

# 또는 nvm 사용
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22
```

#### Windows 설치

1. [Node.js 공식 웹사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 설치 프로그램 실행
3. PowerShell에서 확인:
```powershell
node --version
npm --version
```

#### Linux 설치

```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Node.js 설치
sudo apt-get install -y nodejs

# 또는 nvm 사용
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

## 패키지 관리자

### UV (Python 패키지 관리자) - 필수

UV는 Dify 프로젝트의 표준 Python 패키지 관리자입니다.

#### macOS/Linux 설치

```bash
# 공식 설치 스크립트 사용
curl -LsSf https://astral.sh/uv/install.sh | sh

# 또는 Homebrew 사용 (macOS)
brew install uv
```

#### Windows 설치

```powershell
# PowerShell에서 실행
irm https://astral.sh/uv/install.ps1 | iex

# 또는 Scoop 사용
scoop install uv
```

#### 설치 확인

```bash
uv --version
```

### pnpm (Node.js 패키지 관리자) - 필수

프론트엔드 의존성 관리를 위해 pnpm을 사용합니다.

#### 전체 플랫폼 설치

```bash
# npm을 통한 설치
npm install -g pnpm

# 또는 corepack 사용 (Node.js 16.10+ 포함)
corepack enable
corepack prepare pnpm@latest --activate
```

#### macOS 추가 옵션

```bash
# Homebrew 사용
brew install pnpm
```

#### 설치 확인

```bash
pnpm --version
```

## 버전 확인 스크립트

모든 도구가 올바르게 설치되었는지 확인:

```bash
#!/bin/bash
echo "=== 개발 환경 버전 확인 ==="
echo "Python: $(python3 --version)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "UV: $(uv --version)"
echo "pnpm: $(pnpm --version)"
```

## 환경 변수 설정

### Python 관련

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
export PYTHONPATH="${PYTHONPATH}:$(pwd)/api"
export UV_PYTHON=$(which python3)
```

### Node.js 관련

```bash
# pnpm 글로벌 bin 경로 추가
export PATH="$HOME/.local/share/pnpm:$PATH"
```

## 문제 해결

### Python 버전 충돌

여러 Python 버전이 설치된 경우:

```bash
# 특정 버전 사용
python3.12 --version

# pyenv로 관리하는 경우
pyenv versions
pyenv local 3.12.7
```

### Node.js 버전 관리

```bash
# nvm 사용하여 버전 전환
nvm list
nvm use 22
```

### 권한 문제 (Linux/macOS)

```bash
# Python 패키지 설치 권한 오류 시
python3 -m pip install --user uv

# npm/pnpm 권한 문제 해결
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.local/share/pnpm
```

## 다음 단계

환경 설정이 완료되면 다음 단계를 진행하세요:

1. [Docker 설치 가이드](./docker-setup.md)
2. [개발자 온보딩 가이드](./onboarding.md)
3. 환경 검증: `scripts/verify-env.sh` 실행

## 최소 요구사항 체크리스트

- [ ] Python 3.11-3.13 설치 완료
- [ ] Node.js >=22.11.0 설치 완료
- [ ] UV 패키지 관리자 설치 완료
- [ ] pnpm 패키지 관리자 설치 완료
- [ ] 모든 도구 버전 확인 완료
- [ ] 환경 변수 설정 완료