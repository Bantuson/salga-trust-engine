"""Celery task for checking statutory deadlines and sending notifications.

Runs daily at 07:00 SAST via Celery Beat. For each tenant:
1. Auto-populates deadline records for the current financial year (if not already populated)
2. Checks each deadline for notification windows (30/14/7/3 days, overdue)
3. Creates Notification records for responsible users (CFO, MM)
4. Auto-creates report drafting tasks 30 days before deadlines (REPORT-09)

Pattern follows src/tasks/pa_notify_task.py:
- asyncio.run() wraps async logic (Celery workers are synchronous)
- Windows event loop compatibility via WindowsSelectorEventLoopPolicy
- Tenant discovery via text() raw SQL (bypasses ORM do_orm_execute RLS filter)
- set_tenant_context() / clear_tenant_context() with try/finally per tenant
"""
import asyncio
import logging
import sys
from datetime import datetime

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)


def _determine_current_financial_year(reference_date: datetime | None = None) -> str:
    """Determine the current South African municipal financial year.

    SA municipal financial year: 1 July to 30 June.
    - July–December (months 7-12): FY starts this calendar year
      e.g., July 2025 -> "2025/26"
    - January–June (months 1-6): FY started the previous calendar year
      e.g., January 2026 -> "2025/26"

    Args:
        reference_date: Date to compute FY from (defaults to today).

    Returns:
        Financial year string in YYYY/YY format (e.g., "2025/26").
    """
    if reference_date is None:
        reference_date = datetime.now()

    year = reference_date.year
    month = reference_date.month

    if month >= 7:
        # July-December: FY is year/year+1
        fy_start = year
        fy_end = year + 1
    else:
        # January-June: FY is year-1/year
        fy_start = year - 1
        fy_end = year

    # Format: "2025/26" (last 2 digits of end year)
    return f"{fy_start}/{str(fy_end)[-2:]}"


@app.task(
    bind=True,
    name="src.tasks.statutory_deadline_task.check_statutory_deadlines",
    max_retries=3,
)
def check_statutory_deadlines(self):
    """Check statutory deadlines daily, send escalating notifications, auto-create tasks.

    Runs daily at 07:00 SAST via Celery Beat. For each active tenant:
    1. populate_deadlines — idempotent; creates deadline records for the current FY
       if they don't already exist.
    2. check_and_notify — creates in-app Notification records and sends emails
       for CFO and Municipal Manager at 30/14/7/3 day windows + overdue.
    3. auto_create_report_tasks — auto-creates StatutoryReport in DRAFTING status
       for any deadline within the next 30 days (REPORT-09).

    Tenant discovery uses raw SQL to bypass the ORM do_orm_execute RLS filter
    (same pattern as pms_auto_populate_task.py). Uses a UNION of two sources:
    - Users table: every active tenant has at least one active user
    - Statutory deadlines: catch tenants with existing deadline records

    Returns:
        Dict with keys:
        - tenant_count (int): number of tenants processed
        - notifications_sent (int): total in-app notifications created
        - tasks_created (int): total auto-report tasks created
        - financial_year (str): the FY that was processed
    """
    # Windows event loop compatibility (required for development on Windows)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    current_fy = _determine_current_financial_year()

    async def _run():
        from sqlalchemy import text

        from src.core.database import AsyncSessionLocal
        from src.core.tenant import clear_tenant_context, set_tenant_context
        from src.services.deadline_service import DeadlineService

        deadline_service = DeadlineService()
        total_notifications_sent = 0
        total_tasks_created = 0
        tenant_count = 0

        # Tenant discovery via raw SQL — bypasses ORM do_orm_execute RLS filter.
        # Union of users (primary source) and statutory_deadlines (tenants that
        # already have deadline records from previous runs).
        async with AsyncSessionLocal() as db:
            tenant_result = await db.execute(
                text(
                    "SELECT DISTINCT tenant_id FROM users WHERE is_active = true "
                    "UNION "
                    "SELECT DISTINCT tenant_id FROM statutory_deadlines"
                )
            )
            tenant_ids = [row[0] for row in tenant_result.fetchall()]

        logger.info(
            "Statutory deadline check starting: FY=%s tenants=%s",
            current_fy, len(tenant_ids),
        )

        for tenant_id in tenant_ids:
            tenant_count += 1
            set_tenant_context(tenant_id)
            try:
                async with AsyncSessionLocal() as db:
                    # Step 1: Populate deadlines for the current FY (idempotent)
                    await deadline_service.populate_deadlines(current_fy, tenant_id, db)

                    # Step 2: Check notification windows and send notifications
                    notify_result = await deadline_service.check_and_notify(db, tenant_id)
                    total_notifications_sent += notify_result.get("notifications_sent", 0)

                    # Step 3: Auto-create report tasks for deadlines within 30 days
                    task_result = await deadline_service.auto_create_report_tasks(db, tenant_id)
                    total_tasks_created += task_result.get("tasks_created", 0)

                    logger.info(
                        "Statutory deadline check: tenant=%s notifications=%s tasks=%s",
                        tenant_id,
                        notify_result.get("notifications_sent", 0),
                        task_result.get("tasks_created", 0),
                    )

            except Exception as exc:
                logger.error(
                    "Statutory deadline task failed for tenant %s: %s",
                    tenant_id, exc, exc_info=True,
                )
            finally:
                clear_tenant_context()

        logger.info(
            "Statutory deadline check complete: FY=%s tenants=%s notifications=%s tasks=%s",
            current_fy, tenant_count, total_notifications_sent, total_tasks_created,
        )
        return {
            "tenant_count": tenant_count,
            "notifications_sent": total_notifications_sent,
            "tasks_created": total_tasks_created,
            "financial_year": current_fy,
        }

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("Statutory deadline task failed, retrying: %s", exc)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
