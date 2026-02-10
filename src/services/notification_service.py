"""Notification service for sending WhatsApp status updates to citizens.

Sends trilingual (EN/ZU/AF) WhatsApp messages to citizens when their ticket
status changes. Uses Twilio WhatsApp Business API.

Key decisions:
- Trilingual messages for accessibility (EN/ZU/AF)
- Human-readable status text (not raw enum values)
- Uses Twilio Content API templates in production (TODO: migrate from body text)
- Graceful degradation in dev mode (no Twilio credentials = log only)
"""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from src.core.config import settings
from src.models.ticket import Ticket
from src.models.user import User

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending WhatsApp notifications to citizens.

    Provides methods to:
    - Send status update notifications (trilingual)
    - Send escalation notices
    - Send SLA warnings (internal only, future Phase 5)
    """

    def __init__(self):
        """Initialize notification service with Twilio client."""
        # Create Twilio client if credentials are configured
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            self._twilio_client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            self._from_number = settings.TWILIO_WHATSAPP_NUMBER
        else:
            logger.warning("Twilio client not configured (missing credentials)")
            self._twilio_client = None
            self._from_number = None

    async def send_status_update(
        self,
        phone: str,
        tracking_number: str,
        new_status: str,
        language: str = "en"
    ) -> str | None:
        """Send WhatsApp status update to citizen.

        Maps ticket status to human-readable text in the user's language.
        Sends via Twilio WhatsApp Business API.

        Status mappings:
        - open: "received and under review" (EN), "yamukelwe futhi ibhekwa" (ZU), "ontvang en onder hersiening" (AF)
        - in_progress: "being worked on" (EN), "kuyasebenzelwa" (ZU), "word aan gewerk" (AF)
        - escalated: "escalated to senior team" (EN), "idluliselwe ethimini eliphezulu" (ZU), "verwys na senior span" (AF)
        - resolved: "resolved - please confirm" (EN), "ixazululiwe - sicela uqinisekise" (ZU), "opgelos - bevestig asseblief" (AF)
        - closed: "closed" (EN), "ivaliwe" (ZU), "gesluit" (AF)

        TODO: Migrate to Twilio Content API templates (requires pre-approval).
        For now, using body text for faster development iteration.

        Args:
            phone: Recipient phone number (with country code, e.g., +27821234567)
            tracking_number: Ticket tracking number for reference
            new_status: New ticket status (raw value)
            language: User's preferred language (en/zu/af)

        Returns:
            Twilio message SID on success, None on failure or missing credentials
        """
        if self._twilio_client is None:
            logger.warning(
                "Cannot send status update: Twilio client not configured",
                extra={
                    "tracking_number": tracking_number,
                    "new_status": new_status,
                }
            )
            return None

        # Map status to human-readable text
        status_map = {
            "en": {
                "open": "received and under review",
                "in_progress": "being worked on",
                "escalated": "escalated to senior team",
                "resolved": "resolved - please confirm",
                "closed": "closed",
            },
            "zu": {
                "open": "yamukelwe futhi ibhekwa",
                "in_progress": "kuyasebenzelwa",
                "escalated": "idluliselwe ethimini eliphezulu",
                "resolved": "ixazululiwe - sicela uqinisekise",
                "closed": "ivaliwe",
            },
            "af": {
                "open": "ontvang en onder hersiening",
                "in_progress": "word aan gewerk",
                "escalated": "verwys na senior span",
                "resolved": "opgelos - bevestig asseblief",
                "closed": "gesluit",
            },
        }

        # Get status text in user's language
        lang_map = status_map.get(language, status_map["en"])
        status_text = lang_map.get(new_status, new_status)

        # Format message in user's language
        if language == "zu":
            message = f"Isibuyekezo se-{tracking_number}: Umbiko wakho manje {status_text}."
        elif language == "af":
            message = f"Opdatering vir {tracking_number}: U verslag is nou {status_text}."
        else:  # Default to English
            message = f"Update for {tracking_number}: Your report is now {status_text}."

        # Ensure phone number has whatsapp: prefix
        if not phone.startswith("whatsapp:"):
            phone = f"whatsapp:{phone}"

        try:
            message_obj = self._twilio_client.messages.create(
                body=message,
                from_=self._from_number,
                to=phone
            )

            logger.info(
                "Status update sent via WhatsApp",
                extra={
                    "message_sid": message_obj.sid,
                    "tracking_number": tracking_number,
                    "new_status": new_status,
                    "language": language,
                    "to": phone,
                }
            )

            return message_obj.sid

        except TwilioRestException as e:
            logger.error(
                f"Twilio API error sending status update: {e}",
                extra={
                    "error_code": e.code,
                    "error_message": e.msg,
                    "tracking_number": tracking_number,
                    "to": phone,
                }
            )
            return None

        except Exception as e:
            logger.error(
                f"Unexpected error sending status update: {e}",
                exc_info=True,
                extra={
                    "tracking_number": tracking_number,
                    "to": phone,
                }
            )
            return None

    async def send_sla_warning(
        self,
        ticket: Ticket,
        warning_type: str,
        db: AsyncSession
    ) -> None:
        """Send SLA warning notification (internal only).

        Currently logs the warning. In Phase 5, will send to team lead
        via internal notification system (not WhatsApp to citizen).

        Args:
            ticket: Ticket model instance
            warning_type: Type of warning (response_warning, resolution_warning)
            db: Database session
        """
        logger.warning(
            f"SLA warning for ticket",
            extra={
                "ticket_id": str(ticket.id),
                "tracking_number": ticket.tracking_number,
                "warning_type": warning_type,
                "category": ticket.category,
                "status": ticket.status,
            }
        )

        # TODO Phase 5: Send to team lead via internal notification system
        # This could be:
        # - Dashboard notification bell
        # - Email to team lead
        # - SMS to team lead
        # - Slack/Teams integration

    async def send_escalation_notice(
        self,
        ticket: Ticket,
        db: AsyncSession
    ) -> str | None:
        """Send escalation notice to citizen via WhatsApp.

        Notifies citizen that their report has been escalated for faster resolution.
        Trilingual (EN/ZU/AF).

        Args:
            ticket: Ticket model instance
            db: Database session

        Returns:
            Twilio message SID on success, None on failure
        """
        if self._twilio_client is None:
            logger.warning(
                "Cannot send escalation notice: Twilio client not configured",
                extra={"ticket_id": str(ticket.id)}
            )
            return None

        # Look up citizen's phone number
        stmt = select(User).where(User.id == ticket.user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.phone:
            logger.warning(
                "Cannot send escalation notice: user or phone not found",
                extra={"ticket_id": str(ticket.id), "user_id": str(ticket.user_id)}
            )
            return None

        # Format message in user's language
        tracking_number = ticket.tracking_number
        language = ticket.language

        if language == "zu":
            message = f"Umbiko wakho {tracking_number} udluliselwe ukuze uxazululwe ngokushesha."
        elif language == "af":
            message = f"U verslag {tracking_number} is verwys vir vinniger oplossing."
        else:  # Default to English
            message = f"Your report {tracking_number} has been escalated for faster resolution."

        # Send via WhatsApp
        phone = user.phone
        if not phone.startswith("whatsapp:"):
            phone = f"whatsapp:{phone}"

        try:
            message_obj = self._twilio_client.messages.create(
                body=message,
                from_=self._from_number,
                to=phone
            )

            logger.info(
                "Escalation notice sent via WhatsApp",
                extra={
                    "message_sid": message_obj.sid,
                    "ticket_id": str(ticket.id),
                    "tracking_number": tracking_number,
                    "language": language,
                    "to": phone,
                }
            )

            return message_obj.sid

        except TwilioRestException as e:
            logger.error(
                f"Twilio API error sending escalation notice: {e}",
                extra={
                    "error_code": e.code,
                    "error_message": e.msg,
                    "ticket_id": str(ticket.id),
                    "to": phone,
                }
            )
            return None

        except Exception as e:
            logger.error(
                f"Unexpected error sending escalation notice: {e}",
                exc_info=True,
                extra={
                    "ticket_id": str(ticket.id),
                    "to": phone,
                }
            )
            return None
