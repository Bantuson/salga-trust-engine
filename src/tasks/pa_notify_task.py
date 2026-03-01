"""Celery task for notifying PA evaluators at the start of each financial quarter.

Runs quarterly on the 1st of January, April, July, and October at 08:00 SAST
via Celery Beat. Discovers all tenants with active Performance Agreements, then
logs a notification for each evaluator.

NOTE: The actual email/in-app notification delivery is deferred to Phase 30
(notification infrastructure). This task establishes the scheduling pattern
and tenant iteration pattern for use in Phase 30 integration.

Pattern follows src/tasks/pms_auto_populate_task.py:
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


def _determine_current_quarter() -> str:
    """Determine the current South African financial year quarter.

    SA financial year: July – June
        Q1: July – September
        Q2: October – December
        Q3: January – March
        Q4: April – June

    Returns:
        Current quarter as "Q1", "Q2", "Q3", or "Q4".
    """
    month = datetime.now().month
    if month in (7, 8, 9):
        return "Q1"
    elif month in (10, 11, 12):
        return "Q2"
    elif month in (1, 2, 3):
        return "Q3"
    else:  # 4, 5, 6
        return "Q4"


@app.task(
    bind=True,
    name="src.tasks.pa_notify_task.notify_pa_evaluators",
    max_retries=3,
)
def notify_pa_evaluators(self):
    """Notify PA evaluators at the start of each financial quarter.

    Iterates all tenants with signed Performance Agreements and logs a
    notification entry for each evaluator. Actual delivery (email/in-app)
    will be implemented in Phase 30.

    Returns:
        Dict with keys: tenant_count (int), notifications_logged (int).
    """
    # Windows event loop compatibility (required for development on Windows)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    current_quarter = _determine_current_quarter()

    async def _run():
        from sqlalchemy import text

        from src.core.database import AsyncSessionLocal
        from src.core.tenant import clear_tenant_context, set_tenant_context
        from src.models.pa import PAStatus, PerformanceAgreement
        from sqlalchemy import select

        notifications_logged = 0
        tenant_count = 0

        async with AsyncSessionLocal() as db:
            # Tenant discovery via raw SQL — bypasses ORM do_orm_execute RLS filter
            # (same pattern as pms_auto_populate_task.py)
            tenant_result = await db.execute(
                text(
                    "SELECT DISTINCT tenant_id FROM performance_agreements "
                    "WHERE is_deleted = false"
                )
            )
            tenant_ids = [row[0] for row in tenant_result.fetchall()]

        for tenant_id in tenant_ids:
            tenant_count += 1
            set_tenant_context(tenant_id)
            try:
                async with AsyncSessionLocal() as db:
                    # Fetch signed PAs for this tenant (signed = evaluator needs to score)
                    result = await db.execute(
                        select(PerformanceAgreement).where(
                            PerformanceAgreement.status.in_(
                                [PAStatus.SIGNED, PAStatus.UNDER_REVIEW]
                            )
                        )
                    )
                    agreements = list(result.scalars().all())

                    for agreement in agreements:
                        # Log notification (actual delivery deferred to Phase 30)
                        logger.info(
                            "PA evaluator notification: tenant=%s agreement=%s "
                            "manager=%s FY=%s quarter=%s status=%s",
                            tenant_id,
                            agreement.id,
                            agreement.section57_manager_id,
                            agreement.financial_year,
                            current_quarter,
                            agreement.status,
                        )
                        notifications_logged += 1
            except Exception as exc:
                logger.error(
                    "PA notify task failed for tenant %s: %s",
                    tenant_id, exc, exc_info=True,
                )
            finally:
                clear_tenant_context()

        logger.info(
            "PA evaluator notifications complete: tenants=%s notifications=%s quarter=%s",
            tenant_count, notifications_logged, current_quarter,
        )
        return {
            "tenant_count": tenant_count,
            "notifications_logged": notifications_logged,
            "quarter": current_quarter,
        }

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error(f"PA notify task failed, retrying: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
