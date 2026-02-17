"""WhatsApp service for processing incoming messages and sending replies.

Integrates Twilio WhatsApp Business API with the Phase 2 intake pipeline.
Handles media downloads, phone-to-user mapping, and message processing.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from src.agents.flows.intake_flow import IntakeFlow
from src.agents.flows.state import IntakeState
from src.core.config import settings
from src.core.conversation import ConversationManager
from src.guardrails.engine import guardrails_engine
from src.models.media import MediaAttachment
from src.models.user import User
from src.models.whatsapp_session import WhatsAppSession
from src.services.storage_service import StorageService, StorageServiceError

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service for processing WhatsApp messages through the intake pipeline.

    Handles:
    - Phone-to-user lookup and tenant resolution
    - Media download from Twilio and upload to S3
    - Message processing through Phase 2 pipeline (guardrails -> flow -> crew)
    - Reply message sending via Twilio
    """

    def __init__(self, redis_url: str, storage_service: StorageService):
        """Initialize WhatsApp service.

        Args:
            redis_url: Redis connection URL for conversation management
            storage_service: StorageService instance for media handling
        """
        self._redis_url = redis_url
        self._storage_service = storage_service

        # Create Twilio client if credentials are configured
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            self._twilio_client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
        else:
            logger.warning("Twilio client not configured (missing credentials)")
            self._twilio_client = None

    async def lookup_or_create_session(
        self,
        phone: str,
        db: AsyncSession
    ) -> WhatsAppSession | None:
        """Look up existing valid WhatsApp session for phone number.

        Args:
            phone: Phone number in E.164 format (e.g., +27123456789)
            db: Database session

        Returns:
            WhatsAppSession if valid session exists, None if expired or not found
        """
        # Query for session by phone number
        result = await db.execute(
            select(WhatsAppSession).where(
                WhatsAppSession.phone_number == phone,
                WhatsAppSession.expires_at > datetime.now(timezone.utc)
            )
        )
        session = result.scalar_one_or_none()

        if session:
            logger.debug(f"Found valid session for phone {phone}")
            return session

        logger.debug(f"No valid session found for phone {phone}")
        return None

    async def create_session(
        self,
        phone: str,
        user_id: UUID,
        tenant_id: str,
        db: AsyncSession
    ) -> WhatsAppSession:
        """Create or update WhatsApp session for phone number.

        Uses upsert pattern to handle duplicate phone numbers.

        Args:
            phone: Phone number in E.164 format
            user_id: Supabase Auth user UUID
            tenant_id: Municipality UUID as string
            db: Database session

        Returns:
            Created or updated WhatsAppSession
        """
        # Create new session with 24-hour expiry
        session = WhatsAppSession(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id
        )

        # Upsert: ON CONFLICT (phone_number) DO UPDATE
        stmt = insert(WhatsAppSession).values(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id,
            expires_at=session.expires_at,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        ).on_conflict_do_update(
            index_elements=['phone_number'],
            set_={
                'user_id': user_id,
                'tenant_id': tenant_id,
                'expires_at': session.expires_at,
                'updated_at': datetime.now(timezone.utc)
            }
        ).returning(WhatsAppSession)

        result = await db.execute(stmt)
        await db.commit()

        created_session = result.scalar_one()
        logger.info(f"Created/updated session for phone {phone}")
        return created_session

    async def process_incoming_message(
        self,
        user: User,
        message_body: str | None,
        media_items: list[dict],
        session_id: str | None,
        db: AsyncSession
    ) -> dict[str, Any]:
        """Process incoming WhatsApp message through the intake pipeline.

        This reuses the SAME pipeline as messages.py (Phase 2):
        1. Handle media attachments (download from Twilio, upload to S3)
        2. Run through guardrails (process_input)
        3. Get or create conversation session
        4. Create IntakeState and IntakeFlow
        5. Run flow.kickoff()
        6. Link media to ticket if created
        7. Sanitize output (process_output)
        8. Save conversation turns
        9. Return response with tracking number

        Args:
            user: User model (already looked up by phone)
            message_body: Text message content (may be None if only media)
            media_items: List of dicts with 'url' and 'content_type'
            session_id: Session ID for conversation tracking
            db: Database session

        Returns:
            dict with response, tracking_number, is_complete
        """
        tenant_id = str(user.tenant_id)
        user_id = str(user.id)

        # Validate we have either text or media
        if not message_body and not media_items:
            return {
                "response": "Please send a message with text or photos.",
                "is_complete": False,
                "tracking_number": None,
            }

        # Step 1: Handle media attachments
        media_file_ids: list[str] = []
        if media_items:
            for media_item in media_items:
                try:
                    # Download from Twilio and upload to S3
                    # Note: We don't have ticket_id yet, so we'll use a temp ID
                    # and update later after ticket creation
                    temp_ticket_id = str(uuid.uuid4())

                    result = await self._storage_service.download_and_upload_media(
                        media_url=media_item["url"],
                        media_content_type=media_item["content_type"],
                        ticket_id=temp_ticket_id,
                        tenant_id=tenant_id,
                        auth_credentials=(
                            settings.TWILIO_ACCOUNT_SID,
                            settings.TWILIO_AUTH_TOKEN
                        )
                    )

                    media_file_ids.append(result["file_id"])

                    logger.info(
                        f"Media downloaded and uploaded to S3",
                        extra={
                            "file_id": result["file_id"],
                            "content_type": result["content_type"],
                            "file_size": result["file_size"],
                            "s3_key": result["s3_key"],
                        }
                    )

                except StorageServiceError as e:
                    # Log error but continue processing text message
                    logger.error(
                        f"Failed to download/upload media: {e}",
                        extra={"media_url": media_item["url"]}
                    )
                except Exception as e:
                    logger.error(
                        f"Unexpected error handling media: {e}",
                        exc_info=True,
                        extra={"media_url": media_item["url"]}
                    )

        # Step 2: Prepare message text for processing
        # If only media (no text), use a placeholder message
        processing_message = message_body or "I'm sending you a photo"

        # Step 3: Run through guardrails
        input_result = await guardrails_engine.process_input(processing_message)

        if not input_result.is_safe:
            # Input blocked
            return {
                "response": input_result.blocked_reason or "Message blocked by safety filters",
                "is_complete": False,
                "tracking_number": None,
            }

        # Step 4: Get or create conversation session
        session_id = session_id or str(uuid.uuid4())
        conversation_manager = ConversationManager(self._redis_url)

        try:
            # Try to get existing session
            conversation_state = await conversation_manager.get_state(
                user_id=user_id,
                session_id=session_id,
                is_gbv=False,  # Will be determined from classification
            )

            # If session doesn't exist, create it
            if conversation_state is None:
                conversation_state = await conversation_manager.create_session(
                    user_id=user_id,
                    session_id=session_id,
                    tenant_id=tenant_id,
                    language=user.preferred_language,
                    is_gbv=False,
                )

            # Step 5: Create IntakeFlow with state
            intake_state = IntakeState(
                message_id=str(uuid.uuid4()),
                user_id=user_id,
                tenant_id=tenant_id,
                session_id=session_id,
                message=input_result.sanitized_message,
                language=conversation_state.language,
                turn_count=len(conversation_state.turns) + 1,
            )

            # Initialize flow
            flow = IntakeFlow(redis_url=self._redis_url, llm_model="gpt-4o")
            # Flow.state is a read-only @property backed by flow._state.
            # CrewAI 1.8.1 provides no public setter, so we assign directly.
            flow._state = intake_state

            # Step 6: Run flow (kickoff)
            try:
                result = flow.kickoff()

                # Extract tracking number from ticket_data
                tracking_number = None
                if flow.state.ticket_data and isinstance(flow.state.ticket_data, dict):
                    tracking_number = flow.state.ticket_data.get("tracking_number")

                # Extract response from flow state
                agent_response = "Thank you for your report. We are processing your request."
                if flow.state.ticket_data:
                    # Ticket was created
                    tracking_number_text = f" Your tracking number is {tracking_number}." if tracking_number else ""
                    agent_response = (
                        f"Your report has been received and logged.{tracking_number_text} "
                        f"We will investigate this issue and keep you updated."
                    )

                detected_language = flow.state.language
                category = flow.state.category
                is_complete = flow.state.is_complete
                ticket_id = flow.state.ticket_id

                # Step 7: If ticket created and media exists, link media to ticket
                if ticket_id and media_file_ids:
                    # Create MediaAttachment records for each uploaded file
                    for file_id in media_file_ids:
                        media_attachment = MediaAttachment(
                            ticket_id=ticket_id,
                            file_id=file_id,
                            s3_bucket=settings.S3_BUCKET_EVIDENCE,
                            s3_key=f"evidence/{tenant_id}/{ticket_id}/{file_id}",
                            filename=f"{file_id}.jpg",
                            content_type="image/jpeg",
                            file_size=0,  # Size was logged during upload but not stored; acceptable for now
                            purpose="evidence",
                            source="whatsapp",
                            is_processed=False,
                            tenant_id=tenant_id,
                            created_by=user_id,
                            updated_by=user_id,
                        )
                        db.add(media_attachment)
                    await db.commit()

                    logger.info(
                        f"Linked {len(media_file_ids)} media attachments to ticket",
                        extra={
                            "ticket_id": ticket_id,
                            "media_count": len(media_file_ids),
                        }
                    )

            except Exception as e:
                logger.error(f"Flow execution failed: {e}", exc_info=True)
                agent_response = (
                    "I apologize, but I encountered an error processing your request. "
                    "Please try again or contact support if the issue persists."
                )
                detected_language = conversation_state.language
                category = None
                is_complete = False
                ticket_id = None
                tracking_number = None

            # Step 8: Sanitize output through guardrails
            output_result = await guardrails_engine.process_output(agent_response)

            # Step 9: Save updated conversation state
            await conversation_manager.append_turn(
                user_id=user_id,
                session_id=session_id,
                role="user",
                content=input_result.sanitized_message,
                is_gbv=(category == "gbv"),
            )

            await conversation_manager.append_turn(
                user_id=user_id,
                session_id=session_id,
                role="agent",
                content=output_result.sanitized_response,
                is_gbv=(category == "gbv"),
            )

            # Step 10: Return response
            return {
                "response": output_result.sanitized_response,
                "tracking_number": tracking_number,
                "is_complete": is_complete,
            }

        finally:
            # Clean up Redis connection
            await conversation_manager.close()

    async def send_whatsapp_message(self, to_number: str, message: str) -> str | None:
        """Send WhatsApp message via Twilio.

        Args:
            to_number: Recipient phone number (with country code)
            message: Message text to send

        Returns:
            Message SID on success, None on failure
        """
        if self._twilio_client is None:
            logger.warning("Cannot send WhatsApp message: Twilio client not configured")
            return None

        # Ensure phone number has whatsapp: prefix
        if not to_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{to_number}"

        try:
            message_obj = self._twilio_client.messages.create(
                body=message,
                from_=settings.TWILIO_WHATSAPP_NUMBER,
                to=to_number
            )

            logger.info(
                f"WhatsApp message sent via Twilio",
                extra={
                    "message_sid": message_obj.sid,
                    "to": to_number,
                    "status": message_obj.status,
                }
            )

            return message_obj.sid

        except TwilioRestException as e:
            logger.error(
                f"Twilio API error sending WhatsApp message: {e}",
                extra={
                    "error_code": e.code,
                    "error_message": e.msg,
                    "to": to_number,
                }
            )
            return None
        except Exception as e:
            logger.error(
                f"Unexpected error sending WhatsApp message: {e}",
                exc_info=True,
                extra={"to": to_number}
            )
            return None
