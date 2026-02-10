"""Escalation service for ticket escalation to higher authority.

Handles automatic escalation of tickets that have breached SLA deadlines.
Uses PostgreSQL advisory locks for distributed coordination to prevent
duplicate escalations in multi-worker environments.

Key decisions:
- Advisory lock prevents race conditions with multiple Celery workers
- Escalation changes status to ESCALATED and assigns to team manager
- Creates TicketAssignment record for audit trail
- Lock is transaction-scoped (pg_try_advisory_xact_lock)
"""
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.assignment import TicketAssignment
from src.models.team import Team
from src.models.ticket import Ticket, TicketStatus

logger = logging.getLogger(__name__)


class EscalationService:
    """Service for escalating tickets to higher authority.

    Provides methods to:
    - Escalate single ticket with advisory lock protection
    - Bulk escalate multiple breached tickets
    - Assign ticket to team manager on escalation
    """

    async def escalate_ticket(
        self,
        ticket_id: UUID,
        reason: str,
        db: AsyncSession
    ) -> bool:
        """Escalate a ticket to higher authority (team manager).

        Uses PostgreSQL advisory lock to prevent duplicate escalation
        in multi-worker environments. Lock is transaction-scoped and
        automatically released on commit/rollback.

        Steps:
        1. Acquire advisory lock for this ticket_id
        2. Verify ticket not already escalated
        3. Set status to ESCALATED
        4. Find team manager and assign ticket
        5. Create TicketAssignment record for audit trail

        Args:
            ticket_id: UUID of ticket to escalate
            reason: Escalation reason (e.g., "response_breach", "resolution_breach")
            db: Database session

        Returns:
            True if escalated successfully, False if lock not acquired or already escalated
        """
        # Generate lock key from ticket_id
        # Use hash to convert UUID to integer, then mod to fit in 32-bit signed int
        lock_key = hash(str(ticket_id)) % (2 ** 31)

        # Try to acquire advisory lock
        # pg_try_advisory_xact_lock is transaction-scoped (released on commit/rollback)
        result = await db.execute(
            text("SELECT pg_try_advisory_xact_lock(:lock_key)"),
            {"lock_key": lock_key}
        )
        lock_acquired = result.scalar()

        if not lock_acquired:
            logger.info(
                f"Could not acquire lock for ticket escalation (another worker processing)",
                extra={"ticket_id": str(ticket_id)}
            )
            return False

        # Load ticket
        stmt = select(Ticket).where(Ticket.id == ticket_id)
        result = await db.execute(stmt)
        ticket = result.scalar_one_or_none()

        if not ticket:
            logger.error(
                f"Ticket not found for escalation",
                extra={"ticket_id": str(ticket_id)}
            )
            return False

        # Check if already escalated
        if ticket.status == TicketStatus.ESCALATED:
            logger.info(
                f"Ticket already escalated, skipping",
                extra={
                    "ticket_id": str(ticket_id),
                    "tracking_number": ticket.tracking_number,
                }
            )
            return False

        # Update ticket status
        ticket.status = TicketStatus.ESCALATED
        ticket.escalated_at = datetime.utcnow()
        ticket.escalation_reason = reason

        # Find team manager
        manager_id = None
        if ticket.assigned_team_id:
            team_stmt = select(Team).where(Team.id == ticket.assigned_team_id)
            team_result = await db.execute(team_stmt)
            team = team_result.scalar_one_or_none()

            if team and team.manager_id:
                manager_id = team.manager_id
                ticket.assigned_to = manager_id

                logger.info(
                    f"Assigning escalated ticket to team manager",
                    extra={
                        "ticket_id": str(ticket_id),
                        "team_id": str(team.id),
                        "manager_id": str(manager_id),
                    }
                )
            else:
                logger.warning(
                    f"Team has no manager for escalation assignment",
                    extra={
                        "ticket_id": str(ticket_id),
                        "team_id": str(ticket.assigned_team_id) if ticket.assigned_team_id else None,
                    }
                )
        else:
            logger.warning(
                f"Ticket has no assigned team for escalation",
                extra={"ticket_id": str(ticket_id)}
            )

        # Deactivate previous assignment
        if ticket.assigned_team_id:
            stmt = select(TicketAssignment).where(
                TicketAssignment.ticket_id == ticket_id,
                TicketAssignment.is_current == True
            )
            result = await db.execute(stmt)
            previous_assignments = result.scalars().all()

            for assignment in previous_assignments:
                assignment.is_current = False

        # Create new assignment record
        new_assignment = TicketAssignment(
            ticket_id=ticket_id,
            team_id=ticket.assigned_team_id,
            assigned_to=manager_id,
            assigned_by="system",
            reason="escalation",
            is_current=True,
            tenant_id=ticket.tenant_id,
            created_by=str(ticket.user_id),  # System action on behalf of user
            updated_by=str(ticket.user_id),
        )
        db.add(new_assignment)

        # Commit changes
        await db.commit()

        logger.info(
            f"Ticket escalated successfully",
            extra={
                "ticket_id": str(ticket_id),
                "tracking_number": ticket.tracking_number,
                "reason": reason,
                "manager_id": str(manager_id) if manager_id else None,
            }
        )

        return True

    async def bulk_escalate(
        self,
        breached_tickets: list[dict],
        db: AsyncSession
    ) -> int:
        """Escalate multiple breached tickets in bulk.

        Iterates over breached tickets from SLAService.find_breached_tickets()
        and calls escalate_ticket for each. Logs summary at the end.

        Args:
            breached_tickets: List of dicts from SLAService.find_breached_tickets()
                Each dict has keys: ticket_id, ticket, breach_type, overdue_by_hours
            db: Database session

        Returns:
            Count of successfully escalated tickets
        """
        if not breached_tickets:
            logger.info("No breached tickets to escalate")
            return 0

        escalated_count = 0
        failed_count = 0

        for breach in breached_tickets:
            ticket_id = breach["ticket_id"]
            breach_type = breach["breach_type"]
            overdue_hours = breach["overdue_by_hours"]

            # Build escalation reason
            reason = f"{breach_type} (overdue by {round(overdue_hours, 1)}h)"

            try:
                success = await self.escalate_ticket(ticket_id, reason, db)
                if success:
                    escalated_count += 1
                else:
                    # Lock not acquired or already escalated
                    failed_count += 1

            except Exception as e:
                logger.error(
                    f"Failed to escalate ticket",
                    exc_info=True,
                    extra={
                        "ticket_id": str(ticket_id),
                        "breach_type": breach_type,
                        "error": str(e),
                    }
                )
                failed_count += 1

        logger.info(
            f"Bulk escalation complete",
            extra={
                "total": len(breached_tickets),
                "escalated": escalated_count,
                "failed": failed_count,
            }
        )

        return escalated_count
