"""Unit tests for Statutory Report models, service, and API.

Tests cover:
1.  test_report_type_enum_values             — all 4 ReportType values exist
2.  test_report_status_enum_values           — all 5 ReportStatus values exist
3.  test_report_workflow_transitions         — all 4 valid transitions in sequence
4.  test_report_workflow_invalid_transition  — TransitionNotAllowed raised for invalid event
5.  test_create_statutory_report             — create S52 report, verify status=drafting
6.  test_create_report_duplicate_409         — duplicate type+FY+quarter returns 409
7.  test_report_snapshot_created_at_approval — transition to mm_approved creates snapshot
8.  test_notification_model_creation         — create Notification, verify fields
9.  test_financial_year_validation           — schema rejects "2025" but accepts "2025/26"
10. test_quarter_required_for_s52            — schema validates quarter presence for SECTION_52
11. test_period_computation_s52_q1           — period_start=Jul 1, period_end=Sep 30
12. test_period_computation_s72              — period_start=Jul 1, period_end=Dec 31
13. test_list_reports_filter                 — list with financial_year filter returns correct subset
14. test_transition_role_gate_approve        — only MM/CFO/admin can approve (others get 403)

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally
to satisfy the application-level RLS tenant filter.
"""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.municipality import Municipality
from src.models.notification import Notification, NotificationType
from src.models.statutory_report import (
    ReportStatus,
    ReportType,
    ReportWorkflow,
    StatutoryReport,
    StatutoryReportSnapshot,
    TransitionNotAllowed,
)
from src.models.user import User, UserRole
from src.schemas.statutory_report import (
    ReportTransitionRequest,
    StatutoryReportCreate,
)
from src.services.statutory_report_service import StatutoryReportService, _compute_period

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Mock user helpers
# ---------------------------------------------------------------------------


