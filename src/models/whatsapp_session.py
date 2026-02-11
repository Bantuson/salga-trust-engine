"""WhatsApp session model for phone-to-user mapping.

Links WhatsApp phone numbers to Supabase Auth users with session expiry.
This enables WhatsApp webhook to identify authenticated users.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import DateTime, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class WhatsAppSession(NonTenantModel):
    """WhatsApp session for phone number to Supabase Auth user mapping.

    Uses NonTenantModel because phone lookups are cross-tenant (per Phase 03 decision).
    Phone numbers are globally unique - a user can only be authenticated in one
    municipality at a time via WhatsApp.

    Session expiry enforces re-authentication every 24 hours per research recommendation.
    """

    __tablename__ = "whatsapp_sessions"

    # Phone number as unique identifier (E.164 format)
    phone_number: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)

    # Supabase Auth user ID
    user_id: Mapped[UUID] = mapped_column(nullable=False, index=True)

    # Tenant for session isolation
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Session expiry (24 hours from creation)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )

    def __init__(self, phone_number: str, user_id: UUID, tenant_id: str, **kwargs):
        """Create WhatsApp session with 24-hour expiry.

        Args:
            phone_number: E.164 format phone (e.g., +27123456789)
            user_id: Supabase Auth user UUID
            tenant_id: Municipality UUID as string
            **kwargs: Additional fields (created_at, updated_at handled by base)
        """
        super().__init__(**kwargs)
        self.phone_number = phone_number
        self.user_id = user_id
        self.tenant_id = tenant_id
        # Set expiry to 24 hours from now
        self.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    @property
    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.now(timezone.utc) >= self.expires_at


# Create composite index for efficient cleanup queries
__table_args__ = (
    Index("ix_whatsapp_sessions_expires_at_user_id", "expires_at", "user_id"),
)
