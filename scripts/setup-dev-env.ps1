# Dify 클론 프로젝트 개발 환경 설정 스크립트 (Windows PowerShell)
# 이 스크립트는 개발에 필요한 모든 도구를 자동으로 설치하고 설정합니다.

# 실행 정책 확인 및 설정
$ExecutionPolicy = Get-ExecutionPolicy
if ($ExecutionPolicy -eq 'Restricted') {
    Write-Host "PowerShell 실행 정책을 변경합니다..." -ForegroundColor Yellow
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
}

# 관리자 권한 확인
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

# 색상 및 로그 함수
function Write-Info {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Progress {
    param($Message)
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

# 명령어 존재 확인
function Test-CommandExists {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction SilentlyContinue) {
            return $true
        }
    }
    catch {
        return $false
    }
    return $false
}

# 버전 비교 함수
function Compare-Version {
    param(
        [string]$Version1,
        [string]$Version2
    )

    $v1 = [System.Version]::new($Version1)
    $v2 = [System.Version]::new($Version2)

    return $v1 -ge $v2
}

# 패키지 관리자 설치 확인
function Install-PackageManager {
    Write-Progress "패키지 관리자 확인 중..."

    # Chocolatey 확인
    if (-not (Test-CommandExists "choco")) {
        Write-Info "Chocolatey 설치 중..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

        # PATH 새로고침
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        Write-Success "Chocolatey 설치 완료"
    } else {
        Write-Info "Chocolatey가 이미 설치되어 있습니다"
    }

    # Winget 확인 (Windows 10 1709 이상)
    if (-not (Test-CommandExists "winget")) {
        Write-Warning "Winget이 설치되어 있지 않습니다. Microsoft Store에서 '앱 설치 관리자'를 설치하세요"
    } else {
        Write-Success "Winget을 사용할 수 있습니다"
    }
}

# WSL 2 설치 및 확인
function Install-WSL2 {
    Write-Progress "WSL 2 확인 및 설치 중..."

    # WSL 설치 여부 확인
    try {
        $wslStatus = wsl --status 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "WSL이 이미 설치되어 있습니다"

            # WSL 배포판 확인
            $distributions = wsl --list --quiet
            if ($distributions -match "Ubuntu") {
                Write-Success "Ubuntu 배포판이 설치되어 있습니다"
            } else {
                Write-Info "Ubuntu 배포판 설치 중..."
                wsl --install -d Ubuntu
                Write-Warning "Ubuntu 설치 완료 후 사용자 계정을 설정하세요"
            }
        }
    }
    catch {
        Write-Info "WSL 2 설치 중..."

        if ($IsAdmin) {
            # 필요한 Windows 기능 활성화
            dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
            dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

            # WSL 2 설치
            wsl --install

            Write-Warning "WSL 2 설치 완료. 시스템을 재부팅한 후 스크립트를 다시 실행하세요"
            Write-Info "재부팅 후 'wsl --set-default-version 2' 명령어를 실행하세요"
        } else {
            Write-Error "WSL 2 설치를 위해 관리자 권한이 필요합니다"
            Write-Info "PowerShell을 관리자 권한으로 실행하고 다시 시도하세요"
        }
    }
}

# Python 설치
function Install-Python {
    Write-Progress "Python 3.12 설치 확인 중..."

    $pythonInstalled = $false
    $pythonVersion = ""

    # Python 설치 확인
    if (Test-CommandExists "python") {
        $pythonVersion = python --version 2>$null
        if ($pythonVersion -match "Python 3\.1[1-3]\.\d+") {
            $pythonInstalled = $true
            Write-Success "Python이 이미 설치되어 있습니다: $pythonVersion"
        }
    }

    if (-not $pythonInstalled) {
        Write-Info "Python 3.12 설치 중..."

        try {
            if (Test-CommandExists "winget") {
                winget install Python.Python.3.12
            } elseif (Test-CommandExists "choco") {
                choco install python312 -y
            } else {
                Write-Error "패키지 관리자를 찾을 수 없습니다"
                Write-Info "https://www.python.org/downloads/windows/ 에서 수동으로 설치하세요"
                return $false
            }

            # PATH 새로고침
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

            Write-Success "Python 3.12 설치 완료"
        }
        catch {
            Write-Error "Python 설치 중 오류 발생: $_"
            return $false
        }
    }

    return $true
}

