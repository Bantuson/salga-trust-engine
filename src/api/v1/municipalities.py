"""Municipality management API endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_db, require_role
from src.middleware.rate_limit import (
    SENSITIVE_READ_RATE_LIMIT,
    SENSITIVE_WRITE_RATE_LIMIT,
    limiter,
)
from src.models.municipality import Municipality
from src.models.user import User, UserRole
from src.schemas.municipality import (
    MunicipalityCreate,
    MunicipalityResponse,
    MunicipalityUpdate,
)

router = APIRouter(prefix="/api/v1/municipalities", tags=["Municipalities"])


@router.post(
    "/",
    response_model=MunicipalityResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def create_municipality(
    request: Request,
    municipality: MunicipalityCreate,
    db: AsyncSession = Depends(get_db),
) -> Municipality:
    """Create a new municipality (admin only).

    Args:
        municipality: Municipality creation data
        db: Database session

    Returns:
        Created municipality

    Raises:
        HTTPException: 409 if code or name already exists
    """
    # Check for duplicate code
    result = await db.execute(
        select(Municipality).where(Municipality.code == municipality.code)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Municipality with code '{municipality.code}' already exists",
        )

    # Check for duplicate name
    result = await db.execute(
        select(Municipality).where(Municipality.name == municipality.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Municipality with name '{municipality.name}' already exists",
        )

    # Create municipality
    db_municipality = Municipality(**municipality.model_dump())

    try:
        db.add(db_municipality)
        await db.commit()
        await db.refresh(db_municipality)
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Municipality with this code or name already exists",
        ) from e

    return db_municipality


@router.get(
    "/",
    response_model=list[MunicipalityResponse],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def list_municipalities(
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    is_active: bool | None = Query(None),
) -> list[Municipality]:
    """List all municipalities with pagination (admin only).

    Args:
        db: Database session
        limit: Maximum number of results (default: 50, max: 100)
        offset: Number of results to skip (default: 0)
        is_active: Filter by active status (optional)

    Returns:
        List of municipalities
    """
    query = select(Municipality)

    # Apply is_active filter if provided
    if is_active is not None:
        query = query.where(Municipality.is_active == is_active)

    # Apply pagination
    query = query.limit(limit).offset(offset).order_by(Municipality.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{municipality_id}",
    response_model=MunicipalityResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_municipality(
    request: Request,
    municipality_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Municipality:
    """Get a single municipality by ID (admin only).

    Args:
        municipality_id: Municipality UUID
        db: Database session

    Returns:
        Municipality

    Raises:
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(Municipality.id == municipality_id)
    )
    municipality = result.scalar_one_or_none()

    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found",
        )

    return municipality


@router.patch(
    "/{municipality_id}",
    response_model=MunicipalityResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def update_municipality(
    request: Request,
    municipality_id: UUID,
    municipality_update: MunicipalityUpdate,
    db: AsyncSession = Depends(get_db),
) -> Municipality:
    """Update a municipality (admin only).

    Args:
        municipality_id: Municipality UUID
        municipality_update: Fields to update
        db: Database session

    Returns:
        Updated municipality

    Raises:
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(Municipality.id == municipality_id)
    )
    municipality = result.scalar_one_or_none()

    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found",
        )

    # Apply non-None fields from update
    update_data = municipality_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(municipality, field, value)

    try:
        await db.commit()
        await db.refresh(municipality)
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Municipality with this name already exists",
        ) from e

    return municipality