def _make_user(role: UserRole, tenant_id: str | None = None) -> MagicMock:
    """Create a mock User with the given role."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = f"{role.value}@test.gov.za"
    user.full_name = f"Test {role.value.title()}"
    user.role = role
    t = tenant_id or str(uuid4())
    user.tenant_id = t
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def _make_cfo(tenant_id: str | None = None) -> MagicMock:
    return _make_user(UserRole.CFO, tenant_id)


def _make_mm(tenant_id: str | None = None) -> MagicMock:
    return _make_user(UserRole.MUNICIPAL_MANAGER, tenant_id)


def _make_pms_officer(tenant_id: str | None = None) -> MagicMock:
    return _make_user(UserRole.PMS_OFFICER, tenant_id)


def _make_admin(tenant_id: str | None = None) -> MagicMock:
    return _make_user(UserRole.ADMIN, tenant_id)


def _make_citizen(tenant_id: str | None = None) -> MagicMock:
    return _make_user(UserRole.CITIZEN, tenant_id)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


async def _create_municipality(db: AsyncSession, tenant_id: str) -> Municipality:
    """Create a Municipality for FK tests."""
    from uuid import UUID
    muni = Municipality(
        name=f"Test Municipality {uuid4().hex[:8]}",
        code=uuid4().hex[:6].upper(),
        province="Gauteng",
        is_active=True,
    )
    db.add(muni)
    await db.commit()
    await db.refresh(muni)
    return muni


async def _create_user_row(db: AsyncSession, tenant_id: str, role: UserRole = UserRole.PMS_OFFICER) -> User:
    """Insert a real User row into the DB for FK validation tests."""
    muni = await _create_municipality(db, tenant_id)
    user = User(
        email=f"user_{uuid4().hex[:8]}@test.gov.za",
        hashed_password="supabase_managed",
        full_name="Test User",
        role=role,
        tenant_id=tenant_id,
        municipality_id=muni.id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Test 1: ReportType enum values
# ---------------------------------------------------------------------------


class TestReportTypeEnum:
    """Verify all 4 ReportType enum values exist."""

    def test_report_type_enum_values(self):
        """All 4 ReportType values must exist for the plan to be correct."""
        assert ReportType.SECTION_52 == "section_52"
        assert ReportType.SECTION_72 == "section_72"
        assert ReportType.SECTION_46 == "section_46"
        assert ReportType.SECTION_121 == "section_121"
        assert len(list(ReportType)) == 4


# ---------------------------------------------------------------------------
# Test 2: ReportStatus enum values
# ---------------------------------------------------------------------------


class TestReportStatusEnum:
    """Verify all 5 ReportStatus enum values exist."""

    def test_report_status_enum_values(self):
        """All 5 ReportStatus values must exist for the 5-stage workflow."""
        assert ReportStatus.DRAFTING == "drafting"
        assert ReportStatus.INTERNAL_REVIEW == "internal_review"
        assert ReportStatus.MM_APPROVED == "mm_approved"
        assert ReportStatus.SUBMITTED == "submitted"
        assert ReportStatus.TABLED == "tabled"
        assert len(list(ReportStatus)) == 5


# ---------------------------------------------------------------------------
# Test 3: ReportWorkflow state machine transitions
# ---------------------------------------------------------------------------


class TestReportWorkflowTransitions:
    """State machine transition tests using a fake StatutoryReport object."""

    def test_report_workflow_transitions(self):
        """All 4 valid transitions complete the full drafting -> tabled lifecycle."""
        # Use a simple object with a 'status' attribute for model binding
        class _Report:
            status = "drafting"

        report = _Report()

        # drafting -> internal_review
        machine = ReportWorkflow(model=report, state_field="status", start_value="drafting")
        machine.send("submit_for_review")
        assert report.status == "internal_review"

        # internal_review -> mm_approved
        machine = ReportWorkflow(model=report, state_field="status", start_value="internal_review")
        machine.send("approve")
        assert report.status == "mm_approved"

        # mm_approved -> submitted
        machine = ReportWorkflow(model=report, state_field="status", start_value="mm_approved")
        machine.send("submit_external")
        assert report.status == "submitted"

        # submitted -> tabled
        machine = ReportWorkflow(model=report, state_field="status", start_value="submitted")
        machine.send("table")
        assert report.status == "tabled"

    def test_report_workflow_invalid_transition(self):
        """TransitionNotAllowed is raised when an invalid event is sent."""
        class _Report:
            status = "drafting"

        report = _Report()
        machine = ReportWorkflow(model=report, state_field="status", start_value="drafting")

        with pytest.raises(TransitionNotAllowed):
            machine.send("approve")  # Cannot approve from drafting state


# ---------------------------------------------------------------------------
# Test 4: Create statutory report
# ---------------------------------------------------------------------------


class TestCreateStatutoryReport:
    """Tests for StatutoryReportService.create_report()."""

    async def test_create_statutory_report(self, db_session: AsyncSession):
        """Creating an S52 report returns status=drafting with correct fields."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            data = StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="2025/26",
                quarter="Q1",
                title="Q1 2025/26 Section 52 Performance Report",
            )
            report = await service.create_report(data, cfo_user, db_session)
        finally:
            clear_tenant_context()

        assert report.id is not None
        assert report.report_type == "section_52"
        assert report.financial_year == "2025/26"
        assert report.quarter == "Q1"
        assert report.status == ReportStatus.DRAFTING
        assert report.tenant_id == tenant_id
        assert report.title == "Q1 2025/26 Section 52 Performance Report"


# ---------------------------------------------------------------------------
# Test 5: Duplicate report returns 409
# ---------------------------------------------------------------------------


class TestCreateReportDuplicate:
    """Tests for duplicate report detection."""

    async def test_create_report_duplicate_409(self, db_session: AsyncSession):
        """Second S52 report for same type+FY+quarter+tenant returns 409 Conflict."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            data = StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="2025/26",
                quarter="Q1",
                title="Q1 2025/26 Section 52 Report",
            )
            # First creation should succeed
            await service.create_report(data, cfo_user, db_session)

            # Second creation with same (type, FY, quarter, tenant) should fail
            with pytest.raises(HTTPException) as exc_info:
                await service.create_report(data, cfo_user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# Test 6: Snapshot created at mm_approved
# ---------------------------------------------------------------------------


class TestReportSnapshotCreatedAtApproval:
    """Tests for data snapshot creation at mm_approved transition."""

    async def test_report_snapshot_created_at_approval(self, db_session: AsyncSession):
        """Transitioning to mm_approved creates a StatutoryReportSnapshot."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)
        mm_user = _make_mm(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create a report
            data = StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="2025/26",
                quarter="Q1",
                title="Q1 2025/26 Section 52 Report",
            )
            report = await service.create_report(data, cfo_user, db_session)

            # Transition to internal_review (cfo can do this)
            report = await service.transition_report(report.id, "submit_for_review", cfo_user, db_session)
            assert report.status == "internal_review"

            # Transition to mm_approved (MM can approve)
            report = await service.transition_report(report.id, "approve", mm_user, db_session)
        finally:
            clear_tenant_context()

        assert report.status == ReportStatus.MM_APPROVED
        assert report.approved_by == str(mm_user.id)
        assert report.approved_at is not None

        # Verify snapshot was created
        set_tenant_context(tenant_id)
        try:
            snapshot = await service.get_report_snapshot(report.id, db_session)
        finally:
            clear_tenant_context()

        assert snapshot is not None
        assert snapshot.report_id == report.id
        assert snapshot.snapshot_reason == "mm_approved"
        assert snapshot.snapshot_data is not None


