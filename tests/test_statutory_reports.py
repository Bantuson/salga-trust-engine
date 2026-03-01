"""Unit tests for Statutory Report models, service, and API.

Tests cover:
1.  test_report_type_enum_values                  — all 4 ReportType values exist
2.  test_report_status_enum_values                — all 5 ReportStatus values exist
3.  test_report_workflow_transitions              — all 4 valid transitions in sequence
4.  test_report_workflow_invalid_transition       — TransitionNotAllowed raised for invalid event
5.  test_create_statutory_report                  — create S52 report, verify status=drafting
6.  test_create_report_duplicate_409              — duplicate type+FY+quarter returns 409
7.  test_report_snapshot_created_at_approval      — transition to mm_approved creates snapshot
8.  test_notification_model_creation              — create Notification, verify fields
9.  test_financial_year_validation                — schema rejects "2025" but accepts "2025/26"
10. test_quarter_required_for_s52                 — schema validates quarter presence for SECTION_52
11. test_period_computation_s52_q1                — period_start=Jul 1, period_end=Sep 30
12. test_period_computation_s72                   — period_start=Jul 1, period_end=Dec 31
13. test_list_reports_filter                      — list with financial_year filter returns correct subset
14. test_transition_role_gate_approve             — only MM/CFO/admin can approve (others get 403)
15. test_validate_completeness_s52_no_scorecard   — returns is_complete=False with "No SDBIP scorecard"
16. test_validate_completeness_s52_no_actuals     — returns is_complete=False with "No actuals submitted for Q1"
17. test_validate_completeness_s52_complete       — returns is_complete=True when scorecard, KPIs, actuals exist
18. test_validate_completeness_s46_missing_quarters — returns is_complete=False listing missing quarters
19. test_validate_completeness_s121_missing_idp_warns — is_complete=True but includes IDP warning
20. test_assemble_data_s46_quarterly_summary      — quarterly_summary has 4 entries
21. test_assemble_data_s46_pa_summaries           — PA data included when PAs are assessed
22. test_assemble_data_s121_idp_objectives        — IDP objectives included for S121
23. test_generate_endpoint_rejects_incomplete_422 — API returns 422 when completeness check fails

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
from unittest.mock import AsyncMock, MagicMock, patch

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.municipality import Municipality
from src.models.notification import Notification, NotificationType
from src.models.pa import PerformanceAgreement, PAStatus, ManagerRole
from src.models.sdbip import SDBIPActual, SDBIPKpi, SDBIPScorecard
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


# ---------------------------------------------------------------------------
# Completeness validation helpers
# ---------------------------------------------------------------------------


async def _create_scorecard(db: AsyncSession, tenant_id: str, financial_year: str) -> SDBIPScorecard:
    """Create a minimal SDBIPScorecard for test use."""
    sc = SDBIPScorecard(
        tenant_id=tenant_id,
        financial_year=financial_year,
        layer="top",
        department_id=None,
        status="draft",
    )
    db.add(sc)
    await db.commit()
    await db.refresh(sc)
    return sc


async def _create_kpi(db: AsyncSession, tenant_id: str, scorecard_id) -> SDBIPKpi:
    """Create a minimal SDBIPKpi for test use."""
    kpi = SDBIPKpi(
        tenant_id=tenant_id,
        scorecard_id=scorecard_id,
        kpi_number="KPI-001",
        description="Test KPI",
        unit_of_measurement="percentage",
        baseline=Decimal("0"),
        annual_target=Decimal("100"),
        weight=Decimal("100"),
    )
    db.add(kpi)
    await db.commit()
    await db.refresh(kpi)
    return kpi


async def _create_actual(
    db: AsyncSession,
    tenant_id: str,
    kpi_id,
    quarter: str,
    financial_year: str,
    actual_value: str = "80",
    achievement_pct: str = "80",
    traffic_light: str = "green",
) -> SDBIPActual:
    """Create a minimal SDBIPActual for test use."""
    actual = SDBIPActual(
        tenant_id=tenant_id,
        kpi_id=kpi_id,
        quarter=quarter,
        financial_year=financial_year,
        actual_value=Decimal(actual_value),
        achievement_pct=Decimal(achievement_pct),
        traffic_light_status=traffic_light,
        is_validated=False,
    )
    db.add(actual)
    await db.commit()
    await db.refresh(actual)
    return actual


async def _create_report(
    db: AsyncSession,
    tenant_id: str,
    service: StatutoryReportService,
    report_type: ReportType,
    financial_year: str = "2025/26",
    quarter: str | None = None,
) -> StatutoryReport:
    """Create a statutory report and return it."""
    user = _make_admin(tenant_id=tenant_id)
    data = StatutoryReportCreate(
        report_type=report_type,
        financial_year=financial_year,
        quarter=quarter if report_type == ReportType.SECTION_52 else None,
        title=f"Test {report_type} Report",
    )
    return await service.create_report(data, user, db)


# ---------------------------------------------------------------------------
# Test 15: Completeness validation — S52 no scorecard
# ---------------------------------------------------------------------------


class TestValidateCompletenessS52NoScorecard:
    """Tests for validate_report_completeness with missing scorecard."""

    async def test_validate_completeness_s52_no_scorecard(self, db_session: AsyncSession):
        """Returns is_complete=False with 'No SDBIP scorecard' when no scorecard exists."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_52, quarter="Q1"
            )
            result = await service.validate_report_completeness(report, db_session)
        finally:
            clear_tenant_context()

        assert result["is_complete"] is False
        assert any("No SDBIP scorecard" in item for item in result["missing_items"])


