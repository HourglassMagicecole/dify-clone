#!/bin/bash

# Docker 환경 초기화 스크립트
# API_KEY_ENCRYPTION_KEY를 자동으로 생성하여 docker/.env에 추가

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}🚀 Docker 환경 초기화 시작...${NC}\n"

# 1. docker/.env.example 존재 확인
if [ ! -f "docker/.env.example" ]; then
    echo -e "${RED}❌ docker/.env.example 파일을 찾을 수 없습니다.${NC}"
    exit 1
fi

# 2. docker/.env 파일 동기화 (.env.example 기반, 중요 키 보존)
if [ ! -f "docker/.env" ]; then
    echo -e "${YELLOW}📝 docker/.env 파일 생성 중...${NC}"
    cp docker/.env.example docker/.env
    echo -e "${GREEN}✅ docker/.env 파일 생성 완료${NC}\n"
else
    echo -e "${YELLOW}📝 docker/.env 파일 동기화 중 (.env.example 기반)...${NC}"

    # 보존할 키 값들 백업
    BACKUP_SECRET_KEY=$(grep "^SECRET_KEY=" docker/.env | cut -d'=' -f2-)
    BACKUP_API_KEY=$(grep "^API_KEY_ENCRYPTION_KEY=" docker/.env | cut -d'=' -f2-)
    BACKUP_ADMIN_EMAIL=$(grep "^INITIAL_ADMIN_EMAIL=" docker/.env | cut -d'=' -f2-)
    BACKUP_ADMIN_PASSWORD=$(grep "^INITIAL_ADMIN_PASSWORD=" docker/.env | cut -d'=' -f2-)
    BACKUP_ADMIN_NAME=$(grep "^INITIAL_ADMIN_NAME=" docker/.env | cut -d'=' -f2-)

    # .env.example으로 덮어쓰기
    cp docker/.env.example docker/.env

    # 백업한 키 값들 복원
    if [ -n "$BACKUP_SECRET_KEY" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^SECRET_KEY=.*|SECRET_KEY=${BACKUP_SECRET_KEY}|" docker/.env
        else
            sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${BACKUP_SECRET_KEY}|" docker/.env
        fi
    fi

    if [ -n "$BACKUP_API_KEY" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=${BACKUP_API_KEY}|" docker/.env
        else
            sed -i "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=${BACKUP_API_KEY}|" docker/.env
        fi
    fi

    if [ -n "$BACKUP_ADMIN_EMAIL" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^INITIAL_ADMIN_EMAIL=.*|INITIAL_ADMIN_EMAIL=${BACKUP_ADMIN_EMAIL}|" docker/.env
            sed -i '' "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=${BACKUP_ADMIN_PASSWORD}|" docker/.env
            sed -i '' "s|^INITIAL_ADMIN_NAME=.*|INITIAL_ADMIN_NAME=${BACKUP_ADMIN_NAME}|" docker/.env
        else
            sed -i "s|^INITIAL_ADMIN_EMAIL=.*|INITIAL_ADMIN_EMAIL=${BACKUP_ADMIN_EMAIL}|" docker/.env
            sed -i "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=${BACKUP_ADMIN_PASSWORD}|" docker/.env
            sed -i "s|^INITIAL_ADMIN_NAME=.*|INITIAL_ADMIN_NAME=${BACKUP_ADMIN_NAME}|" docker/.env
        fi
    fi

    echo -e "${GREEN}✅ docker/.env 동기화 완료 (SECRET_KEY, API_KEY_ENCRYPTION_KEY, INITIAL_ADMIN_* 보존)${NC}\n"
fi

# 3. SECRET_KEY 확인 및 생성
EXISTING_SECRET=$(grep "^SECRET_KEY=" docker/.env | cut -d'=' -f2-)
if [ -z "$EXISTING_SECRET" ] || [ "$EXISTING_SECRET" == "sk-9f73s3ljTXVcMT3Blb3ljTqtsKiGHXVcMT3BlbkFJLK7U" ]; then
    echo -e "${YELLOW}🔑 SECRET_KEY 생성 중...${NC}"
    NEW_SECRET=$(openssl rand -base64 42)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^SECRET_KEY=.*|SECRET_KEY=${NEW_SECRET}|" docker/.env
    else
        sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${NEW_SECRET}|" docker/.env
    fi
    echo -e "${GREEN}✅ SECRET_KEY 생성 완료${NC}\n"
else
    echo -e "${GREEN}✅ SECRET_KEY가 이미 설정되어 있습니다${NC}\n"
fi

# 4. API_KEY_ENCRYPTION_KEY 확인 (api/.env와 동기화)
EXISTING_KEY=$(grep "^API_KEY_ENCRYPTION_KEY=" docker/.env | cut -d'=' -f2- || echo "")
API_ENV_KEY=$(grep "^API_KEY_ENCRYPTION_KEY=" api/.env 2>/dev/null | cut -d'=' -f2- || echo "")

if [ -n "$EXISTING_KEY" ] && [ "$EXISTING_KEY" != "" ]; then
    echo -e "${GREEN}✅ API_KEY_ENCRYPTION_KEY가 이미 설정되어 있습니다${NC}"
    echo -e "${YELLOW}⚠️  기존 키를 유지합니다 (덮어쓰지 않음)${NC}\n"
    echo -e "현재 키: ${EXISTING_KEY}"
elif [ -n "$API_ENV_KEY" ] && [ "$API_ENV_KEY" != "" ]; then
    # Sync from api/.env if exists
    echo -e "${YELLOW}🔑 api/.env에서 API_KEY_ENCRYPTION_KEY 동기화 중...${NC}"

    if grep -q "^API_KEY_ENCRYPTION_KEY=" docker/.env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=${API_ENV_KEY}|" docker/.env
        else
            sed -i "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=${API_ENV_KEY}|" docker/.env
        fi
    fi

    echo -e "${GREEN}✅ API_KEY_ENCRYPTION_KEY 동기화 완료 (api/.env → docker/.env)${NC}\n"
    echo -e "동기화된 키: ${API_ENV_KEY}"
else
    echo -e "${YELLOW}🔑 API_KEY_ENCRYPTION_KEY 생성 중...${NC}"

    # Fernet 호환 키 생성 (openssl 우선, Python fallback)
    # Fernet key = 32 bytes random data, URL-safe base64 encoded
    NEW_KEY=$(openssl rand -base64 32 2>/dev/null | tr '+/' '-_')

    if [ -z "$NEW_KEY" ]; then
        # Fallback to Python if openssl fails
        NEW_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null)
    fi

    if [ -z "$NEW_KEY" ]; then
        echo -e "${RED}❌ 키 생성 실패: openssl 또는 python3 cryptography가 필요합니다${NC}"
        echo -e "${YELLOW}해결 방법: brew install openssl 또는 pip install cryptography${NC}"
        exit 1
    fi

    # docker/.env 파일에 키 추가/업데이트
    if grep -q "^API_KEY_ENCRYPTION_KEY=" docker/.env; then
        # 기존 라인 업데이트
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=${NEW_KEY}|" docker/.env
        else
            # Linux
            sed -i "s|^API_KEY_ENCRYPTION_KEY=.*|API_KEY_ENCRYPTION_KEY=${NEW_KEY}|" docker/.env
        fi
    else
        # 새 라인 추가 (# API Key Encryption 섹션 뒤에)
        awk -v key="$NEW_KEY" '
            /^# API Key Encryption/ {
                print;
                getline;
                print;
                getline;
                print;
                getline;
                print;
                print "API_KEY_ENCRYPTION_KEY=" key;
                next;
            }
            { print }
        ' docker/.env > docker/.env.tmp && mv docker/.env.tmp docker/.env
    fi

    echo -e "${GREEN}✅ API_KEY_ENCRYPTION_KEY 생성 및 저장 완료${NC}\n"
    echo -e "생성된 키: ${NEW_KEY}"
fi

# 5. 초기 관리자 정보 설정 (필수)
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 초기 관리자 계정 설정 (필수)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

EXISTING_EMAIL=$(grep "^INITIAL_ADMIN_EMAIL=" docker/.env | cut -d'=' -f2-)
EXISTING_PASSWORD=$(grep "^INITIAL_ADMIN_PASSWORD=" docker/.env | cut -d'=' -f2-)
EXISTING_NAME=$(grep "^INITIAL_ADMIN_NAME=" docker/.env | cut -d'=' -f2-)

if [ -n "$EXISTING_EMAIL" ]; then
    echo -e "${GREEN}✅ 초기 관리자 계정이 이미 설정되어 있습니다${NC}"
    echo -e "   Email: ${EXISTING_EMAIL}"
    echo -e "   Name: ${EXISTING_NAME:-Admin}"
    echo ""
else
    echo -e "${YELLOW}첫 배포를 위한 초기 관리자 계정을 생성합니다.${NC}\n"

    # 이메일 입력 (필수)
    while true; do
        read -p "관리자 이메일: " ADMIN_EMAIL
        if [ -z "$ADMIN_EMAIL" ]; then
            echo -e "${RED}❌ 이메일은 필수입니다. 다시 입력하세요.${NC}"
        elif [[ ! "$ADMIN_EMAIL" =~ @.+ ]]; then
            echo -e "${RED}❌ 유효한 이메일 형식이 아닙니다.${NC}"
        else
            break
        fi
    done

    # 비밀번호 입력 (필수)
    while true; do
        read -s -p "관리자 비밀번호 (최소 8자, 영문+숫자): " ADMIN_PASSWORD
        echo ""

        if [ -z "$ADMIN_PASSWORD" ]; then
            echo -e "${RED}❌ 비밀번호는 필수입니다. 다시 입력하세요.${NC}"
            continue
        fi

        # 비밀번호 길이 검증
        if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
            echo -e "${RED}❌ 비밀번호는 최소 8자 이상이어야 합니다.${NC}"
            continue
        fi

        # 비밀번호 확인
        read -s -p "비밀번호 확인: " ADMIN_PASSWORD_CONFIRM
        echo ""

        if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
            echo -e "${RED}❌ 비밀번호가 일치하지 않습니다. 다시 입력하세요.${NC}"
        else
            break
        fi
    done

    # 관리자 이름 입력 (선택)
    read -p "관리자 이름 (선택, Enter로 이메일에서 추출): " ADMIN_NAME

    # 이름이 비어있으면 이메일에서 추출
    if [ -z "$ADMIN_NAME" ]; then
        # 이메일의 @ 앞부분 추출
        ADMIN_NAME=$(echo "$ADMIN_EMAIL" | cut -d'@' -f1)
        # 첫 글자 대문자로 변환
        ADMIN_NAME="$(echo ${ADMIN_NAME:0:1} | tr '[:lower:]' '[:upper:]')${ADMIN_NAME:1}"
        echo -e "${YELLOW}📝 이름이 이메일에서 추출되었습니다: ${ADMIN_NAME}${NC}"
    fi

    # docker/.env에 저장
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^INITIAL_ADMIN_EMAIL=.*|INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}|" docker/.env
        sed -i '' "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}|" docker/.env
        sed -i '' "s|^INITIAL_ADMIN_NAME=.*|INITIAL_ADMIN_NAME=${ADMIN_NAME}|" docker/.env
    else
        sed -i "s|^INITIAL_ADMIN_EMAIL=.*|INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}|" docker/.env
        sed -i "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}|" docker/.env
        sed -i "s|^INITIAL_ADMIN_NAME=.*|INITIAL_ADMIN_NAME=${ADMIN_NAME}|" docker/.env
    fi

    echo -e "\n${GREEN}✅ 초기 관리자 계정 설정 완료${NC}"
    echo -e "   Email: ${ADMIN_EMAIL}"
    echo -e "   Name: ${ADMIN_NAME}"
    echo ""
fi

echo -e "\n${GREEN}🎉 Docker 환경 초기화 완료!${NC}"
echo -e "\n${YELLOW}다음 단계:${NC}"
echo -e "  1. ${GREEN}cd docker${NC}"
echo -e "  2. ${GREEN}docker-compose up -d${NC}"
echo -e "\n${RED}⚠️  CRITICAL: 생성된 API_KEY_ENCRYPTION_KEY를 안전한 곳에 백업하세요!${NC}"
echo -e "${RED}   이 키를 잃어버리면 암호화된 모든 API Key를 복구할 수 없습니다.${NC}\n"
