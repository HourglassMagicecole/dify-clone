"""API Key Encryption Service for Story 1.8.

This module provides Fernet-based encryption/decryption for API keys.
"""

import base64
import logging

from cryptography.fernet import Fernet, InvalidToken

from configs import dify_config

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """암호화 관련 에러."""

    pass


class DecryptionError(Exception):
    """복호화 관련 에러."""

    pass


class APIKeyEncryptionService:
    """
    API Key 암호화/복호화 서비스.

    Fernet (AES-256-CBC + HMAC) 암호화를 사용하여 API Key를 안전하게 저장합니다.
    """

    def __init__(self) -> None:
        """
        Initialize encryption service with config key.

        Raises:
            ValueError: If API_KEY_ENCRYPTION_KEY is not set in config
        """
        encryption_key = dify_config.API_KEY_ENCRYPTION_KEY
        if not encryption_key:
            raise ValueError("API_KEY_ENCRYPTION_KEY environment variable not set")

        try:
            self.cipher = Fernet(encryption_key.encode())
        except Exception as e:
            raise ValueError(f"Invalid encryption key format: {e}") from e

    def encrypt(self, api_key: str) -> str:
        """
        API Key 암호화.

        Args:
            api_key: 평문 API Key

        Returns:
            암호화된 API Key (base64 인코딩)

        Raises:
            EncryptionError: 암호화 실패 시
        """
        try:
            # 절대 평문 API Key를 로깅하지 않음!
            logger.info("Encrypting API key (length: %d)", len(api_key))

            encrypted = self.cipher.encrypt(api_key.encode())
            encrypted_b64 = base64.b64encode(encrypted).decode()

            logger.info("API key encrypted successfully")
            return encrypted_b64

        except Exception as e:
            logger.exception("Encryption failed")
            raise EncryptionError(f"Failed to encrypt API key: {e}") from e

    def decrypt(self, encrypted_key: str) -> str:
        """
        API Key 복호화.

        Args:
            encrypted_key: 암호화된 API Key (base64 인코딩)

        Returns:
            평문 API Key

        Raises:
            DecryptionError: 복호화 실패 시
        """
        try:
            logger.info("Decrypting API key")

            encrypted_bytes = base64.b64decode(encrypted_key.encode())
            decrypted = self.cipher.decrypt(encrypted_bytes)
            decrypted_str = decrypted.decode()

            # 절대 평문 API Key를 로깅하지 않음!
            logger.info("API key decrypted successfully (length: %d)", len(decrypted_str))
            return decrypted_str

        except InvalidToken as e:
            logger.exception("Decryption failed: Invalid token")
            raise DecryptionError("Invalid encryption token") from e
        except Exception as e:
            logger.exception("Decryption failed")
            raise DecryptionError(f"Failed to decrypt API key: {e}") from e

    def validate_encryption_key(self) -> bool:
        """
        암호화 키가 유효한지 테스트.

        Returns:
            암호화/복호화가 정상 작동하면 True
        """
        try:
            test_data = "test_api_key_validation"
            encrypted = self.encrypt(test_data)
            decrypted = self.decrypt(encrypted)
            return decrypted == test_data
        except Exception:
            logger.exception("Encryption key validation failed")
            return False