# ---------------------------------------------------------------------------
# Test 7: Notification model creation
# ---------------------------------------------------------------------------


class TestNotificationModelCreation:
    """Tests for Notification model."""

    async def test_notification_model_creation(self, db_session: AsyncSession):
        """Create a Notification and verify all fields are stored correctly."""
        tenant_id = str(uuid4())

        # Create a real user first (for FK constraint)
        set_tenant_context(tenant_id)
        try:
            real_user = await _create_user_row(db_session, tenant_id)

            notification = Notification(
                tenant_id=tenant_id,
                user_id=real_user.id,
                type=NotificationType.APPROVAL_REQUIRED,
                title="Report Awaiting Your Approval",
                message="The Q1 2025/26 Section 52 report requires your approval.",
                link="/statutory-reports/some-uuid",
                is_read=False,
            )
            db_session.add(notification)
            await db_session.commit()
            await db_session.refresh(notification)
        finally:
            clear_tenant_context()

        assert notification.id is not None
        assert notification.user_id == real_user.id
        assert notification.type == "approval_required"
        assert notification.title == "Report Awaiting Your Approval"
        assert notification.is_read is False
        assert notification.read_at is None
        assert notification.link == "/statutory-reports/some-uuid"
        assert notification.tenant_id == tenant_id


# ---------------------------------------------------------------------------
# Test 8: Financial year validation
# ---------------------------------------------------------------------------


class TestFinancialYearValidation:
    """Tests for StatutoryReportCreate.financial_year validation."""

    def test_financial_year_validation_rejects_invalid(self):
        """Schema rejects '2025' (no slash) with a ValidationError."""
        with pytest.raises(ValidationError):
            StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="2025",  # Invalid — missing /YY suffix
                quarter="Q1",
                title="Test Report",
            )

    def test_financial_year_validation_accepts_valid(self):
        """Schema accepts '2025/26' (YYYY/YY format)."""
        schema = StatutoryReportCreate(
            report_type=ReportType.SECTION_52,
            financial_year="2025/26",
            quarter="Q1",
            title="Test Report",
        )
        assert schema.financial_year == "2025/26"

    def test_financial_year_validation_rejects_wrong_format(self):
        """Schema rejects '25/26' (wrong digit count) with a ValidationError."""
        with pytest.raises(ValidationError):
            StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="25/26",  # Invalid — only 2 digits before slash
                quarter="Q1",
                title="Test Report",
            )


# ---------------------------------------------------------------------------
# Test 9: Quarter required for S52
# ---------------------------------------------------------------------------


class TestQuarterRequiredForS52:
    """Tests for quarter validation on StatutoryReportCreate."""

    def test_quarter_required_for_s52_schema_validation(self):
        """Schema raises ValidationError when quarter is None for SECTION_52."""
        with pytest.raises(ValidationError) as exc_info:
            StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="2025/26",
                quarter=None,
                title="Test S52 Report Without Quarter",
            )
        # Verify the error message references quarter
        errors = exc_info.value.errors()
        assert any("quarter" in str(e).lower() for e in errors)

    def test_quarter_not_required_for_s72(self):
        """Section 72 does not require a quarter — quarter=None is valid."""
        schema = StatutoryReportCreate(
            report_type=ReportType.SECTION_72,
            financial_year="2025/26",
            quarter=None,
            title="Mid-Year Assessment 2025/26",
        )
        assert schema.quarter is None
        assert schema.report_type == ReportType.SECTION_72

    def test_invalid_quarter_value_rejected(self):
        """Schema rejects quarter values other than Q1-Q4."""
        with pytest.raises(ValidationError):
            StatutoryReportCreate(
                report_type=ReportType.SECTION_52,
                financial_year="2025/26",
                quarter="Q5",  # Invalid
                title="Test Report",
            )


