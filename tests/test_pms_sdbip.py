"""Unit tests for SDBIP (Service Delivery and Budget Implementation Plan) models, service, and API.

Tests cover:
1.  test_create_top_layer_scorecard — POST creates scorecard with layer=top, status=draft
2.  test_create_departmental_scorecard_requires_department — layer=departmental without
    department_id returns 422
3.  test_create_departmental_kpi — creates KPI with all fields, linked to IDP objective
4.  test_kpi_weight_validation — weight > 100 rejected by schema (422-equivalent)
5.  test_quarterly_targets_require_all_four — must provide exactly 4 quarters
6.  test_invalid_mscoa_code_rejected — non-existent mscoa_code_id returns 422
7.  test_mscoa_search_by_segment — service search_mscoa(segment=IE) returns IE rows
8.  test_mscoa_search_by_description — search_mscoa(q=employee) returns matching rows
9.  test_kpi_links_to_objective — idp_objective_id FK set correctly on KPI
10. test_list_scorecards_by_financial_year — list_scorecards(financial_year=) filters correctly

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally
to satisfy the application-level RLS tenant filter (not PostgreSQL RLS).

Note on mSCOA: MscoaReference is NonTenantModel — no tenant context needed for queries,
but we still insert test data directly and verify retrieval.
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.idp import IDPCycle, IDPGoal, IDPObjective, NationalKPA
from src.models.mscoa_reference import MscoaReference
from src.models.sdbip import (
    Quarter,
    SDBIPKpi,
    SDBIPLayer,
    SDBIPQuarterlyTarget,
    SDBIPScorecard,
    SDBIPStatus,
)
from src.models.user import User, UserRole
from src.schemas.sdbip import (
    QuarterlyTargetBulkCreate,
    QuarterlyTargetCreate,
    SDBIPKpiCreate,
    SDBIPScorecardCreate,
)
from src.services.sdbip_service import SDBIPService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_user(tenant_id: str | None = None) -> MagicMock:
    """Create a mock PMS officer user."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "pms@test.gov.za"
    user.full_name = "PMS Officer"
    user.role = UserRole.PMS_OFFICER
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def make_quarterly_targets_payload() -> QuarterlyTargetBulkCreate:
    """Create a valid QuarterlyTargetBulkCreate with all 4 quarters."""
    return QuarterlyTargetBulkCreate(
        targets=[
            QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("25.00")),
            QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=Decimal("25.00")),
            QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=Decimal("25.00")),
            QuarterlyTargetCreate(quarter=Quarter.Q4, target_value=Decimal("25.00")),
        ]
    )


