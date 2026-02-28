"""Periodic auto-population of SDBIP actuals from resolved ticket data.

Runs daily at 01:00 SAST via Celery Beat. Queries resolved tickets per quarter
and creates auto-populated SDBIPActual records for KPIs with aggregation rules.

SEC-05 CRITICAL: All aggregation queries exclude GBV tickets (is_sensitive=FALSE).
This is enforced unconditionally in AutoPopulationEngine.populate_quarter() —
the Celery task does not need to set this filter itself.

Pattern follows src/tasks/sla_monitor.py:
- asyncio.run() wraps async logic (Celery workers are synchronous)
- Windows event loop compatibility via WindowsSelectorEventLoopPolicy
- Retry with exponential backoff (max 3 retries, 60s/120s/240s delays)
"""
import asyncio
import logging
import sys

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)


@app.task(
    bind=True,
    name="src.tasks.pms_auto_populate_task.populate_sdbip_actuals",
    max_retries=3,
)
def populate_sdbip_actuals(self):
    """Auto-populate SDBIP actuals from resolved ticket data.

    Executes the AutoPopulationEngine for the current financial year quarter.
    All tenants with active aggregation rules are processed in a single run.

    SEC-05: GBV tickets (is_sensitive=True) are unconditionally excluded from
    all aggregation queries inside AutoPopulationEngine.populate_quarter().

    Returns:
        Dict with keys: populated (int), skipped (int), errors (int).
    """
    # Windows event loop compatibility (required for development on Windows)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run():
        from src.core.database import AsyncSessionLocal
        from src.services.pms_auto_populate import AutoPopulationEngine

        engine = AutoPopulationEngine()
        async with AsyncSessionLocal() as db:
            try:
                result = await engine.populate_current_quarter(db)
                logger.info(
                    f"SDBIP auto-populate complete: "
                    f"populated={result['populated']}, "
                    f"skipped={result['skipped']}, "
                    f"errors={result['errors']}"
                )
                return result
            except Exception as e:
                logger.error(f"Auto-population failed: {e}", exc_info=True)
                raise

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error(f"Auto-populate task failed, retrying: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
