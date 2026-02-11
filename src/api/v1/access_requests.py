"""Municipality access request API for public application form and admin review.

Provides endpoints for:
- Public submission of municipality access requests (no auth required)
- Admin review and approval/rejection of access requests
- Listing and filtering requests by status

Security:
- POST /access-requests: Public endpoint (no authentication)
- GET /access-requests: Admin-only (requires admin or platform_admin role)
- PATCH /access-requests/{id}/review: Admin-only
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_role
from src.models.access_request import AccessRequest
from src.models.user import User, UserRole
from src.schemas.access_request import (
    AccessRequestCreate,
    AccessRequestResponse,
    AccessRequestReview,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/access-requests", tags=["access-requests"])


@router.post("/", response_model=AccessRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_access_request(
    request_data: AccessRequestCreate,
    db: AsyncSession = Depends(get_db),
) -> AccessRequest:
    """Submit a new municipality access request (public, no auth required).

    This is a public endpoint accessible via the landing page's "Request Access"
    form. Municipality representatives provide their details and supporting
    documentation. Platform admins review and approve/reject the request.

    Args:
        request_data: Access request details
        db: Database session

    Returns:
        Created access request with pending status

    Note:
        Rate limiting should be applied at the infrastructure layer to prevent
        spam submissions.
    """
    # Create access request with pending status
    access_request = AccessRequest(
        municipality_name=request_data.municipality_name,
        province=request_data.province.value,  # Enum value
        municipality_code=request_data.municipality_code.upper() if request_data.municipality_code else None,
        contact_name=request_data.contact_name,
        contact_email=request_data.contact_email,
        contact_phone=request_data.contact_phone,
        notes=request_data.notes,
        status="pending",
    )

    db.add(access_request)
    await db.commit()
    await db.refresh(access_request)

    logger.info(
        f"Access request submitted: {request_data.municipality_name} ({request_data.province.value}) "
        f"by {request_data.contact_name} <{request_data.contact_email}>"
    )

    return access_request


@router.get("/", response_model=list[AccessRequestResponse])
async def list_access_requests(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = None,
    page: int = 0,
    page_size: int = 50,
) -> list[AccessRequest]:
    """List all access requests (admin only).

    Args:
        current_user: Authenticated admin user
        db: Database session
        status_filter: Optional filter by status (pending, approved, rejected)
        page: Page number (0-indexed)
        page_size: Number of results per page

    Returns:
        List of access requests

    Raises:
        HTTPException: 403 if user is not admin
    """
    query = select(AccessRequest)

    # Filter by status if provided
    if status_filter:
        query = query.where(AccessRequest.status == status_filter)

    # Order by newest first
    query = query.order_by(AccessRequest.created_at.desc())

    # Pagination
    query = query.offset(page * page_size).limit(page_size)

    result = await db.execute(query)
    requests = result.scalars().all()

    return list(requests)


@router.patch("/{request_id}/review", response_model=AccessRequestResponse)
async def review_access_request(
    request_id: UUID,
    review_data: AccessRequestReview,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AccessRequest:
    """Review and approve/reject an access request (admin only).

    Args:
        request_id: Access request ID
        review_data: Review decision (approved/rejected) and notes
        current_user: Authenticated admin user
        db: Database session

    Returns:
        Updated access request

    Raises:
        HTTPException: 404 if request not found
        HTTPException: 403 if user is not admin
    """
    # Fetch access request
    result = await db.execute(
        select(AccessRequest).where(AccessRequest.id == request_id)
    )
    access_request = result.scalar_one_or_none()

    if not access_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found"
        )

    # Update review fields
    access_request.status = review_data.status.value
    access_request.reviewed_by = current_user.id
    access_request.reviewed_at = datetime.now(timezone.utc)
    access_request.review_notes = review_data.review_notes

    await db.commit()
    await db.refresh(access_request)

    logger.info(
        f"Access request {request_id} {review_data.status.value} by {current_user.full_name} "
        f"({current_user.email})"
    )

    # TODO: If approved, trigger municipality creation workflow
    # (This would involve creating Municipality record, sending onboarding invite, etc.)

    return access_request
