from pydantic import Field
from pydantic_settings import BaseSettings


class EncryptionConfig(BaseSettings):
    """
    Configuration settings for API Key encryption (Story 1.8).
    """

    API_KEY_ENCRYPTION_KEY: str | None = Field(
        description="Fernet encryption key for securing admin API keys."
        ' Generate using: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"',
        default=None,
    )
