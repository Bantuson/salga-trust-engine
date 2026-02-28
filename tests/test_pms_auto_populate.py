"""Unit tests for SDBIP auto-population engine.

Tests cover:
1.  test_auto_populate_writes_actual         — rule + resolved ticket -> SDBIPActual with is_auto_populated=True
2.  test_gbv_excluded_from_auto_populate     — GBV ticket (is_sensitive=True) NOT counted [SEC-05 CRITICAL]
3.  test_count_aggregation                   — count type counts resolved non-sensitive tickets
4.  test_source_query_ref_populated          — auto-populated actual has descriptive source_query_ref
5.  test_idempotency_skips_existing          — running engine twice creates only 1 actual
6.  test_quarter_boundaries                  — Q1-Q4 date ranges for SA financial year 2025/26
7.  test_auto_populated_flag_distinguishable — is_auto_populated=True vs manual is_auto_populated=False

SEC-05 Test (test_gbv_excluded_from_auto_populate):
    Creates both a normal ticket (is_sensitive=False, water) and a GBV ticket
    (is_sensitive=True, gbv). Verifies the actual_value = 1 (not 2), confirming
    GBV ticket was excluded from the aggregation.

All tests use SQLite in-memory via the db_session fixture from conftest.py.
Tenant isolation uses set_tenant_context()/clear_tenant_context() with try/finally.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.sdbip import (
    AggregationType,
    Quarter,
    SDBIPActual,
    SDBIPKpi,
    SDBIPLayer,
    SDBIPQuarterlyTarget,
    SDBIPScorecard,
    SDBIPStatus,
    SDBIPTicketAggregationRule,
)
from src.models.ticket import Ticket, TicketCategory, TicketStatus
from src.models.user import User, UserRole
from src.schemas.sdbip import (
    QuarterlyTargetBulkCreate,
    QuarterlyTargetCreate,
    SDBIPKpiCreate,
    SDBIPScorecardCreate,
)
from src.services.pms_auto_populate import AutoPopulationEngine
from src.services.sdbip_service import SDBIPService
from unittest.mock import MagicMock

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_director(tenant_id: str) -> MagicMock:
    """Create a mock Section 56 director user."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "director@test.gov.za"
    user.full_name = "Section 56 Director"
    user.role = UserRole.SECTION56_DIRECTOR
    user.tenant_id = tenant_id
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


async def _create_kpi_with_targets(
    db: AsyncSession,
    tenant_id: str,
    quarter: str = "Q3",
    target_value: Decimal = Decimal("10"),
) -> SDBIPKpi:
    """Create a KPI with quarterly targets. Tenant context must be set by caller."""
    service = SDBIPService()
    user = make_mock_director(tenant_id)

    scorecard = await service.create_scorecard(
        SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
        user,
        db,
    )
    kpi = await service.create_kpi(
        scorecard.id,
        SDBIPKpiCreate(
            kpi_number="KPI-001",
            description="Number of water complaints resolved per quarter",
            unit_of_measurement="number",
            baseline=Decimal("0"),
            annual_target=Decimal("40"),
            weight=Decimal("25"),
        ),
        user,
        db,
    )
    await service.set_quarterly_targets(
        kpi.id,
        QuarterlyTargetBulkCreate(
            targets=[
                QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=target_value),
                QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=target_value),
                QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=target_value),
                QuarterlyTargetCreate(quarter=Quarter.Q4, target_value=target_value),
            ]
        ),
        user,
        db,
    )
    return kpi


def _make_resolved_ticket(
    tenant_id: str,
    category: str,
    is_sensitive: bool,
    resolved_at: datetime,
    user_id=None,
) -> Ticket:
    """Create an in-memory Ticket object with resolved status."""
    ticket = Ticket(
        tenant_id=tenant_id,
        category=category,
        description=f"Test {category} complaint",
        status=TicketStatus.RESOLVED,
        is_sensitive=is_sensitive,
        resolved_at=resolved_at,
        user_id=user_id or uuid4(),
        created_by="test",
    )
    return ticket


