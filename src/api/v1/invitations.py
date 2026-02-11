"""Team invitation API for onboarding and team management.

Provides endpoints for:
- Creating individual team member invitations
- Bulk creating multiple invitations at once
- Listing pending/accepted/expired invitations
- Canceling pending invitations

Security:
- All endpoints require authentication
- Only admins/managers can manage invitations for their municipality
- Tenant isolation enforced via RLS and application-level filtering
"""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_role
from src.core.tenant import get_tenant_context
from src.models.team_invitation import TeamInvitation
from src.models.user import User, UserRole
from src.schemas.invitation import (
    TeamInvitationBulkCreate,
    TeamInvitationCreate,
    TeamInvitationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invitations", tags=["invitations"])

# Default invitation expiry (7 days)
DEFAULT_EXPIRY_DAYS = 7


@router.post("/", response_model=TeamInvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    invitation_data: TeamInvitationCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> TeamInvitation:
    """Create a single team member invitation.

    Args:
        invitation_data: Invitation details (email, role)
        current_user: Authenticated admin/manager user
        db: Database session

    Returns:
        Created invitation with pending status

    Raises:
        HTTPException: 403 if user is not admin/manager
    """
    tenant_id = get_tenant_context()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context not set"
        )

    municipality_id = current_user.municipality_id

    # Create invitation
    invitation = TeamInvitation(
        tenant_id=tenant_id,
        municipality_id=municipality_id,
        email=invitation_data.email,
        role=invitation_data.role.value,
        invited_by=current_user.id,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=DEFAULT_EXPIRY_DAYS),
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    logger.info(
        f"Team invitation created: {invitation_data.email} as {invitation_data.role.value} "
        f"by {current_user.full_name} for municipality {municipality_id}"
    )

    # TODO: Send invitation email with signup link and token

    return invitation


@router.post("/bulk", response_model=list[TeamInvitationResponse], status_code=status.HTTP_201_CREATED)
async def create_bulk_invitations(
    bulk_data: TeamInvitationBulkCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> list[TeamInvitation]:
    """Create multiple team member invitations at once.

    Useful for onboarding wizard where admins invite multiple team members
    in the "Team" step.

    Args:
        bulk_data: List of invitations to create
        current_user: Authenticated admin/manager user
        db: Database session

    Returns:
        List of created invitations

    Raises:
        HTTPException: 403 if user is not admin/manager
    """
    tenant_id = get_tenant_context()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context not set"
        )

    municipality_id = current_user.municipality_id
    expires_at = datetime.now(timezone.utc) + timedelta(days=DEFAULT_EXPIRY_DAYS)

    # Create all invitations
    invitations = []
    for invitation_data in bulk_data.invitations:
        invitation = TeamInvitation(
            tenant_id=tenant_id,
            municipality_id=municipality_id,
            email=invitation_data.email,
            role=invitation_data.role.value,
            invited_by=current_user.id,
            status="pending",
            expires_at=expires_at,
        )
        db.add(invitation)
        invitations.append(invitation)

    await db.commit()

    # Refresh all to get IDs
    for invitation in invitations:
        await db.refresh(invitation)

    logger.info(
        f"Bulk invitations created: {len(invitations)} invitations "
        f"by {current_user.full_name} for municipality {municipality_id}"
    )

    # TODO: Send invitation emails for all invitations

    return invitations


@router.get("/", response_model=list[TeamInvitationResponse])
async def list_invitations(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = None,
) -> list[TeamInvitation]:
    """List all invitations for current municipality.

    Args:
        current_user: Authenticated admin/manager user
        db: Database session
        status_filter: Optional filter by status (pending, accepted, expired)

    Returns:
        List of invitations

    Raises:
        HTTPException: 403 if user is not admin/manager
    """
    municipality_id = current_user.municipality_id

    query = select(TeamInvitation).where(
        TeamInvitation.municipality_id == municipality_id
    )

    # Filter by status if provided
    if status_filter:
        query = query.where(TeamInvitation.status == status_filter)

    # Order by newest first
    query = query.order_by(TeamInvitation.created_at.desc())

    result = await db.execute(query)
    invitations = result.scalars().all()

    return list(invitations)


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    invitation_id: UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Cancel/delete a pending invitation.

    Only works if invitation status is 'pending'. Cannot cancel accepted
    or expired invitations.

    Args:
        invitation_id: Invitation ID to cancel
        current_user: Authenticated admin/manager user
        db: Database session

    Raises:
        HTTPException: 404 if invitation not found
        HTTPException: 400 if invitation is not pending
        HTTPException: 403 if user is not admin/manager
    """
    municipality_id = current_user.municipality_id

    # Fetch invitation
    result = await db.execute(
        select(TeamInvitation).where(
            TeamInvitation.id == invitation_id,
            TeamInvitation.municipality_id == municipality_id,
        )
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel invitation with status '{invitation.status}'"
        )

    # Delete invitation
    await db.delete(invitation)
    await db.commit()

    logger.info(
        f"Invitation {invitation_id} canceled by {current_user.full_name}"
    )
