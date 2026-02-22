"""Ticket management API for status updates, assignment, and retrieval.

Provides endpoints for municipal managers and admins to:
- List and filter tickets with RBAC enforcement
- View ticket details with SLA status and assignment history
- Update ticket status with automatic WhatsApp notifications
- Assign tickets to teams (manual or auto-routing)
- View ticket assignment/audit history

Key security features:
- SEC-05: GBV tickets (is_sensitive=True) only accessible to SAPS_LIAISON and ADMIN
- Returns HTTP 403 for unauthorized access to sensitive reports
- All ticket mutations trigger audit log via SQLAlchemy event listener
"""
import logging
import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db
from src.middleware.rate_limit import (
    SENSITIVE_READ_RATE_LIMIT,
    SENSITIVE_WRITE_RATE_LIMIT,
    limiter,
)
from src.models.assignment import TicketAssignment
from src.models.audit_log import AuditLog
from src.models.ticket import Ticket
from src.models.user import User, UserRole
from src.schemas.ticket import (
    AssignmentBrief,
    PaginatedTicketResponse,
    TicketAssignRequest,
    TicketDetailResponse,
    TicketResponse,
    TicketStatusUpdate,
)
from src.services.assignment_service import AssignmentService
from src.services.sla_service import SLAService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _compute_sla_status(ticket: Ticket) -> str | None:
    """Compute SLA status based on deadlines.

    Returns:
        "on_track", "warning", "breached_response", "breached_resolution", or None
    """
    if not ticket.sla_response_deadline or not ticket.sla_resolution_deadline:
        return None

    now = datetime.now(timezone.utc)

    # Check for breaches
    if ticket.status == "open" and now > ticket.sla_response_deadline:
        return "breached_response"

    if ticket.status in ["open", "in_progress"] and now > ticket.sla_resolution_deadline:
        return "breached_resolution"

    # Check for warnings (>80% elapsed)
    if ticket.status == "open" and ticket.sla_response_deadline:
        total_time = (ticket.sla_response_deadline - ticket.created_at).total_seconds()
        elapsed_time = (now - ticket.created_at).total_seconds()
        elapsed_pct = (elapsed_time / total_time) * 100 if total_time > 0 else 0

        if elapsed_pct >= 80:
            return "warning"

    if ticket.status in ["open", "in_progress"] and ticket.sla_resolution_deadline:
        total_time = (ticket.sla_resolution_deadline - ticket.created_at).total_seconds()
        elapsed_time = (now - ticket.created_at).total_seconds()
        elapsed_pct = (elapsed_time / total_time) * 100 if total_time > 0 else 0

        if elapsed_pct >= 80:
            return "warning"

    return "on_track"