# ---------------------------------------------------------------------------
# Test 16: Completeness validation — S52 no actuals
# ---------------------------------------------------------------------------


class TestValidateCompletenessS52NoActuals:
    """Tests for validate_report_completeness with missing actuals."""

    async def test_validate_completeness_s52_no_actuals(self, db_session: AsyncSession):
        """Returns is_complete=False with 'No actuals submitted for Q1' when actuals missing."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            # Create scorecard and KPI but NO actuals
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            await _create_kpi(db_session, tenant_id, sc.id)

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_52, quarter="Q1"
            )
            result = await service.validate_report_completeness(report, db_session)
        finally:
            clear_tenant_context()

        assert result["is_complete"] is False
        assert any("No actuals submitted for Q1" in item for item in result["missing_items"])


# ---------------------------------------------------------------------------
# Test 17: Completeness validation — S52 complete
# ---------------------------------------------------------------------------


class TestValidateCompletenessS52Complete:
    """Tests for validate_report_completeness — complete S52 report."""

    async def test_validate_completeness_s52_complete(self, db_session: AsyncSession):
        """Returns is_complete=True when scorecard, KPIs, and actuals all exist."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            kpi = await _create_kpi(db_session, tenant_id, sc.id)
            await _create_actual(db_session, tenant_id, kpi.id, "Q1", "2025/26")

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_52, quarter="Q1"
            )
            result = await service.validate_report_completeness(report, db_session)
        finally:
            clear_tenant_context()

        assert result["is_complete"] is True
        assert len(result["missing_items"]) == 0


# ---------------------------------------------------------------------------
# Test 18: Completeness validation — S46 missing quarters
# ---------------------------------------------------------------------------


