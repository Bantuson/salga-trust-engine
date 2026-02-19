"""Audit log listing endpoint for admin access to system audit trail.

Provides paginated access to audit logs filtered to the current admin's
municipality/tenant. ADMIN role only.

Security:
- ADMIN role required (most sensitive endpoint)
- Tenant isolation: logs filtered to current_user.tenant_id
- Paginated to prevent bulk data extraction
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_role
from src.models.audit_log import AuditLog
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

MAX_PAGE_SIZE = 100


class AuditLogEntry(BaseModel):
    """Audit log entry response schema."""
    id: str
    tenant_id: str
    user_id: str | None
    operation: str
    table_name: str
    record_id: str
    changes: str | None
    ip_address: str | None
    user_agent: str | None
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Paginated audit log list response."""
    logs: list[AuditLogEntry]
    total: int
    page: int
    page_size: int


@router.get("/", response_model=AuditLogListResponse)
async def list_audit_logs(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(default=50, ge=1, le=MAX_PAGE_SIZE, description="Records per page"),
    table_name: str | None = Query(default=None, description="Filter by table name"),
    operation: str | None = Query(default=None, description="Filter by operation (CREATE, READ, UPDATE, DELETE)"),
) -> AuditLogListResponse:
    """List audit logs for the current admin's tenant.

    Paginated, ordered by timestamp descending (most recent first).
    ADMIN role only — the most sensitive data access endpoint.

    Args:
        current_user: Authenticated ADMIN
        db: Database session
        page: Page number (1-based)
        page_size: Records per page (max 100)
        table_name: Optional filter by table name
        operation: Optional filter by operation type

    Returns:
        Paginated audit log entries with total count

    Raises:
        HTTPException: 403 if user not ADMIN
    """
    tenant_id_str = str(current_user.tenant_id)

    # Base query filtered to this tenant
    base_query = select(AuditLog).where(
        AuditLog.tenant_id == tenant_id_str
    )

    # Optional filters
    if table_name:
        base_query = base_query.where(AuditLog.table_name == table_name)
    if operation:
        base_query = base_query.where(AuditLog.operation == operation)

    # Count total matching records
    count_query = select(func.count()).select_from(
        base_query.subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated results, most recent first
    offset = (page - 1) * page_size
    result = await db.execute(
        base_query
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(page_size)
    )
    logs = result.scalars().all()

    # Convert model operation enum to string for serialization
    log_entries = []
    for log in logs:
        log_entries.append(
            AuditLogEntry(
                id=str(log.id),
                tenant_id=log.tenant_id,
                user_id=log.user_id,
                operation=log.operation.value if hasattr(log.operation, "value") else str(log.operation),
                table_name=log.table_name,
                record_id=log.record_id,
                changes=log.changes,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                timestamp=log.timestamp,
            )
        )

    return AuditLogListResponse(
        logs=log_entries,
        total=total,
        page=page,
        page_size=page_size,
    )
