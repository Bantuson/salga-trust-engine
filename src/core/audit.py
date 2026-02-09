"""Comprehensive audit logging using SQLAlchemy event listeners."""
import json
from contextvars import ContextVar
from datetime import datetime
from typing import Any

from sqlalchemy import event, insert
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import get_history

from src.core.tenant import get_tenant_context
from src.models.audit_log import AuditLog, OperationType
from src.models.base import NonTenantModel, TenantAwareModel

# Request-scoped context variables for audit tracking
current_user_id: ContextVar[str | None] = ContextVar("current_user_id", default=None)
current_ip_address: ContextVar[str | None] = ContextVar("current_ip_address", default=None)
current_user_agent: ContextVar[str | None] = ContextVar("current_user_agent", default=None)


def set_audit_context(
    user_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None
) -> None:
    """Set audit context for the current request.

    Args:
        user_id: ID of the user performing the operation
        ip_address: IP address of the client
        user_agent: User agent string from the request
    """
    if user_id is not None:
        current_user_id.set(user_id)
    if ip_address is not None:
        current_ip_address.set(ip_address)
    if user_agent is not None:
        current_user_agent.set(user_agent)


def clear_audit_context() -> None:
    """Clear audit context after request completion."""
    current_user_id.set(None)
    current_ip_address.set(None)
    current_user_agent.set(None)


def _serialize_value(value: Any) -> Any:
    """Serialize a value for JSON storage.

    Args:
        value: Value to serialize

    Returns:
        JSON-serializable value
    """
    if isinstance(value, datetime):
        return value.isoformat()
    elif hasattr(value, "__str__"):
        return str(value)
    return value


def _get_changes_dict(obj: Any) -> dict[str, dict[str, Any]] | None:
    """Extract changes from a modified object.

    Args:
        obj: SQLAlchemy model instance

    Returns:
        Dictionary mapping field names to {"old": value, "new": value} or None if no changes
    """
    from sqlalchemy import inspect as sqlalchemy_inspect

    inspector = sqlalchemy_inspect(obj)
    changes = {}

    for attr in inspector.attrs:
        # Skip relationships and non-modified attributes
        if attr.key.startswith("_") or not hasattr(attr, "history"):
            continue

        history = get_history(obj, attr.key)
        if history.has_changes():
            old_value = history.deleted[0] if history.deleted else None
            new_value = history.added[0] if history.added else None

            # Only include if values actually differ
            if old_value != new_value:
                changes[attr.key] = {
                    "old": _serialize_value(old_value),
                    "new": _serialize_value(new_value)
                }

    return changes if changes else None


def _should_audit(obj: Any) -> bool:
    """Determine if an object should be audited.

    Args:
        obj: SQLAlchemy model instance

    Returns:
        True if object should be audited, False otherwise
    """
    # Exclude audit logs themselves (prevent infinite recursion)
    if hasattr(obj, "__tablename__") and obj.__tablename__ == "audit_logs":
        return False

    # Only audit models that inherit from TenantAwareModel or NonTenantModel
    return isinstance(obj, (TenantAwareModel, NonTenantModel))


def _create_audit_log(
    connection: Connection,
    tenant_id: str | None,
    user_id: str | None,
    operation: OperationType,
    table_name: str,
    record_id: str,
    changes: dict[str, dict[str, Any]] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None
) -> None:
    """Create an audit log entry directly via connection.

    Uses direct connection.execute to avoid triggering recursive audit events.

    Args:
        connection: Database connection
        tenant_id: Tenant ID (None for non-tenant models)
        user_id: User ID performing the operation
        operation: Type of operation (CREATE, UPDATE, DELETE)
        table_name: Name of the table being modified
        record_id: ID of the record being modified
        changes: Dictionary of changes for UPDATE operations
        ip_address: Client IP address
        user_agent: Client user agent string
    """
    # Serialize changes to JSON
    changes_json = json.dumps(changes) if changes else None

    # Insert audit log directly using connection to avoid session events
    connection.execute(
        insert(AuditLog).values(
            tenant_id=tenant_id or "system",  # Use "system" for non-tenant operations
            user_id=user_id,
            operation=operation,
            table_name=table_name,
            record_id=record_id,
            changes=changes_json,
            ip_address=ip_address,
            user_agent=user_agent
        )
    )


@event.listens_for(Session, "after_flush")
def after_flush_audit_handler(session: Session, flush_context: Any) -> None:
    """Capture all data changes after a flush event.

    This event listener captures INSERT, UPDATE, and DELETE operations
    and creates audit log entries for each change.

    Args:
        session: SQLAlchemy session
        flush_context: Flush context (unused)
    """
    # Get audit context
    user_id = current_user_id.get()
    ip_address = current_ip_address.get()
    user_agent = current_user_agent.get()
    tenant_id = get_tenant_context()

    # Get database connection for direct audit log insertion
    connection = session.connection()

    # Process new objects (INSERT)
    for obj in session.new:
        if not _should_audit(obj):
            continue

        # Get tenant_id from object if it's a TenantAwareModel
        obj_tenant_id = tenant_id
        if isinstance(obj, TenantAwareModel) and hasattr(obj, "tenant_id"):
            obj_tenant_id = obj.tenant_id

        _create_audit_log(
            connection=connection,
            tenant_id=obj_tenant_id,
            user_id=user_id,
            operation=OperationType.CREATE,
            table_name=obj.__tablename__,
            record_id=str(obj.id),
            changes=None,  # No changes for CREATE
            ip_address=ip_address,
            user_agent=user_agent
        )

    # Process modified objects (UPDATE)
    for obj in session.dirty:
        if not _should_audit(obj):
            continue

        # Skip if no actual changes (can happen with relationships)
        changes = _get_changes_dict(obj)
        if not changes:
            continue

        # Get tenant_id from object if it's a TenantAwareModel
        obj_tenant_id = tenant_id
        if isinstance(obj, TenantAwareModel) and hasattr(obj, "tenant_id"):
            obj_tenant_id = obj.tenant_id

        _create_audit_log(
            connection=connection,
            tenant_id=obj_tenant_id,
            user_id=user_id,
            operation=OperationType.UPDATE,
            table_name=obj.__tablename__,
            record_id=str(obj.id),
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent
        )

    # Process deleted objects (DELETE)
    for obj in session.deleted:
        if not _should_audit(obj):
            continue

        # Get tenant_id from object if it's a TenantAwareModel
        obj_tenant_id = tenant_id
        if isinstance(obj, TenantAwareModel) and hasattr(obj, "tenant_id"):
            obj_tenant_id = obj.tenant_id

        _create_audit_log(
            connection=connection,
            tenant_id=obj_tenant_id,
            user_id=user_id,
            operation=OperationType.DELETE,
            table_name=obj.__tablename__,
            record_id=str(obj.id),
            changes=None,  # No changes for DELETE (object is gone)
            ip_address=ip_address,
            user_agent=user_agent
        )
