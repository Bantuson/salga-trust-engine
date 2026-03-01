"""Unit tests for Performance Agreement (PA) models, service, and API.

Tests cover:
1.  test_create_agreement_draft_status — POST creates PA in draft, correct fields stored
2.  test_unique_constraint_manager_fy — second PA for same manager+year+tenant returns 409
3.  test_add_kpi_to_agreement — PAKpi created with sdbip_kpi_id, individual_target, weight
4.  test_weight_sum_exceeds_100_rejected — adding KPIs totaling >100 weight returns 422
5.  test_sign_agreement_by_mm — MM signs section57_director PA, status transitions to "signed"
6.  test_sign_agreement_wrong_role — PMS officer (Tier 3) cannot sign -> 403
7.  test_executive_mayor_signs_mm_pa — ExecMayor signs municipal_manager PA -> "signed"
8.  test_invalid_transition_sign_twice — sign already-signed PA -> 409
9.  test_workflow_full_lifecycle — draft -> signed -> under_review -> assessed full cycle
10. test_popia_flag_set_on_assess — assess transition sets popia_retention_flag=True
11. test_financial_year_format_validation — PACreate with invalid format rejected by schema

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally
to satisfy the application-level RLS tenant filter.

Note: SDBIPKpi is a TenantAwareModel that requires a SDBIPScorecard, which in turn
needs an IDP objective chain. Helper _create_sdbip_kpi() handles the full setup.
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.idp import IDPCycle, IDPGoal, IDPObjective, NationalKPA
from src.models.pa import (
    ManagerRole,
    PAKpi,
    PAStatus,
    PerformanceAgreement,
)
from src.models.sdbip import SDBIPKpi, SDBIPScorecard, SDBIPStatus
from src.models.user import User, UserRole
from src.schemas.pa import PACreate, PAKpiCreate, PATransitionRequest
from src.services.pa_service import PAService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Mock user helpers
# ---------------------------------------------------------------------------


def make_mock_pms_officer(tenant_id: str | None = None) -> MagicMock:
    """Create a mock PMS officer (Tier 3) user."""
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


def make_mock_mm(tenant_id: str | None = None) -> MagicMock:
    """Create a mock Municipal Manager (Tier 1) user."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "mm@test.gov.za"
    user.full_name = "Municipal Manager"
    user.role = UserRole.MUNICIPAL_MANAGER
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def make_mock_exec_mayor(tenant_id: str | None = None) -> MagicMock:
    """Create a mock Executive Mayor (Tier 1) user."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "mayor@test.gov.za"
    user.full_name = "Executive Mayor"
    user.role = UserRole.EXECUTIVE_MAYOR
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def make_mock_director(tenant_id: str | None = None) -> MagicMock:
    """Create a mock Section 56 Director (Tier 2) user."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "director@test.gov.za"
    user.full_name = "Section 56 Director"
    user.role = UserRole.SECTION56_DIRECTOR
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


# ---------------------------------------------------------------------------
# Database helpers — create prerequisite data
# ---------------------------------------------------------------------------


