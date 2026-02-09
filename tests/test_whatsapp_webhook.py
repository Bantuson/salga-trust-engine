"""Unit tests for WhatsApp webhook endpoint with mocked Twilio validation and services.

Tests signature validation, message processing, media handling, and TwiML responses
using FastAPI TestClient with mocked dependencies.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import status

from tests.conftest import POSTGRES_AVAILABLE


@pytest.mark.asyncio
@pytest.mark.integration
class TestWhatsAppWebhook:
    """Integration tests for WhatsApp webhook endpoint."""

    async def test_webhook_valid_signature(self, client, test_user):
        """Test valid Twilio signature processes message and returns TwiML."""
        # Arrange
        form_data = {
            "From": "whatsapp:+27123456789",
            "To": "whatsapp:+14155551234",
            "Body": "There is a pothole on Main Street",
            "MessageSid": "SM123456",
            "NumMedia": "0"
        }

        with patch('src.api.v1.whatsapp.validate_twilio_request', new_callable=AsyncMock) as mock_validate, \
             patch('src.api.v1.whatsapp.lookup_user_by_phone', new_callable=AsyncMock) as mock_lookup, \
             patch('src.api.v1.whatsapp.WhatsAppService') as mock_service_class:

            # Mock validation
            mock_validate.return_value = form_data

            # Mock user lookup
            mock_lookup.return_value = test_user

            # Mock WhatsApp service
            mock_service = MagicMock()
            mock_service.process_incoming_message = AsyncMock(return_value={
                "response": "Thank you for your report.",
                "is_complete": False,
                "tracking_number": None
            })
            mock_service_class.return_value = mock_service

            # Act
            response = await client.post(
                "/api/v1/whatsapp/webhook",
                data=form_data,
                headers={"X-Twilio-Signature": "valid_signature"}
            )

        # Assert
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/xml; charset=utf-8"
        assert "Thank you for your report" in response.text

    async def test_webhook_invalid_signature(self, client):
        """Test invalid Twilio signature returns 403."""
        # Arrange
        form_data = {
            "From": "whatsapp:+27123456789",
            "Body": "Test message",
            "MessageSid": "SM123"
        }

        with patch('src.api.v1.whatsapp.validate_twilio_request', new_callable=AsyncMock) as mock_validate:
            # Mock validation failure
            from fastapi import HTTPException
            mock_validate.side_effect = HTTPException(status_code=403, detail="Invalid signature")

            # Act
            response = await client.post(
                "/api/v1/whatsapp/webhook",
                data=form_data,
                headers={"X-Twilio-Signature": "invalid_signature"}
            )

        # Assert
        assert response.status_code == 403

    async def test_webhook_unregistered_user(self, client):
        """Test unregistered phone returns registration prompt TwiML."""
        # Arrange
        form_data = {
            "From": "whatsapp:+27999999999",  # Unregistered number
            "To": "whatsapp:+14155551234",
            "Body": "I want to report a problem",
            "MessageSid": "SM789",
            "NumMedia": "0"
        }

        with patch('src.api.v1.whatsapp.validate_twilio_request', new_callable=AsyncMock) as mock_validate, \
             patch('src.api.v1.whatsapp.lookup_user_by_phone', new_callable=AsyncMock) as mock_lookup:

            mock_validate.return_value = form_data
            mock_lookup.return_value = None  # User not found

            # Act
            response = await client.post(
                "/api/v1/whatsapp/webhook",
                data=form_data
            )

        # Assert
        assert response.status_code == 200
        assert "register" in response.text.lower()
        assert "application/xml" in response.headers["content-type"]

    async def test_webhook_with_media(self, client, test_user):
        """Test message with media triggers media download."""
        # Arrange
        form_data = {
            "From": "whatsapp:+27123456789",
            "To": "whatsapp:+14155551234",
            "Body": "Photo of the issue",
            "MessageSid": "SM456",
            "NumMedia": "1",
            "MediaUrl0": "https://api.twilio.com/media/ME123",
            "MediaContentType0": "image/jpeg"
        }

        with patch('src.api.v1.whatsapp.validate_twilio_request', new_callable=AsyncMock) as mock_validate, \
             patch('src.api.v1.whatsapp.lookup_user_by_phone', new_callable=AsyncMock) as mock_lookup, \
             patch('src.api.v1.whatsapp.WhatsAppService') as mock_service_class:

            mock_validate.return_value = form_data
            mock_lookup.return_value = test_user

            # Mock WhatsApp service
            mock_service = MagicMock()
            mock_service.process_incoming_message = AsyncMock(return_value={
                "response": "Photo received. Thank you.",
                "is_complete": False,
                "tracking_number": None
            })
            mock_service_class.return_value = mock_service

            # Act
            response = await client.post(
                "/api/v1/whatsapp/webhook",
                data=form_data
            )

        # Assert
        assert response.status_code == 200

        # Verify process_incoming_message was called with media
        call_kwargs = mock_service.process_incoming_message.call_args[1]
        assert len(call_kwargs["media_items"]) == 1
        assert call_kwargs["media_items"][0]["url"] == "https://api.twilio.com/media/ME123"
        assert call_kwargs["media_items"][0]["content_type"] == "image/jpeg"

    async def test_webhook_empty_body_with_media(self, client, test_user):
        """Test message with only media (no text) still processes."""
        # Arrange
        form_data = {
            "From": "whatsapp:+27123456789",
            "To": "whatsapp:+14155551234",
            "Body": "",  # Empty body
            "MessageSid": "SM789",
            "NumMedia": "1",
            "MediaUrl0": "https://api.twilio.com/media/ME456",
            "MediaContentType0": "image/png"
        }

        with patch('src.api.v1.whatsapp.validate_twilio_request', new_callable=AsyncMock) as mock_validate, \
             patch('src.api.v1.whatsapp.lookup_user_by_phone', new_callable=AsyncMock) as mock_lookup, \
             patch('src.api.v1.whatsapp.WhatsAppService') as mock_service_class:

            mock_validate.return_value = form_data
            mock_lookup.return_value = test_user

            mock_service = MagicMock()
            mock_service.process_incoming_message = AsyncMock(return_value={
                "response": "Media received.",
                "is_complete": False,
                "tracking_number": None
            })
            mock_service_class.return_value = mock_service

            # Act
            response = await client.post(
                "/api/v1/whatsapp/webhook",
                data=form_data
            )

        # Assert
        assert response.status_code == 200

        # Verify service was called
        call_kwargs = mock_service.process_incoming_message.call_args[1]
        assert call_kwargs["message_body"] == ""
        assert len(call_kwargs["media_items"]) == 1

    async def test_webhook_returns_twiml(self, client, test_user):
        """Test webhook response is valid TwiML XML."""
        # Arrange
        form_data = {
            "From": "whatsapp:+27123456789",
            "Body": "Test",
            "MessageSid": "SM111",
            "NumMedia": "0"
        }

        with patch('src.api.v1.whatsapp.validate_twilio_request', new_callable=AsyncMock) as mock_validate, \
             patch('src.api.v1.whatsapp.lookup_user_by_phone', new_callable=AsyncMock) as mock_lookup, \
             patch('src.api.v1.whatsapp.WhatsAppService') as mock_service_class:

            mock_validate.return_value = form_data
            mock_lookup.return_value = test_user

            mock_service = MagicMock()
            mock_service.process_incoming_message = AsyncMock(return_value={
                "response": "Test response",
                "is_complete": False,
                "tracking_number": None
            })
            mock_service_class.return_value = mock_service

            # Act
            response = await client.post(
                "/api/v1/whatsapp/webhook",
                data=form_data
            )

        # Assert
        assert response.status_code == 200
        assert "application/xml" in response.headers["content-type"]
        assert "<Response>" in response.text or "<Message>" in response.text

    async def test_status_callback(self, client):
        """Test status update callback is logged correctly."""
        # Arrange
        form_data = {
            "MessageSid": "SM123456",
            "MessageStatus": "delivered",
            "To": "whatsapp:+27123456789"
        }

        # Act
        response = await client.post(
            "/api/v1/whatsapp/status",
            data=form_data
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
