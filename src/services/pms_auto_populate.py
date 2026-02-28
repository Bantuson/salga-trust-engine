"""Auto-population engine for SDBIP actuals from resolved ticket data.

Runs on a daily Celery beat schedule (01:00 SAST). Reads SDBIPTicketAggregationRule
records per tenant, queries resolved tickets for the current quarter, and inserts
SDBIPActual records with is_auto_populated=True.

SEC-05 CRITICAL: Every aggregation query MUST include:
    .where(Ticket.is_sensitive == False)
This unconditionally excludes GBV tickets from all auto-population calculations.
See AutoPopulationEngine.populate_quarter() — the SEC-05 filter is applied at
the innermost query level, not at the rule level.

Quarter boundaries (South African financial year, starting July):
    Q1: July 1   – September 30
    Q2: October 1 – December 31
    Q3: January 1  – March 31
    Q4: April 1    – June 30
"""
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.sdbip import (
    AggregationType,
    SDBIPActual,
    SDBIPQuarterlyTarget,
    SDBIPTicketAggregationRule,
    compute_achievement,
)
from src.models.ticket import Ticket, TicketStatus

logger = logging.getLogger(__name__)


class AutoPopulationEngine:
    """Auto-populates SDBIP actuals from resolved ticket data.

    SEC-05 CRITICAL: Every aggregation query MUST include:
        .where(Ticket.is_sensitive == False)
    This excludes GBV tickets from all auto-population.

    Usage::

        engine = AutoPopulationEngine()
        result = await engine.populate_current_quarter(db)
        # Returns: {"populated": N, "skipped": N, "errors": N}
    """

    # -------------------------------------------------------------------------
    # Quarter boundary helpers
    # -------------------------------------------------------------------------

    def get_quarter_boundaries(self, financial_year: str, quarter: str) -> tuple[date, date]:
        """Compute quarter start/end dates from financial year string.

        Args:
            financial_year: Financial year in YYYY/YY format (e.g., '2025/26').
            quarter: Quarter identifier: Q1, Q2, Q3, or Q4.

        Returns:
            Tuple of (quarter_start, quarter_end) as date objects.

        Examples:
            >>> engine.get_quarter_boundaries('2025/26', 'Q1')
            (date(2025, 7, 1), date(2025, 9, 30))
            >>> engine.get_quarter_boundaries('2025/26', 'Q4')
            (date(2026, 4, 1), date(2026, 6, 30))
        """
        start_year = int(financial_year.split("/")[0])
        quarters: dict[str, tuple[date, date]] = {
            "Q1": (date(start_year, 7, 1), date(start_year, 9, 30)),
            "Q2": (date(start_year, 10, 1), date(start_year, 12, 31)),
            "Q3": (date(start_year + 1, 1, 1), date(start_year + 1, 3, 31)),
            "Q4": (date(start_year + 1, 4, 1), date(start_year + 1, 6, 30)),
        }
        return quarters[quarter]

    def get_current_quarter(self) -> tuple[str, str]:
        """Return (financial_year, quarter) for today's date.

        South African municipal financial year starts on July 1.

        Returns:
            Tuple of (financial_year, quarter) e.g., ('2025/26', 'Q2').
        """
        today = date.today()
        # Financial year starts July 1
        if today.month >= 7:
            fy_start = today.year
        else:
            fy_start = today.year - 1
        fy_str = f"{fy_start}/{str(fy_start + 1)[-2:]}"

        if 7 <= today.month <= 9:
            quarter = "Q1"
        elif 10 <= today.month <= 12:
            quarter = "Q2"
        elif 1 <= today.month <= 3:
            quarter = "Q3"
        else:
            quarter = "Q4"

        return fy_str, quarter

    # -------------------------------------------------------------------------
    # Main population methods
    # -------------------------------------------------------------------------

    async def populate_current_quarter(self, db: AsyncSession) -> dict:
        """Auto-populate actuals for all KPIs with aggregation rules (current quarter).

        Convenience wrapper that resolves the current financial year and quarter
        then delegates to populate_quarter().

        Returns:
            Dict with keys: populated (int), skipped (int), errors (int).
        """
        financial_year, quarter = self.get_current_quarter()
        return await self.populate_quarter(financial_year, quarter, db)

    async def populate_quarter(
        self,
        financial_year: str,
        quarter: str,
        db: AsyncSession,
    ) -> dict:
        """Populate actuals for a specific quarter across all tenants.

        Tenant context is handled internally: this method loads all distinct
        tenant_ids with active aggregation rules (via raw SQL to bypass the ORM
        do_orm_execute tenant filter), then iterates per-tenant calling
        set_tenant_context() / clear_tenant_context() with try/finally.

        SEC-05: is_sensitive == False is applied unconditionally in every
        aggregation query, regardless of the rule's ticket_category setting.

        Idempotency: a KPI/quarter combination is skipped if a non-validated
        auto-populated SDBIPActual already exists for that period.

        Args:
            financial_year: Financial year string e.g., '2025/26'.
            quarter: Quarter identifier e.g., 'Q1'.
            db: Async SQLAlchemy session.

        Returns:
            Dict with keys: populated (int), skipped (int), errors (int).
        """
        from src.core.tenant import clear_tenant_context, set_tenant_context

        q_start, q_end = self.get_quarter_boundaries(financial_year, quarter)
        populated = 0
        skipped = 0
        errors = 0

        # Load distinct tenant_ids using raw SQL with text() to bypass the ORM
        # do_orm_execute event listener. SDBIPTicketAggregationRule is a
        # TenantAwareModel — any ORM select() on it triggers do_orm_execute which
        # raises SecurityError when no tenant context is set. Raw SQL via text()
        # is not intercepted by the event listener.
        tenant_result = await db.execute(
            text(
                "SELECT DISTINCT tenant_id FROM sdbip_ticket_aggregation_rules "
                "WHERE is_active = TRUE"
            )
        )
        tenant_ids = [row[0] for row in tenant_result.fetchall()]

        for tenant_id in tenant_ids:
            set_tenant_context(tenant_id)
            try:
                # Get all active aggregation rules for THIS tenant (ORM query is
                # now safe because tenant context is set)
                rules_result = await db.execute(
                    select(SDBIPTicketAggregationRule).where(
                        SDBIPTicketAggregationRule.is_active == True  # noqa: E712
                    )
                )
                rules = list(rules_result.scalars().all())

                for rule in rules:
                    try:
                        result = await self._process_rule(
                            rule,
                            quarter,
                            financial_year,
                            q_start,
                            q_end,
                            tenant_id,
                            db,
                        )
                        if result == "populated":
                            populated += 1
                        elif result == "skipped":
                            skipped += 1
                    except Exception as exc:
                        logger.error(
                            f"Auto-populate failed for rule {rule.id}: {exc}",
                            exc_info=True,
                        )
                        errors += 1

            finally:
                clear_tenant_context()

        await db.commit()
        return {"populated": populated, "skipped": skipped, "errors": errors}

    async def _process_rule(
        self,
        rule: SDBIPTicketAggregationRule,
        quarter: str,
        financial_year: str,
        q_start: date,
        q_end: date,
        tenant_id: str,
        db: AsyncSession,
    ) -> str:
        """Process a single aggregation rule for one quarter.

        Returns 'populated' if a new SDBIPActual was created, 'skipped' if one
        already existed.

        SEC-05: Ticket.is_sensitive == False is applied unconditionally below.
        """
        # Idempotency check: skip if a non-validated auto-populated actual exists
        # for this KPI/quarter/financial_year combination.
        existing_result = await db.execute(
            select(SDBIPActual).where(
                SDBIPActual.kpi_id == rule.kpi_id,
                SDBIPActual.quarter == quarter,
                SDBIPActual.financial_year == financial_year,
                SDBIPActual.is_auto_populated == True,  # noqa: E712
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            return "skipped"

        # Build the aggregation query.
        # SEC-05: ALWAYS exclude GBV tickets with is_sensitive == False.
        # This filter is NOT conditional — it applies regardless of aggregation_type.
        if rule.aggregation_type == AggregationType.COUNT:
            agg_func = func.count(Ticket.id)
        elif rule.aggregation_type == AggregationType.SUM:
            # SUM of ticket count per category (resolved tickets)
            agg_func = func.count(Ticket.id)
        else:
            # AVG — for ticket-based KPIs this is the count (extensible in future)
            agg_func = func.count(Ticket.id)

        agg_result = await db.execute(
            select(agg_func).where(
                Ticket.tenant_id == tenant_id,
                Ticket.category == rule.ticket_category,
                Ticket.status == TicketStatus.RESOLVED,
                Ticket.is_sensitive == False,  # SEC-05: NEVER include GBV tickets  # noqa: E712
                Ticket.resolved_at >= datetime(q_start.year, q_start.month, q_start.day),
                Ticket.resolved_at <= datetime(q_end.year, q_end.month, q_end.day, 23, 59, 59),
            )
        )
        raw_count = agg_result.scalar_one()
        actual_value = Decimal(str(raw_count or 0))

        # Get quarterly target for achievement calculation (may not exist yet)
        target_result = await db.execute(
            select(SDBIPQuarterlyTarget).where(
                SDBIPQuarterlyTarget.kpi_id == rule.kpi_id,
                SDBIPQuarterlyTarget.quarter == quarter,
            )
        )
        target = target_result.scalar_one_or_none()
        target_value = target.target_value if target else Decimal("0")
        achievement_pct, traffic_light = compute_achievement(actual_value, target_value)

        # Build a human-readable source query reference that documents exactly
        # what query was used to derive this actual value.
        source_ref = (
            f"auto:{rule.aggregation_type}({rule.ticket_category}) "
            f"WHERE status=resolved AND is_sensitive=FALSE "
            f"AND resolved_at BETWEEN {q_start} AND {q_end}"
        )

        actual = SDBIPActual(
            tenant_id=tenant_id,
            kpi_id=rule.kpi_id,
            quarter=quarter,
            financial_year=financial_year,
            actual_value=actual_value,
            achievement_pct=achievement_pct,
            traffic_light_status=traffic_light,
            submitted_by="system:auto_populate",
            submitted_at=datetime.now(timezone.utc),
            is_validated=False,
            is_auto_populated=True,
            source_query_ref=source_ref,
            created_by="system:auto_populate",
        )
        db.add(actual)
        return "populated"
