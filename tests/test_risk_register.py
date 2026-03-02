"""Unit tests for the risk register feature (RISK-01 through RISK-04).

Test index:
1.  test_compute_risk_rating_low               — compute_risk_rating(1, 1) == "low" (score=1)
2.  test_compute_risk_rating_medium            — compute_risk_rating(2, 2) == "medium" (score=4)
3.  test_compute_risk_rating_high              — compute_risk_rating(3, 3) == "high" (score=9)
4.  test_compute_risk_rating_critical          — compute_risk_rating(3, 5) == "critical" (score=15)
5.  test_create_risk_item                      — Create risk item via service, assert risk_rating auto-computed (RISK-01)
6.  test_create_risk_item_with_mitigations     — Create risk item with 2 mitigations, assert children saved (RISK-02)
7.  test_list_risk_items_department_filter     — Create items in 2 departments, filter returns correct subset (RISK-01)
8.  test_auto_flag_risk_items                  — Create risk item linked to KPI, auto-flag sets high + is_auto_flagged (RISK-03)
9.  test_auto_flag_respects_critical           — Create critical risk item, auto-flag does NOT overwrite (RISK-03)
10. test_update_clears_auto_flag               — Create auto-flagged item, update via service, assert is_auto_flagged=False
11. test_risk_register_api_403                 — Non-CFO/MM role on GET /api/v1/risk-register/ returns 403
12. test_risk_register_api_200_cfo             — CFO role on GET /api/v1/risk-register/ returns 200

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally.
"""
import json
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.risk import RiskItem, RiskMitigation, RiskRating, compute_risk_rating
from src.models.sdbip import SDBIPKpi, SDBIPScorecard
from src.models.user import User, UserRole
from src.services.risk_service import RiskService
from src.schemas.risk import RiskItemCreate, RiskMitigationCreate, RiskItemUpdate

pytestmark = pytest.mark.asyncio

TEST_TENANT = str(uuid4())

_service = RiskService()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(
    role: UserRole = UserRole.CFO,
    tenant_id: str = TEST_TENANT,
    user_id: str | None = None,
) -> MagicMock:
    """Create a MagicMock User with the given role and tenant."""
    user = MagicMock(spec=User)
    user.id = uuid4() if user_id is None else uuid4()
    user.role = role
    user.tenant_id = tenant_id
    user.municipality_id = uuid4()
    return user


async def _make_kpi(db: AsyncSession, tenant_id: str) -> SDBIPKpi:
    """Create a minimal SDBIPKpi for test fixtures."""
    scorecard = SDBIPScorecard(
        tenant_id=tenant_id,
        financial_year="2025/26",
        layer="top",
        status="draft",
    )
    db.add(scorecard)
    await db.flush()

    kpi = SDBIPKpi(
        tenant_id=tenant_id,
        scorecard_id=scorecard.id,
        kpi_number="KPI-001",
        description="Test KPI",
        unit_of_measurement="number",
        baseline=Decimal("0"),
        annual_target=Decimal("100"),
        weight=Decimal("100"),
    )
    db.add(kpi)
    await db.flush()
    return kpi


# ---------------------------------------------------------------------------
# Unit tests: compute_risk_rating helper
# ---------------------------------------------------------------------------


def test_compute_risk_rating_low():
    """compute_risk_rating(1, 1) returns 'low' (score=1)."""
    result = compute_risk_rating(1, 1)
    assert result == RiskRating.LOW
    assert result == "low"


def test_compute_risk_rating_medium():
    """compute_risk_rating(2, 2) returns 'medium' (score=4)."""
    result = compute_risk_rating(2, 2)
    assert result == RiskRating.MEDIUM
    assert result == "medium"


def test_compute_risk_rating_high():
    """compute_risk_rating(3, 3) returns 'high' (score=9)."""
    result = compute_risk_rating(3, 3)
    assert result == RiskRating.HIGH
    assert result == "high"


def test_compute_risk_rating_critical():
    """compute_risk_rating(3, 5) returns 'critical' (score=15)."""
    result = compute_risk_rating(3, 5)
    assert result == RiskRating.CRITICAL
    assert result == "critical"


def test_compute_risk_rating_critical_max():
    """compute_risk_rating(5, 5) returns 'critical' (score=25)."""
    result = compute_risk_rating(5, 5)
    assert result == RiskRating.CRITICAL
    assert result == "critical"


# ---------------------------------------------------------------------------
# Service tests: create_risk_item
# ---------------------------------------------------------------------------


