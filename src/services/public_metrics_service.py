"""Public metrics aggregation service for transparency dashboard.

Provides cross-tenant public metrics with mandatory GBV firewall:
- Active municipalities list (basic info only, no contact details)
- Average response times per municipality (TRNS-01)
- Resolution rates with monthly trends (TRNS-02)
- Geographic heatmap data with k-anonymity (TRNS-03)
- System-wide summary with sensitive ticket count at system level only

ALL queries filter is_sensitive == False to exclude GBV/sensitive tickets (TRNS-05, SEC-05).
Heatmap data uses PostGIS ST_SnapToGrid for privacy-preserving location aggregation.
Grid cells with <3 tickets are suppressed (k-anonymity threshold).

Key decisions:
- No tenant_id filter - queries aggregate across ALL active municipalities
- JOIN Municipality to filter is_active == True
- Sensitive ticket count returned ONLY at system level (never per-municipality)
- PostGIS detection for graceful SQLite test compatibility
"""
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.municipality import Municipality
from src.models.ticket import Ticket

# Detect if we're using SQLite (tests) or PostgreSQL (production)
# USE_SQLITE_TESTS environment variable is set in conftest.py before imports
USE_POSTGIS = os.getenv("USE_SQLITE_TESTS") != "1"

if USE_POSTGIS:
    try:
        from geoalchemy2 import func as geo_func
    except ImportError:
        USE_POSTGIS = False