# Node.js 설치
function Install-NodeJS {
    Write-Progress "Node.js 설치 확인 중..."

    $nodeInstalled = $false
    $nodeVersion = ""
    $requiredVersion = "22.11.0"

    # Node.js 설치 확인
    if (Test-CommandExists "node") {
        $nodeVersionOutput = node --version 2>$null
        if ($nodeVersionOutput -match "v(\d+\.\d+\.\d+)") {
            $nodeVersion = $Matches[1]
            if (Compare-Version $nodeVersion $requiredVersion) {
                $nodeInstalled = $true
                Write-Success "Node.js가 이미 설치되어 있습니다: v$nodeVersion"
            } else {
                Write-Warning "Node.js 버전이 낮습니다 ($nodeVersion < $requiredVersion)"
            }
        }
    }

    if (-not $nodeInstalled) {
        Write-Info "Node.js 22.x 설치 중..."

        try {
            if (Test-CommandExists "winget") {
                winget install OpenJS.NodeJS
            } elseif (Test-CommandExists "choco") {
                choco install nodejs -y
            } else {
                Write-Error "패키지 관리자를 찾을 수 없습니다"
                Write-Info "https://nodejs.org/ 에서 수동으로 설치하세요"
                return $false
            }

            # PATH 새로고침
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

            Write-Success "Node.js 설치 완료"
        }
        catch {
            Write-Error "Node.js 설치 중 오류 발생: $_"
            return $false
        }
    }

    return $true
}

# UV 설치
function Install-UV {
    Write-Progress "UV 패키지 관리자 설치 확인 중..."

    if (Test-CommandExists "uv") {
        Write-Success "UV가 이미 설치되어 있습니다"
        uv --version
        return $true
    }

    Write-Info "UV 설치 중..."

    try {
        # 공식 설치 스크립트 사용
        irm https://astral.sh/uv/install.ps1 | iex

        # PATH에 UV 추가 (현재 세션)
        $uvPath = "$env:USERPROFILE\.cargo\bin"
        if (Test-Path $uvPath) {
            $env:Path += ";$uvPath"
        }

        Write-Success "UV 설치 완료"
        return $true
    }
    catch {
        Write-Error "UV 설치 중 오류 발생: $_"

        # Scoop을 통한 대체 설치 시도
        if (Test-CommandExists "scoop") {
            Write-Info "Scoop을 통해 UV 설치 시도 중..."
            scoop install uv
            return $true
        }

        return $false
    }
}

# pnpm 설치
function Install-PNPM {
    Write-Progress "pnpm 패키지 관리자 설치 확인 중..."

    if (Test-CommandExists "pnpm") {
        Write-Success "pnpm이 이미 설치되어 있습니다"
        pnpm --version
        return $true
    }

    Write-Info "pnpm 설치 중..."

    try {
        # corepack을 통한 설치 시도
        if (Test-CommandExists "corepack") {
            corepack enable
            corepack prepare pnpm@latest --activate
        } elseif (Test-CommandExists "npm") {
            npm install -g pnpm
        } else {
            Write-Error "npm이 설치되어 있지 않아 pnpm을 설치할 수 없습니다"
            return $false
        }

        Write-Success "pnpm 설치 완료"
        return $true
    }
    catch {
        Write-Error "pnpm 설치 중 오류 발생: $_"
        return $false
    }
}

