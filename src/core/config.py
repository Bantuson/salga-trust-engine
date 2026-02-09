"""Application configuration using Pydantic Settings."""
import warnings
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL database URL")
    DB_SSL_MODE: str = Field(default="require", description="PostgreSQL SSL mode")

    # Security
    SECRET_KEY: str = Field(..., description="Secret key for JWT tokens (min 32 chars)")
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expiration")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="Refresh token expiration")

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", description="Redis connection URL")

    # CORS
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000"],
        description="Allowed CORS origins"
    )

    # Environment
    DEBUG: bool = Field(default=False, description="Debug mode")
    ENVIRONMENT: str = Field(default="development", description="Environment name")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key_length(cls, v: str) -> str:
        """Validate SECRET_KEY is at least 32 characters."""
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @model_validator(mode='after')
    def validate_database_ssl(self):
        """Warn if sslmode is missing in non-development environments."""
        if self.ENVIRONMENT != "development" and "sslmode" not in self.DATABASE_URL:
            warnings.warn(
                "DATABASE_URL missing sslmode parameter in non-development environment. "
                "Add ?sslmode=require to enforce TLS encryption (SEC-01 compliance).",
                UserWarning,
                stacklevel=2
            )
        return self


# Singleton settings instance
settings = Settings()
