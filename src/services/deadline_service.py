"""Statutory Deadline Service.

Handles financial-year-driven deadline computation, notification scheduling,
and automatic report task creation for the statutory reporting calendar.

Key responsibilities:
- compute_deadlines: Compute all 7 statutory deadlines from a financial_year string
  (NO hardcoded date literals — all dates derived from the year components)
- populate_deadlines: Idempotent insert of deadline records per tenant/FY
- check_and_notify: Send escalating notifications at 30/14/7/3 days + overdue (REPORT-07)
- auto_create_report_tasks: Auto-create StatutoryReport in DRAFTING status 30d before deadline (REPORT-09)

Email delivery:
- _send_deadline_email: SMTP via smtplib if SMTP_HOST configured; logs gracefully if not
- Email failures never block the main notification flow (try/except with logging)

Responsible roles for deadline notifications: CFO, Municipal Manager
(Tier 1 executives accountable for statutory compliance)

Design notes:
- Notification flags on StatutoryDeadline prevent duplicate sends across daily runs
- auto_create_report_tasks is idempotent: skips if task_created=True or report exists
- Period computation reuses _compute_period from statutory_report_service
"""
import logging
import smtplib
from datetime import date, datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.notification import Notification, NotificationType
from src.models.statutory_report import ReportStatus, StatutoryDeadline, StatutoryReport
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Roles that receive statutory deadline notifications
_DEADLINE_NOTIFICATION_ROLES = {UserRole.CFO, UserRole.MUNICIPAL_MANAGER}


def _send_deadline_email(recipient_email: str, subject: str, body: str) -> None:
    """Send a deadline notification email via SMTP.

    Constructs an HTML email and sends via settings.SMTP_HOST/SMTP_PORT.
    Falls back to logging if SMTP is not configured (graceful degradation for dev).
    Never raises — any failure is caught, logged, and swallowed so the main
    notification flow is never blocked by email delivery issues.

    Args:
        recipient_email: Recipient email address.
        subject:         Email subject line.
        body:            Plain-text notification body (converted to simple HTML).
    """
    try:
        from src.core.config import settings

        if not settings.SMTP_HOST:
            logger.debug(
                "SMTP not configured — skipping email to %s (subject: %s)",
                recipient_email, subject,
            )
            return

        html_body = (
            f"<html><body>"
            f"<p>{body.replace(chr(10), '<br>')}</p>"
            f"<hr><p style='font-size:small;color:grey;'>"
            f"SALGA Trust Engine — Statutory Reporting Compliance System</p>"
            f"</body></html>"
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = recipient_email
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_FROM_EMAIL, [recipient_email], msg.as_string())

        logger.info("Deadline email sent to %s (subject: %s)", recipient_email, subject)

    except Exception as exc:
        logger.warning(
            "Failed to send deadline email to %s: %s — notification flow continues",
            recipient_email, exc,
        )