async def test_create_risk_item(db_session: AsyncSession):
    """Create risk item via service, assert risk_rating auto-computed from likelihood/impact."""
    try:
        set_tenant_context(TEST_TENANT)
        kpi = await _make_kpi(db_session, TEST_TENANT)
        user = _make_user()

        data = RiskItemCreate(
            kpi_id=kpi.id,
            title="Water supply disruption risk",
            description="Risk of water infrastructure failure",
            likelihood=3,
            impact=3,
        )

        risk_item = await _service.create_risk_item(data, user, db_session)

        assert risk_item.title == "Water supply disruption risk"
        assert risk_item.kpi_id == kpi.id
        assert risk_item.likelihood == 3
        assert risk_item.impact == 3
        assert risk_item.risk_rating == "high"  # 3*3=9, >= 8 = high
        assert risk_item.tenant_id == TEST_TENANT
        assert risk_item.is_auto_flagged is False
    finally:
        clear_tenant_context()


async def test_create_risk_item_with_mitigations(db_session: AsyncSession):
    """Create risk item with 2 mitigations, assert children saved."""
    try:
        set_tenant_context(TEST_TENANT)
        kpi = await _make_kpi(db_session, TEST_TENANT)
        user = _make_user()

        data = RiskItemCreate(
            kpi_id=kpi.id,
            title="Infrastructure risk",
            description="Risk of infrastructure failure",
            likelihood=2,
            impact=2,
            mitigations=[
                RiskMitigationCreate(strategy="Implement maintenance schedule"),
                RiskMitigationCreate(strategy="Deploy backup systems"),
            ],
        )

        risk_item = await _service.create_risk_item(data, user, db_session)

        assert risk_item.risk_rating == "medium"  # 2*2=4, >= 4 = medium
        assert len(risk_item.mitigations) == 2
        strategies = {m.strategy for m in risk_item.mitigations}
        assert "Implement maintenance schedule" in strategies
        assert "Deploy backup systems" in strategies
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# Service tests: list_risk_items
# ---------------------------------------------------------------------------


async def test_list_risk_items_department_filter(db_session: AsyncSession):
    """Create items in 2 departments, department_id filter returns correct subset."""
    try:
        set_tenant_context(TEST_TENANT)
        kpi = await _make_kpi(db_session, TEST_TENANT)
        user = _make_user()

        dept_a = uuid4()
        dept_b = uuid4()

        # Create item in department A
        data_a = RiskItemCreate(
            kpi_id=kpi.id,
            department_id=dept_a,
            title="Risk in Dept A",
            description="Dept A risk",
            likelihood=2,
            impact=3,
        )
        await _service.create_risk_item(data_a, user, db_session)

        # Create item in department B
        data_b = RiskItemCreate(
            kpi_id=kpi.id,
            department_id=dept_b,
            title="Risk in Dept B",
            description="Dept B risk",
            likelihood=1,
            impact=2,
        )
        await _service.create_risk_item(data_b, user, db_session)

        # Filter by dept A - should only return dept A risk
        items_a = await _service.list_risk_items(TEST_TENANT, db_session, department_id=dept_a)
        assert len(items_a) == 1
        assert items_a[0].title == "Risk in Dept A"

        # No filter - should return both
        all_items = await _service.list_risk_items(TEST_TENANT, db_session)
        assert len(all_items) == 2
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# Service tests: auto_flag_for_kpi
# ---------------------------------------------------------------------------


async def test_auto_flag_risk_items(db_session: AsyncSession):
    """Create risk item linked to KPI, call auto_flag_for_kpi, assert high + is_auto_flagged=True."""
    try:
        set_tenant_context(TEST_TENANT)
        kpi = await _make_kpi(db_session, TEST_TENANT)
        user = _make_user()

        data = RiskItemCreate(
            kpi_id=kpi.id,
            title="KPI linked risk",
            description="Risk linked to failing KPI",
            likelihood=1,
            impact=2,
        )
        risk_item = await _service.create_risk_item(data, user, db_session)
        assert risk_item.risk_rating == "low"  # 1*2=2, < 4 = low

        # Auto-flag for this KPI (simulating red traffic light)
        count = await _service.auto_flag_for_kpi(kpi.id, TEST_TENANT, db_session)
        assert count == 1

        # Refresh and verify
        updated_items = await _service.list_risk_items(TEST_TENANT, db_session)
        assert len(updated_items) == 1
        flagged = updated_items[0]
        assert flagged.risk_rating == "high"
        assert flagged.is_auto_flagged is True
        assert flagged.auto_flagged_at is not None
    finally:
        clear_tenant_context()


