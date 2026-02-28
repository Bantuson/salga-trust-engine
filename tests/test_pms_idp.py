"""Unit tests for IDP (Integrated Development Plan) models, service, and API.

Tests cover:
1.  create_idp_cycle — POST creates cycle with status=draft
2.  create_idp_cycle_year_validation — end_year must equal start_year + 5
3.  add_idp_goal_with_kpa — POST adds goal with valid NationalKPA enum
4.  add_idp_goal_invalid_kpa — POST rejects invalid KPA value (422)
5.  add_objective — POST adds objective under a goal
6.  idp_version_unique — second version with same version_number raises 409
7.  idp_workflow_submit — transition from draft to approved succeeds
8.  idp_workflow_invalid_transition — transition from draft via open_review returns 409
9.  idp_workflow_full_cycle — draft -> approved -> under_review -> approved
10. list_cycles — GET returns list of cycles for tenant
11. golden_thread_structure — nested goals/objectives structure
12. golden_thread_empty_cycle — cycle with no goals returns goals=[]

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally
to satisfy the application-level RLS tenant filter (not PostgreSQL RLS).
"""
import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.idp import IDPCycle, IDPGoal, IDPObjective, IDPVersion, IDPStatus, NationalKPA
from src.models.user import User, UserRole
from src.schemas.idp import (
    IDPCycleCreate,
    IDPGoalCreate,
    IDPObjectiveCreate,
    IDPVersionCreate,
)
from src.services.idp_service import IDPService

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


def make_cycle_create(start_year: int = 2022, title: str = "IDP 2022-2027") -> IDPCycleCreate:
    """Create a valid IDPCycleCreate payload."""
    return IDPCycleCreate(
        title=title,
        vision="A prosperous and sustainable municipality",
        mission="Deliver quality services to all residents",
        start_year=start_year,
        end_year=start_year + 5,
    )


# ---------------------------------------------------------------------------
# Test 1: Create IDP cycle with draft status
# ---------------------------------------------------------------------------

class TestCreateIDPCycle:
    """Tests for IDPService.create_cycle()."""

    async def test_create_idp_cycle(self, db_session: AsyncSession):
        """Creating a cycle sets status=draft and persists to DB."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)
        data = make_cycle_create()

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(data, user, db_session)
        finally:
            clear_tenant_context()

        assert cycle.id is not None
        assert cycle.title == "IDP 2022-2027"
        assert cycle.status == IDPStatus.DRAFT
        assert cycle.tenant_id == tenant_id
        assert cycle.start_year == 2022
        assert cycle.end_year == 2027

    # ---------------------------------------------------------------------------
    # Test 2: Year span validation
    # ---------------------------------------------------------------------------

    def test_create_idp_cycle_year_validation_wrong_span(self):
        """IDPCycleCreate rejects cycles not spanning exactly 5 years."""
        with pytest.raises(Exception):
            IDPCycleCreate(
                title="Bad Cycle",
                start_year=2022,
                end_year=2030,  # 8 years, not 5
            )

    def test_create_idp_cycle_year_validation_end_before_start(self):
        """IDPCycleCreate rejects end_year <= start_year."""
        with pytest.raises(Exception):
            IDPCycleCreate(
                title="Bad Cycle",
                start_year=2022,
                end_year=2020,
            )

    def test_create_idp_cycle_year_validation_valid(self):
        """IDPCycleCreate accepts exactly 5-year span."""
        data = IDPCycleCreate(
            title="Valid Cycle",
            start_year=2023,
            end_year=2028,
        )
        assert data.start_year == 2023
        assert data.end_year == 2028


# ---------------------------------------------------------------------------
# Test 3: Add goal with valid NationalKPA
# ---------------------------------------------------------------------------

class TestIDPGoals:
    """Tests for IDPService.add_goal()."""

    async def test_add_idp_goal_with_kpa(self, db_session: AsyncSession):
        """Adding a goal with valid NationalKPA persists it under the cycle."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(make_cycle_create(), user, db_session)

            goal_data = IDPGoalCreate(
                title="Improve Service Delivery",
                description="Enhance water and sanitation services",
                national_kpa=NationalKPA.BASIC_SERVICE_DELIVERY,
            )
            goal = await service.add_goal(cycle.id, goal_data, user, db_session)
        finally:
            clear_tenant_context()

        assert goal.id is not None
        assert goal.cycle_id == cycle.id
        assert goal.title == "Improve Service Delivery"
        assert goal.national_kpa == NationalKPA.BASIC_SERVICE_DELIVERY.value
        assert goal.tenant_id == tenant_id

    # ---------------------------------------------------------------------------
    # Test 4: Invalid KPA value
    # ---------------------------------------------------------------------------

    def test_add_idp_goal_invalid_kpa(self):
        """IDPGoalCreate rejects invalid national_kpa value (422-equivalent)."""
        with pytest.raises(Exception):
            IDPGoalCreate(
                title="Bad Goal",
                national_kpa="nonexistent_kpa",
            )

    def test_add_idp_goal_all_valid_kpa_values(self):
        """All 5 NationalKPA enum values are accepted by IDPGoalCreate."""
        for kpa in NationalKPA:
            data = IDPGoalCreate(title=f"Goal for {kpa}", national_kpa=kpa)
            assert data.national_kpa == kpa


