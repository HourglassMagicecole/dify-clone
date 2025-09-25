"""
Education API key model for central API key management.
"""

import os
import uuid
from base64 import b64decode, b64encode
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from cryptography.fernet import Fernet
from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class EducationApiKey(Base):
    """
    Education API key table for central API key management.

    This table manages API keys with encrypted storage requirement
    for secure key management across educational platform.
    """

    __tablename__ = "education_api_keys"

    # Encryption key from environment variable
    _cipher_suite: Optional[Fernet] = None

    @classmethod
    def _get_cipher_suite(cls) -> Fernet:
        """Get or create the cipher suite for encryption/decryption."""
        if cls._cipher_suite is None:
            # Get encryption key from environment or generate a new one
            encryption_key = os.getenv("EDUCATION_ENCRYPTION_KEY")
            if not encryption_key:
                # For development only - in production, must be set in environment
                encryption_key = Fernet.generate_key().decode()
                # Log warning about using generated key
                import logging

                logging.warning(
                    "Using auto-generated encryption key. "
                    "Set EDUCATION_ENCRYPTION_KEY environment variable for production."
                )
            else:
                # Decode if provided as base64 string
                encryption_key = encryption_key.encode() if isinstance(encryption_key, str) else encryption_key

            cls._cipher_suite = Fernet(encryption_key)
        return cls._cipher_suite

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="API key record unique identifier"
    )

    # Key identification
    key_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="Human-readable key name")

    key_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="API key type: openai, anthropic, google, azure, dify"
    )

    # Key data - MUST be encrypted in production
    api_key: Mapped[str] = mapped_column(Text, nullable=False, comment="Encrypted API key - NEVER store in plain text")

    # Additional configuration
    endpoint_url: Mapped[Optional[str]] = mapped_column(String(500), comment="Custom endpoint URL if applicable")

    additional_headers: Mapped[Optional[str]] = mapped_column(
        Text, comment="Additional headers in JSON format (encrypted)"
    )

    # Scope and permissions
    scope: Mapped[str] = mapped_column(
        String(50), default="education", nullable=False, comment="Key scope: education, global, session-specific"
    )

    allowed_models: Mapped[Optional[list]] = mapped_column(sa.JSON, comment="List of allowed models/endpoints")

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(
        sa.Integer, default=0, nullable=False, comment="Number of times key has been used"
    )

    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Last usage timestamp")

    # Rate limiting
    rate_limit_per_minute: Mapped[Optional[int]] = mapped_column(sa.Integer, comment="Rate limit per minute")

    rate_limit_per_day: Mapped[Optional[int]] = mapped_column(sa.Integer, comment="Rate limit per day")

    # Status and lifecycle
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, comment="Key status: active, inactive, expired, revoked"
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Key expiration timestamp")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Key creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    # Ownership and access control
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Creator user ID from account system"
    )

    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Associated session ID if session-specific"
    )

    # Security tracking
    last_rotation_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="Last key rotation timestamp"
    )

    # Indexes
    __table_args__ = (
        sa.Index("ix_education_api_keys_type", "key_type"),
        sa.Index("ix_education_api_keys_status", "status"),
        sa.Index("ix_education_api_keys_scope", "scope"),
        sa.Index("ix_education_api_keys_session", "session_id"),
        sa.Index("ix_education_api_keys_name", "key_name"),
    )

    def __repr__(self) -> str:
        return f"<EducationApiKey(id={self.id}, name='{self.key_name}', type='{self.key_type}')>"

    def __str__(self) -> str:
        return f"API Key: {self.key_name} ({self.key_type})"

    @property
    def is_active(self) -> bool:
        """Check if API key is active."""
        if self.status != "active":
            return False
        if self.expires_at and self.expires_at < datetime.utcnow():
            return False
        return True

    @property
    def is_expired(self) -> bool:
        """Check if API key is expired."""
        if self.expires_at:
            return self.expires_at < datetime.utcnow()
        return False

    def increment_usage(self) -> None:
        """Increment usage count and update last used timestamp."""
        self.usage_count += 1
        self.last_used_at = datetime.utcnow()

    def revoke(self) -> None:
        """Revoke the API key."""
        self.status = "revoked"

    def rotate(self, new_key: str) -> None:
        """Rotate the API key with a new one."""
        self.set_encrypted_api_key(new_key)
        self.last_rotation_at = datetime.utcnow()
        self.usage_count = 0

    def set_encrypted_api_key(self, plaintext_key: str) -> None:
        """Encrypt and store an API key."""
        cipher_suite = self._get_cipher_suite()
        encrypted = cipher_suite.encrypt(plaintext_key.encode())
        self.api_key = b64encode(encrypted).decode("utf-8")

    def get_decrypted_api_key(self) -> str:
        """Decrypt and return the stored API key."""
        try:
            cipher_suite = self._get_cipher_suite()
            encrypted_data = b64decode(self.api_key.encode("utf-8"))
            decrypted = cipher_suite.decrypt(encrypted_data)
            return decrypted.decode("utf-8")
        except Exception as e:
            # Log error and raise a more informative exception
            import logging

            logging.exception("Failed to decrypt API key for %s", self.key_name)
            raise ValueError(f"Failed to decrypt API key: {str(e)}") from e

    def set_encrypted_headers(self, headers: Optional[str]) -> None:
        """Encrypt and store additional headers."""
        if headers:
            cipher_suite = self._get_cipher_suite()
            encrypted = cipher_suite.encrypt(headers.encode())
            self.additional_headers = b64encode(encrypted).decode("utf-8")
        else:
            self.additional_headers = None

    def get_decrypted_headers(self) -> Optional[str]:
        """Decrypt and return additional headers."""
        if not self.additional_headers:
            return None
        try:
            cipher_suite = self._get_cipher_suite()
            encrypted_data = b64decode(self.additional_headers.encode("utf-8"))
            decrypted = cipher_suite.decrypt(encrypted_data)
            return decrypted.decode("utf-8")
        except Exception:
            import logging

            logging.exception("Failed to decrypt headers for %s", self.key_name)
            return None

    @classmethod
    def get_active_by_type(cls, key_type: str) -> list["EducationApiKey"]:
        """Get active API keys by type."""
        # This would be implemented in service layer
        pass