@router.get("/", response_model=PaginatedTicketResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def list_tickets(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = 0,
    page_size: int = 50,
    status_filter: str | None = None,
    category: str | None = None,
    assigned_team_id: UUID | None = None,
    search: str | None = None,
    ward_id: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> PaginatedTicketResponse:
    """List tickets with server-side filtering, search, and pagination.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, SAPS_LIAISON, or WARD_COUNCILLOR)
        db: Database session
        page: Page number (default 0)
        page_size: Items per page (default 50)
        status_filter: Filter by status (optional)
        category: Filter by category (optional)
        assigned_team_id: Filter by assigned team (optional)
        search: Free-text search on tracking_number and description (optional)
        ward_id: Filter by ward (optional)
        sort_by: Sort field (created_at/status/severity/category, default created_at)
        sort_order: Sort order (asc/desc, default desc)

    Returns:
        PaginatedTicketResponse with tickets and pagination metadata

    Raises:
        HTTPException: 403 if user not authorized
    """
    # RBAC check - allow WARD_COUNCILLOR
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.SAPS_LIAISON, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view tickets"
        )

    # Ward councillor ward enforcement — use stored ward_id, not client-supplied
    if current_user.role == UserRole.WARD_COUNCILLOR:
        # Auto-apply ward filter from user's stored ward_id.
        # This prevents ward councillors from spoofing a different ward_id via query param.
        effective_ward_id = current_user.ward_id
        if effective_ward_id is None:
            # No ward assigned yet — return empty results (fail-safe, not fail-open)
            logger.warning(
                f"WARD_COUNCILLOR {current_user.id} has no ward_id assigned. Returning empty results."
            )
            return PaginatedTicketResponse(
                tickets=[],
                total=0,
                page=page,
                page_size=page_size,
                page_count=0,
            )
        # Override client-supplied ward_id with stored value
        ward_id = effective_ward_id

    # Build base query
    query = select(Ticket)

    # SEC-05: SAPS_LIAISON only sees GBV tickets
    if current_user.role == UserRole.SAPS_LIAISON:
        query = query.where(Ticket.is_sensitive == True)
    else:
        # MANAGER/ADMIN/WARD_COUNCILLOR see only non-sensitive tickets
        query = query.where(Ticket.is_sensitive == False)

    # Apply filters
    if status_filter:
        query = query.where(Ticket.status == status_filter.lower())

    if category:
        query = query.where(Ticket.category == category.lower())

    if assigned_team_id:
        query = query.where(Ticket.assigned_team_id == assigned_team_id)

    # Free-text search (tracking_number OR description)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Ticket.tracking_number.ilike(search_pattern),
                Ticket.description.ilike(search_pattern)
            )
        )

    # Ward filtering (interim: address ILIKE match)
    if ward_id:
        query = query.where(Ticket.address.ilike(f"%{ward_id}%"))

    # Count total (before pagination)
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Sorting
    valid_sort_fields = ["created_at", "status", "severity", "category"]
    if sort_by not in valid_sort_fields:
        sort_by = "created_at"

    sort_column = getattr(Ticket, sort_by)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # Apply pagination
    query = query.limit(page_size).offset(page * page_size)

    # Execute query
    result = await db.execute(query)
    tickets = result.scalars().all()

    # Calculate page count
    page_count = math.ceil(total / page_size) if page_size > 0 else 0

    return PaginatedTicketResponse(
        tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
        total=total,
        page=page,
        page_size=page_size,
        page_count=page_count
    )


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_ticket_detail(
    request: Request,
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailResponse:
    """Get ticket detail with SLA status and assignment history.

    Args:
        ticket_id: Ticket UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        TicketDetailResponse with full ticket details

    Raises:
        HTTPException: 404 if ticket not found
        HTTPException: 403 if user not authorized (SEC-05)
    """
    # Load ticket
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )

    # SEC-05: GBV access control
    if ticket.is_sensitive:
        if current_user.role not in [UserRole.SAPS_LIAISON, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access sensitive reports"
            )

    # RBAC: Ticket owner or manager/admin/saps_liaison/ward_councillor
    if (ticket.user_id != current_user.id and
        current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.SAPS_LIAISON, UserRole.WARD_COUNCILLOR]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this ticket"
        )

    # Ward councillor: only view tickets in their assigned ward
    if current_user.role == UserRole.WARD_COUNCILLOR:
        if current_user.ward_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No ward assigned to your account"
            )
        # Address-based ward check (same pattern as list endpoint)
        ticket_address = ticket.address or ""
        if current_user.ward_id.lower() not in ticket_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ticket is not in your assigned ward"
            )

    # Build response
    response = TicketDetailResponse.model_validate(ticket)

    # Compute SLA status
    response.sla_status = _compute_sla_status(ticket)

    # Load assignment history (if user is manager/admin/saps_liaison)
    if current_user.role in [UserRole.MANAGER, UserRole.ADMIN, UserRole.SAPS_LIAISON]:
        assignment_service = AssignmentService()
        assignments = await assignment_service.get_assignment_history(ticket_id, db)

        # Convert to AssignmentBrief
        # TODO: Populate team_name, assigned_to_name from relationships
        # For now, return empty list as we don't have joins set up
        response.assignment_history = []

    return response


@router.patch("/{ticket_id}/status", response_model=TicketResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def update_ticket_status(
    request: Request,
    ticket_id: UUID,
    status_update: TicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Update ticket status with automatic WhatsApp notification.

    Args:
        ticket_id: Ticket UUID
        status_update: New status
        current_user: Authenticated user (must be MANAGER, ADMIN, or SAPS_LIAISON)
        db: Database session

    Returns:
        Updated TicketResponse

    Raises:
        HTTPException: 404 if ticket not found
        HTTPException: 403 if user not authorized (SEC-05)
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.SAPS_LIAISON]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update ticket status"
        )

    # Load ticket
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )

    # SEC-05: GBV tickets only accessible to SAPS_LIAISON and ADMIN
    if ticket.is_sensitive:
        if current_user.role not in [UserRole.SAPS_LIAISON, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access sensitive reports"
            )

    # Store old status for audit
    old_status = ticket.status

    # Update status
    ticket.status = status_update.status

    # Set resolved_at if status is resolved
    if status_update.status == "resolved" and ticket.resolved_at is None:
        ticket.resolved_at = datetime.now(timezone.utc)

    # Set first_responded_at if moving to in_progress
    if status_update.status == "in_progress" and ticket.first_responded_at is None:
        ticket.first_responded_at = datetime.now(timezone.utc)

    ticket.updated_by = current_user.id

    await db.commit()
    await db.refresh(ticket)

    # Dispatch WhatsApp notification (best-effort, non-blocking)
    try:
        # Look up user phone
        user_result = await db.execute(
            select(User).where(User.id == ticket.user_id)
        )
        user = user_result.scalar_one_or_none()

        if user and user.phone:
            from src.tasks.status_notify import send_status_notification

            # Celery async dispatch
            send_status_notification.delay(
                ticket_id=str(ticket.id),
                user_phone=user.phone,
                tracking_number=ticket.tracking_number,
                old_status=old_status,
                new_status=status_update.status,
                language=ticket.language,
            )

            logger.info(
                f"Dispatched WhatsApp notification for status change",
                extra={
                    "ticket_id": str(ticket.id),
                    "old_status": old_status,
                    "new_status": status_update.status,
                }
            )
    except Exception as e:
        logger.warning(f"Failed to dispatch WhatsApp notification: {e}", exc_info=True)
        # Don't fail the request - status update succeeded

    return TicketResponse.model_validate(ticket)