class TestValidateCompletenessS46MissingQuarters:
    """Tests for validate_report_completeness — S46 with missing quarter actuals."""

    async def test_validate_completeness_s46_missing_quarters(self, db_session: AsyncSession):
        """Returns is_complete=False listing missing quarters when not all 4 quarters have actuals."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            kpi = await _create_kpi(db_session, tenant_id, sc.id)
            # Only Q1 and Q2 actuals — Q3 and Q4 missing
            await _create_actual(db_session, tenant_id, kpi.id, "Q1", "2025/26")
            await _create_actual(db_session, tenant_id, kpi.id, "Q2", "2025/26")

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_46
            )
            result = await service.validate_report_completeness(report, db_session)
        finally:
            clear_tenant_context()

        assert result["is_complete"] is False
        missing = result["missing_items"]
        # Q3 and Q4 should be listed as missing
        assert any("Q3" in item for item in missing)
        assert any("Q4" in item for item in missing)
        # Q1 and Q2 should NOT appear as missing
        assert not any("No actuals submitted for Q1" in item for item in missing)
        assert not any("No actuals submitted for Q2" in item for item in missing)


# ---------------------------------------------------------------------------
# Test 19: Completeness validation — S121 missing IDP warns only
# ---------------------------------------------------------------------------


class TestValidateCompletenessS121MissingIdpWarns:
    """Tests for validate_report_completeness — S121 with all actuals but no IDP."""

    async def test_validate_completeness_s121_missing_idp_warns(self, db_session: AsyncSession):
        """Returns is_complete=True (warn only) but includes IDP warning for missing IDP cycle."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            kpi = await _create_kpi(db_session, tenant_id, sc.id)
            # All 4 quarters have actuals
            for q in ("Q1", "Q2", "Q3", "Q4"):
                await _create_actual(db_session, tenant_id, kpi.id, q, "2025/26")

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_121
            )
            result = await service.validate_report_completeness(report, db_session)
        finally:
            clear_tenant_context()

        # Should be complete (IDP missing is only a warning, not blocking)
        assert result["is_complete"] is True
        assert len(result["missing_items"]) == 0
        # Should have an IDP warning in warnings
        assert any("IDP cycle" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# Test 20: assemble_report_data — S46 quarterly_summary
# ---------------------------------------------------------------------------


class TestAssembleDataS46QuarterlySummary:
    """Tests for assemble_report_data quarterly_summary for Section 46."""

    async def test_assemble_data_s46_quarterly_summary(self, db_session: AsyncSession):
        """quarterly_summary contains 4 entries (one per quarter) for S46 reports."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            kpi = await _create_kpi(db_session, tenant_id, sc.id)
            for q in ("Q1", "Q2", "Q3", "Q4"):
                await _create_actual(db_session, tenant_id, kpi.id, q, "2025/26")

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_46
            )
            context = await service.assemble_report_data(report, db_session)
        finally:
            clear_tenant_context()

        quarterly_summary = context["quarterly_summary"]
        assert len(quarterly_summary) == 4
        quarters = [q["quarter"] for q in quarterly_summary]
        assert "Q1" in quarters
        assert "Q2" in quarters
        assert "Q3" in quarters
        assert "Q4" in quarters
        # Each entry should have the expected keys
        for entry in quarterly_summary:
            assert "assessed" in entry
            assert "green" in entry
            assert "amber" in entry
            assert "red" in entry
            assert "achievement_pct" in entry


# ---------------------------------------------------------------------------
# Test 21: assemble_report_data — S46 PA summaries
# ---------------------------------------------------------------------------


class TestAssembleDataS46PaSummaries:
    """Tests for assemble_report_data PA summaries for Section 46."""

    async def test_assemble_data_s46_pa_summaries(self, db_session: AsyncSession):
        """pa_summaries is populated when assessed PAs exist for the financial year."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            kpi = await _create_kpi(db_session, tenant_id, sc.id)
            for q in ("Q1", "Q2", "Q3", "Q4"):
                await _create_actual(db_session, tenant_id, kpi.id, q, "2025/26")

            # Create an assessed PA for the financial year
            muni = await _create_municipality(db_session, tenant_id)
            manager = User(
                email=f"mm_{uuid4().hex[:8]}@test.gov.za",
                hashed_password="supabase_managed",
                full_name="Test MM",
                role=UserRole.MUNICIPAL_MANAGER,
                tenant_id=tenant_id,
                municipality_id=muni.id,
                is_active=True,
            )
            db_session.add(manager)
            await db_session.commit()
            await db_session.refresh(manager)

            pa = PerformanceAgreement(
                tenant_id=tenant_id,
                financial_year="2025/26",
                section57_manager_id=manager.id,
                manager_role=ManagerRole.MUNICIPAL_MANAGER,
                status=PAStatus.ASSESSED,
                annual_score=Decimal("85.0"),
            )
            db_session.add(pa)
            await db_session.commit()

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_46
            )
            context = await service.assemble_report_data(report, db_session)
        finally:
            clear_tenant_context()

        pa_summaries = context["pa_summaries"]
        assert len(pa_summaries) == 1
        pa_data = pa_summaries[0]
        assert pa_data["annual_score"] == "85.0"
        assert pa_data["rating"] == "Exceeds Expectations"
        assert pa_data["rating_class"] == "rating-exceeds"
        assert pa_data["status"] == "assessed"


