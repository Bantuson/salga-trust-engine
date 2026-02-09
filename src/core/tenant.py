"""Tenant context management using contextvars."""
from contextvars import ContextVar

# Context variable for current tenant ID
current_tenant_id: ContextVar[str | None] = ContextVar("current_tenant_id", default=None)


def set_tenant_context(tenant_id: str) -> None:
    """Set the current tenant context."""
    current_tenant_id.set(tenant_id)


def get_tenant_context() -> str | None:
    """Get the current tenant context."""
    return current_tenant_id.get()


def clear_tenant_context() -> None:
    """Clear the current tenant context."""
    current_tenant_id.set(None)
