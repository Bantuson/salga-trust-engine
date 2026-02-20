"""Citizen portal API for personal ticket tracking and analytics.

Provides endpoints for:
- "My Reports": List citizen's own tickets with GBV privacy enforcement
- Personal stats: Total reports, resolved count, avg resolution time

Security:
- All endpoints require authentication with CITIZEN role
- GBV tickets (is_sensitive=True) return limited fields only
  - Citizens can see their own GBV tickets (they reported it)
  - But only tracking number, status, assigned SAPS officer, station info
  - No description, address, photos, or other sensitive details
- Municipal tickets return full details
"""
import logging
from typing import Union
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db, require_role
from src.middleware.rate_limit import SENSITIVE_READ_RATE_LIMIT, limiter
from src.models.assignment import TicketAssignment
from src.models.team import Team
from src.models.ticket import Ticket, TicketStatus
from src.models.user import User, UserRole
from src.schemas.citizen import (
    CitizenGBVTicketResponse,
    CitizenMyReportsResponse,
    CitizenStatsResponse,
    CitizenTicketResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/citizen", tags=["citizen"])


@router.get("/my-reports", response_model=CitizenMyReportsResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_my_reports(
    request: Request,
    current_user: User = Depends(require_role(UserRole.CITIZEN)),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = None,
    page: int = 0,
    page_size: int = 50,
) -> CitizenMyReportsResponse:
    """Get all tickets created by the current citizen.

    Returns mixed list of municipal tickets (full details) and GBV tickets
    (limited fields for privacy). Citizens can only see their own tickets.

    Args:
        current_user: Authenticated citizen user
        db: Database session
        status_filter: Optional filter by status (open, in_progress, resolved, etc.)
        page: Page number (0-indexed)
        page_size: Number of results per page

    Returns:
        List of tickets with appropriate field filtering based on sensitivity

    Raises:
        HTTPException: 403 if user is not citizen
    """
    user_id = current_user.id

    # Base query: tickets created by this user
    query = select(Ticket).where(Ticket.created_by == str(user_id))

    # Filter by status if provided
    if status_filter:
        query = query.where(Ticket.status == status_filter)

    # Order by newest first
    query = query.order_by(Ticket.created_at.desc())

    # Pagination
    query = query.offset(page * page_size).limit(page_size)

    result = await db.execute(query)
    tickets = result.scalars().all()

    # Format tickets based on sensitivity
    formatted_tickets: list[Union[CitizenTicketResponse, CitizenGBVTicketResponse]] = []

    for ticket in tickets:
        if ticket.is_sensitive:
            # GBV ticket: Limited fields only
            # Get assigned SAPS officer and station info
            assigned_officer_name = None
            station_name = None
            station_phone = None

            if ticket.assigned_to:
                # Fetch assigned user
                user_result = await db.execute(
                    select(User).where(User.id == ticket.assigned_to)
                )
                assigned_user = user_result.scalar_one_or_none()
                if assigned_user and assigned_user.role == UserRole.SAPS_LIAISON:
                    assigned_officer_name = assigned_user.full_name

            if ticket.assigned_team_id:
                # Fetch assigned team (SAPS station)
                team_result = await db.execute(
                    select(Team).where(Team.id == ticket.assigned_team_id)
                )
                assigned_team = team_result.scalar_one_or_none()
                if assigned_team and assigned_team.is_saps:
                    station_name = assigned_team.name
                    # Assuming team has a phone field (if not, this will be None)
                    station_phone = getattr(assigned_team, 'phone', None)

            formatted_tickets.append(
                CitizenGBVTicketResponse(
                    tracking_number=ticket.tracking_number,
                    status=ticket.status,
                    assigned_officer_name=assigned_officer_name,
                    station_name=station_name,
                    station_phone=station_phone,
                )
            )
        else:
            # Municipal ticket: Full details
            # Get assigned worker and team names
            assigned_to_name = None
            assigned_team_name = None

            if ticket.assigned_to:
                user_result = await db.execute(
                    select(User).where(User.id == ticket.assigned_to)
                )
                assigned_user = user_result.scalar_one_or_none()
                if assigned_user:
                    assigned_to_name = assigned_user.full_name

            if ticket.assigned_team_id:
                team_result = await db.execute(
                    select(Team).where(Team.id == ticket.assigned_team_id)
                )
                assigned_team = team_result.scalar_one_or_none()
                if assigned_team:
                    assigned_team_name = assigned_team.name

            # Count media attachments (if media_attachments relationship exists)
            # For now, default to 0 (can be enhanced with relationship query)
            media_count = 0

            formatted_tickets.append(
                CitizenTicketResponse(
                    tracking_number=ticket.tracking_number,
                    category=ticket.category,
                    status=ticket.status,
                    created_at=ticket.created_at,
                    address=ticket.address,
                    severity=ticket.severity,
                    assigned_to_name=assigned_to_name,
                    assigned_team_name=assigned_team_name,
                    media_count=media_count,
                    is_sensitive=False,
                )
            )

    # Get total count for pagination
    count_query = select(func.count()).select_from(Ticket).where(Ticket.created_by == str(user_id))
    if status_filter:
        count_query = count_query.where(Ticket.status == status_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    return CitizenMyReportsResponse(
        tickets=formatted_tickets,
        total=total,
    )


@router.get("/stats", response_model=CitizenStatsResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_citizen_stats(
    request: Request,
    current_user: User = Depends(require_role(UserRole.CITIZEN)),
    db: AsyncSession = Depends(get_db),
) -> CitizenStatsResponse:
    """Get personal analytics for the current citizen.

    Provides:
    - Total reports submitted by this citizen
    - Count of resolved reports
    - Average resolution time for this citizen's tickets
    - Municipality-wide average resolution time for comparison

    Args:
        current_user: Authenticated citizen user
        db: Database session

    Returns:
        Personal analytics stats

    Raises:
        HTTPException: 403 if user is not citizen
    """
    user_id = current_user.id
    municipality_id = current_user.municipality_id

    # Total reports by this user
    total_result = await db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.created_by == str(user_id))
    )
    total_reports = total_result.scalar_one()

    # Resolved count (status in 'resolved' or 'closed')
    resolved_result = await db.execute(
        select(func.count())
        .select_from(Ticket)
        .where(
            and_(
                Ticket.created_by == str(user_id),
                Ticket.status.in_([TicketStatus.RESOLVED, TicketStatus.CLOSED])
            )
        )
    )
    resolved_count = resolved_result.scalar_one()

    # Average resolution time for this user's tickets
    # AVG of (resolved_at - created_at) in days for resolved tickets
    avg_resolution_result = await db.execute(
        select(
            func.avg(
                func.extract('epoch', Ticket.resolved_at - Ticket.created_at) / 86400
            )
        )
        .select_from(Ticket)
        .where(
            and_(
                Ticket.created_by == str(user_id),
                Ticket.status.in_([TicketStatus.RESOLVED, TicketStatus.CLOSED]),
                Ticket.resolved_at.is_not(None)
            )
        )
    )
    avg_resolution_days = avg_resolution_result.scalar_one()

    # Municipality-wide average resolution time for comparison
    # Exclude GBV tickets (is_sensitive=True) from comparison
    municipality_avg_result = await db.execute(
        select(
            func.avg(
                func.extract('epoch', Ticket.resolved_at - Ticket.created_at) / 86400
            )
        )
        .select_from(Ticket)
        .where(
            and_(
                Ticket.tenant_id == current_user.tenant_id,
                Ticket.status.in_([TicketStatus.RESOLVED, TicketStatus.CLOSED]),
                Ticket.resolved_at.is_not(None),
                Ticket.is_sensitive == False  # Exclude GBV tickets
            )
        )
    )
    municipality_avg_resolution_days = municipality_avg_result.scalar_one()

    return CitizenStatsResponse(
        total_reports=total_reports,
        resolved_count=resolved_count,
        avg_resolution_days=avg_resolution_days,
        municipality_avg_resolution_days=municipality_avg_resolution_days,
    )