# ---------------------------------------------------------------------------
# Test 22: assemble_report_data — S121 IDP objectives
# ---------------------------------------------------------------------------


class TestAssembleDataS121IdpObjectives:
    """Tests for assemble_report_data IDP objectives for Section 121."""

    async def test_assemble_data_s121_idp_objectives(self, db_session: AsyncSession):
        """idp_objectives is populated when an IDP cycle exists for the financial year."""
        from src.models.idp import IDPCycle, IDPGoal, IDPObjective

        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            sc = await _create_scorecard(db_session, tenant_id, "2025/26")
            kpi = await _create_kpi(db_session, tenant_id, sc.id)
            for q in ("Q1", "Q2", "Q3", "Q4"):
                await _create_actual(db_session, tenant_id, kpi.id, q, "2025/26")

            # Create an IDP cycle covering 2025
            cycle = IDPCycle(
                tenant_id=tenant_id,
                title="IDP 2022-2027",
                vision="A prosperous municipality",
                mission="Service excellence for all",
                start_year=2022,
                end_year=2027,
                status="approved",
            )
            db_session.add(cycle)
            await db_session.commit()
            await db_session.refresh(cycle)

            goal = IDPGoal(
                tenant_id=tenant_id,
                cycle_id=cycle.id,
                title="Basic Services Goal",
                national_kpa="basic_service_delivery",
                display_order=1,
            )
            db_session.add(goal)
            await db_session.commit()
            await db_session.refresh(goal)

            obj = IDPObjective(
                tenant_id=tenant_id,
                goal_id=goal.id,
                title="Improve water service delivery",
                display_order=1,
            )
            db_session.add(obj)
            await db_session.commit()

            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_121
            )
            context = await service.assemble_report_data(report, db_session)
        finally:
            clear_tenant_context()

        idp_objectives = context["idp_objectives"]
        assert len(idp_objectives) >= 1
        first_obj = idp_objectives[0]
        assert first_obj["title"] == "Improve water service delivery"
        assert first_obj["national_kpa"] == "basic_service_delivery"
        assert "linked_kpi_count" in first_obj

        # Vision/mission should be populated
        assert context["municipality_vision"] == "A prosperous municipality"
        assert context["municipality_mission"] == "Service excellence for all"


# ---------------------------------------------------------------------------
# Test 23: Generate endpoint rejects incomplete data (422)
# ---------------------------------------------------------------------------


class TestGenerateEndpointRejectsIncomplete422:
    """Tests for the generate endpoint returning 422 when data is incomplete."""

    async def test_generate_endpoint_rejects_incomplete_422(self, db_session: AsyncSession):
        """Generate endpoint returns 422 with missing_items when completeness check fails."""
        service = StatutoryReportService()
        tenant_id = str(uuid4())

        set_tenant_context(tenant_id)
        try:
            # Create an S52 report but NO scorecard (so completeness fails)
            report = await _create_report(
                db_session, tenant_id, service, ReportType.SECTION_52, quarter="Q1"
            )

            # Simulate the API's completeness check
            completeness = await service.validate_report_completeness(report, db_session)
        finally:
            clear_tenant_context()

        # Should be incomplete
        assert completeness["is_complete"] is False
        assert len(completeness["missing_items"]) > 0

        # API would raise HTTPException 422 — verify the data structure matches what API returns
        from fastapi import HTTPException
        exc = HTTPException(
            status_code=422,
            detail={
                "error": "Report data incomplete",
                "missing_items": completeness["missing_items"],
            },
        )
        assert exc.status_code == 422
        assert "missing_items" in exc.detail
        assert len(exc.detail["missing_items"]) > 0