async def _create_test_mscoa_row(
    db: AsyncSession,
    segment: str = "IE",
    code: str = "0100",
    description: str = "Employee Related Costs",
) -> MscoaReference:
    """Insert a single mSCOA reference row for testing.

    NonTenantModel — no tenant context required.
    """
    row = MscoaReference(
        segment=segment,
        code=code,
        description=description,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def _create_idp_objective(
    db: AsyncSession,
    tenant_id: str,
    user: MagicMock,
) -> IDPObjective:
    """Create a minimal IDP cycle -> goal -> objective chain for FK tests."""
    cycle = IDPCycle(
        title="Test Cycle",
        start_year=2022,
        end_year=2027,
        status="draft",
        tenant_id=tenant_id,
        created_by=str(user.id),
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)

    goal = IDPGoal(
        cycle_id=cycle.id,
        title="Test Goal",
        national_kpa=NationalKPA.BASIC_SERVICE_DELIVERY.value,
        display_order=0,
        tenant_id=tenant_id,
        created_by=str(user.id),
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    objective = IDPObjective(
        goal_id=goal.id,
        title="Test Objective",
        display_order=0,
        tenant_id=tenant_id,
        created_by=str(user.id),
    )
    db.add(objective)
    await db.commit()
    await db.refresh(objective)

    return objective


# ---------------------------------------------------------------------------
# Test 1: Create top-layer scorecard
# ---------------------------------------------------------------------------


class TestCreateTopLayerScorecard:
    """Tests for SDBIPService.create_scorecard() with layer=top."""

    async def test_create_top_layer_scorecard(self, db_session: AsyncSession):
        """Creating a top-layer scorecard sets status=draft and no department."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        data = SDBIPScorecardCreate(
            financial_year="2025/26",
            layer=SDBIPLayer.TOP,
            title="Municipal Top-Layer SDBIP 2025/26",
        )

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(data, user, db_session)
        finally:
            clear_tenant_context()

        assert scorecard.id is not None
        assert scorecard.financial_year == "2025/26"
        assert scorecard.layer == SDBIPLayer.TOP
        assert scorecard.status == SDBIPStatus.DRAFT
        assert scorecard.department_id is None  # top-layer: no department
        assert scorecard.tenant_id == tenant_id
        assert scorecard.title == "Municipal Top-Layer SDBIP 2025/26"


# ---------------------------------------------------------------------------
# Test 2: Departmental scorecard requires department_id
# ---------------------------------------------------------------------------


class TestCreateDepartmentalScorecard:
    """Tests for SDBIPService.create_scorecard() with layer=departmental."""

    async def test_create_departmental_scorecard_requires_department(
        self, db_session: AsyncSession
    ):
        """Creating a departmental scorecard without department_id raises 422."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        data = SDBIPScorecardCreate(
            financial_year="2025/26",
            layer=SDBIPLayer.DEPARTMENTAL,
            # department_id intentionally omitted
        )

        set_tenant_context(tenant_id)
        try:
            with pytest.raises(HTTPException) as exc_info:
                await service.create_scorecard(data, user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "department_id" in exc_info.value.detail.lower()

    async def test_create_departmental_scorecard_with_department(
        self, db_session: AsyncSession
    ):
        """Creating a departmental scorecard with department_id succeeds."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)
        dept_id = uuid4()

        data = SDBIPScorecardCreate(
            financial_year="2025/26",
            layer=SDBIPLayer.DEPARTMENTAL,
            department_id=dept_id,
        )

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(data, user, db_session)
        finally:
            clear_tenant_context()

        assert scorecard.layer == SDBIPLayer.DEPARTMENTAL
        assert scorecard.department_id == dept_id
        assert scorecard.status == SDBIPStatus.DRAFT


# ---------------------------------------------------------------------------
# Test 3: Create departmental KPI with IDP objective link
# ---------------------------------------------------------------------------


class TestCreateSDBIPKpi:
    """Tests for SDBIPService.create_kpi()."""

    async def test_create_departmental_kpi(self, db_session: AsyncSession):
        """Creates a KPI with all required fields and IDP objective link."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create scorecard
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(
                    financial_year="2025/26",
                    layer=SDBIPLayer.TOP,
                ),
                user, db_session,
            )

            # Create IDP objective for golden thread link
            objective = await _create_idp_objective(db_session, tenant_id, user)

            # Create KPI
            kpi_data = SDBIPKpiCreate(
                kpi_number="KPI-001",
                description="Percentage of households with access to clean water",
                unit_of_measurement="percentage",
                baseline=Decimal("72.50"),
                annual_target=Decimal("85.00"),
                weight=Decimal("20.00"),
                idp_objective_id=objective.id,
            )
            kpi = await service.create_kpi(scorecard.id, kpi_data, user, db_session)
        finally:
            clear_tenant_context()

        assert kpi.id is not None
        assert kpi.scorecard_id == scorecard.id
        assert kpi.kpi_number == "KPI-001"
        assert kpi.description == "Percentage of households with access to clean water"
        assert kpi.unit_of_measurement == "percentage"
        assert kpi.baseline == Decimal("72.50")
        assert kpi.annual_target == Decimal("85.00")
        assert kpi.weight == Decimal("20.00")
        assert kpi.tenant_id == tenant_id


# ---------------------------------------------------------------------------
# Test 4: Weight validation — weight > 100 rejected by schema
# ---------------------------------------------------------------------------


class TestKpiWeightValidation:
    """Tests for SDBIP KPI weight field validation."""

    def test_kpi_weight_over_100_rejected(self):
        """SDBIPKpiCreate rejects weight > 100 (schema-level validation)."""
        with pytest.raises(Exception) as exc_info:
            SDBIPKpiCreate(
                kpi_number="KPI-001",
                description="Test KPI",
                unit_of_measurement="percentage",
                baseline=Decimal("0"),
                annual_target=Decimal("100"),
                weight=Decimal("101"),  # Over 100 — should fail
            )
        assert "weight" in str(exc_info.value).lower() or "100" in str(exc_info.value)

    def test_kpi_weight_zero_accepted(self):
        """SDBIPKpiCreate accepts weight=0 (minimum boundary)."""
        kpi = SDBIPKpiCreate(
            kpi_number="KPI-001",
            description="Test KPI",
            unit_of_measurement="number",
            baseline=Decimal("0"),
            annual_target=Decimal("10"),
            weight=Decimal("0"),
        )
        assert kpi.weight == Decimal("0")

    def test_kpi_weight_100_accepted(self):
        """SDBIPKpiCreate accepts weight=100 (maximum boundary)."""
        kpi = SDBIPKpiCreate(
            kpi_number="KPI-001",
            description="Test KPI",
            unit_of_measurement="number",
            baseline=Decimal("0"),
            annual_target=Decimal("100"),
            weight=Decimal("100"),
        )
        assert kpi.weight == Decimal("100")


# ---------------------------------------------------------------------------
# Test 5: Quarterly targets require all four quarters
# ---------------------------------------------------------------------------


class TestQuarterlyTargets:
    """Tests for QuarterlyTargetBulkCreate validation and SDBIPService.set_quarterly_targets."""

    def test_quarterly_targets_require_all_four_schema(self):
        """QuarterlyTargetBulkCreate rejects fewer than 4 quarters."""
        with pytest.raises(Exception):
            QuarterlyTargetBulkCreate(
                targets=[
                    QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("25")),
                    QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=Decimal("25")),
                    QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=Decimal("25")),
                    # Q4 missing
                ]
            )

    def test_quarterly_targets_reject_duplicates(self):
        """QuarterlyTargetBulkCreate rejects duplicate quarters."""
        with pytest.raises(Exception):
            QuarterlyTargetBulkCreate(
                targets=[
                    QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("25")),
                    QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("25")),  # duplicate
                    QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=Decimal("25")),
                    QuarterlyTargetCreate(quarter=Quarter.Q4, target_value=Decimal("25")),
                ]
            )

    def test_quarterly_targets_all_four_valid(self):
        """QuarterlyTargetBulkCreate accepts exactly Q1, Q2, Q3, Q4."""
        payload = make_quarterly_targets_payload()
        assert len(payload.targets) == 4
        quarters = {t.quarter for t in payload.targets}
        assert quarters == {Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4}

    async def test_set_quarterly_targets_creates_four_records(self, db_session: AsyncSession):
        """SDBIPService.set_quarterly_targets creates exactly 4 target records in DB."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
                user, db_session,
            )
            kpi = await service.create_kpi(
                scorecard.id,
                SDBIPKpiCreate(
                    kpi_number="KPI-001",
                    description="Water access",
                    unit_of_measurement="percentage",
                    baseline=Decimal("70"),
                    annual_target=Decimal("90"),
                    weight=Decimal("30"),
                ),
                user, db_session,
            )
            targets = await service.set_quarterly_targets(
                kpi.id, make_quarterly_targets_payload(), user, db_session
            )
        finally:
            clear_tenant_context()

        assert len(targets) == 4
        quarters_set = {t.quarter for t in targets}
        assert quarters_set == {"Q1", "Q2", "Q3", "Q4"}

    async def test_set_quarterly_targets_replaces_existing(self, db_session: AsyncSession):
        """Calling set_quarterly_targets twice replaces existing records (upsert)."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
                user, db_session,
            )
            kpi = await service.create_kpi(
                scorecard.id,
                SDBIPKpiCreate(
                    kpi_number="KPI-001",
                    description="Water access",
                    unit_of_measurement="percentage",
                    baseline=Decimal("70"),
                    annual_target=Decimal("90"),
                    weight=Decimal("30"),
                ),
                user, db_session,
            )

            # First set
            await service.set_quarterly_targets(
                kpi.id, make_quarterly_targets_payload(), user, db_session
            )

            # Second set with different values
            new_payload = QuarterlyTargetBulkCreate(
                targets=[
                    QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("10")),
                    QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=Decimal("20")),
                    QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=Decimal("30")),
                    QuarterlyTargetCreate(quarter=Quarter.Q4, target_value=Decimal("40")),
                ]
            )
            targets = await service.set_quarterly_targets(
                kpi.id, new_payload, user, db_session
            )

            # Fetch again to confirm no duplicates
            fetched = await service.get_quarterly_targets(kpi.id, db_session)
        finally:
            clear_tenant_context()

        assert len(fetched) == 4  # Still exactly 4 (not 8)
        q1_target = next(t for t in fetched if t.quarter == "Q1")
        assert q1_target.target_value == Decimal("10.0000")