# ---------------------------------------------------------------------------
# Test 5: Add objective under a goal
# ---------------------------------------------------------------------------

class TestIDPObjectives:
    """Tests for IDPService.add_objective()."""

    async def test_add_objective(self, db_session: AsyncSession):
        """Adding an objective under a goal persists it and links correctly."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(make_cycle_create(), user, db_session)
            goal = await service.add_goal(
                cycle.id,
                IDPGoalCreate(title="Economic Goal", national_kpa=NationalKPA.LOCAL_ECONOMIC_DEVELOPMENT),
                user,
                db_session,
            )

            obj_data = IDPObjectiveCreate(
                title="Increase SMME registrations by 10%",
                description="Support local businesses through registration assistance",
            )
            objective = await service.add_objective(goal.id, obj_data, user, db_session)
        finally:
            clear_tenant_context()

        assert objective.id is not None
        assert objective.goal_id == goal.id
        assert objective.title == "Increase SMME registrations by 10%"
        assert objective.tenant_id == tenant_id


# ---------------------------------------------------------------------------
# Test 6: IDP version unique constraint
# ---------------------------------------------------------------------------

class TestIDPVersions:
    """Tests for IDPService.create_version()."""

    async def test_idp_version_unique(self, db_session: AsyncSession):
        """Creating two versions with the same version_number raises 409 Conflict."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(
                make_cycle_create(title="Cycle for version test"), user, db_session
            )

            # First version — should succeed
            v1 = await service.create_version(
                cycle.id,
                IDPVersionCreate(version_number=1, financial_year="2022/23"),
                user,
                db_session,
            )
            assert v1.version_number == 1

            # Second version with same number — should raise 409
            with pytest.raises(HTTPException) as exc_info:
                await service.create_version(
                    cycle.id,
                    IDPVersionCreate(version_number=1, financial_year="2022/23"),
                    user,
                    db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 409

    async def test_idp_version_different_numbers_allowed(self, db_session: AsyncSession):
        """Different version numbers for the same cycle are all allowed."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(
                make_cycle_create(title="Multi-version cycle"), user, db_session
            )

            v1 = await service.create_version(
                cycle.id,
                IDPVersionCreate(version_number=1, financial_year="2022/23"),
                user, db_session,
            )
            v2 = await service.create_version(
                cycle.id,
                IDPVersionCreate(version_number=2, financial_year="2023/24"),
                user, db_session,
            )
        finally:
            clear_tenant_context()

        assert v1.version_number == 1
        assert v2.version_number == 2


# ---------------------------------------------------------------------------
# Tests 7-9: IDP state machine workflow
# ---------------------------------------------------------------------------

class TestIDPWorkflow:
    """Tests for IDPService.transition_cycle() state machine."""

    async def test_idp_workflow_submit(self, db_session: AsyncSession):
        """Transitioning draft -> approved via 'submit' event succeeds."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(
                make_cycle_create(title="Workflow test cycle"), user, db_session
            )
            assert cycle.status == IDPStatus.DRAFT

            approved_cycle = await service.transition_cycle(cycle.id, "submit", user, db_session)
        finally:
            clear_tenant_context()

        assert approved_cycle.status == IDPStatus.APPROVED

    async def test_idp_workflow_invalid_transition(self, db_session: AsyncSession):
        """Transitioning draft -> under_review via 'open_review' returns 409."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(
                make_cycle_create(title="Invalid transition cycle"), user, db_session
            )
            assert cycle.status == IDPStatus.DRAFT

            # 'open_review' is only valid from approved -> under_review, not draft
            with pytest.raises(HTTPException) as exc_info:
                await service.transition_cycle(cycle.id, "open_review", user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 409

    async def test_idp_workflow_full_cycle(self, db_session: AsyncSession):
        """Full transition: draft -> approved -> under_review -> approved."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(
                make_cycle_create(title="Full workflow cycle"), user, db_session
            )

            # draft -> approved
            cycle = await service.transition_cycle(cycle.id, "submit", user, db_session)
            assert cycle.status == IDPStatus.APPROVED

            # approved -> under_review
            cycle = await service.transition_cycle(cycle.id, "open_review", user, db_session)
            assert cycle.status == IDPStatus.UNDER_REVIEW

            # under_review -> approved
            cycle = await service.transition_cycle(cycle.id, "re_approve", user, db_session)
            assert cycle.status == IDPStatus.APPROVED
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 10: List cycles
# ---------------------------------------------------------------------------