@router.post("/{ticket_id}/assign", response_model=TicketResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def assign_ticket(
    request: Request,
    ticket_id: UUID,
    assign_request: TicketAssignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Assign ticket to team (auto-routing or manual).

    Args:
        ticket_id: Ticket UUID
        assign_request: Assignment request (team_id=None triggers auto-routing)
        current_user: Authenticated user (must be MANAGER or ADMIN)
        db: Database session

    Returns:
        Updated TicketResponse

    Raises:
        HTTPException: 404 if ticket not found
        HTTPException: 403 if user not authorized
        HTTPException: 400 if assignment validation fails
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to assign tickets"
        )

    # Load ticket
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )

    # SEC-05: Validate GBV assignment
    if ticket.is_sensitive and assign_request.team_id:
        # Load team to verify is_saps flag
        from src.models.team import Team

        team_result = await db.execute(
            select(Team).where(Team.id == assign_request.team_id)
        )
        team = team_result.scalar_one_or_none()

        if not team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Team {assign_request.team_id} not found"
            )

        if not team.is_saps:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GBV tickets can only be assigned to SAPS teams"
            )

    assignment_service = AssignmentService()

    # Auto-route or manual assignment
    if assign_request.team_id is None:
        # Auto-route
        assignment = await assignment_service.auto_route_and_assign(ticket, db)

        if assignment is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No team found for ticket {ticket.tracking_number}"
            )
    else:
        # Manual assignment
        assignment = await assignment_service.assign_ticket(
            ticket_id=ticket_id,
            team_id=assign_request.team_id,
            assigned_to=assign_request.assigned_to,
            assigned_by=str(current_user.id),
            reason=assign_request.reason or "manual_assignment",
            db=db
        )

    # Set SLA deadlines if not already set
    if not ticket.sla_response_deadline:
        sla_service = SLAService()
        await sla_service.set_ticket_deadlines(ticket, db)

    # Refresh ticket
    await db.refresh(ticket)

    return TicketResponse.model_validate(ticket)


@router.get("/{ticket_id}/history", response_model=list[dict])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_ticket_history(
    request: Request,
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get ticket assignment and audit history.

    Args:
        ticket_id: Ticket UUID
        current_user: Authenticated user (must be MANAGER, ADMIN, or SAPS_LIAISON)
        db: Database session

    Returns:
        List of history entries (assignments + audit logs)

    Raises:
        HTTPException: 404 if ticket not found
        HTTPException: 403 if user not authorized (SEC-05)
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.SAPS_LIAISON]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view ticket history"
        )

    # Load ticket
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )

    # SEC-05: GBV access control
    if ticket.is_sensitive:
        if current_user.role not in [UserRole.SAPS_LIAISON, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access sensitive reports"
            )

    # Get assignment history
    assignment_service = AssignmentService()
    assignments = await assignment_service.get_assignment_history(ticket_id, db)

    # Get audit log history
    audit_result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.table_name == "tickets",
            AuditLog.record_id == str(ticket_id)
        )
        .order_by(desc(AuditLog.created_at))
    )
    audit_logs = audit_result.scalars().all()

    # Combine history
    history = []

    for assignment in assignments:
        history.append({
            "type": "assignment",
            "timestamp": assignment.created_at,
            "team_id": str(assignment.team_id) if assignment.team_id else None,
            "assigned_to": str(assignment.assigned_to) if assignment.assigned_to else None,
            "assigned_by": assignment.assigned_by,
            "reason": assignment.reason,
            "is_current": assignment.is_current,
        })

    for log in audit_logs:
        history.append({
            "type": "audit",
            "timestamp": log.created_at,
            "operation": log.operation,
            "user_id": log.user_id,
            "changes": log.changes,
        })

    # Sort by timestamp descending
    history.sort(key=lambda x: x["timestamp"], reverse=True)

    return history
