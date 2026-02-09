"""Pydantic schemas for WhatsApp webhook payloads and responses.

Defines data structures for Twilio WhatsApp Business API webhook integration.
"""
from pydantic import BaseModel, Field


class WhatsAppWebhookPayload(BaseModel):
    """Twilio WhatsApp webhook payload.

    Twilio sends form data with specific field names. We parse these into a structured model.
    Supports up to 10 media attachments per message (we handle 0-10).
    """

    From: str = Field(
        ...,
        alias="From",
        description="Sender WhatsApp number (format: whatsapp:+27...)"
    )
    Body: str | None = Field(
        default=None,
        alias="Body",
        description="Text message content"
    )
    NumMedia: int = Field(
        default=0,
        alias="NumMedia",
        description="Number of media attachments"
    )
    MessageSid: str = Field(
        ...,
        alias="MessageSid",
        description="Unique Twilio message ID"
    )
    AccountSid: str = Field(
        ...,
        alias="AccountSid",
        description="Twilio account SID"
    )

    # Media fields (Twilio sends MediaUrl0, MediaUrl1, ..., MediaUrl9)
    MediaUrl0: str | None = Field(default=None, alias="MediaUrl0")
    MediaContentType0: str | None = Field(default=None, alias="MediaContentType0")
    MediaUrl1: str | None = Field(default=None, alias="MediaUrl1")
    MediaContentType1: str | None = Field(default=None, alias="MediaContentType1")
    MediaUrl2: str | None = Field(default=None, alias="MediaUrl2")
    MediaContentType2: str | None = Field(default=None, alias="MediaContentType2")
    MediaUrl3: str | None = Field(default=None, alias="MediaUrl3")
    MediaContentType3: str | None = Field(default=None, alias="MediaContentType3")
    MediaUrl4: str | None = Field(default=None, alias="MediaUrl4")
    MediaContentType4: str | None = Field(default=None, alias="MediaContentType4")
    MediaUrl5: str | None = Field(default=None, alias="MediaUrl5")
    MediaContentType5: str | None = Field(default=None, alias="MediaContentType5")
    MediaUrl6: str | None = Field(default=None, alias="MediaUrl6")
    MediaContentType6: str | None = Field(default=None, alias="MediaContentType6")
    MediaUrl7: str | None = Field(default=None, alias="MediaUrl7")
    MediaContentType7: str | None = Field(default=None, alias="MediaContentType7")
    MediaUrl8: str | None = Field(default=None, alias="MediaUrl8")
    MediaContentType8: str | None = Field(default=None, alias="MediaContentType8")
    MediaUrl9: str | None = Field(default=None, alias="MediaUrl9")
    MediaContentType9: str | None = Field(default=None, alias="MediaContentType9")

    class Config:
        """Pydantic config."""
        populate_by_name = True


class WhatsAppMediaItem(BaseModel):
    """Media item extracted from webhook payload."""

    url: str = Field(..., description="Twilio MediaUrl")
    content_type: str = Field(..., description="MIME type")


class WhatsAppResponse(BaseModel):
    """Response status for WhatsApp message processing."""

    message_sid: str | None = Field(None, description="Twilio message SID if sent")
    status: str = Field(..., description="Processing status (success/error)")
    error: str | None = Field(None, description="Error message if failed")