# ---------------------------------------------------------------------------
# Test 6: Invalid mSCOA code rejected
# ---------------------------------------------------------------------------


class TestMscoaValidation:
    """Tests for mSCOA code FK validation in SDBIPService.create_kpi()."""

    async def test_invalid_mscoa_code_rejected(self, db_session: AsyncSession):
        """Non-existent mscoa_code_id raises 422 from the service layer."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)
        fake_mscoa_id = uuid4()  # Does not exist in DB

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
                user, db_session,
            )

            with pytest.raises(HTTPException) as exc_info:
                await service.create_kpi(
                    scorecard.id,
                    SDBIPKpiCreate(
                        kpi_number="KPI-001",
                        description="Test KPI",
                        unit_of_measurement="number",
                        baseline=Decimal("0"),
                        annual_target=Decimal("100"),
                        weight=Decimal("20"),
                        mscoa_code_id=fake_mscoa_id,
                    ),
                    user, db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "mscoa" in exc_info.value.detail.lower() or "Invalid" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Test 7: mSCOA search by segment
# ---------------------------------------------------------------------------


class TestMscoaSearch:
    """Tests for SDBIPService.search_mscoa()."""

    async def test_mscoa_search_by_segment(self, db_session: AsyncSession):
        """search_mscoa(segment=IE) returns only IE rows."""
        service = SDBIPService()

        # Insert test mSCOA rows (NonTenantModel — no tenant context needed)
        await _create_test_mscoa_row(db_session, "IE", "0100", "Employee Related Costs")
        await _create_test_mscoa_row(db_session, "IE", "0200", "Remuneration of Councillors")
        await _create_test_mscoa_row(db_session, "FX", "0300", "Community Services")

        results = await service.search_mscoa(segment="IE", q=None, db=db_session)

        assert len(results) == 2
        for r in results:
            assert r.segment == "IE"

    async def test_mscoa_search_case_insensitive_segment(self, db_session: AsyncSession):
        """search_mscoa segment filter is case-insensitive (ie == IE)."""
        service = SDBIPService()

        await _create_test_mscoa_row(db_session, "IE", "0300", "Depreciation")

        results = await service.search_mscoa(segment="ie", q=None, db=db_session)
        assert len(results) >= 1
        assert all(r.segment == "IE" for r in results)


# ---------------------------------------------------------------------------
# Test 8: mSCOA search by description
# ---------------------------------------------------------------------------

    async def test_mscoa_search_by_description(self, db_session: AsyncSession):
        """search_mscoa(q=employee) returns rows matching description keyword."""
        service = SDBIPService()

        await _create_test_mscoa_row(db_session, "IE", "0100", "Employee Related Costs")
        await _create_test_mscoa_row(db_session, "IE", "0900", "Other Expenditure")

        results = await service.search_mscoa(segment=None, q="employee", db=db_session)

        assert len(results) >= 1
        assert all("employee" in r.description.lower() for r in results)

    async def test_mscoa_search_no_filters_returns_all_active(self, db_session: AsyncSession):
        """search_mscoa with no filters returns all active rows (up to 50)."""
        service = SDBIPService()

        await _create_test_mscoa_row(db_session, "IE", "0100", "Employee Related Costs")
        await _create_test_mscoa_row(db_session, "FX", "0300", "Community Services")
        await _create_test_mscoa_row(db_session, "IA", "0200", "Buildings")

        results = await service.search_mscoa(segment=None, q=None, db=db_session)
        assert len(results) >= 3


# ---------------------------------------------------------------------------
# Test 9: KPI links to IDP objective
# ---------------------------------------------------------------------------


class TestKpiObjectiveLink:
    """Tests for SDBIPKpi.idp_objective_id FK correctness."""

    async def test_kpi_links_to_objective(self, db_session: AsyncSession):
        """idp_objective_id FK is set correctly on the KPI record."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
                user, db_session,
            )

            # Create IDP objective to link
            objective = await _create_idp_objective(db_session, tenant_id, user)

            kpi = await service.create_kpi(
                scorecard.id,
                SDBIPKpiCreate(
                    kpi_number="KPI-002",
                    description="Road infrastructure coverage",
                    unit_of_measurement="percentage",
                    baseline=Decimal("60.00"),
                    annual_target=Decimal("75.00"),
                    weight=Decimal("15.00"),
                    idp_objective_id=objective.id,
                ),
                user, db_session,
            )
        finally:
            clear_tenant_context()

        assert kpi.idp_objective_id == objective.id
        assert kpi.idp_objective_id is not None

    async def test_kpi_invalid_objective_rejected(self, db_session: AsyncSession):
        """Creating a KPI with non-existent idp_objective_id raises 422."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)
        fake_obj_id = uuid4()

        set_tenant_context(tenant_id)
        try:
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
                user, db_session,
            )

            with pytest.raises(HTTPException) as exc_info:
                await service.create_kpi(
                    scorecard.id,
                    SDBIPKpiCreate(
                        kpi_number="KPI-003",
                        description="Test KPI with bad objective",
                        unit_of_measurement="number",
                        baseline=Decimal("0"),
                        annual_target=Decimal("10"),
                        weight=Decimal("10"),
                        idp_objective_id=fake_obj_id,
                    ),
                    user, db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# Test 10: List scorecards filtered by financial year
# ---------------------------------------------------------------------------


class TestListScorecards:
    """Tests for SDBIPService.list_scorecards() with financial_year filter."""

    async def test_list_scorecards_by_financial_year(self, db_session: AsyncSession):
        """list_scorecards(financial_year=2025/26) returns only matching scorecards."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create scorecards for different financial years
            await service.create_scorecard(
                SDBIPScorecardCreate(
                    financial_year="2025/26",
                    layer=SDBIPLayer.TOP,
                    title="2025/26 Top Layer",
                ),
                user, db_session,
            )
            await service.create_scorecard(
                SDBIPScorecardCreate(
                    financial_year="2026/27",
                    layer=SDBIPLayer.TOP,
                    title="2026/27 Top Layer",
                ),
                user, db_session,
            )

            # Filter by financial year
            results_2025 = await service.list_scorecards("2025/26", db_session)
            results_2026 = await service.list_scorecards("2026/27", db_session)
            results_all = await service.list_scorecards(None, db_session)
        finally:
            clear_tenant_context()

        assert len(results_2025) == 1
        assert results_2025[0].financial_year == "2025/26"

        assert len(results_2026) == 1
        assert results_2026[0].financial_year == "2026/27"

        assert len(results_all) == 2

    async def test_list_scorecards_empty_for_unknown_year(self, db_session: AsyncSession):
        """list_scorecards returns empty list for a year with no scorecards."""
        service = SDBIPService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            results = await service.list_scorecards("2099/00", db_session)
        finally:
            clear_tenant_context()

        assert results == []


