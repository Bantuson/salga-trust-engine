"""Application configuration using Pydantic Settings."""
import warnings
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL database URL")
    DB_SSL_MODE: str = Field(default="require", description="PostgreSQL SSL mode")

    # Supabase
    SUPABASE_URL: str = Field(default="", description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(default="", description="Supabase anon/public key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="", description="Supabase service role key (server-side only)")
    SUPABASE_JWT_SECRET: str = Field(default="", description="Supabase JWT secret for token verification")
    SUPABASE_DB_URL: str = Field(default="", description="Supabase direct PostgreSQL connection string")
    SUPABASE_DB_URL_POOLER: str = Field(default="", description="Supabase transaction pooler connection string (for Celery)")

    # Security
    SECRET_KEY: str = Field(..., description="Secret key for JWT tokens (min 32 chars)")
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expiration")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="Refresh token expiration")

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", description="Redis connection URL")

    # Celery
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Celery broker URL"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/1",
        description="Celery result backend URL"
    )
    SLA_CHECK_INTERVAL_SECONDS: int = Field(
        default=300,
        description="SLA check interval in seconds (default 5 minutes)"
    )

    # CORS
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000"],
        description="Allowed CORS origins"
    )

    # AWS S3
    AWS_ACCESS_KEY_ID: str = Field(default="", description="AWS access key")
    AWS_SECRET_ACCESS_KEY: str = Field(default="", description="AWS secret key")
    AWS_REGION: str = Field(default="af-south-1", description="AWS region")
    S3_BUCKET_EVIDENCE: str = Field(default="salga-evidence-dev", description="S3 bucket for evidence photos")
    S3_BUCKET_DOCUMENTS: str = Field(default="salga-documents-dev", description="S3 bucket for proof of residence")

    # Encryption
    ENCRYPTION_KEY_CURRENT: str = Field(default="", description="Current Fernet encryption key")
    ENCRYPTION_KEY_PREVIOUS: str = Field(default="", description="Previous Fernet key for rotation")

    # Twilio
    TWILIO_ACCOUNT_SID: str = Field(default="", description="Twilio account SID")
    TWILIO_AUTH_TOKEN: str = Field(default="", description="Twilio auth token")
    TWILIO_WHATSAPP_NUMBER: str = Field(default="", description="Twilio WhatsApp sender number (whatsapp:+14155238886)")

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
