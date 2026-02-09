"""POPIA data rights endpoints for data access and deletion."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_active_user, get_db
from src.middleware.rate_limit import DATA_EXPORT_RATE_LIMIT, limiter
from src.models.audit_log import AuditLog, OperationType
from src.models.consent import ConsentRecord
from src.models.user import User

router = APIRouter(prefix="/api/v1/data-rights", tags=["POPIA Data Rights"])


@router.get("/my-data")
@limiter.limit(DATA_EXPORT_RATE_LIMIT)
async def get_my_data(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all personal data held about the current user (POPIA Right to Access).

    This endpoint returns a comprehensive export of all personal data stored
    about the authenticated user across all system tables.

    Rate limited to 5 requests per hour to prevent abuse.

    Args:
        request: FastAPI request object (required for rate limiter)
        current_user: Authenticated user
        db: Database session

    Returns:
        Dictionary containing:
        - profile: User profile information
        - consent_records: All consent records
        - activity_log: User's activity audit trail
    """
    # Gather user profile data
    profile = {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "preferred_language": current_user.preferred_language,
        "role": current_user.role.value,
        "tenant_id": current_user.tenant_id,
        "municipality_id": str(current_user.municipality_id),
        "is_active": current_user.is_active,
        "is_deleted": current_user.is_deleted,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "updated_at": current_user.updated_at.isoformat() if current_user.updated_at else None,
        "deleted_at": current_user.deleted_at.isoformat() if current_user.deleted_at else None,
    }

    # Gather consent records
    consent_result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.user_id == current_user.id)
    )
    consent_records_data = []
    for consent in consent_result.scalars().all():
        consent_records_data.append({
            "id": str(consent.id),
            "purpose": consent.purpose,
            "purpose_description": consent.purpose_description,
            "language": consent.language,
            "consented": consent.consented,
            "consented_at": consent.consented_at.isoformat() if consent.consented_at else None,
            "withdrawn": consent.withdrawn,
            "withdrawn_at": consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
            "ip_address": consent.ip_address,
        })

    # Gather activity log (audit trail)
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == str(current_user.id))
        .order_by(AuditLog.timestamp.desc())
        .limit(1000)  # Limit to most recent 1000 entries
    )
    activity_log_data = []
    for audit in audit_result.scalars().all():
        activity_log_data.append({
            "timestamp": audit.timestamp.isoformat() if audit.timestamp else None,
            "operation": audit.operation.value,
            "table_name": audit.table_name,
            "record_id": audit.record_id,
            "ip_address": audit.ip_address,
        })

    # Log this data access request for compliance
    audit_log_entry = AuditLog(
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        operation=OperationType.READ,
        table_name="users",
        record_id=str(current_user.id),
        changes=None,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log_entry)
    await db.commit()

    return {
        "profile": profile,
        "consent_records": consent_records_data,
        "activity_log": activity_log_data,
        "export_timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.delete("/delete-account")
@limiter.limit("1/day")
async def delete_account(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete user account and anonymize personal data (POPIA Right to Deletion).

    This endpoint performs a soft delete and anonymizes all personally identifiable
    information while preserving audit logs for legal compliance.

    Rate limited to 1 request per day to prevent accidental deletion.

    Args:
        request: FastAPI request object (required for rate limiter)
        current_user: Authenticated user
        db: Database session

    Returns:
        Confirmation message with deletion details
    """
    # Soft-delete the user
    current_user.is_deleted = True
    current_user.deleted_at = datetime.now(timezone.utc)

    # Anonymize PII fields
    current_user.email = f"deleted_{current_user.id}@anonymized.local"
    current_user.full_name = "Deleted User"
    current_user.phone = None

    # Invalidate password (prevents login)
    current_user.hashed_password = ""

    # Mark all consent records as withdrawn
    consent_result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.user_id == current_user.id)
    )
    for consent in consent_result.scalars().all():
        consent.withdrawn = True
        consent.withdrawn_at = datetime.now(timezone.utc)

    # Log the deletion for compliance
    audit_log_entry = AuditLog(
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        operation=OperationType.DELETE,
        table_name="users",
        record_id=str(current_user.id),
        changes=None,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log_entry)

    await db.commit()

    return {
        "status": "account_deleted",
        "message": "Your personal data has been anonymized",
        "deleted_at": current_user.deleted_at.isoformat(),
    }
