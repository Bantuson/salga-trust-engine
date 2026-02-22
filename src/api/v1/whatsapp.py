"""WhatsApp webhook endpoint for Twilio Business API integration.

This module provides webhook endpoints for incoming WhatsApp messages and status callbacks.
Integrates with the existing Phase 2 intake pipeline (guardrails -> flow -> crew).
"""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from src.api.deps import get_db
from src.core.config import settings
from src.models.user import User
from src.schemas.whatsapp import WhatsAppMediaItem, WhatsAppWebhookPayload, WhatsAppResponse
from src.services.whatsapp_service import WhatsAppService
from src.services.storage_service import StorageService
from sqlalchemy import select

logger = logging.getLogger(__name__)

# Create router (no prefix here - added in main.py)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


async def validate_twilio_request(request: Request) -> dict:
    """Validate Twilio webhook signature and parse form data.

    Args:
        request: FastAPI request object

    Returns:
        Parsed form data as dictionary

    Raises:
        HTTPException: 403 if signature validation fails
    """
    # Read form data
    form = await request.form()
    form_dict = dict(form)

    # Get signature header
    signature = request.headers.get("X-Twilio-Signature", "")

    # Skip validation in development/testing if no auth token configured
    if not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio signature validation skipped (no TWILIO_AUTH_TOKEN configured)")
        return form_dict

    # Validate signature
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    url = str(request.url)

    if not validator.validate(url, form_dict, signature):
        logger.error(
            "Invalid Twilio signature",
            extra={
                "url": url,
                "signature": signature[:20] + "..." if signature else None,
            }
        )
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    return form_dict


async def lookup_user_by_phone(phone: str, db: AsyncSession) -> User | None:
    """Look up user by phone number (cross-tenant).

    Args:
        phone: Phone number (may have whatsapp: prefix)
        db: Database session

    Returns:
        User if found and active, None otherwise
    """
    # Normalize phone number
    normalized = phone.replace("whatsapp:", "").strip()

    # Handle South African number formats (+27 vs 0 prefix)
    if normalized.startswith("0") and len(normalized) == 10:
        # Convert 0XXXXXXXXX to +27XXXXXXXXX
        normalized = "+27" + normalized[1:]
    elif not normalized.startswith("+"):
        # Add + if missing
        normalized = "+" + normalized

    # Query user by phone (cross-tenant lookup)
    # This is intentionally cross-tenant because phone is unique across system
    result = await db.execute(
        select(User).where(
            User.phone == normalized,
            User.is_active == True,
            User.is_deleted == False
        )
    )
    user = result.scalar_one_or_none()

    return user


@router.post("/webhook", response_class=Response)
async def whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Response:
    """Receive and process incoming WhatsApp messages from Twilio.

    This endpoint:
    1. Validates Twilio signature
    2. Parses webhook payload
    3. Looks up user by phone number
    4. Extracts media URLs if present
    5. Processes message through WhatsAppService (reuses Phase 2 pipeline)
    6. Returns TwiML response with agent reply

    Args:
        request: FastAPI request with form data
        db: Database session

    Returns:
        TwiML XML response for Twilio
    """
    try:
        # Step 1: Validate signature and parse form data
        form_dict = await validate_twilio_request(request)

        # Step 2: Parse into Pydantic model
        try:
            payload = WhatsAppWebhookPayload(**form_dict)
        except Exception as e:
            logger.error(f"Failed to parse webhook payload: {e}", extra={"form_data": form_dict})
            # Return TwiML error response
            resp = MessagingResponse()
            resp.message("Sorry, we couldn't process your message. Please try again.")
            return Response(content=str(resp), media_type="application/xml")

        # Step 3: Extract phone number
        sender_phone = payload.From

        # Step 4: Look up user
        user = await lookup_user_by_phone(sender_phone, db)

        if user is None:
            # User not registered - send registration prompt
            logger.info(f"Unregistered user attempted to message via WhatsApp: {sender_phone}")
            resp = MessagingResponse()
            resp.message(
                "Welcome! Please register at our web portal first to use WhatsApp reporting. "
                "Visit https://salga.gov.za/register"
            )
            return Response(content=str(resp), media_type="application/xml")

        # Step 5: Extract media items if present
        media_items: list[dict[str, Any]] = []
        if payload.NumMedia > 0:
            for i in range(min(payload.NumMedia, 10)):  # Twilio sends max 10 media
                media_url = getattr(payload, f"MediaUrl{i}", None)
                media_content_type = getattr(payload, f"MediaContentType{i}", None)

                if media_url and media_content_type:
                    media_items.append({
                        "url": media_url,
                        "content_type": media_content_type
                    })

        logger.info(
            f"WhatsApp message received from user {user.id}",
            extra={
                "user_id": str(user.id),
                "tenant_id": str(user.tenant_id),
                "has_text": bool(payload.Body),
                "num_media": len(media_items),
                "message_sid": payload.MessageSid
            }
        )

        # Step 6: Process message through WhatsAppService
        storage_service = StorageService()
        whatsapp_service = WhatsAppService(
            redis_url=settings.REDIS_URL,
            storage_service=storage_service
        )

        # Stable session per phone number (not per message) — supports multi-turn state
        normalized_phone = sender_phone.replace("whatsapp:", "").strip()
        session_id = f"wa-{normalized_phone}"

        result = await whatsapp_service.process_incoming_message(
            user=user,
            message_body=payload.Body,
            media_items=media_items,
            session_id=session_id,
            db=db
        )

        # Step 7: Return TwiML response
        resp = MessagingResponse()
        resp.message(result.get("response", "Thank you for your message."))

        logger.info(
            f"WhatsApp response sent to user {user.id}",
            extra={
                "user_id": str(user.id),
                "is_complete": result.get("is_complete", False),
                "tracking_number": result.get("tracking_number"),
            }
        )

        return Response(content=str(resp), media_type="application/xml")

    except HTTPException:
        # Re-raise HTTP exceptions (like signature validation failure)
        raise
    except Exception as e:
        # Log unexpected errors and return graceful error message
        logger.error(f"Unexpected error in WhatsApp webhook: {e}", exc_info=True)

        resp = MessagingResponse()
        resp.message(
            "Sorry, we encountered an error processing your message. "
            "Please try again later or visit our web portal."
        )
        return Response(content=str(resp), media_type="application/xml")


@router.post("/status")
async def whatsapp_status_callback(request: Request) -> dict:
    """Receive message delivery status updates from Twilio.

    Logs status updates for debugging and monitoring.
    Statuses: queued, sending, sent, delivered, read, failed, undelivered

    Args:
        request: FastAPI request with form data

    Returns:
        Simple acknowledgment
    """
    try:
        form = await request.form()
        form_dict = dict(form)

        message_sid = form_dict.get("MessageSid")
        message_status = form_dict.get("MessageStatus")
        to = form_dict.get("To")

        logger.info(
            f"WhatsApp message status update: {message_status}",
            extra={
                "message_sid": message_sid,
                "status": message_status,
                "to": to,
            }
        )

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Error processing status callback: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
