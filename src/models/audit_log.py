"""AuditLog model for comprehensive audit trail."""
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class OperationType(str, Enum):
    """Audit log operation types."""

    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    # Auth event types (SEC-07 auth event logging)
    AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS"
    AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE"
    AUTH_REGISTER = "AUTH_REGISTER"
    AUTH_OTP_SEND = "AUTH_OTP_SEND"
    AUTH_OTP_VERIFY = "AUTH_OTP_VERIFY"
    AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH"


class AuditLog(NonTenantModel):
    """Audit log for all data operations - exists above tenant scope for admin access."""

    __tablename__ = "audit_logs"

    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    operation: Mapped[OperationType] = mapped_column(nullable=False)
    table_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    record_id: Mapped[str] = mapped_column(String, nullable=False)
    changes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
