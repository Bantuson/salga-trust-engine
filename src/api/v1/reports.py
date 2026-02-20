"""Report submission API for web portal.

Provides endpoints for citizens to submit reports via web with GPS/address,
attach evidence photos, and track report status. Integrates with IntakeFlow
for AI classification when category not specified.
"""
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db
from src.middleware.rate_limit import REPORT_RATE_LIMIT, SENSITIVE_READ_RATE_LIMIT, limiter
from src.agents.flows.intake_flow import IntakeFlow
from src.agents.flows.state import IntakeState
from src.core.config import settings
from src.guardrails.engine import guardrails_engine
from src.models.media import MediaAttachment
from src.models.ticket import Ticket, generate_tracking_number
from src.models.user import User, UserRole
from src.schemas.report import ReportSubmitRequest, ReportSubmitResponse
from src.schemas.ticket import TicketResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/submit", response_model=ReportSubmitResponse)
@limiter.limit(REPORT_RATE_LIMIT)
async def submit_report(
    request: Request,
    report: ReportSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportSubmitResponse:
    """Submit report via web portal with GPS/address and media attachments.

    Flow:
    1. Validate description through guardrails
    2. If category provided, skip AI classification
    3. If category not provided, run IntakeFlow for AI classification
    4. Create ticket with location data
    5. Link media attachments
    6. If GBV, trigger SAPS notification

    Args:
        request: Report submission request
        current_user: Authenticated user
        db: Database session

    Returns:
        ReportSubmitResponse with ticket_id, tracking_number, category, status

    Raises:
        HTTPException: 400 if input blocked or validation fails
        HTTPException: 404 if media file_ids not found
    """
    # Step 1: Validate input through guardrails
    input_result = await guardrails_engine.process_input(report.description)

    if not input_result.is_safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=input_result.blocked_reason or "Description blocked by safety filters"
        )

    sanitized_description = input_result.sanitized_message

    # Step 2: Determine category
    category = report.category
    severity = "medium"  # Default severity

    if category is None:
        # Run IntakeFlow for AI classification
        try:
            intake_state = IntakeState(
                message_id=str(uuid.uuid4()),
                user_id=str(current_user.id),
                tenant_id=str(current_user.tenant_id),
                session_id=str(uuid.uuid4()),
                message=sanitized_description,
                language=report.language,
            )

            flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
            # Flow.state is a read-only @property backed by flow._state.
            # CrewAI 1.8.1 provides no public setter, so we assign directly.
            flow._state = intake_state

            # Run classification (receive_message -> classify_message)
            flow.receive_message()
            flow.classify_message()

            # Extract classification result
            category = flow.state.subcategory or flow.state.category or "other"

        except Exception as e:
            logger.error(f"AI classification failed: {e}", exc_info=True)
            category = "other"
    else:
        # Validate provided category
        valid_categories = ["water", "roads", "electricity", "waste", "sanitation", "gbv", "other"]
        if category.lower() not in valid_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category '{category}'. Must be one of: {', '.join(valid_categories)}"
            )
        category = category.lower()

    # Override category if is_gbv flag is set
    if report.is_gbv:
        category = "gbv"

    # Step 3: Extract location data
    latitude = None
    longitude = None
    address = report.manual_address

    if report.location:
        latitude = report.location.latitude
        longitude = report.location.longitude
        # In production, would reverse-geocode to get address
        # For now, use manual_address if provided, else leave None
        if not address:
            address = f"{latitude}, {longitude}"

    # Step 4: Create ticket
    tracking_number = generate_tracking_number()

    # Handle GBV encryption
    ticket_description = sanitized_description
    encrypted_description = None

    if category == "gbv" or report.is_gbv:
        # Encrypt actual description and use placeholder for public field
        encrypted_description = sanitized_description
        ticket_description = "GBV incident report"

    ticket = Ticket(
        tracking_number=tracking_number,
        category=category,
        description=ticket_description,
        encrypted_description=encrypted_description,
        latitude=latitude,
        longitude=longitude,
        address=address,
        severity=severity,
        status="open",
        language=report.language,
        user_id=current_user.id,
        is_sensitive=(category == "gbv" or report.is_gbv),
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    # Step 5: Link media attachments
    media_count = 0
    if report.media_file_ids:
        # Look up MediaAttachment records by file_id
        result = await db.execute(
            select(MediaAttachment).where(
                MediaAttachment.file_id.in_(report.media_file_ids),
                MediaAttachment.tenant_id == current_user.tenant_id
            )
        )
        media_attachments = result.scalars().all()

        # Verify all file_ids were found
        found_file_ids = {m.file_id for m in media_attachments}
        missing_file_ids = set(report.media_file_ids) - found_file_ids

        if missing_file_ids:
            # Clean up ticket (rollback)
            await db.delete(ticket)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media files not found: {', '.join(missing_file_ids)}"
            )

        # Link media to ticket
        for media in media_attachments:
            media.ticket_id = ticket.id
            media_count += 1

        await db.commit()

    # Step 6: If GBV, trigger SAPS notification
    if category == "gbv" or report.is_gbv:
        try:
            # Import here to avoid circular dependency
            from src.agents.tools.saps_tool import notify_saps

            # Call SAPS notification (logs internally in v1)
            notify_saps(
                ticket_id=str(ticket.id),
                incident_type="GBV Report",
                location=address or f"{latitude}, {longitude}",
                danger_level="high"
            )
        except Exception as e:
            logger.error(f"SAPS notification failed: {e}", exc_info=True)
            # Don't fail the request - ticket is created

    # Step 7: Return response
    message = f"Your report has been received. Tracking number: {tracking_number}"

    return ReportSubmitResponse(
        ticket_id=str(ticket.id),
        tracking_number=tracking_number,
        category=category,
        status=ticket.status,
        message=message,
        media_count=media_count,
    )


