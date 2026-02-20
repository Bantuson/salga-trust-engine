"""Settings API for SLA configuration and municipality profile management.

Provides endpoints for:
- Listing and upserting SLA configurations per category
- Getting and updating municipality profile

Security:
- GET endpoints: MANAGER and ADMIN roles
- PUT/update endpoints: ADMIN only
- Tenant isolation via current_user.municipality_id
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db, require_role
from src.middleware.rate_limit import (
    SENSITIVE_READ_RATE_LIMIT,
    SENSITIVE_WRITE_RATE_LIMIT,
    limiter,
)
from src.models.municipality import Municipality
from src.models.sla_config import SLAConfig
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


# --- Pydantic Schemas ---

class SLAConfigResponse(BaseModel):
    """SLA config response schema."""
    category: str | None
    response_hours: int
    resolution_hours: int
    warning_threshold_pct: int
    is_active: bool

    class Config:
        from_attributes = True


class SLAConfigUpdate(BaseModel):
    """SLA config upsert request body."""
    response_hours: int
    resolution_hours: int
    warning_threshold_pct: int = 80


class MunicipalityProfileResponse(BaseModel):
    """Municipality profile response schema."""
    id: UUID
    name: str
    code: str
    province: str
    contact_email: str | None = None
    contact_phone: str | None = None
    logo_url: str | None = None

    class Config:
        from_attributes = True


class MunicipalityProfileUpdate(BaseModel):
    """Municipality profile partial update request body."""
    name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    logo_url: str | None = None


# --- Endpoints ---

@router.get("/sla", response_model=list[SLAConfigResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def list_sla_configs(
    request: Request,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[SLAConfig]:
    """List all SLA configurations for the current user's municipality.

    Args:
        current_user: Authenticated MANAGER or ADMIN
        db: Database session

    Returns:
        List of SLA configs for the municipality

    Raises:
        HTTPException: 403 if user not authorized
    """
    result = await db.execute(
        select(SLAConfig).where(
            SLAConfig.municipality_id == current_user.municipality_id,
            SLAConfig.is_active == True,
        ).order_by(SLAConfig.category)
    )
    configs = result.scalars().all()

    return list(configs)


@router.put("/sla/{category}", response_model=SLAConfigResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def upsert_sla_config(
    request: Request,
    category: str,
    sla_data: SLAConfigUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SLAConfig:
    """Upsert (create or update) SLA configuration for a category.

    Only ADMIN role can modify SLA configurations.
    Uses category='default' for municipality-level defaults.

    Args:
        category: Ticket category (e.g., 'water', 'roads') or 'default'
        sla_data: SLA hours and warning threshold
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Updated or created SLA config

    Raises:
        HTTPException: 403 if user not ADMIN
    """
    municipality_id = current_user.municipality_id

    # Normalize 'default' category to NULL for DB query
    db_category: str | None = None if category == "default" else category

    # Check if config already exists
    result = await db.execute(
        select(SLAConfig).where(
            SLAConfig.municipality_id == municipality_id,
            SLAConfig.category == db_category,
        )
    )
    config = result.scalar_one_or_none()

    if config:
        # Update existing
        config.response_hours = sla_data.response_hours
        config.resolution_hours = sla_data.resolution_hours
        config.warning_threshold_pct = sla_data.warning_threshold_pct
        config.is_active = True
    else:
        # Create new
        config = SLAConfig(
            municipality_id=municipality_id,
            category=db_category,
            response_hours=sla_data.response_hours,
            resolution_hours=sla_data.resolution_hours,
            warning_threshold_pct=sla_data.warning_threshold_pct,
            is_active=True,
        )
        db.add(config)

    await db.commit()
    await db.refresh(config)

    logger.info(
        f"SLA config upserted: category={category}, municipality={municipality_id} "
        f"by {current_user.full_name}"
    )

    return config


@router.get("/municipality", response_model=MunicipalityProfileResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_municipality_profile(
    request: Request,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MunicipalityProfileResponse:
    """Get municipality profile for the current user's municipality.

    Args:
        current_user: Authenticated MANAGER or ADMIN
        db: Database session

    Returns:
        Municipality profile with available fields

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(
            Municipality.id == current_user.municipality_id
        )
    )
    municipality = result.scalar_one_or_none()

    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found"
        )

    # Build response — Municipality model doesn't have all fields,
    # return None for fields not present in the model
    return MunicipalityProfileResponse(
        id=municipality.id,
        name=municipality.name,
        code=municipality.code,
        province=municipality.province,
        contact_email=municipality.contact_email,
        contact_phone=None,  # Not in current Municipality model
        logo_url=None,       # Not in current Municipality model
    )


@router.put("/municipality", response_model=MunicipalityProfileResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def update_municipality_profile(
    request: Request,
    update_data: MunicipalityProfileUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MunicipalityProfileResponse:
    """Update municipality profile. ADMIN only.

    Only updates fields that exist on the Municipality model.
    Fields not in the model (contact_phone, logo_url) are silently ignored
    until the model is extended in a future migration.

    Args:
        update_data: Fields to update (all optional)
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Updated municipality profile

    Raises:
        HTTPException: 403 if user not ADMIN
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(
            Municipality.id == current_user.municipality_id
        )
    )
    municipality = result.scalar_one_or_none()

    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found"
        )

    # Apply updates for fields that exist in the model
    if update_data.name is not None:
        municipality.name = update_data.name
    if update_data.contact_email is not None:
        municipality.contact_email = update_data.contact_email
    # Note: contact_phone and logo_url not yet in Municipality model —
    # silently skip until a migration adds those columns

    await db.commit()
    await db.refresh(municipality)

    logger.info(
        f"Municipality {municipality.id} profile updated "
        f"by {current_user.full_name}"
    )

    return MunicipalityProfileResponse(
        id=municipality.id,
        name=municipality.name,
        code=municipality.code,
        province=municipality.province,
        contact_email=municipality.contact_email,
        contact_phone=None,
        logo_url=None,
    )