# Docker Desktop 설치 확인
function Check-Docker {
    Write-Progress "Docker Desktop 설치 확인 중..."

    if (Test-CommandExists "docker") {
        try {
            $dockerVersion = docker --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker Desktop이 설치되어 있습니다"
                Write-Host $dockerVersion
            } else {
                Write-Warning "Docker가 설치되어 있지만 실행되지 않습니다"
                Write-Info "Docker Desktop을 실행하세요"
            }
        }
        catch {
            Write-Warning "Docker 상태 확인 중 오류 발생"
        }
    } else {
        Write-Warning "Docker Desktop이 설치되어 있지 않습니다"
        Write-Info "docs/dev-setup/docker-setup.md를 참조하여 Docker Desktop을 설치하세요"

        # 자동 설치 제안
        $installDocker = Read-Host "Docker Desktop을 자동으로 설치하시겠습니까? (y/N)"
        if ($installDocker -eq "y" -or $installDocker -eq "Y") {
            try {
                if (Test-CommandExists "winget") {
                    winget install Docker.DockerDesktop
                } elseif (Test-CommandExists "choco") {
                    choco install docker-desktop -y
                }
                Write-Success "Docker Desktop 설치 완료"
                Write-Info "Docker Desktop을 실행하고 WSL 2 통합을 활성화하세요"
            }
            catch {
                Write-Error "Docker Desktop 설치 중 오류 발생: $_"
            }
        }
    }

    # Docker Compose 확인
    try {
        $composeVersion = docker compose version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker Compose를 사용할 수 있습니다"
        } else {
            docker-compose --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker Compose (레거시)를 사용할 수 있습니다"
            } else {
                Write-Warning "Docker Compose를 사용할 수 없습니다"
            }
        }
    }
    catch {
        Write-Warning "Docker Compose 상태 확인 중 오류 발생"
    }
}

# 프로젝트 의존성 설치
function Install-ProjectDependencies {
    Write-Progress "프로젝트 의존성 설치 중..."

    # 프로젝트 루트 디렉터리로 이동
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptPath
    Set-Location $projectRoot

    # API 의존성 설치 (UV 사용)
    if (Test-Path "api/pyproject.toml") {
        Write-Info "API 의존성 설치 중..."
        try {
            uv sync --project api
            Write-Success "API 의존성 설치 완료"
        }
        catch {
            Write-Error "API 의존성 설치 중 오류 발생: $_"
        }
    }

    # Web 의존성 설치 (pnpm 사용)
    if (Test-Path "web/package.json") {
        Write-Info "Web 의존성 설치 중..."
        try {
            Set-Location "web"
            pnpm install
            Set-Location $projectRoot
            Write-Success "Web 의존성 설치 완료"
        }
        catch {
            Write-Error "Web 의존성 설치 중 오류 발생: $_"
            Set-Location $projectRoot
        }
    }
}

# 환경 변수 설정
function Set-EnvironmentVariables {
    Write-Progress "환경 변수 설정 중..."

    $envFile = "docker\.env.edu"

    if (-not (Test-Path $envFile)) {
        Write-Info ".env.edu 파일 생성 중..."

        # 랜덤 시크릿 키 생성
        $secretKey = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Maximum 16)})

        $envContent = @"
# 교육용 환경 변수 설정
EDU_SESSION_SECRET=$secretKey
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
"@

        $envContent | Out-File -FilePath $envFile -Encoding UTF8
        Write-Success ".env.edu 파일 생성 완료"
    } else {
        Write-Info ".env.edu 파일이 이미 존재합니다"
    }

    # 사용자 환경 변수 설정
    $pythonPath = Get-Location
    $currentPythonPath = [Environment]::GetEnvironmentVariable("PYTHONPATH", "User")

    if (-not $currentPythonPath -or $currentPythonPath -notlike "*$pythonPath\api*") {
        [Environment]::SetEnvironmentVariable("PYTHONPATH", "$currentPythonPath;$pythonPath\api", "User")
        $env:PYTHONPATH += ";$pythonPath\api"
        Write-Success "PYTHONPATH 환경 변수 설정 완료"
    }

    # UV_PYTHON 환경 변수 설정
    $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if ($pythonExe) {
        [Environment]::SetEnvironmentVariable("UV_PYTHON", $pythonExe, "User")
        $env:UV_PYTHON = $pythonExe
        Write-Success "UV_PYTHON 환경 변수 설정 완료"
    }
}