class TestListCycles:
    """Tests for IDPService.list_cycles()."""

    async def test_list_cycles(self, db_session: AsyncSession):
        """list_cycles returns all cycles for the current tenant."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create 2 cycles
            await service.create_cycle(make_cycle_create(title="Cycle A"), user, db_session)
            await service.create_cycle(
                make_cycle_create(start_year=2027, title="Cycle B"), user, db_session
            )

            cycles = await service.list_cycles(db_session)
        finally:
            clear_tenant_context()

        assert len(cycles) == 2
        titles = {c.title for c in cycles}
        assert "Cycle A" in titles
        assert "Cycle B" in titles

    async def test_list_cycles_empty(self, db_session: AsyncSession):
        """list_cycles returns empty list when no cycles exist for tenant."""
        service = IDPService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            cycles = await service.list_cycles(db_session)
        finally:
            clear_tenant_context()

        assert cycles == []


# ---------------------------------------------------------------------------
# Tests 11-12: Golden thread structure
# ---------------------------------------------------------------------------

class TestGoldenThread:
    """Tests for IDPService.get_golden_thread()."""

    async def test_golden_thread_structure(self, db_session: AsyncSession):
        """get_golden_thread returns nested cycle -> goals -> objectives structure."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create cycle with a goal and objective
            cycle = await service.create_cycle(
                IDPCycleCreate(
                    title="Golden Thread Cycle",
                    start_year=2022,
                    end_year=2027,
                ),
                user, db_session,
            )
            goal = await service.add_goal(
                cycle.id,
                IDPGoalCreate(
                    title="Service Delivery Goal",
                    national_kpa=NationalKPA.BASIC_SERVICE_DELIVERY,
                ),
                user, db_session,
            )
            await service.add_objective(
                goal.id,
                IDPObjectiveCreate(title="Provide water to 95% of households"),
                user, db_session,
            )

            thread = await service.get_golden_thread(cycle.id, db_session)
        finally:
            clear_tenant_context()

        # Top-level structure
        assert "id" in thread
        assert "title" in thread
        assert "status" in thread
        assert "goals" in thread
        assert thread["title"] == "Golden Thread Cycle"
        assert thread["status"] == IDPStatus.DRAFT

        # Goals structure
        assert len(thread["goals"]) == 1
        goal_dict = thread["goals"][0]
        assert "id" in goal_dict
        assert "title" in goal_dict
        assert "national_kpa" in goal_dict
        assert "objectives" in goal_dict
        assert goal_dict["title"] == "Service Delivery Goal"
        assert goal_dict["national_kpa"] == NationalKPA.BASIC_SERVICE_DELIVERY.value

        # Objectives structure
        assert len(goal_dict["objectives"]) == 1
        obj_dict = goal_dict["objectives"][0]
        assert "id" in obj_dict
        assert "title" in obj_dict
        assert "kpis" in obj_dict
        assert obj_dict["kpis"] == []  # Empty in Wave 1 — SDBIP models not yet linked
        assert obj_dict["title"] == "Provide water to 95% of households"

    async def test_golden_thread_empty_cycle(self, db_session: AsyncSession):
        """get_golden_thread returns goals=[] for a cycle with no goals (not None, not error)."""
        service = IDPService()
        tenant_id = str(uuid4())
        user = make_mock_user(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            cycle = await service.create_cycle(
                IDPCycleCreate(title="Empty Cycle", start_year=2025, end_year=2030),
                user, db_session,
            )
            thread = await service.get_golden_thread(cycle.id, db_session)
        finally:
            clear_tenant_context()

        assert thread["goals"] == []
        assert isinstance(thread["goals"], list)
        assert thread["title"] == "Empty Cycle"

    async def test_golden_thread_cycle_not_found(self, db_session: AsyncSession):
        """get_golden_thread raises 404 for a non-existent cycle."""
        service = IDPService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            with pytest.raises(HTTPException) as exc_info:
                await service.get_golden_thread(uuid4(), db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Test: IDP API router is importable and registered
# ---------------------------------------------------------------------------

def test_idp_router_importable():
    """The IDP router can be imported without errors."""
    from src.api.v1.idp import router
    assert router is not None
    # Verify key routes exist
    paths = [r.path for r in router.routes]
    assert "/api/v1/idp/cycles" in paths
    assert "/api/v1/idp/cycles/{cycle_id}/goals" in paths
    assert "/api/v1/idp/goals/{goal_id}/objectives" in paths
    assert "/api/v1/idp/cycles/{cycle_id}/versions" in paths


def test_idp_service_importable():
    """IDPService and all schemas are importable without errors."""
    from src.services.idp_service import IDPService
    from src.schemas.idp import (
        IDPCycleCreate, IDPCycleResponse,
        IDPGoalCreate, IDPGoalResponse,
        IDPObjectiveCreate, IDPObjectiveResponse,
        IDPVersionCreate, IDPVersionResponse,
    )
    assert IDPService is not None


def test_idp_workflow_state_machine_standalone():
    """IDPWorkflow state machine transitions work in isolation (no DB)."""
    from src.models.idp import IDPWorkflow

    class MockCycle:
        status = IDPStatus.DRAFT

    cycle = MockCycle()
    machine = IDPWorkflow(model=cycle, state_field="status", start_value=cycle.status)
    state_values = {s.value for s in machine.configuration}
    assert "draft" in state_values

    machine.submit()
    assert cycle.status == IDPStatus.APPROVED

    machine.open_review()
    assert cycle.status == IDPStatus.UNDER_REVIEW

    machine.re_approve()
    assert cycle.status == IDPStatus.APPROVED