class DeadlineService:
    """Service for statutory deadline computation, notifications, and auto-task creation.

    All methods are async and accept an AsyncSession. Designed for use from
    Celery beat tasks (wrapping asyncio.run) as well as FastAPI endpoints.
    """

    # ------------------------------------------------------------------
    # Deadline computation
    # ------------------------------------------------------------------

    def compute_deadlines(self, financial_year: str) -> list[dict]:
        """Compute all 7 statutory deadlines from a financial_year string.

        All deadline dates are derived from the financial_year components —
        NO hardcoded date literals. The dates follow MFMA statutory requirements:

        1. Section 52 Q1: 31 Oct (start_year)   — Q1 ends Sep 30, report due 31 Oct
        2. Section 52 Q2: 31 Jan (end_year)      — Q2 ends Dec 31, report due 31 Jan
        3. Section 72:    25 Jan (end_year)       — Mid-year assessment due 25 Jan
        4. Section 52 Q3: 30 Apr (end_year)      — Q3 ends Mar 31, report due 30 Apr
        5. Section 52 Q4: 31 Jul (end_year)      — Q4 ends Jun 30, report due 31 Jul
        6. Section 46:    31 Aug (end_year)       — Annual performance report due 31 Aug
        7. Section 121:   31 Jan (end_year + 1)  — Annual financial statements due 31 Jan next year

        Args:
            financial_year: Financial year string in YYYY/YY format (e.g., "2025/26").

        Returns:
            List of 7 deadline dicts with keys:
            report_type, quarter, deadline_date, description.
        """
        start_year = int(financial_year.split("/")[0])
        end_year = start_year + 1

        return [
            {
                "report_type": "section_52",
                "quarter": "Q1",
                "deadline_date": date(start_year, 10, 31),
                "description": f"Section 52 Q1 Performance Report ({start_year})",
            },
            {
                "report_type": "section_52",
                "quarter": "Q2",
                "deadline_date": date(end_year, 1, 31),
                "description": (
                    f"Section 52 Q2 Performance Report ({start_year}/{end_year})"
                ),
            },
            {
                "report_type": "section_72",
                "quarter": None,
                "deadline_date": date(end_year, 1, 25),
                "description": f"Section 72 Mid-Year Assessment ({financial_year})",
            },
            {
                "report_type": "section_52",
                "quarter": "Q3",
                "deadline_date": date(end_year, 4, 30),
                "description": f"Section 52 Q3 Performance Report ({end_year})",
            },
            {
                "report_type": "section_52",
                "quarter": "Q4",
                "deadline_date": date(end_year, 7, 31),
                "description": f"Section 52 Q4 Performance Report ({end_year})",
            },
            {
                "report_type": "section_46",
                "quarter": None,
                "deadline_date": date(end_year, 8, 31),
                "description": f"Section 46 Annual Performance Report ({financial_year})",
            },
            {
                "report_type": "section_121",
                "quarter": None,
                "deadline_date": date(end_year + 1, 1, 31),
                "description": f"Section 121 Annual Report ({financial_year})",
            },
        ]

    # ------------------------------------------------------------------
    # Deadline population (idempotent)
    # ------------------------------------------------------------------

    async def populate_deadlines(
        self,
        financial_year: str,
        tenant_id: str,
        db: AsyncSession,
    ) -> list[StatutoryDeadline]:
        """Populate statutory deadline records for a financial year and tenant.

        Idempotent — skips any deadline that already exists (UniqueConstraint on
        report_type + financial_year + quarter + tenant_id). Existing records
        are returned alongside newly created ones.

        Args:
            financial_year: Financial year string (e.g., "2025/26").
            tenant_id:      Tenant scope.
            db:             Async database session.

        Returns:
            List of 7 StatutoryDeadline records (mix of created and existing).
        """
        deadline_dicts = self.compute_deadlines(financial_year)
        results: list[StatutoryDeadline] = []

        for dl in deadline_dicts:
            # Check if it already exists
            existing_result = await db.execute(
                select(StatutoryDeadline).where(
                    StatutoryDeadline.tenant_id == tenant_id,
                    StatutoryDeadline.report_type == dl["report_type"],
                    StatutoryDeadline.financial_year == financial_year,
                    StatutoryDeadline.quarter == dl["quarter"],
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing is not None:
                results.append(existing)
                continue

            # Create new deadline record
            deadline = StatutoryDeadline(
                tenant_id=tenant_id,
                report_type=dl["report_type"],
                financial_year=financial_year,
                quarter=dl["quarter"],
                deadline_date=dl["deadline_date"],
                description=dl["description"],
                task_created=False,
                notification_30d_sent=False,
                notification_14d_sent=False,
                notification_7d_sent=False,
                notification_3d_sent=False,
                notification_overdue_sent=False,
                created_by="system",
            )
            db.add(deadline)
            try:
                await db.flush()
                results.append(deadline)
                logger.debug(
                    "Created deadline: tenant=%s type=%s FY=%s Q=%s due=%s",
                    tenant_id, dl["report_type"], financial_year,
                    dl["quarter"], dl["deadline_date"],
                )
            except IntegrityError:
                # Race condition — another process created it concurrently
                await db.rollback()
                existing_result2 = await db.execute(
                    select(StatutoryDeadline).where(
                        StatutoryDeadline.tenant_id == tenant_id,
                        StatutoryDeadline.report_type == dl["report_type"],
                        StatutoryDeadline.financial_year == financial_year,
                        StatutoryDeadline.quarter == dl["quarter"],
                    )
                )
                existing2 = existing_result2.scalar_one_or_none()
                if existing2:
                    results.append(existing2)

        await db.commit()
        return results

    # ------------------------------------------------------------------
    # Notification checking
    # ------------------------------------------------------------------

    async def check_and_notify(
        self,
        db: AsyncSession,
        tenant_id: str,
    ) -> dict:
        """Check all deadlines for notification windows and send notifications.

        Notification windows:
        - 30 days before: send warning if notification_30d_sent is False
        - 14 days before: send warning if notification_14d_sent is False
        - 7 days before:  send warning if notification_7d_sent is False
        - 3 days before:  send warning if notification_3d_sent is False
        - Overdue:        send overdue notice if notification_overdue_sent is False

        For each notification event:
        - Creates one in-app Notification record per responsible user (CFO, MM)
        - Sends an email to each user with a configured email address

        Notification flags prevent duplicate sends across daily task runs.

        Args:
            db:        Async database session (with tenant context set).
            tenant_id: Tenant scope for notification recipients.

        Returns:
            Stats dict: {notifications_sent: int, deadlines_checked: int}
        """
        today = date.today()
        notifications_sent = 0

        # Fetch all deadlines that are upcoming (within 31 days) or recently overdue
        upcoming_result = await db.execute(
            select(StatutoryDeadline).where(
                StatutoryDeadline.deadline_date >= today - timedelta(days=1),
                StatutoryDeadline.deadline_date <= today + timedelta(days=31),
            )
        )
        upcoming_deadlines = list(upcoming_result.scalars().all())

        # Also fetch any overdue deadlines that haven't sent the overdue notification yet
        overdue_result = await db.execute(
            select(StatutoryDeadline).where(
                StatutoryDeadline.deadline_date < today,
                StatutoryDeadline.notification_overdue_sent == False,  # noqa: E712
            )
        )
        overdue_deadlines = [
            dl for dl in overdue_result.scalars().all()
            if dl.id not in {u.id for u in upcoming_deadlines}
        ]

        all_deadlines = upcoming_deadlines + overdue_deadlines
        deadlines_checked = len(all_deadlines)

        # Fetch responsible users (CFO and Municipal Manager) for this tenant
        users_result = await db.execute(
            select(User).where(
                User.is_active == True,  # noqa: E712
                User.role.in_([UserRole.CFO, UserRole.MUNICIPAL_MANAGER]),
            )
        )
        responsible_users = list(users_result.scalars().all())

        if not responsible_users:
            logger.info(
                "No CFO/MM users found for tenant %s — skipping deadline notifications",
                tenant_id,
            )
            return {"notifications_sent": 0, "deadlines_checked": deadlines_checked}

        for deadline in all_deadlines:
            days_until = (deadline.deadline_date - today).days

            # Determine which notification windows apply
            windows_to_send: list[tuple[str, str, str]] = []  # (flag_attr, title, type)

            if days_until < 0 and not deadline.notification_overdue_sent:
                windows_to_send.append((
                    "notification_overdue_sent",
                    "Statutory Deadline OVERDUE",
                    "overdue",
                ))
            else:
                if days_until <= 3 and not deadline.notification_3d_sent:
                    windows_to_send.append((
                        "notification_3d_sent",
                        "Statutory Deadline: 3 days remaining",
                        "warning",
                    ))
                if days_until <= 7 and not deadline.notification_7d_sent:
                    windows_to_send.append((
                        "notification_7d_sent",
                        "Statutory Deadline: 7 days remaining",
                        "warning",
                    ))
                if days_until <= 14 and not deadline.notification_14d_sent:
                    windows_to_send.append((
                        "notification_14d_sent",
                        "Statutory Deadline: 14 days remaining",
                        "warning",
                    ))
                if days_until <= 30 and not deadline.notification_30d_sent:
                    windows_to_send.append((
                        "notification_30d_sent",
                        "Statutory Deadline: 30 days remaining",
                        "warning",
                    ))

            for flag_attr, title, notification_kind in windows_to_send:
                if notification_kind == "overdue":
                    notif_type = NotificationType.DEADLINE_OVERDUE
                    days_label = f"OVERDUE by {abs(days_until)} day(s)"
                else:
                    notif_type = NotificationType.DEADLINE_WARNING
                    days_label = f"{days_until} days remaining"

                message = (
                    f"The {deadline.description} is due on "
                    f"{deadline.deadline_date.strftime('%d %B %Y')}. {days_label}."
                )
                link = "/pms?view=statutory-reports"

                # Create in-app notification for each responsible user
                for user in responsible_users:
                    notification = Notification(
                        tenant_id=tenant_id,
                        user_id=user.id,
                        type=notif_type.value,
                        title=title,
                        message=message,
                        link=link,
                        is_read=False,
                        created_by="system",
                    )
                    db.add(notification)
                    notifications_sent += 1
                    logger.info(
                        "Deadline notification queued: user=%s type=%s deadline=%s %s",
                        user.id, notif_type.value, deadline.description, days_label,
                    )

                    # Send email notification
                    user_email = getattr(user, "email", None)
                    if user_email:
                        _send_deadline_email(
                            recipient_email=user_email,
                            subject=f"[SALGA PMS] {title} — {deadline.description}",
                            body=message,
                        )

                # Set the notification flag to prevent re-sending
                setattr(deadline, flag_attr, True)

        await db.commit()

        logger.info(
            "Deadline check complete: tenant=%s deadlines_checked=%s notifications_sent=%s",
            tenant_id, deadlines_checked, notifications_sent,
        )
        return {
            "notifications_sent": notifications_sent,
            "deadlines_checked": deadlines_checked,
        }

    # ------------------------------------------------------------------
    # Auto-task creation (REPORT-09)
    # ------------------------------------------------------------------

    async def auto_create_report_tasks(
        self,
        db: AsyncSession,
        tenant_id: str,
    ) -> dict:
        """Auto-create StatutoryReport drafting tasks 30 days before each deadline.

        For each deadline that:
        - task_created is False
        - deadline_date is within the next 30 days (inclusive)
        - deadline_date is in the future (today or later)

        Creates a StatutoryReport in DRAFTING status. Skips if a report with the
        same type+FY+quarter already exists (prevents duplicates with manual reports).

        Args:
            db:        Async database session (with tenant context set).
            tenant_id: Tenant scope for created reports.

        Returns:
            Stats dict: {tasks_created: int, deadlines_processed: int}
        """
        today = date.today()
        window_end = today + timedelta(days=30)

        # Fetch deadlines within the auto-task window
        result = await db.execute(
            select(StatutoryDeadline).where(
                StatutoryDeadline.task_created == False,  # noqa: E712
                StatutoryDeadline.deadline_date >= today,
                StatutoryDeadline.deadline_date <= window_end,
            )
        )
        eligible_deadlines = list(result.scalars().all())

        tasks_created = 0
        deadlines_processed = len(eligible_deadlines)

        for deadline in eligible_deadlines:
            # Check if a report already exists for this type+FY+quarter
            existing_result = await db.execute(
                select(StatutoryReport).where(
                    StatutoryReport.report_type == deadline.report_type,
                    StatutoryReport.financial_year == deadline.financial_year,
                    StatutoryReport.quarter == deadline.quarter,
                )
            )
            existing_report = existing_result.scalar_one_or_none()

            if existing_report is not None:
                # Mark as task_created so we don't check again
                deadline.task_created = True
                deadline.task_created_at = datetime.now(timezone.utc)
                deadline.report_id = existing_report.id
                logger.debug(
                    "Auto-task: report already exists for %s %s Q=%s — skipping creation",
                    deadline.report_type, deadline.financial_year, deadline.quarter,
                )
                continue

            # Compute period dates
            period_start, period_end = _compute_deadline_period(
                deadline.report_type, deadline.financial_year, deadline.quarter
            )

            # Create the StatutoryReport in DRAFTING status
            report = StatutoryReport(
                tenant_id=tenant_id,
                report_type=deadline.report_type,
                financial_year=deadline.financial_year,
                quarter=deadline.quarter,
                period_start=datetime.combine(period_start, datetime.min.time()),
                period_end=datetime.combine(period_end, datetime.min.time()),
                title=deadline.description,
                status=ReportStatus.DRAFTING,
                created_by="system_auto_task",
                updated_by="system_auto_task",
            )
            db.add(report)
            await db.flush()  # Get the report ID before updating deadline

            # Update deadline tracking
            deadline.task_created = True
            deadline.task_created_at = datetime.now(timezone.utc)
            deadline.report_id = report.id
            tasks_created += 1

            logger.info(
                "Auto-task created: report=%s type=%s FY=%s Q=%s due=%s",
                report.id, deadline.report_type, deadline.financial_year,
                deadline.quarter, deadline.deadline_date,
            )

        await db.commit()

        logger.info(
            "Auto-task creation complete: tenant=%s deadlines_processed=%s tasks_created=%s",
            tenant_id, deadlines_processed, tasks_created,
        )
        return {
            "tasks_created": tasks_created,
            "deadlines_processed": deadlines_processed,
        }


# ---------------------------------------------------------------------------
# Period computation helper (mirrors _compute_period in statutory_report_service)
# ---------------------------------------------------------------------------


def _compute_deadline_period(
    report_type: str,
    financial_year: str,
    quarter: str | None,
) -> tuple[date, date]:
    """Compute period_start and period_end for an auto-created report.

    South African financial year: July 1 to June 30.
    Mirrors the _compute_period logic in statutory_report_service.py.

    Args:
        report_type:    Report type string (e.g., "section_52").
        financial_year: "YYYY/YY" string.
        quarter:        "Q1"-"Q4" or None.

    Returns:
        Tuple of (period_start, period_end) as date objects.
    """
    start_year = int(financial_year.split("/")[0])
    next_year = start_year + 1

    if report_type == "section_52":
        quarter_periods = {
            "Q1": (date(start_year, 7, 1), date(start_year, 9, 30)),
            "Q2": (date(start_year, 10, 1), date(start_year, 12, 31)),
            "Q3": (date(next_year, 1, 1), date(next_year, 3, 31)),
            "Q4": (date(next_year, 4, 1), date(next_year, 6, 30)),
        }
        return quarter_periods[quarter]  # type: ignore[index]
    elif report_type == "section_72":
        return date(start_year, 7, 1), date(start_year, 12, 31)
    else:
        # section_46 and section_121: full financial year
        return date(start_year, 7, 1), date(next_year, 6, 30)