@router.get("/{tracking_number}", response_model=TicketResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_report_by_tracking(
    request: Request,
    tracking_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Get report details by tracking number.

    Args:
        tracking_number: Ticket tracking number
        current_user: Authenticated user
        db: Database session

    Returns:
        TicketResponse with report details

    Raises:
        HTTPException: 404 if ticket not found
        HTTPException: 403 if user not authorized to view ticket
    """
    # Look up ticket
    result = await db.execute(
        select(Ticket).where(Ticket.tracking_number == tracking_number)
    )
    ticket = result.scalar_one_or_none()

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {tracking_number} not found"
        )

    # Verify authorization (user owns ticket OR is manager/admin)
    if ticket.user_id != current_user.id and current_user.role not in [UserRole.MANAGER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this report"
        )

    # For GBV tickets, only show encrypted_description to SAPS_LIAISON
    ticket_response = TicketResponse.model_validate(ticket)

    # If sensitive and user is not SAPS liaison, mask description
    if ticket.is_sensitive and current_user.role != UserRole.SAPS_LIAISON:
        # Use the public placeholder description
        ticket_response.description = ticket.description  # Already "[Sensitive Report]" or "GBV incident report"

    return ticket_response


@router.get("/my", response_model=list[TicketResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_my_reports(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
) -> list[TicketResponse]:
    """Get current user's reports (paginated).

    Args:
        current_user: Authenticated user
        db: Database session
        limit: Maximum number of results (default 50)
        offset: Offset for pagination (default 0)

    Returns:
        List of TicketResponse objects for user's tickets
    """
    # Query user's tickets, ordered by most recent first
    result = await db.execute(
        select(Ticket)
        .where(Ticket.user_id == current_user.id)
        .order_by(desc(Ticket.created_at))
        .limit(limit)
        .offset(offset)
    )
    tickets = result.scalars().all()

    # Convert to response objects
    ticket_responses = []
    for ticket in tickets:
        ticket_response = TicketResponse.model_validate(ticket)

        # For GBV tickets, show "[Sensitive Report]" instead of description
        if ticket.is_sensitive and current_user.role != UserRole.SAPS_LIAISON:
            ticket_response.description = "[Sensitive Report]"

        ticket_responses.append(ticket_response)

    return ticket_responses
