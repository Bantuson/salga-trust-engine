"""Periodic SLA breach detection and auto-escalation task.

Runs every 5 minutes via Celery Beat. Checks all open/in_progress tickets
for SLA breaches and triggers escalation for overdue tickets.

Key decisions:
- Celery workers are synchronous, so wrap async code with asyncio.run()
- Windows compatibility: use WindowsSelectorEventLoopPolicy
- Retry with exponential backoff on failures
- Advisory locks in EscalationService prevent duplicate escalations
"""
import asyncio
import logging
import sys

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, name="src.tasks.sla_monitor.check_sla_breaches", max_retries=3)
def check_sla_breaches(self):
    """Check all open/in_progress tickets for SLA breaches.

    Uses synchronous database session (Celery workers are synchronous).
    Finds breached tickets and triggers escalation for each.

    Returns:
        dict with keys: breached (int), escalated (int)
    """
    # Windows event loop compatibility
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run():
        from src.core.database import AsyncSessionLocal
        from src.services.escalation_service import EscalationService
        from src.services.sla_service import SLAService

        sla_service = SLAService()
        escalation_service = EscalationService()

        async with AsyncSessionLocal() as db:
            try:
                # Find breached tickets
                breached = await sla_service.find_breached_tickets(db)

                if not breached:
                    logger.debug("No SLA breaches found")
                    return {"breached": 0, "escalated": 0}

                logger.info(f"Found {len(breached)} SLA breaches")

                # Escalate breached tickets
                escalated = await escalation_service.bulk_escalate(breached, db)

                logger.info(f"Escalated {escalated}/{len(breached)} tickets")
                return {"breached": len(breached), "escalated": escalated}

            except Exception as e:
                logger.error(f"SLA check failed: {e}", exc_info=True)
                raise

    try:
        # Run async code in Celery's sync context
        # Use asyncio.run() for clean event loop
        return asyncio.run(_run())
    except Exception as exc:
        logger.error(f"SLA monitor task failed, retrying: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
