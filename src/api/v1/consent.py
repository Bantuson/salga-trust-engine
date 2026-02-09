"""Consent management endpoints for POPIA compliance."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_active_user, get_db
from src.models.consent import ConsentRecord
from src.models.user import User

router = APIRouter(prefix="/api/v1/consent", tags=["Consent Management"])


class ConsentCreate(BaseModel):
    """Schema for creating a new consent record."""

    purpose: str
    purpose_description: str
    language: str = "en"
    consented: bool


class ConsentResponse(BaseModel):
    """Schema for consent record response."""

    id: str
    user_id: str
    tenant_id: str
    purpose: str
    purpose_description: str
    language: str
    consented: bool
    consented_at: str
    withdrawn: bool
    withdrawn_at: str | None
    ip_address: str | None
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ConsentResponse])
async def list_user_consents(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all consent records for the current user.

    Returns both active and withdrawn consents to provide full transparency
    about data processing consent history.

    Args:
        current_user: Authenticated user
        db: Database session

    Returns:
        List of consent records
    """
    result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == current_user.id)
        .order_by(ConsentRecord.consented_at.desc())
    )
    consents = result.scalars().all()

    return [
        ConsentResponse(
            id=str(consent.id),
            user_id=str(consent.user_id),
            tenant_id=consent.tenant_id,
            purpose=consent.purpose,
            purpose_description=consent.purpose_description,
            language=consent.language,
            consented=consent.consented,
            consented_at=consent.consented_at.isoformat() if consent.consented_at else "",
            withdrawn=consent.withdrawn,
            withdrawn_at=consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
            ip_address=consent.ip_address,
            created_at=consent.created_at.isoformat() if consent.created_at else "",
        )
        for consent in consents
    ]


@router.post("/", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
async def create_consent(
    request: Request,
    consent_data: ConsentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a new consent for the current user.

    This endpoint creates a new consent record with full transparency about
    the purpose and scope of data processing.

    Args:
        request: FastAPI request object
        consent_data: Consent information
        current_user: Authenticated user
        db: Database session

    Returns:
        Created consent record
    """
    # Extract IP address from request
    ip_address = request.client.host if request.client else None

    # Create consent record
    consent = ConsentRecord(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        purpose=consent_data.purpose,
        purpose_description=consent_data.purpose_description,
        language=consent_data.language,
        consented=consent_data.consented,
        ip_address=ip_address,
        withdrawn=False,
    )

    db.add(consent)
    await db.commit()
    await db.refresh(consent)

    return ConsentResponse(
        id=str(consent.id),
        user_id=str(consent.user_id),
        tenant_id=consent.tenant_id,
        purpose=consent.purpose,
        purpose_description=consent.purpose_description,
        language=consent.language,
        consented=consent.consented,
        consented_at=consent.consented_at.isoformat() if consent.consented_at else "",
        withdrawn=consent.withdrawn,
        withdrawn_at=consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
        ip_address=consent.ip_address,
        created_at=consent.created_at.isoformat() if consent.created_at else "",
    )


@router.post("/{consent_id}/withdraw", response_model=ConsentResponse)
async def withdraw_consent(
    consent_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Withdraw a previously given consent.

    Per POPIA, consent withdrawal does not retroactively invalidate data
    processing that occurred under valid consent. It only prevents future
    processing under that consent.

    Args:
        consent_id: ID of the consent to withdraw
        current_user: Authenticated user
        db: Database session

    Returns:
        Updated consent record with withdrawal timestamp

    Raises:
        HTTPException: 404 if consent not found or doesn't belong to user
    """
    # Look up consent
    result = await db.execute(
        select(ConsentRecord).where(
            ConsentRecord.id == consent_id,
            ConsentRecord.user_id == current_user.id  # Ensure user owns this consent
        )
    )
    consent = result.scalar_one_or_none()

    if consent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent record not found"
        )

    # Mark as withdrawn
    consent.withdrawn = True
    consent.withdrawn_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(consent)

    return ConsentResponse(
        id=str(consent.id),
        user_id=str(consent.user_id),
        tenant_id=consent.tenant_id,
        purpose=consent.purpose,
        purpose_description=consent.purpose_description,
        language=consent.language,
        consented=consent.consented,
        consented_at=consent.consented_at.isoformat() if consent.consented_at else "",
        withdrawn=consent.withdrawn,
        withdrawn_at=consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
        ip_address=consent.ip_address,
        created_at=consent.created_at.isoformat() if consent.created_at else "",
    )
