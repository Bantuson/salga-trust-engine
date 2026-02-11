"""Base model classes for all database models."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, event, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from src.core.exceptions import SecurityError
from src.core.tenant import get_tenant_context


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class NonTenantModel(Base):
    """Base model for entities that exist above tenant scope (e.g., Municipality, AuditLog)."""

    __abstract__ = True

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )


class TenantAwareModel(Base):
    """Base model for all tenant-scoped entities with audit fields."""

    __abstract__ = True

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)


# Application-level tenant filtering (defense-in-depth with RLS)
@event.listens_for(Session, "do_orm_execute")
def add_tenant_filter(orm_execute_state):
    """Backup tenant filtering at application level (defense-in-depth with RLS).

    This provides a second layer of defense against cross-tenant data leakage.
    Even if RLS policies are misconfigured or bypassed, this filter prevents
    the application from accidentally querying data from other tenants.

    FAIL-CLOSED: If tenant context is missing for a tenant-aware query, raise
    SecurityError rather than returning empty results. This prevents silent
    failures that could mask security issues.

    Args:
        orm_execute_state: SQLAlchemy ORM execute state

    Raises:
        SecurityError: If tenant context is missing for tenant-aware query
    """
    # Only filter SELECT queries
    if not orm_execute_state.is_select:
        return

    # Skip if this is not an ORM query (e.g., raw SQL)
    if not hasattr(orm_execute_state, 'bind_mapper') or orm_execute_state.bind_mapper is None:
        return

    # Get the mapper's class
    mapper_class = orm_execute_state.bind_mapper.class_

    # Check if the model is tenant-aware
    if not hasattr(mapper_class, 'tenant_id'):
        return  # NonTenantModel, skip filtering

    # Get current tenant context
    tenant_id = get_tenant_context()

    # FAIL CLOSED: no tenant context for tenant-aware query = deny
    if tenant_id is None:
        raise SecurityError(
            "Tenant context not set for tenant-aware query - potential data leakage. "
            "This is a security violation. Ensure tenant_id is present in JWT "
            "app_metadata claims (for authenticated requests) or tenant context is "
            "set via get_current_user dependency."
        )

    # Add tenant_id filter to the query
    orm_execute_state.statement = orm_execute_state.statement.where(
        mapper_class.tenant_id == tenant_id
    )
