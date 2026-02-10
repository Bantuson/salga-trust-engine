"""Dashboard metrics calculation service.

Provides aggregated metrics for municipal operations dashboard:
- Overall ticket metrics (open/resolved counts, SLA compliance)
- Volume by category
- SLA compliance breakdown
- Team workload distribution

All queries exclude GBV/sensitive tickets (SEC-05 compliance).
Ward councillors receive ward-filtered metrics only.
"""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.team import Team
from src.models.ticket import Ticket


class DashboardService:
    """Dashboard metrics calculation service.

    All queries exclude GBV/sensitive tickets (SEC-05 compliance).
    Ward councillors receive ward-filtered metrics only.
    """

    async def get_metrics(
        self, municipality_id: UUID, db: AsyncSession, ward_id: str | None = None
    ) -> dict:
        """Get aggregated dashboard metrics.

        Args:
            municipality_id: Municipality (tenant) ID
            db: Database session
            ward_id: Optional ward filter (interim: address ILIKE match)

        Returns:
            dict with keys:
            - total_open: int (tickets with status open/in_progress/escalated)
            - total_resolved: int (resolved + closed)
            - sla_compliance_percent: float (% tickets within SLA deadline)
            - avg_response_hours: float (average first_responded_at - created_at)
            - sla_breaches: int (tickets past sla_resolution_deadline)
        """
        # Base query: non-sensitive tickets only (SEC-05)
        base_conditions = [
            Ticket.tenant_id == municipality_id,
            Ticket.is_sensitive == False,
        ]

        # Ward filtering (interim: address ILIKE)
        if ward_id:
            base_conditions.append(Ticket.address.ilike(f"%{ward_id}%"))

        # Total open tickets (open/in_progress/escalated)
        open_statuses = ["open", "in_progress", "escalated"]
        open_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.status.in_(open_statuses)
                )
            )
        )
        total_open = open_result.scalar() or 0

        # Total resolved tickets (resolved/closed)
        resolved_statuses = ["resolved", "closed"]
        resolved_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.status.in_(resolved_statuses)
                )
            )
        )
        total_resolved = resolved_result.scalar() or 0

        # Average response time (hours)
        avg_response_result = await db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        Ticket.first_responded_at - Ticket.created_at
                    ) / 3600
                )
            ).where(
                and_(
                    *base_conditions,
                    Ticket.first_responded_at.isnot(None)
                )
            )
        )
        avg_response_hours = avg_response_result.scalar() or 0.0

        # SLA breaches (tickets past resolution deadline and not resolved)
        now = datetime.now(timezone.utc)
        breach_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.sla_resolution_deadline.isnot(None),
                    Ticket.sla_resolution_deadline < now,
                    Ticket.status.in_(open_statuses)
                )
            )
        )
        sla_breaches = breach_result.scalar() or 0

        # SLA compliance (tickets resolved within deadline)
        total_with_sla_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.sla_resolution_deadline.isnot(None)
                )
            )
        )
        total_with_sla = total_with_sla_result.scalar() or 0

        compliant_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.sla_resolution_deadline.isnot(None),
                    or_(
                        # Resolved before deadline
                        and_(
                            Ticket.status.in_(resolved_statuses),
                            Ticket.resolved_at <= Ticket.sla_resolution_deadline
                        ),
                        # Open but still within deadline
                        and_(
                            Ticket.status.in_(open_statuses),
                            Ticket.sla_resolution_deadline >= now
                        )
                    )
                )
            )
        )
        compliant = compliant_result.scalar() or 0

        sla_compliance_percent = (
            (compliant / total_with_sla * 100) if total_with_sla > 0 else 0.0
        )

        return {
            "total_open": total_open,
            "total_resolved": total_resolved,
            "sla_compliance_percent": round(sla_compliance_percent, 2),
            "avg_response_hours": round(avg_response_hours, 2),
            "sla_breaches": sla_breaches,
        }

    async def get_volume_by_category(
        self, municipality_id: UUID, db: AsyncSession, ward_id: str | None = None
    ) -> list[dict]:
        """Get ticket counts grouped by category.

        Args:
            municipality_id: Municipality (tenant) ID
            db: Database session
            ward_id: Optional ward filter

        Returns:
            list of: {"category": str, "open": int, "resolved": int}
            Excludes GBV category (SEC-05).
        """
        base_conditions = [
            Ticket.tenant_id == municipality_id,
            Ticket.is_sensitive == False,
            Ticket.category != "gbv",  # Exclude GBV category
        ]

        if ward_id:
            base_conditions.append(Ticket.address.ilike(f"%{ward_id}%"))

        # Group by category with open/resolved counts
        open_statuses = ["open", "in_progress", "escalated"]
        resolved_statuses = ["resolved", "closed"]

        result = await db.execute(
            select(
                Ticket.category,
                func.count(
                    case((Ticket.status.in_(open_statuses), 1))
                ).label("open_count"),
                func.count(
                    case((Ticket.status.in_(resolved_statuses), 1))
                ).label("resolved_count"),
            )
            .where(and_(*base_conditions))
            .group_by(Ticket.category)
        )

        rows = result.all()
        return [
            {
                "category": row.category,
                "open": row.open_count or 0,
                "resolved": row.resolved_count or 0,
            }
            for row in rows
        ]

    async def get_sla_compliance(
        self, municipality_id: UUID, db: AsyncSession, ward_id: str | None = None
    ) -> dict:
        """Get SLA compliance breakdown.

        Args:
            municipality_id: Municipality (tenant) ID
            db: Database session
            ward_id: Optional ward filter

        Returns:
            {
                "response_compliance_percent": float,
                "resolution_compliance_percent": float,
                "total_with_sla": int,
                "response_breaches": int,
                "resolution_breaches": int
            }
        """
        base_conditions = [
            Ticket.tenant_id == municipality_id,
            Ticket.is_sensitive == False,
        ]

        if ward_id:
            base_conditions.append(Ticket.address.ilike(f"%{ward_id}%"))

        now = datetime.now(timezone.utc)

        # Total tickets with SLA deadlines
        total_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.sla_response_deadline.isnot(None)
                )
            )
        )
        total_with_sla = total_result.scalar() or 0

        # Response breaches (open tickets past response deadline)
        response_breach_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.sla_response_deadline.isnot(None),
                    Ticket.sla_response_deadline < now,
                    Ticket.status == "open",
                    Ticket.first_responded_at.is_(None)
                )
            )
        )
        response_breaches = response_breach_result.scalar() or 0

        # Resolution breaches (open/in_progress tickets past resolution deadline)
        resolution_breach_result = await db.execute(
            select(func.count(Ticket.id)).where(
                and_(
                    *base_conditions,
                    Ticket.sla_resolution_deadline.isnot(None),
                    Ticket.sla_resolution_deadline < now,
                    Ticket.status.in_(["open", "in_progress", "escalated"])
                )
            )
        )
        resolution_breaches = resolution_breach_result.scalar() or 0

        # Calculate compliance percentages
        response_compliance_percent = (
            ((total_with_sla - response_breaches) / total_with_sla * 100)
            if total_with_sla > 0
            else 0.0
        )

        resolution_compliance_percent = (
            ((total_with_sla - resolution_breaches) / total_with_sla * 100)
            if total_with_sla > 0
            else 0.0
        )

        return {
            "response_compliance_percent": round(response_compliance_percent, 2),
            "resolution_compliance_percent": round(resolution_compliance_percent, 2),
            "total_with_sla": total_with_sla,
            "response_breaches": response_breaches,
            "resolution_breaches": resolution_breaches,
        }

    async def get_team_workload(
        self, municipality_id: UUID, db: AsyncSession, ward_id: str | None = None
    ) -> list[dict]:
        """Get ticket counts per team.

        Args:
            municipality_id: Municipality (tenant) ID
            db: Database session
            ward_id: Optional ward filter

        Returns:
            list of: {"team_id": str, "team_name": str, "open_count": int, "total_count": int}
            Excludes SAPS teams (SEC-05).
        """
        base_conditions = [
            Ticket.tenant_id == municipality_id,
            Ticket.is_sensitive == False,
            Team.is_saps == False,  # Exclude SAPS teams
        ]

        if ward_id:
            base_conditions.append(Ticket.address.ilike(f"%{ward_id}%"))

        # Join Ticket with Team and group by team
        open_statuses = ["open", "in_progress", "escalated"]

        result = await db.execute(
            select(
                Team.id.label("team_id"),
                Team.name.label("team_name"),
                func.count(
                    case((Ticket.status.in_(open_statuses), 1))
                ).label("open_count"),
                func.count(Ticket.id).label("total_count"),
            )
            .join(Team, Ticket.assigned_team_id == Team.id)
            .where(and_(*base_conditions))
            .group_by(Team.id, Team.name)
        )

        rows = result.all()
        return [
            {
                "team_id": str(row.team_id),
                "team_name": row.team_name,
                "open_count": row.open_count or 0,
                "total_count": row.total_count or 0,
            }
            for row in rows
        ]