# ---------------------------------------------------------------------------
# Importability checks
# ---------------------------------------------------------------------------


def test_sdbip_router_importable():
    """The SDBIP router can be imported without errors."""
    from src.api.v1.sdbip import router
    assert router is not None
    paths = [r.path for r in router.routes]
    assert "/api/v1/sdbip/scorecards" in paths
    assert "/api/v1/sdbip/kpis/{kpi_id}/quarterly-targets" in paths
    assert "/api/v1/sdbip/mscoa-codes" in paths


def test_sdbip_service_importable():
    """SDBIPService and all schemas are importable without errors."""
    from src.services.sdbip_service import SDBIPService
    from src.schemas.sdbip import (
        SDBIPScorecardCreate, SDBIPScorecardResponse,
        SDBIPKpiCreate, SDBIPKpiResponse,
        QuarterlyTargetCreate, QuarterlyTargetBulkCreate, QuarterlyTargetResponse,
        MscoaSearchResponse,
    )
    assert SDBIPService is not None


def test_financial_year_validation():
    """SDBIPScorecardCreate validates YYYY/YY pattern correctly."""
    # Valid
    s = SDBIPScorecardCreate(financial_year="2025/26", layer="top")
    assert s.financial_year == "2025/26"

    # Invalid formats
    invalid_years = ["25/26", "2025-26", "25-26", "2025/2026", "abcd/ef"]
    for year in invalid_years:
        with pytest.raises(Exception):
            SDBIPScorecardCreate(financial_year=year, layer="top")


def test_quarterly_target_bulk_create_validation():
    """QuarterlyTargetBulkCreate schema validation works correctly."""
    # Valid — all 4 quarters
    payload = make_quarterly_targets_payload()
    assert len(payload.targets) == 4

    # Invalid — only 3 quarters
    with pytest.raises(Exception):
        QuarterlyTargetBulkCreate(
            targets=[
                QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("25")),
                QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=Decimal("25")),
                QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=Decimal("25")),
            ]
        )