async def _create_real_user(
    db: AsyncSession,
    tenant_id: str,
    role: UserRole = UserRole.PMS_OFFICER,
) -> User:
    """Insert a real User row into the DB for FK validation tests."""
    from src.models.municipality import Municipality

    # We need a real municipality to satisfy User.municipality_id FK
    muni = Municipality(
        name=f"Test Municipality {uuid4().hex[:8]}",
        code=uuid4().hex[:6].upper(),
        province="Gauteng",
        is_active=True,
    )
    db.add(muni)
    await db.commit()
    await db.refresh(muni)

    user = User(
        email=f"user_{uuid4().hex[:8]}@test.gov.za",
        hashed_password="supabase_managed",
        full_name="Test Manager",
        role=role,
        tenant_id=tenant_id,
        municipality_id=muni.id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _create_sdbip_kpi(
    db: AsyncSession,
    tenant_id: str,
    creator_id: str,
    suffix: str | None = None,
) -> SDBIPKpi:
    """Create the full IDP -> SDBIP chain needed for a valid SDBIPKpi FK.

    Chain: IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi

    Args:
        suffix: Optional suffix to make titles unique when called multiple times
                in the same test with the same tenant_id.
    """
    tag = suffix or uuid4().hex[:8]

    cycle = IDPCycle(
        title=f"Test IDP Cycle {tag}",
        start_year=2022,
        end_year=2027,
        status="draft",
        tenant_id=tenant_id,
        created_by=creator_id,
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)

    goal = IDPGoal(
        cycle_id=cycle.id,
        title=f"Test Goal {tag}",
        national_kpa=NationalKPA.BASIC_SERVICE_DELIVERY.value,
        display_order=0,
        tenant_id=tenant_id,
        created_by=creator_id,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    objective = IDPObjective(
        goal_id=goal.id,
        title=f"Test Objective {tag}",
        display_order=0,
        tenant_id=tenant_id,
        created_by=creator_id,
    )
    db.add(objective)
    await db.commit()
    await db.refresh(objective)

    scorecard = SDBIPScorecard(
        financial_year="2025/26",
        layer="top",
        status=SDBIPStatus.DRAFT,
        tenant_id=tenant_id,
        created_by=creator_id,
    )
    db.add(scorecard)
    await db.commit()
    await db.refresh(scorecard)

    kpi = SDBIPKpi(
        scorecard_id=scorecard.id,
        idp_objective_id=objective.id,
        kpi_number=f"KPI-{tag[:6]}",
        description=f"Test KPI for PA linkage {tag}",
        unit_of_measurement="percentage",
        baseline=Decimal("50.00"),
        annual_target=Decimal("80.00"),
        weight=Decimal("20.00"),
        tenant_id=tenant_id,
        created_by=creator_id,
    )
    db.add(kpi)
    await db.commit()
    await db.refresh(kpi)
    return kpi


# ---------------------------------------------------------------------------
# Test 1: Create agreement in draft status
# ---------------------------------------------------------------------------


class TestCreateAgreementDraftStatus:
    """Tests for PAService.create_agreement()."""

    async def test_create_agreement_draft_status(self, db_session: AsyncSession):
        """Creating a PA sets status=draft and stores financial_year and manager_role."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create a real user for the section57_manager_id FK
            real_manager = await _create_real_user(db_session, tenant_id, role=UserRole.SECTION56_DIRECTOR)

            data = PACreate(
                financial_year="2025/26",
                section57_manager_id=real_manager.id,
                manager_role=ManagerRole.SECTION57_DIRECTOR,
            )
            agreement = await service.create_agreement(data, pms_user, db_session)
        finally:
            clear_tenant_context()

        assert agreement.id is not None
        assert agreement.financial_year == "2025/26"
        assert agreement.manager_role == ManagerRole.SECTION57_DIRECTOR
        assert agreement.status == PAStatus.DRAFT
        assert agreement.section57_manager_id == real_manager.id
        assert agreement.tenant_id == tenant_id
        assert agreement.popia_retention_flag is False


# ---------------------------------------------------------------------------
# Test 2: Unique constraint — same manager + FY + tenant returns 409
# ---------------------------------------------------------------------------


class TestUniqueConstraintManagerFy:
    """Tests for duplicate PA detection."""

    async def test_unique_constraint_manager_fy(self, db_session: AsyncSession):
        """Second PA for same manager+year+tenant returns 409 Conflict."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)

            data = PACreate(
                financial_year="2025/26",
                section57_manager_id=real_manager.id,
                manager_role=ManagerRole.SECTION57_DIRECTOR,
            )
            # First creation should succeed
            await service.create_agreement(data, pms_user, db_session)

            # Second creation with same manager + FY + tenant should fail
            with pytest.raises(HTTPException) as exc_info:
                await service.create_agreement(data, pms_user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# Test 3: Add KPI to agreement
# ---------------------------------------------------------------------------


class TestAddKpiToAgreement:
    """Tests for PAService.add_kpi()."""

    async def test_add_kpi_to_agreement(self, db_session: AsyncSession):
        """PAKpi is created with correct sdbip_kpi_id, individual_target, and weight."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)
            sdbip_kpi = await _create_sdbip_kpi(db_session, tenant_id, str(pms_user.id))

            # Create agreement
            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )

            # Add KPI
            kpi = await service.add_kpi(
                agreement.id,
                PAKpiCreate(
                    sdbip_kpi_id=sdbip_kpi.id,
                    individual_target=Decimal("75.00"),
                    weight=Decimal("30.00"),
                    description="Individual target for water access",
                ),
                pms_user, db_session,
            )
        finally:
            clear_tenant_context()

        assert kpi.id is not None
        assert kpi.agreement_id == agreement.id
        assert kpi.sdbip_kpi_id == sdbip_kpi.id
        assert kpi.individual_target == Decimal("75.00")
        assert kpi.weight == Decimal("30.00")
        assert kpi.description == "Individual target for water access"
        assert kpi.tenant_id == tenant_id


# ---------------------------------------------------------------------------
# Test 4: Weight sum > 100 returns 422
# ---------------------------------------------------------------------------


class TestWeightSumExceeds100Rejected:
    """Tests for weight sum enforcement in PAService.add_kpi()."""

    async def test_weight_sum_exceeds_100_rejected(self, db_session: AsyncSession):
        """Adding KPIs totaling > 100 weight returns 422."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)
            sdbip_kpi = await _create_sdbip_kpi(db_session, tenant_id, str(pms_user.id))

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )

            # First KPI with weight 80
            await service.add_kpi(
                agreement.id,
                PAKpiCreate(
                    sdbip_kpi_id=sdbip_kpi.id,
                    individual_target=Decimal("80.00"),
                    weight=Decimal("80.00"),
                ),
                pms_user, db_session,
            )

            # Second SDBIP KPI for the second PA KPI
            sdbip_kpi2 = await _create_sdbip_kpi(db_session, tenant_id, str(pms_user.id))

            # Adding second KPI with weight 30 would take total to 110 -> 422
            with pytest.raises(HTTPException) as exc_info:
                await service.add_kpi(
                    agreement.id,
                    PAKpiCreate(
                        sdbip_kpi_id=sdbip_kpi2.id,
                        individual_target=Decimal("50.00"),
                        weight=Decimal("30.00"),
                    ),
                    pms_user, db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "weight" in exc_info.value.detail.lower() or "100" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Test 5: MM signs section57_director PA -> "signed"
# ---------------------------------------------------------------------------


class TestSignAgreementByMm:
    """Tests for MM signing a section57_director PA (PA-06)."""

    async def test_sign_agreement_by_mm(self, db_session: AsyncSession):
        """Municipal Manager can sign a section57_director PA -> status becomes 'signed'."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)
        mm_user = make_mock_mm(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )
            assert agreement.status == PAStatus.DRAFT

            # MM signs the director PA
            signed = await service.transition_agreement(
                agreement.id, "sign", mm_user, db_session
            )
        finally:
            clear_tenant_context()

        assert signed.status == PAStatus.SIGNED


# ---------------------------------------------------------------------------
# Test 6: PMS officer (Tier 3) cannot sign -> 403
# ---------------------------------------------------------------------------


class TestSignAgreementWrongRole:
    """Tests for role-gated signing rejection (PA-06)."""

    async def test_sign_agreement_wrong_role(self, db_session: AsyncSession):
        """PMS officer (Tier 3) attempting to sign a director PA gets 403."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )

            # PMS officer (not MM) tries to sign -> 403
            with pytest.raises(HTTPException) as exc_info:
                await service.transition_agreement(
                    agreement.id, "sign", pms_user, db_session
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# Test 7: Executive Mayor signs municipal_manager PA -> "signed"
# ---------------------------------------------------------------------------


class TestExecutiveMayorSignsMmPa:
    """Tests for Executive Mayor signing a municipal_manager PA (PA-06)."""

    async def test_executive_mayor_signs_mm_pa(self, db_session: AsyncSession):
        """Executive Mayor can sign a municipal_manager PA -> status becomes 'signed'."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)
        exec_mayor = make_mock_exec_mayor(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id, role=UserRole.MUNICIPAL_MANAGER)

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.MUNICIPAL_MANAGER,
                ),
                pms_user, db_session,
            )
            assert agreement.status == PAStatus.DRAFT

            # Executive Mayor signs the MM PA
            signed = await service.transition_agreement(
                agreement.id, "sign", exec_mayor, db_session
            )
        finally:
            clear_tenant_context()

        assert signed.status == PAStatus.SIGNED


# ---------------------------------------------------------------------------
# Test 8: Sign already-signed PA -> 409
# ---------------------------------------------------------------------------


class TestInvalidTransitionSignTwice:
    """Tests for invalid state machine transitions."""

    async def test_invalid_transition_sign_twice(self, db_session: AsyncSession):
        """Signing an already-signed PA returns 409 Conflict."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)
        mm_user = make_mock_mm(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )

            # Sign once -> should succeed
            await service.transition_agreement(agreement.id, "sign", mm_user, db_session)

            # Sign again -> 409
            with pytest.raises(HTTPException) as exc_info:
                await service.transition_agreement(agreement.id, "sign", mm_user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# Test 9: Full lifecycle draft -> signed -> under_review -> assessed
# ---------------------------------------------------------------------------


class TestWorkflowFullLifecycle:
    """Tests for the full PA state machine lifecycle."""

    async def test_workflow_full_lifecycle(self, db_session: AsyncSession):
        """PA transitions through all states: draft -> signed -> under_review -> assessed."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)
        mm_user = make_mock_mm(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )
            assert agreement.status == PAStatus.DRAFT

            # draft -> signed
            agreement = await service.transition_agreement(
                agreement.id, "sign", mm_user, db_session
            )
            assert agreement.status == PAStatus.SIGNED

            # signed -> under_review (open mid-year review; any Tier 1+ can do this)
            agreement = await service.transition_agreement(
                agreement.id, "open_review", mm_user, db_session
            )
            assert agreement.status == PAStatus.UNDER_REVIEW

            # under_review -> assessed
            agreement = await service.transition_agreement(
                agreement.id, "assess", mm_user, db_session
            )
            assert agreement.status == PAStatus.ASSESSED
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 10: assess transition sets popia_retention_flag=True
# ---------------------------------------------------------------------------


class TestPopiaFlagSetOnAssess:
    """Tests for POPIA compliance flag on assess transition."""

    async def test_popia_flag_set_on_assess(self, db_session: AsyncSession):
        """assess transition sets popia_retention_flag=True on the agreement."""
        service = PAService()
        tenant_id = str(uuid4())
        pms_user = make_mock_pms_officer(tenant_id=tenant_id)
        mm_user = make_mock_mm(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            real_manager = await _create_real_user(db_session, tenant_id)

            agreement = await service.create_agreement(
                PACreate(
                    financial_year="2025/26",
                    section57_manager_id=real_manager.id,
                    manager_role=ManagerRole.SECTION57_DIRECTOR,
                ),
                pms_user, db_session,
            )

            # Initial flag should be False
            assert agreement.popia_retention_flag is False

            # Progress through lifecycle
            agreement = await service.transition_agreement(
                agreement.id, "sign", mm_user, db_session
            )
            assert agreement.popia_retention_flag is False

            agreement = await service.transition_agreement(
                agreement.id, "open_review", mm_user, db_session
            )
            assert agreement.popia_retention_flag is False

            # Assess -> popia_retention_flag should be True
            assessed = await service.transition_agreement(
                agreement.id, "assess", mm_user, db_session
            )
        finally:
            clear_tenant_context()

        assert assessed.status == PAStatus.ASSESSED
        assert assessed.popia_retention_flag is True


# ---------------------------------------------------------------------------
# Test 11: financial_year format validation (schema-level)
# ---------------------------------------------------------------------------


class TestFinancialYearFormatValidation:
    """Tests for financial_year format validation in PACreate schema."""

    def test_financial_year_format_validation_invalid(self):
        """PACreate with invalid financial_year format raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            PACreate(
                financial_year="2025-26",  # Wrong format — must be YYYY/YY
                section57_manager_id=uuid4(),
                manager_role="section57_director",
            )
        errors = exc_info.value.errors()
        assert any("financial_year" in str(e) for e in errors)

    def test_financial_year_format_validation_valid(self):
        """PACreate with correct YYYY/YY financial_year passes validation."""
        schema = PACreate(
            financial_year="2025/26",
            section57_manager_id=uuid4(),
            manager_role="section57_director",
        )
        assert schema.financial_year == "2025/26"

    def test_manager_role_validation_invalid(self):
        """PACreate with invalid manager_role raises ValidationError."""
        with pytest.raises(ValidationError):
            PACreate(
                financial_year="2025/26",
                section57_manager_id=uuid4(),
                manager_role="invalid_role",
            )

    def test_pa_transition_event_validation_invalid(self):
        """PATransitionRequest with invalid event raises ValidationError."""
        with pytest.raises(ValidationError):
            PATransitionRequest(event="approve")  # Not a valid PA event

    def test_pa_transition_event_validation_valid(self):
        """PATransitionRequest with valid events passes validation."""
        for event in ("sign", "open_review", "assess"):
            req = PATransitionRequest(event=event)
            assert req.event == event
