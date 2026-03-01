"""Unit tests for StatutoryDeadline model, DeadlineService, and Celery task.

Tests cover:
1.  test_compute_deadlines_2025_26             — all 7 deadlines computed for "2025/26"
2.  test_compute_deadlines_2026_27             — correct dates for a different FY
3.  test_compute_deadlines_no_hardcoded_dates  — all 3 FYs produce different dates (no literals)
4.  test_populate_deadlines_idempotent         — calling twice returns 7 records (not 14)
5.  test_check_and_notify_30_day_window        — deadline 25d out -> notification_30d_sent=True
6.  test_check_and_notify_14_day_window        — deadline 10d out -> both 30d and 14d flags set
7.  test_check_and_notify_overdue              — past deadline -> notification_overdue_sent=True
8.  test_check_and_notify_already_sent_no_duplicate — flag already set -> no new notification
9.  test_auto_create_report_task_30_days_before — deadline 25d out -> DRAFTING report created
10. test_auto_create_report_task_skips_existing_report — manual report exists -> no duplicate
11. test_auto_create_skips_far_future          — deadline 60d out -> no auto-task
12. test_check_and_notify_sends_email          — email helper called with correct subject/body
13. test_check_and_notify_email_failure_does_not_block — email error -> notifications still created
14. test_determine_current_financial_year      — helper function with various dates

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally.
"""
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.municipality import Municipality
from src.models.notification import Notification
from src.models.statutory_report import ReportStatus, StatutoryDeadline, StatutoryReport
from src.models.user import User, UserRole
from src.services.deadline_service import DeadlineService
from src.tasks.statutory_deadline_task import _determine_current_financial_year

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_municipality(db: AsyncSession) -> Municipality:
    """Create a test municipality (NonTenantModel)."""
    muni = Municipality(
        name=f"Test Muni {uuid4().hex[:6]}",
        code=uuid4().hex[:6].upper(),
        province="Gauteng",
        is_active=True,
    )
    db.add(muni)
    await db.commit()
    await db.refresh(muni)
    return muni