class PublicMetricsService:
    """Public metrics aggregation service with cross-tenant queries and GBV firewall.

    All queries exclude sensitive tickets (is_sensitive == False) at SQL level.
    """

    async def get_active_municipalities(self, db: AsyncSession) -> list[dict]:
        """Get list of active municipalities with basic public information.

        Returns:
            list of {"id": str, "name": str, "code": str, "province": str}

        Note: Excludes contact_email for privacy. Only returns public-facing info.
        """
        result = await db.execute(
            select(
                Municipality.id,
                Municipality.name,
                Municipality.code,
                Municipality.province
            ).where(Municipality.is_active == True)
        )

        rows = result.all()
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "code": row.code,
                "province": row.province,
            }
            for row in rows
        ]

    async def get_response_times(
        self, db: AsyncSession, municipality_id: str | None = None
    ) -> list[dict]:
        """Get average response times per municipality (TRNS-01).

        Calculates average time from ticket creation to first response.
        Excludes sensitive tickets (GBV firewall).

        Args:
            db: Database session
            municipality_id: Optional filter to single municipality

        Returns:
            list of {
                "municipality_id": str,
                "municipality_name": str,
                "avg_response_hours": float,
                "ticket_count": int
            }
        """
        # Base conditions: non-sensitive, active municipalities, has response
        base_conditions = [
            Ticket.is_sensitive == False,
            Municipality.is_active == True,
            Ticket.first_responded_at.isnot(None),
        ]

        # Optional municipality filter
        if municipality_id:
            base_conditions.append(Ticket.tenant_id == municipality_id)

        # Query: JOIN Ticket with Municipality, calculate avg response time
        result = await db.execute(
            select(
                Ticket.tenant_id,
                Municipality.name.label("municipality_name"),
                func.avg(
                    func.extract("epoch", Ticket.first_responded_at - Ticket.created_at) / 3600
                ).label("avg_response_hours"),
                func.count(Ticket.id).label("ticket_count"),
            )
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(and_(*base_conditions))
            .group_by(Ticket.tenant_id, Municipality.name)
        )

        rows = result.all()
        return [
            {
                "municipality_id": str(row.tenant_id),
                "municipality_name": row.municipality_name,
                "avg_response_hours": round(float(row.avg_response_hours or 0), 2),
                "ticket_count": row.ticket_count or 0,
            }
            for row in rows
        ]

    async def get_resolution_rates(
        self,
        db: AsyncSession,
        municipality_id: str | None = None,
        months: int = 6,
    ) -> list[dict]:
        """Get resolution rates per municipality with monthly trends (TRNS-02).

        Resolution rate = (resolved + closed) / total * 100
        Excludes sensitive tickets (GBV firewall).

        Args:
            db: Database session
            municipality_id: Optional filter to single municipality
            months: Number of months for trend data (default 6)

        Returns:
            list of {
                "municipality_id": str,
                "municipality_name": str,
                "resolution_rate": float,
                "total_tickets": int,
                "resolved_tickets": int,
                "trend": [{"month": str, "rate": float}]
            }
        """
        # Base conditions
        base_conditions = [
            Ticket.is_sensitive == False,
            Municipality.is_active == True,
        ]

        if municipality_id:
            base_conditions.append(Ticket.tenant_id == municipality_id)

        # Main query: overall resolution rates
        resolved_statuses = ["resolved", "closed"]

        main_result = await db.execute(
            select(
                Ticket.tenant_id,
                Municipality.name.label("municipality_name"),
                func.count(Ticket.id).label("total_tickets"),
                func.count(
                    func.case((Ticket.status.in_(resolved_statuses), 1))
                ).label("resolved_tickets"),
            )
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(and_(*base_conditions))
            .group_by(Ticket.tenant_id, Municipality.name)
        )

        main_rows = main_result.all()

        # Trend query: monthly resolution rates for last N months
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=months * 30)
        trend_conditions = base_conditions + [Ticket.created_at >= cutoff_date]

        trend_result = await db.execute(
            select(
                Ticket.tenant_id,
                func.date_trunc("month", Ticket.created_at).label("month"),
                func.count(Ticket.id).label("total"),
                func.count(
                    func.case((Ticket.status.in_(resolved_statuses), 1))
                ).label("resolved"),
            )
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(and_(*trend_conditions))
            .group_by(Ticket.tenant_id, func.date_trunc("month", Ticket.created_at))
            .order_by(func.date_trunc("month", Ticket.created_at))
        )

        trend_rows = trend_result.all()

        # Build trend data indexed by municipality_id
        trends_by_municipality = {}
        for row in trend_rows:
            muni_id = str(row.tenant_id)
            if muni_id not in trends_by_municipality:
                trends_by_municipality[muni_id] = []

            rate = (row.resolved / row.total * 100) if row.total > 0 else 0.0
            trends_by_municipality[muni_id].append({
                "month": row.month.strftime("%Y-%m") if row.month else "",
                "rate": round(float(rate), 2),
            })

        # Combine main and trend data
        results = []
        for row in main_rows:
            muni_id = str(row.tenant_id)
            resolution_rate = (
                (row.resolved_tickets / row.total_tickets * 100)
                if row.total_tickets > 0
                else 0.0
            )

            results.append({
                "municipality_id": muni_id,
                "municipality_name": row.municipality_name,
                "resolution_rate": round(float(resolution_rate), 2),
                "total_tickets": row.total_tickets or 0,
                "resolved_tickets": row.resolved_tickets or 0,
                "trend": trends_by_municipality.get(muni_id, []),
            })

        return results

    async def get_heatmap_data(
        self, db: AsyncSession, municipality_id: str | None = None
    ) -> list[dict]:
        """Get grid-aggregated heatmap data for geographic visualization (TRNS-03).

        Uses PostGIS ST_SnapToGrid to aggregate tickets into ~1km grid cells.
        Applies k-anonymity threshold: suppresses cells with <3 tickets.
        Excludes sensitive tickets (GBV firewall).

        Args:
            db: Database session
            municipality_id: Optional filter to single municipality

        Returns:
            list of {"lat": float, "lng": float, "intensity": int}

        Note: Returns empty list when PostGIS unavailable (SQLite tests).
        """
        # Graceful degradation: return empty list when PostGIS unavailable
        if not USE_POSTGIS:
            return []

        # Base conditions
        base_conditions = [
            Ticket.is_sensitive == False,
            Municipality.is_active == True,
            Ticket.location.isnot(None),
        ]

        if municipality_id:
            base_conditions.append(Ticket.tenant_id == municipality_id)

        # PostGIS query: snap to grid, extract center, filter by count
        # Grid size 0.01, 0.01 (~1km at equator)
        result = await db.execute(
            select(
                func.ST_Y(func.ST_SnapToGrid(Ticket.location, 0.01, 0.01)).label("lat"),
                func.ST_X(func.ST_SnapToGrid(Ticket.location, 0.01, 0.01)).label("lng"),
                func.count(Ticket.id).label("intensity"),
            )
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(and_(*base_conditions))
            .group_by(
                func.ST_SnapToGrid(Ticket.location, 0.01, 0.01)
            )
            .having(func.count(Ticket.id) >= 3)  # k-anonymity threshold
            .order_by(func.count(Ticket.id).desc())
            .limit(1000)
        )

        rows = result.all()
        return [
            {
                "lat": float(row.lat),
                "lng": float(row.lng),
                "intensity": row.intensity or 0,
            }
            for row in rows
        ]

    async def get_system_summary(self, db: AsyncSession) -> dict:
        """Get system-wide summary statistics.

        Sensitive ticket count returned at system level ONLY (never per-municipality).
        This follows TRNS-05: GBV counts are system-wide aggregates only.

        Args:
            db: Database session

        Returns:
            {
                "total_municipalities": int,
                "total_tickets": int,
                "total_sensitive_tickets": int
            }
        """
        # Count active municipalities
        muni_result = await db.execute(
            select(func.count(Municipality.id)).where(Municipality.is_active == True)
        )
        total_municipalities = muni_result.scalar() or 0

        # Count total non-sensitive tickets across all active municipalities
        total_result = await db.execute(
            select(func.count(Ticket.id))
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(
                and_(
                    Ticket.is_sensitive == False,
                    Municipality.is_active == True,
                )
            )
        )
        total_tickets = total_result.scalar() or 0

        # Count sensitive tickets (system-wide only, never per-municipality)
        sensitive_result = await db.execute(
            select(func.count(Ticket.id))
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(
                and_(
                    Ticket.is_sensitive == True,
                    Municipality.is_active == True,
                )
            )
        )
        total_sensitive_tickets = sensitive_result.scalar() or 0

        return {
            "total_municipalities": total_municipalities,
            "total_tickets": total_tickets,
            "total_sensitive_tickets": total_sensitive_tickets,
        }