async def test_auto_flag_respects_critical(db_session: AsyncSession):
    """Create critical risk item, auto-flag does NOT overwrite risk_rating='critical'."""
    try:
        set_tenant_context(TEST_TENANT)
        kpi = await _make_kpi(db_session, TEST_TENANT)
        user = _make_user()

        # Create with likelihood=5, impact=5 -> critical
        data = RiskItemCreate(
            kpi_id=kpi.id,
            title="Critical risk",
            description="Maximum severity risk",
            likelihood=5,
            impact=5,
        )
        risk_item = await _service.create_risk_item(data, user, db_session)
        assert risk_item.risk_rating == "critical"

        # Auto-flag should NOT overwrite critical
        count = await _service.auto_flag_for_kpi(kpi.id, TEST_TENANT, db_session)
        assert count == 0  # nothing flagged (critical items skipped)

        # Verify unchanged
        items = await _service.list_risk_items(TEST_TENANT, db_session)
        assert items[0].risk_rating == "critical"
        assert items[0].is_auto_flagged is False
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# Service tests: update_risk_item
# ---------------------------------------------------------------------------


async def test_update_clears_auto_flag(db_session: AsyncSession):
    """Create auto-flagged item, update via service, assert is_auto_flagged=False."""
    try:
        set_tenant_context(TEST_TENANT)
        kpi = await _make_kpi(db_session, TEST_TENANT)
        user = _make_user()

        # Create a low-risk item
        data = RiskItemCreate(
            kpi_id=kpi.id,
            title="Low risk",
            description="Initially low risk",
            likelihood=1,
            impact=1,
        )
        risk_item = await _service.create_risk_item(data, user, db_session)

        # Auto-flag it
        count = await _service.auto_flag_for_kpi(kpi.id, TEST_TENANT, db_session)
        assert count == 1

        # Verify it's auto-flagged
        items = await _service.list_risk_items(TEST_TENANT, db_session)
        assert items[0].is_auto_flagged is True

        # Update the item — this should clear the auto-flag
        update_data = RiskItemUpdate(title="Updated risk title")
        updated = await _service.update_risk_item(risk_item.id, update_data, user, db_session)

        assert updated.title == "Updated risk title"
        assert updated.is_auto_flagged is False
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# API tests: RBAC enforcement
# ---------------------------------------------------------------------------


async def test_risk_register_api_403(db_session: AsyncSession):
    """Non-CFO/MM role on GET /api/v1/risk-register/ returns 403."""
    from httpx import ASGITransport, AsyncClient
    from src.main import app
    from src.api.deps import get_current_user

    # Create a PMS officer user (Tier 3 - not CFO/MM)
    pms_officer = _make_user(role=UserRole.PMS_OFFICER, tenant_id=TEST_TENANT)

    try:
        set_tenant_context(TEST_TENANT)

        # Override dependency to return PMS officer
        app.dependency_overrides[get_current_user] = lambda: pms_officer

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/v1/risk-register/",
                headers={"Authorization": "Bearer fake_token"},
            )

        assert response.status_code == 403
    finally:
        clear_tenant_context()
        app.dependency_overrides.pop(get_current_user, None)


async def test_risk_register_api_200_cfo(db_session: AsyncSession):
    """CFO role on GET /api/v1/risk-register/ returns 200."""
    from unittest.mock import AsyncMock, patch
    from httpx import ASGITransport, AsyncClient
    from src.main import app
    from src.api.deps import get_current_user

    # Create a CFO user
    cfo_user = _make_user(role=UserRole.CFO, tenant_id=TEST_TENANT)

    # Patch require_pms_ready at the API module level to always pass
    # (require_pms_ready() returns a new factory each call — override the inner gate)
    try:
        set_tenant_context(TEST_TENANT)

        # Override get_current_user to return CFO
        app.dependency_overrides[get_current_user] = lambda: cfo_user

        # Patch check_pms_readiness to return a passing readiness check
        from src.services.pms_readiness import PmsReadinessStatus
        ready_status = PmsReadinessStatus(
            is_ready=True,
            municipality_configured=True,
            all_departments_have_directors=True,
            pms_officer_assigned=True,
            department_count=1,
            departments_with_directors=1,
            missing_directors=[],
        )
        with patch(
            "src.services.pms_readiness.check_pms_readiness",
            new=AsyncMock(return_value=ready_status),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test"
            ) as client:
                response = await client.get(
                    "/api/v1/risk-register/",
                    headers={"Authorization": "Bearer fake_token"},
                )

        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        clear_tenant_context()
        app.dependency_overrides.pop(get_current_user, None)