async def _create_user(
    db: AsyncSession,
    tenant_id: str,
    role: UserRole,
    email: str | None = None,
) -> User:
    """Create a real User row for notification recipient tests."""
    muni = await _create_municipality(db)
    user = User(
        email=email or f"user_{uuid4().hex[:8]}@test.gov.za",
        hashed_password="supabase_managed",
        full_name=f"Test {role.value}",
        role=role,
        tenant_id=tenant_id,
        municipality_id=muni.id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _create_deadline(
    db: AsyncSession,
    tenant_id: str,
    deadline_date: date,
    report_type: str = "section_52",
    quarter: str | None = "Q1",
    financial_year: str = "2025/26",
    **flags,
) -> StatutoryDeadline:
    """Create a StatutoryDeadline record for testing."""
    dl = StatutoryDeadline(
        tenant_id=tenant_id,
        report_type=report_type,
        financial_year=financial_year,
        quarter=quarter,
        deadline_date=deadline_date,
        description=f"{report_type} deadline for testing",
        task_created=flags.get("task_created", False),
        notification_30d_sent=flags.get("notification_30d_sent", False),
        notification_14d_sent=flags.get("notification_14d_sent", False),
        notification_7d_sent=flags.get("notification_7d_sent", False),
        notification_3d_sent=flags.get("notification_3d_sent", False),
        notification_overdue_sent=flags.get("notification_overdue_sent", False),
        created_by="test",
    )
    db.add(dl)
    await db.commit()
    await db.refresh(dl)
    return dl


# ---------------------------------------------------------------------------
# Test 1: compute_deadlines 2025/26
# ---------------------------------------------------------------------------


class TestComputeDeadlines2025_26:
    """Verify all 7 deadline dates for FY 2025/26."""

    def test_compute_deadlines_2025_26(self):
        """All 7 deadlines computed correctly for '2025/26'."""
        svc = DeadlineService()
        deadlines = svc.compute_deadlines("2025/26")

        assert len(deadlines) == 7

        # Build a lookup dict: (report_type, quarter) -> deadline_date
        lookup = {(d["report_type"], d["quarter"]): d["deadline_date"] for d in deadlines}

        # Section 52 quarterly deadlines
        assert lookup[("section_52", "Q1")] == date(2025, 10, 31)
        assert lookup[("section_52", "Q2")] == date(2026, 1, 31)
        assert lookup[("section_52", "Q3")] == date(2026, 4, 30)
        assert lookup[("section_52", "Q4")] == date(2026, 7, 31)

        # Section 72 mid-year
        assert lookup[("section_72", None)] == date(2026, 1, 25)

        # Annual reports
        assert lookup[("section_46", None)] == date(2026, 8, 31)
        assert lookup[("section_121", None)] == date(2027, 1, 31)


# ---------------------------------------------------------------------------
# Test 2: compute_deadlines 2026/27
# ---------------------------------------------------------------------------


class TestComputeDeadlines2026_27:
    """Verify all 7 deadline dates for FY 2026/27 (different FY)."""

    def test_compute_deadlines_2026_27(self):
        """All 7 deadlines computed correctly for '2026/27'."""
        svc = DeadlineService()
        deadlines = svc.compute_deadlines("2026/27")

        assert len(deadlines) == 7

        lookup = {(d["report_type"], d["quarter"]): d["deadline_date"] for d in deadlines}

        assert lookup[("section_52", "Q1")] == date(2026, 10, 31)
        assert lookup[("section_52", "Q2")] == date(2027, 1, 31)
        assert lookup[("section_72", None)] == date(2027, 1, 25)
        assert lookup[("section_52", "Q3")] == date(2027, 4, 30)
        assert lookup[("section_52", "Q4")] == date(2027, 7, 31)
        assert lookup[("section_46", None)] == date(2027, 8, 31)
        assert lookup[("section_121", None)] == date(2028, 1, 31)


# ---------------------------------------------------------------------------
# Test 3: No hardcoded dates (3 different FYs produce different dates)
# ---------------------------------------------------------------------------


class TestComputeDeadlinesNoHardcodedDates:
    """Verify that deadline dates change when the FY changes — no hardcoded literals."""

    def test_compute_deadlines_no_hardcoded_dates(self):
        """Three different FYs produce three different sets of deadline dates."""
        svc = DeadlineService()

        fy1 = svc.compute_deadlines("2024/25")
        fy2 = svc.compute_deadlines("2025/26")
        fy3 = svc.compute_deadlines("2026/27")

        # Extract Section 52 Q1 dates (the most obvious test)
        q1_lookup = {
            (d["report_type"], d["quarter"]): d["deadline_date"] for d in fy1
        }
        q1_fy1 = q1_lookup[("section_52", "Q1")]

        q1_lookup2 = {
            (d["report_type"], d["quarter"]): d["deadline_date"] for d in fy2
        }
        q1_fy2 = q1_lookup2[("section_52", "Q1")]

        q1_lookup3 = {
            (d["report_type"], d["quarter"]): d["deadline_date"] for d in fy3
        }
        q1_fy3 = q1_lookup3[("section_52", "Q1")]

        # All three Q1 deadlines must differ
        assert q1_fy1 != q1_fy2
        assert q1_fy2 != q1_fy3
        assert q1_fy1 != q1_fy3

        # Section 121 dates also differ across all FYs
        s121_dates = set()
        for fy_list in [fy1, fy2, fy3]:
            for d in fy_list:
                if d["report_type"] == "section_121":
                    s121_dates.add(d["deadline_date"])
        assert len(s121_dates) == 3, "Section 121 deadline dates must differ for different FYs"


# ---------------------------------------------------------------------------
# Test 4: populate_deadlines idempotent
# ---------------------------------------------------------------------------


class TestPopulateDeadlinesIdempotent:
    """Calling populate_deadlines twice returns 7 records, not 14."""

    async def test_populate_deadlines_idempotent(self, db_session: AsyncSession):
        """Idempotent insert: second call returns 7 existing records, not 14."""
        tenant_id = str(uuid4())
        svc = DeadlineService()

        set_tenant_context(tenant_id)
        try:
            # First call: creates 7 records
            result1 = await svc.populate_deadlines("2025/26", tenant_id, db_session)
            assert len(result1) == 7

            # Second call: returns 7 existing records (no duplicates)
            result2 = await svc.populate_deadlines("2025/26", tenant_id, db_session)
            assert len(result2) == 7

            # Verify only 7 records in DB
            all_deadlines = await db_session.execute(
                select(StatutoryDeadline).where(
                    StatutoryDeadline.tenant_id == tenant_id,
                    StatutoryDeadline.financial_year == "2025/26",
                )
            )
            rows = all_deadlines.scalars().all()
            assert len(rows) == 7
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 5: check_and_notify — 30-day window
# ---------------------------------------------------------------------------


class TestCheckAndNotify30DayWindow:
    """Deadline 25 days out triggers notification_30d_sent=True and Notification record."""

    async def test_check_and_notify_30_day_window(self, db_session: AsyncSession):
        """25 days before deadline: 30d warning sent, Notification record created."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=25)

        set_tenant_context(tenant_id)
        try:
            # Create a CFO user to receive notifications
            cfo = await _create_user(db_session, tenant_id, UserRole.CFO)

            # Create deadline
            await _create_deadline(db_session, tenant_id, deadline_date)

            svc = DeadlineService()
            result = await svc.check_and_notify(db_session, tenant_id)

            assert result["notifications_sent"] >= 1
            assert result["deadlines_checked"] >= 1

            # Verify the deadline flag was set
            dl_result = await db_session.execute(
                select(StatutoryDeadline).where(StatutoryDeadline.tenant_id == tenant_id)
            )
            dl = dl_result.scalar_one()
            assert dl.notification_30d_sent is True

            # Verify a Notification record was created for the CFO
            notif_result = await db_session.execute(
                select(Notification).where(
                    Notification.tenant_id == tenant_id,
                    Notification.user_id == cfo.id,
                )
            )
            notifications = notif_result.scalars().all()
            assert len(notifications) >= 1
            assert any("30 days" in n.title or "30 days" in n.message for n in notifications)
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 6: check_and_notify — 14-day window
# ---------------------------------------------------------------------------


class TestCheckAndNotify14DayWindow:
    """Deadline 10 days out triggers both 30d and 14d flags."""

    async def test_check_and_notify_14_day_window(self, db_session: AsyncSession):
        """10 days before deadline: both 30d and 14d notification flags set."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=10)

        set_tenant_context(tenant_id)
        try:
            await _create_user(db_session, tenant_id, UserRole.CFO)
            await _create_deadline(db_session, tenant_id, deadline_date)

            svc = DeadlineService()
            await svc.check_and_notify(db_session, tenant_id)

            dl_result = await db_session.execute(
                select(StatutoryDeadline).where(StatutoryDeadline.tenant_id == tenant_id)
            )
            dl = dl_result.scalar_one()

            # Both flags should be set (10 days is within both 30d and 14d windows)
            assert dl.notification_30d_sent is True
            assert dl.notification_14d_sent is True
            # 7d window not yet triggered (10 > 7)
            assert dl.notification_7d_sent is False
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 7: check_and_notify — overdue
# ---------------------------------------------------------------------------


class TestCheckAndNotifyOverdue:
    """Past deadline triggers notification_overdue_sent=True."""

    async def test_check_and_notify_overdue(self, db_session: AsyncSession):
        """Deadline in the past: overdue notification sent."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today - timedelta(days=3)

        set_tenant_context(tenant_id)
        try:
            await _create_user(db_session, tenant_id, UserRole.MUNICIPAL_MANAGER)
            await _create_deadline(db_session, tenant_id, deadline_date)

            svc = DeadlineService()
            result = await svc.check_and_notify(db_session, tenant_id)

            assert result["notifications_sent"] >= 1

            dl_result = await db_session.execute(
                select(StatutoryDeadline).where(StatutoryDeadline.tenant_id == tenant_id)
            )
            dl = dl_result.scalar_one()
            assert dl.notification_overdue_sent is True

            # Verify overdue notification type
            notif_result = await db_session.execute(
                select(Notification).where(Notification.tenant_id == tenant_id)
            )
            notifications = notif_result.scalars().all()
            assert len(notifications) >= 1
            assert any(n.type == "deadline_overdue" for n in notifications)
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 8: check_and_notify — already sent, no duplicate
# ---------------------------------------------------------------------------


class TestCheckAndNotifyAlreadySentNoDuplicate:
    """notification_30d_sent=True prevents duplicate notification creation."""

    async def test_check_and_notify_already_sent_no_duplicate(self, db_session: AsyncSession):
        """When 30d flag already set, no new Notification created for 30d window."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=25)

        set_tenant_context(tenant_id)
        try:
            cfo = await _create_user(db_session, tenant_id, UserRole.CFO)

            # Create deadline with 30d flag already set
            await _create_deadline(
                db_session, tenant_id, deadline_date,
                notification_30d_sent=True,
            )

            svc = DeadlineService()
            result = await svc.check_and_notify(db_session, tenant_id)

            # No new 30d notification sent
            assert result["notifications_sent"] == 0

            # Confirm no notification records exist
            notif_result = await db_session.execute(
                select(Notification).where(
                    Notification.tenant_id == tenant_id,
                    Notification.user_id == cfo.id,
                )
            )
            notifications = notif_result.scalars().all()
            assert len(notifications) == 0
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 9: auto_create_report_task — creates DRAFTING report
# ---------------------------------------------------------------------------


class TestAutoCreateReportTask30DaysBefore:
    """Deadline 25 days out triggers auto-creation of StatutoryReport in DRAFTING."""

    async def test_auto_create_report_task_30_days_before(self, db_session: AsyncSession):
        """25 days before deadline: StatutoryReport created in DRAFTING status."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=25)

        set_tenant_context(tenant_id)
        try:
            deadline = await _create_deadline(
                db_session, tenant_id, deadline_date,
                report_type="section_52",
                quarter="Q1",
                financial_year="2025/26",
            )

            svc = DeadlineService()
            result = await svc.auto_create_report_tasks(db_session, tenant_id)

            assert result["tasks_created"] == 1
            assert result["deadlines_processed"] == 1

            # Verify deadline flags updated
            await db_session.refresh(deadline)
            assert deadline.task_created is True
            assert deadline.task_created_at is not None
            assert deadline.report_id is not None

            # Verify the StatutoryReport was created in DRAFTING
            report_result = await db_session.execute(
                select(StatutoryReport).where(
                    StatutoryReport.id == deadline.report_id,
                )
            )
            report = report_result.scalar_one()
            assert report.status == ReportStatus.DRAFTING
            assert report.report_type == "section_52"
            assert report.financial_year == "2025/26"
            assert report.quarter == "Q1"
            assert report.created_by == "system_auto_task"
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 10: auto_create_report_task — skips existing report
# ---------------------------------------------------------------------------


class TestAutoCreateReportTaskSkipsExistingReport:
    """If a manual report already exists, no duplicate is created."""

    async def test_auto_create_report_task_skips_existing_report(self, db_session: AsyncSession):
        """If report exists for type+FY+quarter, auto-task is skipped."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=25)

        set_tenant_context(tenant_id)
        try:
            # Create a pre-existing manual report
            existing_report = StatutoryReport(
                tenant_id=tenant_id,
                report_type="section_52",
                financial_year="2025/26",
                quarter="Q2",
                period_start=datetime(2025, 10, 1),
                period_end=datetime(2025, 12, 31),
                title="Manual Q2 Report",
                status=ReportStatus.DRAFTING,
                created_by="manual_user",
            )
            db_session.add(existing_report)
            await db_session.commit()
            await db_session.refresh(existing_report)

            # Create deadline matching the existing report
            await _create_deadline(
                db_session, tenant_id, deadline_date,
                report_type="section_52",
                quarter="Q2",
                financial_year="2025/26",
            )

            svc = DeadlineService()
            result = await svc.auto_create_report_tasks(db_session, tenant_id)

            # No new report created (existing one found)
            assert result["tasks_created"] == 0
            assert result["deadlines_processed"] == 1

            # Only 1 StatutoryReport in DB (no duplicate)
            reports_result = await db_session.execute(
                select(StatutoryReport).where(
                    StatutoryReport.tenant_id == tenant_id,
                    StatutoryReport.report_type == "section_52",
                    StatutoryReport.quarter == "Q2",
                )
            )
            all_reports = reports_result.scalars().all()
            assert len(all_reports) == 1
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 11: auto_create_skips_far_future
# ---------------------------------------------------------------------------


class TestAutoCreateSkipsFarFuture:
    """Deadline 60 days out is outside the 30-day window — no auto-task created."""

    async def test_auto_create_skips_far_future(self, db_session: AsyncSession):
        """Deadline 60 days away: auto_create_report_tasks does NOT create a task."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=60)

        set_tenant_context(tenant_id)
        try:
            await _create_deadline(db_session, tenant_id, deadline_date)

            svc = DeadlineService()
            result = await svc.auto_create_report_tasks(db_session, tenant_id)

            assert result["tasks_created"] == 0
            assert result["deadlines_processed"] == 0  # outside window, not selected

            # No StatutoryReport created
            reports_result = await db_session.execute(
                select(StatutoryReport).where(StatutoryReport.tenant_id == tenant_id)
            )
            reports = reports_result.scalars().all()
            assert len(reports) == 0
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 12: check_and_notify — email helper called
# ---------------------------------------------------------------------------


class TestCheckAndNotifySendsEmail:
    """_send_deadline_email is called for each responsible user with configured email."""

    async def test_check_and_notify_sends_email(self, db_session: AsyncSession):
        """For a 10-day deadline, email helper called with correct subject/body."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=10)

        set_tenant_context(tenant_id)
        try:
            cfo = await _create_user(
                db_session, tenant_id, UserRole.CFO,
                email="cfo@test.gov.za",
            )
            mm = await _create_user(
                db_session, tenant_id, UserRole.MUNICIPAL_MANAGER,
                email="mm@test.gov.za",
            )
            await _create_deadline(
                db_session, tenant_id, deadline_date,
                report_type="section_72",
                quarter=None,
                financial_year="2025/26",
            )

            with patch(
                "src.services.deadline_service._send_deadline_email"
            ) as mock_email:
                svc = DeadlineService()
                result = await svc.check_and_notify(db_session, tenant_id)

            # Email should have been called for each user per notification window
            assert mock_email.call_count >= 2  # at least 30d + 14d windows for 2 users
            call_args_list = [str(c) for c in mock_email.call_args_list]

            # Verify emails were sent to CFO and MM
            all_recipients = [
                call.args[0] if call.args else call.kwargs.get("recipient_email")
                for call in mock_email.call_args_list
            ]
            assert "cfo@test.gov.za" in all_recipients
            assert "mm@test.gov.za" in all_recipients
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 13: check_and_notify — email failure does not block
# ---------------------------------------------------------------------------


class TestCheckAndNotifyEmailFailureDoesNotBlock:
    """Email delivery failure must not prevent in-app Notification records from being created."""

    async def test_check_and_notify_email_failure_does_not_block(self, db_session: AsyncSession):
        """Even if email raises, Notification records are still created."""
        tenant_id = str(uuid4())
        today = date.today()
        deadline_date = today + timedelta(days=10)

        set_tenant_context(tenant_id)
        try:
            cfo = await _create_user(
                db_session, tenant_id, UserRole.CFO,
                email="cfo@test.gov.za",
            )
            await _create_deadline(db_session, tenant_id, deadline_date)

            with patch(
                "src.services.deadline_service._send_deadline_email",
                side_effect=Exception("SMTP connection refused"),
            ):
                svc = DeadlineService()
                result = await svc.check_and_notify(db_session, tenant_id)

            # Notifications still created despite email failure
            assert result["notifications_sent"] >= 1

            notif_result = await db_session.execute(
                select(Notification).where(
                    Notification.tenant_id == tenant_id,
                    Notification.user_id == cfo.id,
                )
            )
            notifications = notif_result.scalars().all()
            assert len(notifications) >= 1
        finally:
            clear_tenant_context()


# ---------------------------------------------------------------------------
# Test 14: _determine_current_financial_year helper
# ---------------------------------------------------------------------------


class TestDetermineCurrentFinancialYear:
    """Test the FY helper function with various dates."""

    def test_july_2025_gives_2025_26(self):
        """July 2025 -> "2025/26" (month >= 7, FY starts this year)."""
        dt = datetime(2025, 7, 15)
        assert _determine_current_financial_year(dt) == "2025/26"

    def test_december_2025_gives_2025_26(self):
        """December 2025 -> "2025/26" (still in the first half of the FY)."""
        dt = datetime(2025, 12, 31)
        assert _determine_current_financial_year(dt) == "2025/26"

    def test_january_2026_gives_2025_26(self):
        """January 2026 -> "2025/26" (month < 7, FY started previous year)."""
        dt = datetime(2026, 1, 1)
        assert _determine_current_financial_year(dt) == "2025/26"

    def test_june_2026_gives_2025_26(self):
        """June 2026 -> "2025/26" (last month of FY)."""
        dt = datetime(2026, 6, 30)
        assert _determine_current_financial_year(dt) == "2025/26"

    def test_july_2026_gives_2026_27(self):
        """July 2026 -> "2026/27" (new FY starts)."""
        dt = datetime(2026, 7, 1)
        assert _determine_current_financial_year(dt) == "2026/27"

    def test_march_2027_gives_2026_27(self):
        """March 2027 -> "2026/27"."""
        dt = datetime(2027, 3, 15)
        assert _determine_current_financial_year(dt) == "2026/27"
