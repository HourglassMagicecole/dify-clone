# Docker Desktop 설치 가이드

Dify 클론 프로젝트는 Docker Compose를 사용하여 개발 환경을 구성합니다. 이 가이드는 각 운영체제별 Docker Desktop 설치 방법을 설명합니다.

## macOS용 Docker Desktop 설치

### 시스템 요구사항

- macOS 10.15 이상 (Catalina, Big Sur, Monterey, Ventura, Sonoma, Sequoia)
- Intel 칩: 2010년 이후 모델
- Apple 실리콘: M1, M2, M3 칩

### 설치 방법

#### 방법 1: 공식 웹사이트에서 다운로드 (권장)

1. [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) 다운로드
2. Apple Silicon Mac인 경우 "Mac with Apple Chip" 선택
3. Intel Mac인 경우 "Mac with Intel Chip" 선택
4. `.dmg` 파일 다운로드 후 실행
5. Docker.app을 Applications 폴더로 드래그

#### 방법 2: Homebrew Cask 사용

```bash
# Homebrew가 설치되어 있어야 함
brew install --cask docker

# Docker Desktop 실행
open -a Docker
```

### 설치 후 설정

1. Docker Desktop 실행
2. Docker Desktop이 시작될 때까지 대기 (상단 메뉴바에서 Docker 고래 아이콘 확인)
3. 터미널에서 설치 확인:

```bash
docker --version
docker-compose --version
```

### 권장 설정

Docker Desktop > Settings에서:

- **Resources > Memory**: 최소 4GB, 권장 8GB
- **Resources > CPU**: 최소 2코어, 권장 4코어
- **Docker Engine**: 기본값 유지

## Windows용 Docker Desktop 설치

### 시스템 요구사항

- Windows 10 64비트: Pro, Enterprise, Education (Build 19041 이상)
- Windows 11 64비트: Home, Pro, Enterprise, Education
- WSL 2 기능 활성화
- Hyper-V와 컨테이너 Windows 기능 활성화

### WSL 2 설치 및 설정

Docker Desktop은 WSL 2를 백엔드로 사용합니다.

1. **WSL 2 설치**:
```powershell
# PowerShell을 관리자 권한으로 실행
wsl --install

# 재부팅 후 WSL 버전 확인
wsl --list --verbose
```

2. **Linux 배포판 설치** (Ubuntu 권장):
```powershell
wsl --install -d Ubuntu
```

### Docker Desktop 설치

#### 방법 1: 공식 웹사이트에서 다운로드 (권장)

1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) 다운로드
2. `Docker Desktop Installer.exe` 실행
3. "Use WSL 2 instead of Hyper-V" 옵션 체크
4. 설치 완료 후 재부팅

#### 방법 2: 패키지 관리자 사용

```powershell
# Chocolatey 사용
choco install docker-desktop

# 또는 Winget 사용 (Windows 10 1709 이상)
winget install Docker.DockerDesktop
```

### 설치 후 설정

1. Docker Desktop 실행
2. "Use the WSL 2 based engine" 옵션 활성화
3. PowerShell에서 설치 확인:

```powershell
docker --version
docker-compose --version
```

### WSL 2 통합 설정

Docker Desktop > Settings > Resources > WSL Integration:
- "Enable integration with my default WSL distro" 체크
- 설치된 Ubuntu 배포판 활성화

## Linux용 Docker 설치

Linux에서는 Docker Desktop 대신 Docker Engine과 Docker Compose를 직접 설치합니다.

### Ubuntu/Debian 설치

```bash
# 기존 Docker 제거
sudo apt-get remove docker docker-engine docker.io containerd runc

# 패키지 업데이트 및 필수 패키지 설치
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg lsb-release

# Docker GPG 키 추가
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Docker 저장소 추가
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker Engine 설치
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### CentOS/RHEL/Fedora 설치

```bash
# 기존 Docker 제거
sudo yum remove docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine

