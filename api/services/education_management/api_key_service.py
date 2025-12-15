"""API Key Service for Story 1.8.

This module provides business logic for API Key management (CRUD, testing).
"""

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import requests
from sqlalchemy import select

from extensions.ext_database import db
from models.education.api_key_config import AdminAPIKeyConfig
from services.education_management.encryption_service import APIKeyEncryptionService

logger = logging.getLogger(__name__)


class APIKeyService:
    """
    API Key 관리 서비스.

    API Key의 CRUD 및 테스트 기능을 제공합니다.
    """

    def __init__(self) -> None:
        """Initialize API Key service with encryption service."""
        self.encryption_service = APIKeyEncryptionService()

    def _check_priority_unique(
        self,
        provider: str,
        priority: str,
        exclude_id: str | None = None,
    ) -> None:
        """
        같은 프로바이더 내에서 우선순위 중복 검사.

        Args:
            provider: 프로바이더 타입
            priority: 확인할 우선순위
            exclude_id: 제외할 API Key ID (업데이트 시 자기 자신 제외)

        Raises:
            ValueError: 해당 우선순위가 이미 존재하는 경우
        """
        query = db.session.query(AdminAPIKeyConfig).filter(
            AdminAPIKeyConfig.provider == provider,
            AdminAPIKeyConfig.priority == priority,
        )
        if exclude_id:
            query = query.filter(AdminAPIKeyConfig.id != exclude_id)

        existing = query.first()
        if existing:
            raise ValueError(f"Priority '{priority}' already exists for provider '{provider}'")

    def _validate_priority_order(
        self,
        provider: str,
        priority: str,
        exclude_id: str | None = None,
    ) -> None:
        """
        우선순위 순서 검증 (secondary는 primary 필수, tertiary는 secondary 필수).

        Args:
            provider: 프로바이더 타입
            priority: 설정할 우선순위
            exclude_id: 제외할 API Key ID (업데이트 시 자기 자신 제외)

        Raises:
            ValueError: 상위 우선순위가 없는 경우
        """
        if priority == "primary":
            return  # primary는 항상 허용

        # secondary는 primary 필요
        if priority == "secondary":
            query = db.session.query(AdminAPIKeyConfig).filter(
                AdminAPIKeyConfig.provider == provider,
                AdminAPIKeyConfig.priority == "primary",
            )
            if exclude_id:
                query = query.filter(AdminAPIKeyConfig.id != exclude_id)
            if not query.first():
                raise ValueError(f"Cannot set 'secondary' without 'primary' for provider '{provider}'")

        # tertiary는 secondary 필요
        if priority == "tertiary":
            query = db.session.query(AdminAPIKeyConfig).filter(
                AdminAPIKeyConfig.provider == provider,
                AdminAPIKeyConfig.priority == "secondary",
            )
            if exclude_id:
                query = query.filter(AdminAPIKeyConfig.id != exclude_id)
            if not query.first():
                raise ValueError(f"Cannot set 'tertiary' without 'secondary' for provider '{provider}'")

    def _promote_lower_priorities(self, provider: str, deleted_priority: str) -> None:
        """
        삭제된 우선순위보다 낮은 것들을 승격.

        primary 삭제 시: secondary → primary, tertiary → secondary
        secondary 삭제 시: tertiary → secondary

        Args:
            provider: 프로바이더 타입
            deleted_priority: 삭제된 우선순위
        """
        if deleted_priority == "primary":
            # secondary → primary
            secondary_key = (
                db.session.query(AdminAPIKeyConfig)
                .filter(
                    AdminAPIKeyConfig.provider == provider,
                    AdminAPIKeyConfig.priority == "secondary",
                )
                .first()
            )
            if secondary_key:
                secondary_key.priority = "primary"
                secondary_key.updated_at = datetime.now(UTC)
                logger.info(
                    "Promoted API key %s from secondary to primary (provider: %s)",
                    secondary_key.id,
                    provider,
                )

            # tertiary → secondary
            tertiary_key = (
                db.session.query(AdminAPIKeyConfig)
                .filter(
                    AdminAPIKeyConfig.provider == provider,
                    AdminAPIKeyConfig.priority == "tertiary",
                )
                .first()
            )
            if tertiary_key:
                tertiary_key.priority = "secondary"
                tertiary_key.updated_at = datetime.now(UTC)
                logger.info(
                    "Promoted API key %s from tertiary to secondary (provider: %s)",
                    tertiary_key.id,
                    provider,
                )

        elif deleted_priority == "secondary":
            # tertiary → secondary
            tertiary_key = (
                db.session.query(AdminAPIKeyConfig)
                .filter(
                    AdminAPIKeyConfig.provider == provider,
                    AdminAPIKeyConfig.priority == "tertiary",
                )
                .first()
            )
            if tertiary_key:
                tertiary_key.priority = "secondary"
                tertiary_key.updated_at = datetime.now(UTC)
                logger.info(
                    "Promoted API key %s from tertiary to secondary (provider: %s)",
                    tertiary_key.id,
                    provider,
                )

        db.session.commit()

    def create_api_key(
        self,
        key_name: str,
        provider: str,
        api_key: str,
        priority: str,
        created_by: str,
    ) -> AdminAPIKeyConfig:
        """
        API Key 생성 (암호화 후 저장).

        Args:
            key_name: API Key 이름
            provider: Provider 타입 (openai, anthropic, etc.)
            api_key: 평문 API Key
            priority: 우선순위 (primary, secondary, tertiary)
            created_by: 생성자 Account ID

        Returns:
            생성된 AdminAPIKeyConfig 인스턴스

        Raises:
            ValueError: 유효하지 않은 provider 또는 priority
        """
        # 1. Validation
        if provider not in AdminAPIKeyConfig.SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}")

        if priority not in AdminAPIKeyConfig.SUPPORTED_PRIORITIES:
            raise ValueError(f"Invalid priority: {priority}")

        # 2. 같은 프로바이더 내 우선순위 중복 검사
        self._check_priority_unique(provider, priority)

        # 3. 우선순위 순서 검증 (secondary는 primary 필수 등)
        self._validate_priority_order(provider, priority)

        # 4. 암호화
        encrypted_key = self.encryption_service.encrypt(api_key)
        logger.info("API key encrypted for provider: %s", provider)

        # 3. 모델 생성
        api_key_config = AdminAPIKeyConfig(
            id=str(uuid.uuid4()),
            key_name=key_name,
            provider=provider,
            api_key_encrypted=encrypted_key,
            priority=priority,
            is_active=True,
            created_by=created_by,
        )

        # 4. 저장
        db.session.add(api_key_config)
        db.session.commit()

        logger.info("API key created successfully: %s (provider: %s)", key_name, provider)
        return api_key_config

    def list_api_keys(
        self,
        current_user_id: str,
        current_user_role: str,
        provider: str | None = None,
        is_active: bool | None = None,
    ) -> list[AdminAPIKeyConfig]:
        """
        API Key 목록 조회.

        Args:
            current_user_id: 현재 사용자 ID
            current_user_role: 현재 사용자 역할 (owner, admin, etc.)
            provider: Provider 필터 (optional)
            is_active: 활성 상태 필터 (optional)

        Returns:
            AdminAPIKeyConfig 목록
        """
        stmt = select(AdminAPIKeyConfig)

        # 권한 기반 필터링 (소유자만 모든 Key 조회 가능)
        # Story 1.8C에서 구현된 권한 시스템에 따라,
        # owner는 모든 Key를 볼 수 있고, 다른 역할은 자신이 생성한 것만 볼 수 있음
        if current_user_role != "owner":
            stmt = stmt.where(AdminAPIKeyConfig.created_by == current_user_id)

        # Provider 필터
        if provider:
            stmt = stmt.where(AdminAPIKeyConfig.provider == provider)

        # 활성 상태 필터
        if is_active is not None:
            stmt = stmt.where(AdminAPIKeyConfig.is_active == is_active)

        stmt = stmt.order_by(AdminAPIKeyConfig.created_at.desc())

        results = db.session.execute(stmt).scalars().all()
        logger.info("Retrieved %d API keys for user %s", len(results), current_user_id)

        return list(results)

    def get_api_key_by_id(self, key_id: str) -> AdminAPIKeyConfig | None:
        """
        API Key 조회 (ID로).

        Args:
            key_id: API Key ID

        Returns:
            AdminAPIKeyConfig 또는 None
        """
        stmt = select(AdminAPIKeyConfig).where(AdminAPIKeyConfig.id == key_id)
        result = db.session.execute(stmt).scalar_one_or_none()
        return result

    def update_api_key(
        self,
        key_id: str,
        key_name: str | None = None,
        priority: str | None = None,
        is_active: bool | None = None,
    ) -> AdminAPIKeyConfig:
        """
        API Key 수정 (API Key 자체는 수정 불가).

        Args:
            key_id: API Key ID
            key_name: 새 이름 (optional)
            priority: 새 우선순위 (optional)
            is_active: 활성 상태 (optional)

        Returns:
            수정된 AdminAPIKeyConfig 인스턴스

        Raises:
            ValueError: Key를 찾을 수 없거나 유효하지 않은 priority
        """
        api_key_config = self.get_api_key_by_id(key_id)
        if not api_key_config:
            raise ValueError(f"API Key not found: {key_id}")

        # 수정 가능한 필드만 업데이트
        if key_name is not None:
            api_key_config.key_name = key_name

        if priority is not None:
            if priority not in AdminAPIKeyConfig.SUPPORTED_PRIORITIES:
                raise ValueError(f"Invalid priority: {priority}")
            # 같은 프로바이더 내 우선순위 중복 검사 (자기 자신 제외)
            self._check_priority_unique(api_key_config.provider, priority, exclude_id=key_id)
            # 우선순위 순서 검증 (자기 자신 제외)
            self._validate_priority_order(api_key_config.provider, priority, exclude_id=key_id)
            api_key_config.priority = priority

        if is_active is not None:
            api_key_config.is_active = is_active

        api_key_config.updated_at = datetime.now(UTC)
        db.session.commit()

        logger.info("API key updated: %s", key_id)
        return api_key_config

    def delete_api_key(self, key_id: str) -> None:
        """
        API Key 삭제.

        삭제 후 하위 우선순위 키들이 자동으로 승격됩니다:
        - primary 삭제 시: secondary → primary, tertiary → secondary
        - secondary 삭제 시: tertiary → secondary

        Args:
            key_id: API Key ID

        Raises:
            ValueError: Key를 찾을 수 없음
        """
        api_key_config = self.get_api_key_by_id(key_id)
        if not api_key_config:
            raise ValueError(f"API Key not found: {key_id}")

        # 삭제 전에 provider와 priority 저장
        provider = api_key_config.provider
        deleted_priority = api_key_config.priority

        db.session.delete(api_key_config)
        db.session.commit()

        logger.info("API key deleted: %s (provider: %s)", key_id, provider)

        # 하위 우선순위 승격
        self._promote_lower_priorities(provider, deleted_priority)

    def get_decrypted_key(self, key_id: str) -> str:
        """
        API Key 복호화 (메모리에서만, 로깅 금지).

        Args:
            key_id: API Key ID

        Returns:
            복호화된 평문 API Key

        Raises:
            ValueError: Key를 찾을 수 없음
        """
        api_key_config = self.get_api_key_by_id(key_id)
        if not api_key_config:
            raise ValueError(f"API Key not found: {key_id}")

        # 절대 평문을 로깅하지 않음!
        decrypted_key = self.encryption_service.decrypt(api_key_config.api_key_encrypted)
        return decrypted_key

    def test_api_key(self, key_id: str) -> dict[str, Any]:
        """
        API Key 유효성 테스트.

        Args:
            key_id: API Key ID

        Returns:
            테스트 결과 딕셔너리:
                - success: bool
                - message: str
                - response_time_ms: int (optional)
                - error_code: str (optional)

        Raises:
            ValueError: Key를 찾을 수 없음
        """
        api_key_config = self.get_api_key_by_id(key_id)
        if not api_key_config:
            raise ValueError(f"API Key not found: {key_id}")

        # 복호화
        api_key = self.get_decrypted_key(key_id)

        # Provider별 테스트 호출
        start_time = time.time()
        try:
            if api_key_config.provider == "openai":
                self._test_openai(api_key)
            elif api_key_config.provider == "anthropic":
                self._test_anthropic(api_key)
            elif api_key_config.provider == "google":
                self._test_google(api_key)
            elif api_key_config.provider == "cohere":
                self._test_cohere(api_key)
            else:
                raise ValueError(f"Unsupported provider: {api_key_config.provider}")

            response_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                "API key test successful for provider: %s (time: %dms)", api_key_config.provider, response_time_ms
            )
            return {
                "success": True,
                "message": f"API Key가 유효합니다. 응답 시간: {response_time_ms}ms",
                "response_time_ms": response_time_ms,
            }

        except Exception as e:
            logger.warning("API key test failed for provider %s: %s", api_key_config.provider, type(e).__name__)
            return {
                "success": False,
                "message": f"API Key가 유효하지 않습니다. 오류: {str(e)}",
                "error_code": type(e).__name__,
            }

    def _test_openai(self, api_key: str) -> None:
        """OpenAI API Key 테스트 (간단한 호출)."""
        headers = {"Authorization": f"Bearer {api_key}"}
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json={
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 5,
            },
            timeout=10,
            verify=True,
        )
        response.raise_for_status()

    def _test_anthropic(self, api_key: str) -> None:
        """Anthropic API Key 테스트."""
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json={
                "model": "claude-3-haiku-20240307",
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 5,
            },
            timeout=10,
            verify=True,
        )
        response.raise_for_status()

    def _test_google(self, api_key: str) -> None:
        """Google AI API Key 테스트."""
        # Google AI Studio API (Gemini 2.5)
        headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            headers=headers,
            json={"contents": [{"parts": [{"text": "Hello"}]}]},
            timeout=10,
            verify=True,
        )
        response.raise_for_status()

    def _test_cohere(self, api_key: str) -> None:
        """Cohere API Key 테스트 (v2 API)."""
        headers = {
            "Authorization": f"bearer {api_key}",
            "Content-Type": "application/json",
            "accept": "application/json",
        }
        response = requests.post(
            "https://api.cohere.com/v2/chat",
            headers=headers,
            json={"model": "command-a-03-2025", "messages": [{"role": "user", "content": "Hello"}]},
            timeout=10,
            verify=True,
        )
        response.raise_for_status()
