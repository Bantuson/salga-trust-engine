"""Asynchronous ticket status notification task.

Sends WhatsApp status updates to citizens when ticket status changes.
Called asynchronously from API endpoints to avoid blocking the request.

Key decisions:
- Only primitive types (str, int) as task parameters (JSON serializable)
- Windows compatibility: use WindowsSelectorEventLoopPolicy
- Retry with exponential backoff on failures
- Graceful degradation: log warning if Twilio not configured
"""
import asyncio
import logging
import sys

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)


@app.task(
    bind=True,
    name="src.tasks.status_notify.send_status_notification",
    max_retries=3,
    default_retry_delay=60
)
def send_status_notification(
    self,
    ticket_id: str,
    user_phone: str,
    tracking_number: str,
    old_status: str,
    new_status: str,
    language: str = "en"
):
    """Send WhatsApp status update notification.

    Args:
        ticket_id: UUID of the ticket (as string for JSON serialization)
        user_phone: Citizen phone number (with country code)
        tracking_number: Ticket tracking number for reference
        old_status: Previous ticket status
        new_status: New ticket status
        language: User's preferred language (en/zu/af)

    Returns:
        dict with keys: sent (bool), message_sid (str | None)
    """
    # Windows event loop compatibility
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _send():
        from src.services.notification_service import NotificationService

        notification_service = NotificationService()
        result = await notification_service.send_status_update(
            phone=user_phone,
            tracking_number=tracking_number,
            new_status=new_status,
            language=language,
        )
        return result

    try:
        message_sid = asyncio.run(_send())

        if message_sid:
            logger.info(
                f"Status notification sent",
                extra={
                    "ticket_id": ticket_id,
                    "tracking_number": tracking_number,
                    "new_status": new_status,
                    "message_sid": message_sid,
                }
            )
        else:
            logger.warning(
                f"Status notification not sent (no Twilio client or failure)",
                extra={"ticket_id": ticket_id, "new_status": new_status}
            )

        return {"sent": message_sid is not None, "message_sid": message_sid}

    except Exception as exc:
        logger.error(f"Status notification failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