# Docker 저장소 설정
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Docker Engine 설치
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker 서비스 시작
sudo systemctl start docker
sudo systemctl enable docker
```

### 권한 설정

```bash
# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 변경사항 적용을 위해 로그아웃 후 재로그인 또는
newgrp docker
```

### Docker Compose 설치 확인

```bash
# Docker Compose V2 (플러그인) 확인
docker compose version

# 레거시 Docker Compose가 필요한 경우
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 설치 검증

모든 플랫폼에서 다음 명령어로 설치를 확인하세요:

```bash
# Docker 버전 확인
docker --version

# Docker Compose 버전 확인
docker compose version  # 또는 docker-compose --version

# Docker 실행 테스트
docker run hello-world

# Docker 시스템 정보
docker system info
```

## Dify 프로젝트 Docker 구성

### 필수 서비스

Dify 클론 프로젝트는 다음 Docker 서비스들을 사용합니다:

- **api**: Dify 백엔드 API 서버 (포트 5001)
- **web**: 기존 Dify 프론트엔드 (포트 3000)
- **web-edu**: 교육용 프론트엔드 (포트 3001)
- **redis-edu**: 교육 전용 Redis (포트 6380)
- **postgres**: PostgreSQL 데이터베이스
- **redis**: Redis 캐시 및 메시지 브로커

### Docker 네트워크

프로젝트는 `dify-network`라는 사용자 정의 네트워크를 사용합니다.

### 환경 변수 파일

`docker/.env.edu` 파일이 필요합니다 (환경 설정 시 자동 생성).

## 문제 해결

### 일반적인 문제

#### Docker Desktop이 시작되지 않는 경우

**macOS**:
```bash
# Docker Desktop 완전 재시작
killall Docker && open /Applications/Docker.app
```

**Windows**:
```powershell
# WSL 재시작
wsl --shutdown
# Docker Desktop 재시작
```

#### 메모리 부족 오류

Docker Desktop > Settings > Resources에서:
- Memory를 최소 4GB로 증가
- Swap을 1GB로 설정

#### 포트 충돌 문제

```bash
# 포트 사용 확인
docker ps -a
netstat -tulpn | grep :5001  # Linux/macOS
netstat -an | findstr :5001  # Windows

# 충돌하는 컨테이너 정지
docker stop <container_name>
```

#### 권한 문제 (Linux)

```bash
# Docker 서비스 상태 확인
sudo systemctl status docker

# 권한 오류 시 사용자 그룹 재설정
sudo usermod -aG docker $USER
newgrp docker
```

### WSL 2 관련 문제 (Windows)

#### WSL 2 업데이트

```powershell
# WSL 업데이트
wsl --update

# WSL 버전 확인
wsl --list --verbose

# 기본 WSL 버전 설정
wsl --set-default-version 2
```

#### 메모리 사용량 제한

`%USERPROFILE%\.wslconfig` 파일 생성:

```ini
[wsl2]
memory=4GB
processors=2
swap=1GB
```

## 성능 최적화

### macOS

```bash
# Docker Desktop 설정에서
# Resources > Advanced:
# - Memory: 시스템 RAM의 50-70%
# - CPUs: 사용 가능한 코어의 50-75%
```

### Windows (WSL 2)

```bash
# WSL 배포판에서 Docker 리소스 확인
docker system df
docker system prune  # 불필요한 이미지/컨테이너 정리
```

### Linux

```bash
# Docker 로그 크기 제한
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## 다음 단계

Docker 설치가 완료되면:

1. [개발 환경 요구사항](./requirements.md) 확인
2. [개발자 온보딩 가이드](./onboarding.md) 참조
3. 환경 검증 스크립트 실행: `scripts/verify-env.sh`
4. Dify 프로젝트 실행: `docker compose up -d`

## 체크리스트

- [ ] Docker Desktop (또는 Docker Engine) 설치 완료
- [ ] Docker Compose 설치 완료
- [ ] Docker 실행 권한 설정 완료
- [ ] hello-world 컨테이너 실행 테스트 성공
- [ ] 메모리 및 CPU 리소스 할당 완료
- [ ] 네트워크 연결 테스트 성공