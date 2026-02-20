"""Teams CRUD API for municipal service team management.

Provides endpoints for:
- Listing teams within a municipality
- Creating and updating teams
- Managing team members (via accepted invitations)
- Listing team-specific invitations

Security:
- All endpoints require authentication
- RBAC: MANAGER and ADMIN roles only (plus WARD_COUNCILLOR for read-only list)
- Tenant isolation: all queries scoped to current_user.tenant_id
- SAPS teams excluded from general queries (SEC-05)
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db, require_role
from src.middleware.rate_limit import (
    SENSITIVE_READ_RATE_LIMIT,
    SENSITIVE_WRITE_RATE_LIMIT,
    limiter,
)
from src.models.team import Team
from src.models.team_invitation import TeamInvitation
from src.models.ticket import Ticket, TicketStatus
from src.models.user import User, UserRole
from src.schemas.invitation import TeamInvitationResponse
from src.schemas.team import TeamCreate, TeamMemberResponse, TeamResponse, TeamUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teams", tags=["teams"])


async def _compute_team_response(
    team: Team,
    db: AsyncSession,
) -> TeamResponse:
    """Compute a TeamResponse with member_count, manager_name, active_ticket_count.

    Args:
        team: Team ORM object
        db: Database session

    Returns:
        TeamResponse with computed fields populated
    """
    # Count accepted members for this team
    member_count_result = await db.execute(
        select(func.count()).where(
            TeamInvitation.team_id == team.id,
            TeamInvitation.status == "accepted"
        )
    )
    member_count = member_count_result.scalar() or 0

    # Get manager name if manager assigned
    manager_name: str | None = None
    if team.manager_id:
        manager_result = await db.execute(
            select(User.full_name).where(User.id == team.manager_id)
        )
        manager_name = manager_result.scalar_one_or_none()

    # Count active tickets assigned to this team
    active_ticket_result = await db.execute(
        select(func.count()).where(
            Ticket.assigned_team_id == team.id,
            Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS])
        )
    )
    active_ticket_count = active_ticket_result.scalar() or 0

    response = TeamResponse.model_validate(team)
    response.member_count = member_count
    response.manager_name = manager_name
    response.active_ticket_count = active_ticket_count

    return response


@router.get("/", response_model=list[TeamResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def list_teams(
    request: Request,
    current_user: User = Depends(
        require_role(UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR)
    ),
    db: AsyncSession = Depends(get_db),
) -> list[TeamResponse]:
    """List all active teams for the current user's municipality.

    Excludes SAPS teams from general queries (SEC-05 boundary).
    Computes member_count, manager_name, and active_ticket_count for each team.

    Args:
        current_user: Authenticated user (MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session

    Returns:
        List of teams with computed fields

    Raises:
        HTTPException: 403 if user not authorized
    """
    query = select(Team).where(
        Team.tenant_id == current_user.tenant_id,
        Team.is_active == True,
        Team.is_saps == False,  # Exclude SAPS teams from general view (SEC-05)
    )
    result = await db.execute(query)
    teams = result.scalars().all()

    responses = []
    for team in teams:
        responses.append(await _compute_team_response(team, db))

    return responses


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def create_team(
    request: Request,
    team_data: TeamCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    """Create a new municipal service team.

    Args:
        team_data: Team creation data (name, category, manager_id, is_saps)
        current_user: Authenticated ADMIN or MANAGER
        db: Database session

    Returns:
        Created team with computed fields

    Raises:
        HTTPException: 403 if user not authorized
    """
    team = Team(
        tenant_id=current_user.tenant_id,
        name=team_data.name,
        category=team_data.category,
        manager_id=team_data.manager_id,
        is_saps=team_data.is_saps,
        is_active=True,
    )

    db.add(team)
    await db.commit()
    await db.refresh(team)

    logger.info(
        f"Team created: {team.name} ({team.category}) "
        f"by {current_user.full_name} in tenant {current_user.tenant_id}"
    )

    return await _compute_team_response(team, db)


@router.get("/{team_id}", response_model=TeamResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_team(
    request: Request,
    team_id: UUID,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    """Get a single team by ID.

    Verifies team belongs to current user's municipality (tenant isolation).

    Args:
        team_id: Team UUID
        current_user: Authenticated MANAGER or ADMIN
        db: Database session

    Returns:
        Team with computed fields

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 404 if team not found or not in user's municipality
    """
    result = await db.execute(
        select(Team).where(
            Team.id == team_id,
            Team.tenant_id == current_user.tenant_id,
        )
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    return await _compute_team_response(team, db)


@router.patch("/{team_id}", response_model=TeamResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def update_team(
    request: Request,
    team_id: UUID,
    update_data: TeamUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    """Partially update a team (name, category, manager_id, is_active).

    Verifies team belongs to current user's municipality (tenant isolation).

    Args:
        team_id: Team UUID
        update_data: Fields to update (all optional)
        current_user: Authenticated ADMIN or MANAGER
        db: Database session

    Returns:
        Updated team with computed fields

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 404 if team not found or not in user's municipality
    """
    result = await db.execute(
        select(Team).where(
            Team.id == team_id,
            Team.tenant_id == current_user.tenant_id,
        )
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    # Apply partial updates
    update_fields = update_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(team, field, value)

    await db.commit()
    await db.refresh(team)

    logger.info(
        f"Team {team_id} updated by {current_user.full_name}: {list(update_fields.keys())}"
    )

    return await _compute_team_response(team, db)


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_team_members(
    request: Request,
    team_id: UUID,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[TeamMemberResponse]:
    """Get team members (accepted invitations joined with user details).

    Verifies team belongs to current user's municipality (tenant isolation).

    Args:
        team_id: Team UUID
        current_user: Authenticated MANAGER or ADMIN
        db: Database session

    Returns:
        List of team members with user details

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 404 if team not found or not in user's municipality
    """
    # Verify team belongs to this municipality
    team_result = await db.execute(
        select(Team).where(
            Team.id == team_id,
            Team.tenant_id == current_user.tenant_id,
        )
    )
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    # Query accepted invitations for this team with user details
    result = await db.execute(
        select(
            TeamInvitation.id,
            TeamInvitation.email,
            TeamInvitation.role,
            TeamInvitation.accepted_at,
            User.full_name,
        )
        .outerjoin(User, User.email == TeamInvitation.email)
        .where(
            TeamInvitation.team_id == team_id,
            TeamInvitation.status == "accepted",
        )
    )
    rows = result.all()

    members = []
    for row in rows:
        members.append(
            TeamMemberResponse(
                id=row.id,
                email=row.email,
                full_name=row.full_name,
                role=row.role,
                joined_at=row.accepted_at,
            )
        )

    return members


@router.delete(
    "/{team_id}/members/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def remove_team_member(
    request: Request,
    team_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a member from a team by setting their invitation to 'removed'.

    Verifies team belongs to current user's municipality (tenant isolation).

    Args:
        team_id: Team UUID
        invitation_id: TeamInvitation UUID to remove
        current_user: Authenticated ADMIN or MANAGER
        db: Database session

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 404 if team or member not found
    """
    # Verify team belongs to this municipality
    team_result = await db.execute(
        select(Team).where(
            Team.id == team_id,
            Team.tenant_id == current_user.tenant_id,
        )
    )
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    # Find the invitation
    inv_result = await db.execute(
        select(TeamInvitation).where(
            TeamInvitation.id == invitation_id,
            TeamInvitation.team_id == team_id,
        )
    )
    invitation = inv_result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )

    invitation.status = "removed"
    await db.commit()

    logger.info(
        f"Member {invitation.email} removed from team {team_id} "
        f"by {current_user.full_name}"
    )


@router.get("/{team_id}/invitations", response_model=list[TeamInvitationResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_team_invitations(
    request: Request,
    team_id: UUID,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[TeamInvitationResponse]:
    """Get all invitations for a specific team.

    Verifies team belongs to current user's municipality (tenant isolation).

    Args:
        team_id: Team UUID
        current_user: Authenticated MANAGER or ADMIN
        db: Database session

    Returns:
        List of invitations for the team

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 404 if team not found or not in user's municipality
    """
    # Verify team belongs to this municipality
    team_result = await db.execute(
        select(Team).where(
            Team.id == team_id,
            Team.tenant_id == current_user.tenant_id,
        )
    )
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    result = await db.execute(
        select(TeamInvitation)
        .where(TeamInvitation.team_id == team_id)
        .order_by(TeamInvitation.created_at.desc())
    )
    invitations = result.scalars().all()

    return list(invitations)
