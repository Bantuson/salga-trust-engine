"""Ticket assignment service with history tracking.

Records ticket-to-team and ticket-to-user assignments with full history.
Deactivates previous assignments when creating new ones (is_current flag).
Enforces GBV-to-SAPS security constraint on reassignment.

Key decisions:
- is_current flag ensures only one active assignment per ticket
- assigned_by can be "system" (auto-routing) or user_id (manual)
- first_responded_at tracking for SLA compliance (TKT-05)
- Full assignment history maintained for audit trail
- GBV reassignment guard: MUST validate new team is SAPS
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.assignment import TicketAssignment
from src.models.team import Team
from src.models.ticket import Ticket
from src.services.routing_service import RoutingService

logger = logging.getLogger(__name__)


class AssignmentService:
    """Ticket assignment service with history tracking.

    Creates and manages ticket assignments to teams and users.
    Tracks full assignment history for audit trail.
    """

    async def assign_ticket(
        self,
        ticket_id: UUID,
        team_id: UUID | None,
        assigned_to: UUID | None,
        assigned_by: str,
        reason: str,
        db: AsyncSession
    ) -> TicketAssignment:
        """Assign ticket to team and/or user.

        Deactivates previous active assignments, creates new assignment record,
        updates ticket fields, and tracks first response time for SLA.

        Args:
            ticket_id: Ticket to assign
            team_id: Team to assign to (nullable)
            assigned_to: User to assign to (nullable)
            assigned_by: User ID or "system" for auto-routing
            reason: Assignment reason (e.g., "geospatial_routing", "manual_override")
            db: Database session

        Returns:
            New TicketAssignment record

        Raises:
            ValueError: If ticket not found
        """
        # Load ticket
        ticket_result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = ticket_result.scalar_one_or_none()

        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        # Deactivate previous active assignments
        await db.execute(
            update(TicketAssignment)
            .where(
                TicketAssignment.ticket_id == ticket_id,
                TicketAssignment.is_current == True
            )
            .values(is_current=False)
        )

        logger.debug(f"Deactivated previous assignments for ticket {ticket.tracking_number}")

        # Create new assignment
        assignment = TicketAssignment(
            ticket_id=ticket_id,
            team_id=team_id,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            reason=reason,
            is_current=True,
            tenant_id=ticket.tenant_id
        )
        db.add(assignment)

        # Update ticket
        ticket.assigned_team_id = team_id
        ticket.assigned_to = assigned_to

        # If assigned to a user and ticket is open, move to in_progress
        # and track first response time (SLA tracking)
        if assigned_to is not None and ticket.status == "open":
            ticket.status = "in_progress"
            if ticket.first_responded_at is None:
                ticket.first_responded_at = datetime.now(timezone.utc)
                logger.info(
                    f"First response recorded for ticket {ticket.tracking_number} "
                    f"at {ticket.first_responded_at}"
                )

        await db.commit()
        await db.refresh(assignment)

        logger.info(
            f"Ticket {ticket.tracking_number} assigned to "
            f"team={team_id}, user={assigned_to} by {assigned_by} "
            f"(reason={reason})"
        )

        return assignment

    async def auto_route_and_assign(
        self, ticket: Ticket, db: AsyncSession
    ) -> TicketAssignment | None:
        """Auto-route ticket and create assignment.

        Convenience method combining RoutingService + assignment.
        Used by background tasks and API endpoints for automatic routing.

        Args:
            ticket: Ticket to route and assign
            db: Database session

        Returns:
            TicketAssignment if team found, None otherwise
        """
        routing_service = RoutingService()
        team = await routing_service.route_ticket(ticket, db)

        if team is None:
            logger.warning(
                f"No team found for ticket {ticket.tracking_number} "
                f"(category={ticket.category}, tenant={ticket.tenant_id}) - "
                f"ticket remains unassigned for manual routing"
            )
            return None

        # Assign ticket to the routed team
        assignment = await self.assign_ticket(
            ticket_id=ticket.id,
            team_id=team.id,
            assigned_to=None,  # Team-level assignment only (no specific user yet)
            assigned_by="system",
            reason="geospatial_routing",
            db=db
        )

        logger.info(
            f"Auto-routed ticket {ticket.tracking_number} to team {team.name}"
        )

        return assignment

    async def reassign_ticket(
        self,
        ticket_id: UUID,
        new_team_id: UUID,
        assigned_by: str,
        reason: str,
        db: AsyncSession
    ) -> TicketAssignment:
        """Reassign ticket to a different team.

        GBV GUARD: Validates that GBV tickets can only be reassigned to SAPS teams.
        This prevents accidental or malicious routing of sensitive tickets to
        municipal teams.

        Args:
            ticket_id: Ticket to reassign
            new_team_id: New team to assign to
            assigned_by: User performing the reassignment
            reason: Reassignment reason (e.g., "manual_override", "escalation")
            db: Database session

        Returns:
            New TicketAssignment record

        Raises:
            ValueError: If ticket/team not found or GBV reassignment constraint violated
        """
        # Load ticket
        ticket_result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = ticket_result.scalar_one_or_none()

        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        # Load new team
        team_result = await db.execute(select(Team).where(Team.id == new_team_id))
        new_team = team_result.scalar_one_or_none()

        if not new_team:
            raise ValueError(f"Team {new_team_id} not found")

        # GBV GUARD: If ticket is sensitive, new team MUST be SAPS
        if ticket.is_sensitive:
            if not new_team.is_saps:
                raise ValueError(
                    "GBV tickets can only be assigned to SAPS teams. "
                    f"Team '{new_team.name}' is not a SAPS team."
                )
            logger.info(
                f"GBV reassignment guard passed: ticket {ticket.tracking_number} -> "
                f"SAPS team {new_team.name}"
            )

        # Call assign_ticket to handle deactivation and assignment
        assignment = await self.assign_ticket(
            ticket_id=ticket_id,
            team_id=new_team_id,
            assigned_to=None,  # Reassignment at team level only
            assigned_by=assigned_by,
            reason=reason,
            db=db
        )

        logger.info(
            f"Reassigned ticket {ticket.tracking_number} to team {new_team.name} "
            f"by {assigned_by} (reason={reason})"
        )

        return assignment

    async def get_assignment_history(
        self, ticket_id: UUID, db: AsyncSession
    ) -> list[TicketAssignment]:
        """Get full assignment history for a ticket.

        Returns all TicketAssignment records ordered by creation time (most recent first).
        Used for audit trail (TKT-05 requirement).

        Args:
            ticket_id: Ticket to get history for
            db: Database session

        Returns:
            List of TicketAssignment records (may be empty)
        """
        query = (
            select(TicketAssignment)
            .where(TicketAssignment.ticket_id == ticket_id)
            .order_by(TicketAssignment.created_at.desc())
        )

        result = await db.execute(query)
        assignments = result.scalars().all()

        logger.debug(
            f"Retrieved {len(assignments)} assignment records for ticket {ticket_id}"
        )

        return list(assignments)
