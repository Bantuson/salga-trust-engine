"""SLA service for tracking service level agreements and breach detection.

Calculates SLA deadlines based on municipality-specific SLA configurations and
detects breached tickets that require escalation. GBV tickets (is_sensitive=True)
are excluded from SLA monitoring per SAPS handling protocols.

Key decisions:
- Response deadline = created_at + response_hours (status must be changed from OPEN)
- Resolution deadline = created_at + resolution_hours (ticket must be RESOLVED)
- GBV tickets excluded from all SLA checks (handled internally by SAPS)
- System defaults: 24h response, 168h (7 days) resolution
- In-memory cache for SLA configs during task execution (performance optimization)
"""
import logging
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.sla_config import SLAConfig
from src.models.ticket import Ticket, TicketStatus

logger = logging.getLogger(__name__)


class SLAService:
    """Service for SLA deadline calculation and breach detection.

    Provides methods to:
    - Calculate response/resolution deadlines based on SLAConfig
    - Find tickets that have breached their SLA deadlines
    - Find tickets approaching SLA breach (warning threshold)
    """

    def __init__(self):
        """Initialize SLA service with in-memory cache."""
        self._sla_cache: dict[tuple[UUID, str], SLAConfig | None] = {}

    async def get_sla_config(
        self,
        municipality_id: UUID,
        category: str,
        db: AsyncSession
    ) -> SLAConfig | None:
        """Get SLA configuration for municipality and category.

        Lookup order:
        1. Exact match: municipality_id + category + is_active
        2. Default match: municipality_id + NULL category + is_active
        3. Return None (use system defaults)

        Results are cached in-memory for the duration of the task run.

        Args:
            municipality_id: Municipality UUID
            category: Ticket category (water, roads, etc.)
            db: Database session

        Returns:
            SLAConfig if found, None otherwise
        """
        # Check cache first
        cache_key = (municipality_id, category)
        if cache_key in self._sla_cache:
            return self._sla_cache[cache_key]

        # Try exact match (municipality + category)
        stmt = select(SLAConfig).where(
            SLAConfig.municipality_id == municipality_id,
            SLAConfig.category == category,
            SLAConfig.is_active == True
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        if config:
            self._sla_cache[cache_key] = config
            return config

        # Try default match (municipality + NULL category)
        stmt = select(SLAConfig).where(
            SLAConfig.municipality_id == municipality_id,
            SLAConfig.category == None,
            SLAConfig.is_active == True
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        self._sla_cache[cache_key] = config
        return config

    async def calculate_deadlines(
        self,
        ticket: Ticket,
        db: AsyncSession
    ) -> tuple[datetime, datetime]:
        """Calculate response and resolution deadlines for a ticket.

        Looks up SLAConfig for the ticket's municipality and category.
        Falls back to system defaults if no config found:
        - response_hours: 24
        - resolution_hours: 168 (7 days)

        Args:
            ticket: Ticket model instance
            db: Database session

        Returns:
            Tuple of (response_deadline, resolution_deadline)
        """
        # Default SLA hours
        response_hours = 24
        resolution_hours = 168

        # Try to get municipality-specific SLA config
        # Note: ticket.tenant_id maps to municipality in our multi-tenant architecture
        config = await self.get_sla_config(
            municipality_id=ticket.tenant_id,
            category=ticket.category,
            db=db
        )

        if config:
            response_hours = config.response_hours
            resolution_hours = config.resolution_hours
            logger.debug(
                f"Using SLA config for ticket {ticket.tracking_number}",
                extra={
                    "municipality_id": str(ticket.tenant_id),
                    "category": ticket.category,
                    "response_hours": response_hours,
                    "resolution_hours": resolution_hours,
                }
            )
        else:
            logger.debug(
                f"Using system default SLA for ticket {ticket.tracking_number}",
                extra={
                    "municipality_id": str(ticket.tenant_id),
                    "category": ticket.category,
                    "response_hours": response_hours,
                    "resolution_hours": resolution_hours,
                }
            )

        # Calculate deadlines from ticket creation time
        response_deadline = ticket.created_at + timedelta(hours=response_hours)
        resolution_deadline = ticket.created_at + timedelta(hours=resolution_hours)

        return (response_deadline, resolution_deadline)

    async def set_ticket_deadlines(
        self,
        ticket: Ticket,
        db: AsyncSession
    ) -> None:
        """Set SLA deadlines on a ticket.

        Calculates and sets sla_response_deadline and sla_resolution_deadline.
        Skips GBV tickets (is_sensitive=True) as they are handled by SAPS.

        Args:
            ticket: Ticket model instance
            db: Database session
        """
        # Skip GBV tickets - they are handled by SAPS with their own protocols
        if ticket.is_sensitive:
            logger.debug(
                f"Skipping SLA deadline setting for sensitive ticket {ticket.tracking_number}"
            )
            return

        response_deadline, resolution_deadline = await self.calculate_deadlines(
            ticket, db
        )

        ticket.sla_response_deadline = response_deadline
        ticket.sla_resolution_deadline = resolution_deadline

        await db.commit()

        logger.info(
            f"Set SLA deadlines for ticket {ticket.tracking_number}",
            extra={
                "ticket_id": str(ticket.id),
                "response_deadline": response_deadline.isoformat(),
                "resolution_deadline": resolution_deadline.isoformat(),
            }
        )

    async def find_breached_tickets(self, db: AsyncSession) -> list[dict]:
        """Find tickets that have breached their SLA deadlines.

        A ticket is breached if:
        - Response breach: status='open' AND now > sla_response_deadline
        - Resolution breach: status IN ('open','in_progress') AND now > sla_resolution_deadline

        GBV tickets (is_sensitive=True) are excluded.

        Args:
            db: Database session

        Returns:
            List of dicts with keys:
            - ticket_id: UUID
            - ticket: Ticket model instance
            - breach_type: "response_breach" or "resolution_breach"
            - overdue_by_hours: float
        """
        now = datetime.utcnow()

        # Query for breached tickets
        # Exclude GBV tickets (is_sensitive=True) and tickets without SLA deadlines
        stmt = select(Ticket).where(
            Ticket.is_sensitive == False,
            Ticket.sla_response_deadline != None,
            Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS]),
        )

        result = await db.execute(stmt)
        tickets = result.scalars().all()

        breached = []

        for ticket in tickets:
            # Check response breach (only for OPEN tickets)
            if (ticket.status == TicketStatus.OPEN and
                ticket.sla_response_deadline and
                now > ticket.sla_response_deadline):

                overdue_delta = now - ticket.sla_response_deadline
                overdue_hours = overdue_delta.total_seconds() / 3600

                breached.append({
                    "ticket_id": ticket.id,
                    "ticket": ticket,
                    "breach_type": "response_breach",
                    "overdue_by_hours": overdue_hours,
                })

                logger.warning(
                    f"Response SLA breach detected",
                    extra={
                        "ticket_id": str(ticket.id),
                        "tracking_number": ticket.tracking_number,
                        "deadline": ticket.sla_response_deadline.isoformat(),
                        "overdue_hours": round(overdue_hours, 2),
                    }
                )

            # Check resolution breach (for OPEN or IN_PROGRESS tickets)
            elif (ticket.status in [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] and
                  ticket.sla_resolution_deadline and
                  now > ticket.sla_resolution_deadline):

                overdue_delta = now - ticket.sla_resolution_deadline
                overdue_hours = overdue_delta.total_seconds() / 3600

                breached.append({
                    "ticket_id": ticket.id,
                    "ticket": ticket,
                    "breach_type": "resolution_breach",
                    "overdue_by_hours": overdue_hours,
                })

                logger.warning(
                    f"Resolution SLA breach detected",
                    extra={
                        "ticket_id": str(ticket.id),
                        "tracking_number": ticket.tracking_number,
                        "deadline": ticket.sla_resolution_deadline.isoformat(),
                        "overdue_hours": round(overdue_hours, 2),
                    }
                )

        logger.info(
            f"SLA breach check complete",
            extra={
                "total_tickets_checked": len(tickets),
                "breached_count": len(breached),
            }
        )

        return breached

    async def find_warning_tickets(self, db: AsyncSession) -> list[dict]:
        """Find tickets approaching SLA breach (within warning threshold).

        Calculates elapsed percentage for each ticket:
        elapsed_pct = (now - created_at) / (deadline - created_at) * 100

        Returns tickets where elapsed_pct >= warning_threshold_pct AND not yet breached.
        Used for early warning notifications to team leads.

        Args:
            db: Database session

        Returns:
            List of dicts with keys:
            - ticket_id: UUID
            - ticket: Ticket model instance
            - warning_type: "response_warning" or "resolution_warning"
            - elapsed_pct: float (0-100)
        """
        now = datetime.utcnow()

        # Query for active tickets with SLA deadlines
        stmt = select(Ticket).where(
            Ticket.is_sensitive == False,
            Ticket.sla_response_deadline != None,
            Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS]),
        )

        result = await db.execute(stmt)
        tickets = result.scalars().all()

        warnings = []

        for ticket in tickets:
            # Get municipality's warning threshold (default 80%)
            config = await self.get_sla_config(
                municipality_id=ticket.tenant_id,
                category=ticket.category,
                db=db
            )
            threshold_pct = config.warning_threshold_pct if config else 80

            # Check response warning (only for OPEN tickets)
            if (ticket.status == TicketStatus.OPEN and
                ticket.sla_response_deadline and
                now < ticket.sla_response_deadline):

                total_time = (ticket.sla_response_deadline - ticket.created_at).total_seconds()
                elapsed_time = (now - ticket.created_at).total_seconds()
                elapsed_pct = (elapsed_time / total_time) * 100 if total_time > 0 else 0

                if elapsed_pct >= threshold_pct:
                    warnings.append({
                        "ticket_id": ticket.id,
                        "ticket": ticket,
                        "warning_type": "response_warning",
                        "elapsed_pct": elapsed_pct,
                    })

            # Check resolution warning (for OPEN or IN_PROGRESS tickets)
            elif (ticket.status in [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] and
                  ticket.sla_resolution_deadline and
                  now < ticket.sla_resolution_deadline):

                total_time = (ticket.sla_resolution_deadline - ticket.created_at).total_seconds()
                elapsed_time = (now - ticket.created_at).total_seconds()
                elapsed_pct = (elapsed_time / total_time) * 100 if total_time > 0 else 0

                if elapsed_pct >= threshold_pct:
                    warnings.append({
                        "ticket_id": ticket.id,
                        "ticket": ticket,
                        "warning_type": "resolution_warning",
                        "elapsed_pct": elapsed_pct,
                    })

        logger.info(
            f"SLA warning check complete",
            extra={
                "total_tickets_checked": len(tickets),
                "warning_count": len(warnings),
            }
        )

        return warnings