# 설치 확인
function Test-Installation {
    Write-Progress "설치 확인 중..."

    $errors = 0

    # Python 확인
    if (Test-CommandExists "python") {
        $pythonVersion = python --version 2>$null
        if ($pythonVersion -match "Python 3\.1[1-3]\.\d+") {
            Write-Success "✓ $pythonVersion"
        } else {
            Write-Error "✗ Python 버전이 요구사항에 맞지 않습니다 ($pythonVersion)"
            $errors++
        }
    } else {
        Write-Error "✗ Python이 설치되지 않았습니다"
        $errors++
    }

    # Node.js 확인
    if (Test-CommandExists "node") {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion -match "v(\d+\.\d+\.\d+)" -and (Compare-Version $Matches[1] "22.11.0")) {
            Write-Success "✓ Node.js $nodeVersion"
        } else {
            Write-Error "✗ Node.js 버전이 요구사항에 맞지 않습니다 ($nodeVersion)"
            $errors++
        }
    } else {
        Write-Error "✗ Node.js가 설치되지 않았습니다"
        $errors++
    }

    # UV 확인
    if (Test-CommandExists "uv") {
        $uvVersion = uv --version 2>$null
        Write-Success "✓ UV $uvVersion"
    } else {
        Write-Error "✗ UV가 설치되지 않았습니다"
        $errors++
    }

    # pnpm 확인
    if (Test-CommandExists "pnpm") {
        $pnpmVersion = pnpm --version 2>$null
        Write-Success "✓ pnpm $pnpmVersion"
    } else {
        Write-Error "✗ pnpm이 설치되지 않았습니다"
        $errors++
    }

    # Docker 확인
    if (Test-CommandExists "docker") {
        try {
            $dockerVersion = docker --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✓ Docker $dockerVersion"
            } else {
                Write-Warning "⚠ Docker가 설치되어 있지만 실행되지 않습니다"
            }
        }
        catch {
            Write-Warning "⚠ Docker 상태 확인 중 오류 발생"
        }
    } else {
        Write-Warning "⚠ Docker가 설치되어 있지 않습니다"
    }

    # WSL 2 확인
    try {
        $wslVersion = wsl --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ WSL 2 설치됨"
        }
    }
    catch {
        Write-Warning "⚠ WSL 2 상태 확인 중 오류 발생"
    }

    return $errors
}

# 메인 함수
function Main {
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "  Dify 클론 프로젝트 개발 환경 설정" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Info "Windows 개발 환경 설정을 시작합니다..."

    # 관리자 권한 상태 표시
    if ($IsAdmin) {
        Write-Success "관리자 권한으로 실행 중"
    } else {
        Write-Warning "일반 사용자 권한으로 실행 중 (일부 기능은 관리자 권한이 필요할 수 있습니다)"
    }

    # 설치 과정 시작
    Install-PackageManager
    Install-WSL2
    $pythonOk = Install-Python
    $nodeOk = Install-NodeJS
    $uvOk = Install-UV
    $pnpmOk = Install-PNPM
    Check-Docker

    # 프로젝트가 있는 경우에만 의존성 설치
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptPath

    if (Test-Path "$projectRoot\api\pyproject.toml") {
        Install-ProjectDependencies
    }

    Set-EnvironmentVariables

    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan

    # 설치 확인
    $errors = Test-Installation

    if ($errors -eq 0) {
        Write-Success "🎉 개발 환경 설정이 완료되었습니다!"
        Write-Host ""
        Write-Info "다음 단계:"
        Write-Host "1. PowerShell을 다시 시작하여 환경 변수를 적용하세요"
        Write-Host "2. Docker Desktop이 설치되지 않은 경우 docs/dev-setup/docker-setup.md를 참조하세요"
        Write-Host "3. WSL 2와 Docker Desktop의 WSL 통합을 활성화하세요"
        Write-Host "4. 환경 검증을 위해 다음 명령어를 실행하세요:"
        Write-Host "   .\scripts\verify-env.sh"
        Write-Host "5. 개발 서버 실행:"
        Write-Host "   .\dev\start-api     # API 서버"
        Write-Host "   .\dev\start-worker  # Celery 워커"
        Write-Host "   cd web; pnpm dev    # 프론트엔드"
    } else {
        Write-Error "⚠️  $errors 개의 도구 설치에 실패했습니다"
        Write-Info "설치 로그를 확인하고 수동으로 설치하세요"
        exit 1
    }

    Write-Host "======================================" -ForegroundColor Cyan
}

# 스크립트 시작
Main