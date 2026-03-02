"""Auto-flag risk items when a KPI's quarterly actual turns red (RISK-03).

Dispatched on-demand by the submit_actual and validate_actual endpoints in
src/api/v1/sdbip.py when actual.traffic_light_status == "red".

Pattern follows src/tasks/pms_auto_populate_task.py:
- asyncio.run() wraps async logic (Celery workers are synchronous)
- Windows event loop compatibility via WindowsSelectorEventLoopPolicy
- Retry with exponential backoff (max 3 retries, 60s/120s/240s delays)
- Imports deferred into inner async function for Celery worker isolation

This task is NOT a beat schedule task — it is dispatched on-demand when a red
actual is submitted. It is included in celery_app.py for auto-discovery.
"""
import asyncio
import logging
import sys
from uuid import UUID

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)


@app.task(
    bind=True,
    name="src.tasks.risk_autoflag_task.flag_risk_items_for_kpi",
    max_retries=3,
)
def flag_risk_items_for_kpi(self, kpi_id: str, tenant_id: str):
    """Auto-flag risk items linked to a KPI that has turned red.

    Sets risk_rating="high" and is_auto_flagged=True on all linked non-critical
    risk items. Does not overwrite items already rated "critical".

    Args:
        kpi_id: UUID string of the SDBIP KPI with a red actual
        tenant_id: Municipality tenant ID for tenant context

    Returns:
        Dict with key "flagged" (int count of flagged items)
    """
    # Windows event loop compatibility (required for development on Windows)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run():
        from src.core.database import AsyncSessionLocal
        from src.core.tenant import clear_tenant_context, set_tenant_context
        from src.services.risk_service import RiskService

        service = RiskService()
        async with AsyncSessionLocal() as db:
            try:
                set_tenant_context(tenant_id)
                count = await service.auto_flag_for_kpi(
                    kpi_id=UUID(kpi_id), tenant_id=tenant_id, db=db
                )
                logger.info(
                    "Auto-flagged %d risk items for KPI %s (tenant=%s)",
                    count,
                    kpi_id,
                    tenant_id,
                )
                return {"flagged": count}
            finally:
                clear_tenant_context()

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("Risk auto-flag task failed, retrying: %s", exc)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