# ---------------------------------------------------------------------------
# Test 10: Period computation for S52 Q1
# ---------------------------------------------------------------------------


class TestPeriodComputationS52Q1:
    """Tests for _compute_period helper function."""

    def test_period_computation_s52_q1(self):
        """S52 Q1 period should be 1 July to 30 September of the start year."""
        start, end = _compute_period(ReportType.SECTION_52, "2025/26", "Q1")
        assert start == date(2025, 7, 1)
        assert end == date(2025, 9, 30)

    def test_period_computation_s52_q2(self):
        """S52 Q2 period should be 1 October to 31 December of the start year."""
        start, end = _compute_period(ReportType.SECTION_52, "2025/26", "Q2")
        assert start == date(2025, 10, 1)
        assert end == date(2025, 12, 31)

    def test_period_computation_s52_q3(self):
        """S52 Q3 period should be 1 January to 31 March of the next year."""
        start, end = _compute_period(ReportType.SECTION_52, "2025/26", "Q3")
        assert start == date(2026, 1, 1)
        assert end == date(2026, 3, 31)

    def test_period_computation_s52_q4(self):
        """S52 Q4 period should be 1 April to 30 June of the next year."""
        start, end = _compute_period(ReportType.SECTION_52, "2025/26", "Q4")
        assert start == date(2026, 4, 1)
        assert end == date(2026, 6, 30)


# ---------------------------------------------------------------------------
# Test 11: Period computation for S72
# ---------------------------------------------------------------------------


class TestPeriodComputationS72:
    """Tests for Section 72 period computation."""

    def test_period_computation_s72(self):
        """S72 mid-year assessment should cover 1 July to 31 December (H1)."""
        start, end = _compute_period(ReportType.SECTION_72, "2025/26", None)
        assert start == date(2025, 7, 1)
        assert end == date(2025, 12, 31)

    def test_period_computation_s46_full_year(self):
        """S46 annual report should cover the full financial year: Jul 1 to Jun 30."""
        start, end = _compute_period(ReportType.SECTION_46, "2025/26", None)
        assert start == date(2025, 7, 1)
        assert end == date(2026, 6, 30)

    def test_period_computation_s121_full_year(self):
        """S121 annual financial statements should cover the full financial year."""
        start, end = _compute_period(ReportType.SECTION_121, "2025/26", None)
        assert start == date(2025, 7, 1)
        assert end == date(2026, 6, 30)


# ---------------------------------------------------------------------------
# Test 12: List reports with financial_year filter
# ---------------------------------------------------------------------------


class TestListReportsFilter:
    """Tests for StatutoryReportService.list_reports()."""

    async def test_list_reports_filter(self, db_session: AsyncSession):
        """Filtering by financial_year returns only matching reports."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create two reports with different financial years
            await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_52,
                    financial_year="2025/26",
                    quarter="Q1",
                    title="Q1 2025/26 Report",
                ),
                cfo_user, db_session,
            )
            await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_52,
                    financial_year="2024/25",
                    quarter="Q1",
                    title="Q1 2024/25 Report",
                ),
                cfo_user, db_session,
            )

            # Filter by 2025/26
            reports_2526 = await service.list_reports("2025/26", None, db_session)
            # Filter by 2024/25
            reports_2425 = await service.list_reports("2024/25", None, db_session)
            # No filter — should return both
            all_reports = await service.list_reports(None, None, db_session)
        finally:
            clear_tenant_context()

        assert len(reports_2526) == 1
        assert reports_2526[0].financial_year == "2025/26"

        assert len(reports_2425) == 1
        assert reports_2425[0].financial_year == "2024/25"

        assert len(all_reports) == 2

    async def test_list_reports_filter_by_type(self, db_session: AsyncSession):
        """Filtering by report_type returns only matching reports."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_52,
                    financial_year="2025/26",
                    quarter="Q2",
                    title="Q2 2025/26 S52 Report",
                ),
                cfo_user, db_session,
            )
            await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_72,
                    financial_year="2025/26",
                    quarter=None,
                    title="Mid-Year 2025/26 Report",
                ),
                cfo_user, db_session,
            )

            s52_reports = await service.list_reports(None, "section_52", db_session)
            s72_reports = await service.list_reports(None, "section_72", db_session)
        finally:
            clear_tenant_context()

        assert len(s52_reports) == 1
        assert s52_reports[0].report_type == "section_52"

        assert len(s72_reports) == 1
        assert s72_reports[0].report_type == "section_72"