async def _create_aggregation_rule(
    db: AsyncSession,
    kpi_id,
    tenant_id: str,
    ticket_category: str = "water",
    aggregation_type: str = AggregationType.COUNT,
) -> SDBIPTicketAggregationRule:
    """Create and persist an aggregation rule. Tenant context must be set by caller."""
    rule = SDBIPTicketAggregationRule(
        tenant_id=tenant_id,
        kpi_id=kpi_id,
        ticket_category=ticket_category,
        aggregation_type=aggregation_type,
        formula_description=f"Count of resolved {ticket_category} tickets per quarter",
        is_active=True,
        created_by="test",
    )
    db.add(rule)
    await db.flush()
    return rule


# Q3 of 2025/26 is Jan 2026 – Mar 2026
Q3_RESOLVED_AT = datetime(2026, 2, 15, 10, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Test 1: Auto-populate writes actual with is_auto_populated=True
# ---------------------------------------------------------------------------


class TestAutoPopulateWritesActual:
    """Engine creates SDBIPActual with is_auto_populated=True from resolved ticket."""

    async def test_auto_populate_writes_actual(self, db_session: AsyncSession):
        """Rule + resolved ticket -> SDBIPActual created with is_auto_populated=True."""
        tenant_id = str(uuid4())
        engine = AutoPopulationEngine()

        set_tenant_context(tenant_id)
        try:
            kpi = await _create_kpi_with_targets(db_session, tenant_id)
            await _create_aggregation_rule(db_session, kpi.id, tenant_id)

            # Create a resolved non-sensitive water ticket in Q3 (Jan-Mar 2026)
            ticket = _make_resolved_ticket(
                tenant_id=tenant_id,
                category="water",
                is_sensitive=False,
                resolved_at=Q3_RESOLVED_AT,
            )
            db_session.add(ticket)
            await db_session.flush()

            result = await engine.populate_quarter("2025/26", "Q3", db_session)
        finally:
            clear_tenant_context()

        assert result["populated"] == 1
        assert result["skipped"] == 0
        assert result["errors"] == 0

        # Verify the actual was created
        from sqlalchemy import select
        set_tenant_context(tenant_id)
        try:
            actuals_result = await db_session.execute(
                select(SDBIPActual).where(
                    SDBIPActual.kpi_id == kpi.id,
                    SDBIPActual.is_auto_populated == True,  # noqa: E712
                )
            )
            actuals = actuals_result.scalars().all()
        finally:
            clear_tenant_context()

        assert len(actuals) == 1
        actual = actuals[0]
        assert actual.is_auto_populated is True
        assert actual.is_validated is False
        assert actual.quarter == "Q3"
        assert actual.financial_year == "2025/26"
        assert actual.actual_value == Decimal("1")
        assert actual.submitted_by == "system:auto_populate"


# ---------------------------------------------------------------------------
# Test 2: SEC-05 — GBV tickets excluded from auto-population
# ---------------------------------------------------------------------------


class TestGbvExcludedFromAutoPopulate:
    """SEC-05 CRITICAL: GBV tickets (is_sensitive=True) are never counted."""

    async def test_gbv_excluded_from_auto_populate(self, db_session: AsyncSession):
        """GBV ticket (is_sensitive=True) must NOT be counted in actual_value.

        Creates:
        - 1 normal water ticket (is_sensitive=False) — MUST be counted
        - 1 GBV ticket (is_sensitive=True, category=gbv) — MUST NOT be counted

        Verifies actual_value == 1 (not 2), confirming GBV exclusion.
        """
        tenant_id = str(uuid4())
        engine = AutoPopulationEngine()

        set_tenant_context(tenant_id)
        try:
            kpi = await _create_kpi_with_targets(db_session, tenant_id)
            await _create_aggregation_rule(
                db_session, kpi.id, tenant_id,
                ticket_category="water",
                aggregation_type=AggregationType.COUNT,
            )

            # Normal ticket — should be counted
            normal_ticket = _make_resolved_ticket(
                tenant_id=tenant_id,
                category="water",
                is_sensitive=False,
                resolved_at=Q3_RESOLVED_AT,
            )
            # GBV ticket — must NOT be counted (SEC-05 firewall)
            gbv_ticket = _make_resolved_ticket(
                tenant_id=tenant_id,
                category="gbv",
                is_sensitive=True,
                resolved_at=Q3_RESOLVED_AT,
            )
            db_session.add(normal_ticket)
            db_session.add(gbv_ticket)
            await db_session.flush()

            result = await engine.populate_quarter("2025/26", "Q3", db_session)
        finally:
            clear_tenant_context()

        assert result["populated"] == 1
        assert result["errors"] == 0

        # Verify actual_value is 1 (only the normal ticket), not 2
        from sqlalchemy import select
        set_tenant_context(tenant_id)
        try:
            actuals_result = await db_session.execute(
                select(SDBIPActual).where(
                    SDBIPActual.kpi_id == kpi.id,
                    SDBIPActual.is_auto_populated == True,  # noqa: E712
                )
            )
            actual = actuals_result.scalar_one()
        finally:
            clear_tenant_context()

        # SEC-05: GBV ticket must NOT appear in the count
        assert actual.actual_value == Decimal("1"), (
            f"SEC-05 VIOLATION: expected actual_value=1 (excluding GBV ticket), "
            f"got {actual.actual_value}. GBV tickets are being incorrectly included!"
        )


# ---------------------------------------------------------------------------
# Test 3: Count aggregation counts resolved non-sensitive tickets
# ---------------------------------------------------------------------------


class TestCountAggregation:
    """COUNT aggregation type counts resolved non-sensitive tickets matching category."""

    async def test_count_aggregation(self, db_session: AsyncSession):
        """COUNT type: 3 resolved water tickets -> actual_value=3."""
        tenant_id = str(uuid4())
        engine = AutoPopulationEngine()

        set_tenant_context(tenant_id)
        try:
            kpi = await _create_kpi_with_targets(db_session, tenant_id)
            await _create_aggregation_rule(
                db_session, kpi.id, tenant_id,
                ticket_category="water",
                aggregation_type=AggregationType.COUNT,
            )

            # Create 3 resolved water tickets in Q3
            for _ in range(3):
                ticket = _make_resolved_ticket(
                    tenant_id=tenant_id,
                    category="water",
                    is_sensitive=False,
                    resolved_at=Q3_RESOLVED_AT,
                )
                db_session.add(ticket)

            # Create 2 resolved electricity tickets (different category — should NOT be counted)
            for _ in range(2):
                ticket = _make_resolved_ticket(
                    tenant_id=tenant_id,
                    category="electricity",
                    is_sensitive=False,
                    resolved_at=Q3_RESOLVED_AT,
                )
                db_session.add(ticket)

            await db_session.flush()
            result = await engine.populate_quarter("2025/26", "Q3", db_session)
        finally:
            clear_tenant_context()

        assert result["populated"] == 1

        from sqlalchemy import select
        set_tenant_context(tenant_id)
        try:
            actual = (
                await db_session.execute(
                    select(SDBIPActual).where(
                        SDBIPActual.kpi_id == kpi.id,
                        SDBIPActual.is_auto_populated == True,  # noqa: E712
                    )
                )
            ).scalar_one()
        finally:
            clear_tenant_context()

        assert actual.actual_value == Decimal("3"), (
            f"Expected 3 water tickets counted, got {actual.actual_value}"
        )


# ---------------------------------------------------------------------------
# Test 4: source_query_ref is populated on auto-populated actuals
# ---------------------------------------------------------------------------


class TestSourceQueryRefPopulated:
    """source_query_ref records a human-readable description of the query used."""

    async def test_source_query_ref_populated(self, db_session: AsyncSession):
        """Auto-populated actual has a descriptive source_query_ref string."""
        tenant_id = str(uuid4())
        engine = AutoPopulationEngine()

        set_tenant_context(tenant_id)
        try:
            kpi = await _create_kpi_with_targets(db_session, tenant_id)
            await _create_aggregation_rule(
                db_session, kpi.id, tenant_id,
                ticket_category="roads",
                aggregation_type=AggregationType.COUNT,
            )
            ticket = _make_resolved_ticket(
                tenant_id=tenant_id,
                category="roads",
                is_sensitive=False,
                resolved_at=Q3_RESOLVED_AT,
            )
            db_session.add(ticket)
            await db_session.flush()
            await engine.populate_quarter("2025/26", "Q3", db_session)
        finally:
            clear_tenant_context()

        from sqlalchemy import select
        set_tenant_context(tenant_id)
        try:
            actual = (
                await db_session.execute(
                    select(SDBIPActual).where(
                        SDBIPActual.kpi_id == kpi.id,
                        SDBIPActual.is_auto_populated == True,  # noqa: E712
                    )
                )
            ).scalar_one()
        finally:
            clear_tenant_context()

        assert actual.source_query_ref is not None
        assert "auto:" in actual.source_query_ref
        assert "roads" in actual.source_query_ref
        assert "is_sensitive=FALSE" in actual.source_query_ref
        assert "resolved" in actual.source_query_ref.lower()


# ---------------------------------------------------------------------------
# Test 5: Idempotency — running engine twice creates only 1 actual
# ---------------------------------------------------------------------------


class TestIdempotencySkipsExisting:
    """Running the engine twice does not duplicate actuals."""

    async def test_idempotency_skips_existing(self, db_session: AsyncSession):
        """Engine run twice: second run skips the existing auto-populated actual."""
        tenant_id = str(uuid4())
        engine = AutoPopulationEngine()

        set_tenant_context(tenant_id)
        try:
            kpi = await _create_kpi_with_targets(db_session, tenant_id)
            await _create_aggregation_rule(db_session, kpi.id, tenant_id)

            ticket = _make_resolved_ticket(
                tenant_id=tenant_id,
                category="water",
                is_sensitive=False,
                resolved_at=Q3_RESOLVED_AT,
            )
            db_session.add(ticket)
            await db_session.flush()

            # First run: populates
            result1 = await engine.populate_quarter("2025/26", "Q3", db_session)
            # Second run: skips (idempotent)
            result2 = await engine.populate_quarter("2025/26", "Q3", db_session)
        finally:
            clear_tenant_context()

        assert result1["populated"] == 1
        assert result1["skipped"] == 0
        assert result2["populated"] == 0
        assert result2["skipped"] == 1

        # Verify only 1 actual exists (no duplicates)
        from sqlalchemy import select
        set_tenant_context(tenant_id)
        try:
            count_result = await db_session.execute(
                select(SDBIPActual).where(
                    SDBIPActual.kpi_id == kpi.id,
                    SDBIPActual.is_auto_populated == True,  # noqa: E712
                )
            )
            actuals = count_result.scalars().all()
        finally:
            clear_tenant_context()

        assert len(actuals) == 1, (
            f"Expected 1 auto-populated actual, found {len(actuals)}. "
            "Idempotency broken: duplicate actuals created."
        )


# ---------------------------------------------------------------------------
# Test 6: Quarter boundary logic for SA financial year
# ---------------------------------------------------------------------------


class TestQuarterBoundaries:
    """Verify Q1-Q4 date boundaries for South African financial year (July start)."""

    def test_quarter_boundaries(self):
        """Q1-Q4 start/end dates for 2025/26 financial year are correct."""
        engine = AutoPopulationEngine()

        q1_start, q1_end = engine.get_quarter_boundaries("2025/26", "Q1")
        assert q1_start == date(2025, 7, 1)
        assert q1_end == date(2025, 9, 30)

        q2_start, q2_end = engine.get_quarter_boundaries("2025/26", "Q2")
        assert q2_start == date(2025, 10, 1)
        assert q2_end == date(2025, 12, 31)

        q3_start, q3_end = engine.get_quarter_boundaries("2025/26", "Q3")
        assert q3_start == date(2026, 1, 1)
        assert q3_end == date(2026, 3, 31)

        q4_start, q4_end = engine.get_quarter_boundaries("2025/26", "Q4")
        assert q4_start == date(2026, 4, 1)
        assert q4_end == date(2026, 6, 30)

    def test_quarter_boundaries_earlier_financial_year(self):
        """Boundary logic works for financial years other than 2025/26."""
        engine = AutoPopulationEngine()

        # 2024/25 financial year
        q1_start, q1_end = engine.get_quarter_boundaries("2024/25", "Q1")
        assert q1_start == date(2024, 7, 1)
        assert q1_end == date(2024, 9, 30)

        q4_start, q4_end = engine.get_quarter_boundaries("2024/25", "Q4")
        assert q4_start == date(2025, 4, 1)
        assert q4_end == date(2025, 6, 30)

    def test_get_current_quarter_returns_valid_quarter(self):
        """get_current_quarter() returns a valid (financial_year, quarter) tuple."""
        engine = AutoPopulationEngine()
        fy, q = engine.get_current_quarter()

        assert "/" in fy, f"Financial year must be YYYY/YY format, got: {fy}"
        start_year = int(fy.split("/")[0])
        assert start_year >= 2020, "Financial year start looks invalid"
        assert q in ("Q1", "Q2", "Q3", "Q4"), f"Quarter must be Q1-Q4, got: {q}"

    def test_quarter_boundaries_exclude_out_of_range_tickets(self, db_session=None):
        """Tickets resolved outside quarter boundaries should not be counted.

        This tests the boundary logic by verifying that a Q1 ticket (Aug 2025)
        is not counted in Q3 (Jan-Mar 2026).
        """
        engine = AutoPopulationEngine()
        q3_start, q3_end = engine.get_quarter_boundaries("2025/26", "Q3")
        q1_ticket_date = datetime(2025, 8, 15)

        # Q1 ticket date must NOT fall within Q3 boundaries
        q3_start_dt = datetime(q3_start.year, q3_start.month, q3_start.day)
        q3_end_dt = datetime(q3_end.year, q3_end.month, q3_end.day, 23, 59, 59)
        assert q1_ticket_date < q3_start_dt or q1_ticket_date > q3_end_dt, (
            "Q1 ticket date falls within Q3 boundaries — boundary logic broken"
        )


# ---------------------------------------------------------------------------
# Test 7: is_auto_populated flag distinguishable from manual actuals
# ---------------------------------------------------------------------------


class TestAutoPopulatedFlagDistinguishable:
    """is_auto_populated=True distinguishes system actuals from manually submitted ones."""

    async def test_auto_populated_flag_distinguishable(self, db_session: AsyncSession):
        """Auto-populated actual has is_auto_populated=True; manual has is_auto_populated=False."""
        tenant_id = str(uuid4())
        engine = AutoPopulationEngine()
        service = SDBIPService()
        user = make_mock_director(tenant_id)

        from src.schemas.sdbip import SDBIPActualCreate

        set_tenant_context(tenant_id)
        try:
            kpi = await _create_kpi_with_targets(db_session, tenant_id)
            await _create_aggregation_rule(db_session, kpi.id, tenant_id)

            # Create a resolved ticket for the engine to count
            ticket = _make_resolved_ticket(
                tenant_id=tenant_id,
                category="water",
                is_sensitive=False,
                resolved_at=Q3_RESOLVED_AT,
            )
            db_session.add(ticket)
            await db_session.flush()

            # Run auto-population for Q3
            # Note: populate_quarter() clears tenant context in its finally block,
            # so we re-set it after for the manual submission below.
            await engine.populate_quarter("2025/26", "Q3", db_session)

            # Re-set tenant context (populate_quarter clears it in finally block)
            set_tenant_context(tenant_id)

            # Manually submit an actual for Q2 (different quarter — no idempotency clash)
            manual_actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q2,
                    financial_year="2025/26",
                    actual_value=Decimal("5"),
                ),
                user,
                db_session,
            )
        finally:
            clear_tenant_context()

        # Manual actual must have is_auto_populated=False
        assert manual_actual.is_auto_populated is False
        assert manual_actual.submitted_by == str(user.id)

        # Auto-populated actual must have is_auto_populated=True
        from sqlalchemy import select
        set_tenant_context(tenant_id)
        try:
            auto_actual = (
                await db_session.execute(
                    select(SDBIPActual).where(
                        SDBIPActual.kpi_id == kpi.id,
                        SDBIPActual.quarter == "Q3",
                        SDBIPActual.is_auto_populated == True,  # noqa: E712
                    )
                )
            ).scalar_one()
        finally:
            clear_tenant_context()

        assert auto_actual.is_auto_populated is True
        assert auto_actual.submitted_by == "system:auto_populate"
        assert auto_actual.source_query_ref is not None

        # Verify they are distinguishable
        assert auto_actual.is_auto_populated != manual_actual.is_auto_populated