# ---------------------------------------------------------------------------
# Test 13: Transition role gate — approve requires MM/CFO/admin
# ---------------------------------------------------------------------------


class TestTransitionRoleGateApprove:
    """Tests for role-gated approve transition."""

    async def test_transition_role_gate_approve_mm_allowed(self, db_session: AsyncSession):
        """Municipal Manager can approve a report in internal_review status."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)
        mm_user = _make_mm(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            report = await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_52,
                    financial_year="2025/26",
                    quarter="Q3",
                    title="Q3 Report",
                ),
                cfo_user, db_session,
            )
            # First transition: submit_for_review (CFO can do this)
            report = await service.transition_report(report.id, "submit_for_review", cfo_user, db_session)

            # Approve: only MM/CFO/admin can do this
            report = await service.transition_report(report.id, "approve", mm_user, db_session)
        finally:
            clear_tenant_context()

        assert report.status == ReportStatus.MM_APPROVED

    async def test_transition_role_gate_approve_citizen_forbidden(self, db_session: AsyncSession):
        """Citizens cannot approve reports — must return 403."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)
        citizen_user = _make_citizen(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            report = await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_52,
                    financial_year="2025/26",
                    quarter="Q4",
                    title="Q4 Report",
                ),
                cfo_user, db_session,
            )
            # Transition to internal_review first
            report = await service.transition_report(report.id, "submit_for_review", cfo_user, db_session)

            # Citizen attempts to approve — should get 403
            with pytest.raises(HTTPException) as exc_info:
                await service.transition_report(report.id, "approve", citizen_user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 403

    async def test_transition_role_gate_approve_pms_officer_forbidden(self, db_session: AsyncSession):
        """PMS officers cannot approve reports (only submit_for_review) — must return 403."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)
        pms_user = _make_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            report = await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_72,
                    financial_year="2025/26",
                    quarter=None,
                    title="S72 Report",
                ),
                cfo_user, db_session,
            )
            # Submit for review (PMS officer can do this)
            report = await service.transition_report(report.id, "submit_for_review", pms_user, db_session)
            assert report.status == "internal_review"

            # PMS officer cannot approve — should get 403
            with pytest.raises(HTTPException) as exc_info:
                await service.transition_report(report.id, "approve", pms_user, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 403

    async def test_transition_admin_can_approve(self, db_session: AsyncSession):
        """Admin user can approve reports (bypass)."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())
        cfo_user = _make_cfo(tenant_id=tenant_id)
        admin_user = _make_admin(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            report = await service.create_report(
                StatutoryReportCreate(
                    report_type=ReportType.SECTION_46,
                    financial_year="2025/26",
                    quarter=None,
                    title="Annual Report 2025/26",
                ),
                admin_user, db_session,
            )
            report = await service.transition_report(report.id, "submit_for_review", admin_user, db_session)
            report = await service.transition_report(report.id, "approve", admin_user, db_session)
        finally:
            clear_tenant_context()

        assert report.status == ReportStatus.MM_APPROVED


# ---------------------------------------------------------------------------
# Test 14: ReportTransitionRequest schema validation
# ---------------------------------------------------------------------------


class TestReportTransitionRequestSchema:
    """Tests for ReportTransitionRequest event validation."""

    def test_valid_event_accepted(self):
        """Valid transition events are accepted by the schema."""
        for event in ("submit_for_review", "approve", "submit_external", "table"):
            req = ReportTransitionRequest(event=event)
            assert req.event == event

    def test_invalid_event_rejected(self):
        """Invalid event names are rejected by the schema."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ReportTransitionRequest(event="sign")  # PA event, not report event

    def test_unknown_event_rejected(self):
        """Completely unknown events are rejected."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ReportTransitionRequest(event="delete_report")
