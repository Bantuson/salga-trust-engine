"""Unit tests for WhatsApp service with mocked Twilio and S3.

Tests phone-to-user lookup, message processing, media handling,
and message sending without real Twilio API calls.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4

from src.services.whatsapp_service import WhatsAppService
from src.services.storage_service import StorageService
from src.models.user import User, UserRole


pytestmark = pytest.mark.asyncio


class TestWhatsAppService:
    """Unit tests for WhatsAppService."""

    @pytest.fixture
    def mock_storage_service(self):
        """Create mocked StorageService."""
        mock_service = MagicMock(spec=StorageService)
        mock_service.download_and_upload_media = AsyncMock(return_value={
            "s3_bucket": "test-bucket",
            "s3_key": "evidence/tenant/ticket/file.jpg",
            "file_id": str(uuid4()),
            "content_type": "image/jpeg",
            "file_size": 12345
        })
        return mock_service

    @pytest.fixture
    def whatsapp_service(self, mock_storage_service):
        """Create WhatsAppService with mocked dependencies."""
        with patch('src.services.whatsapp_service.Client'):
            service = WhatsAppService(
                redis_url="redis://localhost:6379/0",
                storage_service=mock_storage_service
            )
            # Mock Twilio client
            service._twilio_client = MagicMock()
            return service

    @pytest.fixture
    def test_user(self):
        """Create test user for phone lookup tests."""
        return User(
            id=uuid4(),
            email="test@example.com",
            full_name="Test User",
            phone="+27123456789",
            tenant_id=str(uuid4()),
            municipality_id=uuid4(),
            role=UserRole.CITIZEN,
            is_active=True,
            preferred_language="en"
        )

    async def test_send_whatsapp_message(self, whatsapp_service):
        """Test sending WhatsApp message via Twilio."""
        # Arrange
        mock_message = MagicMock()
        mock_message.sid = "SM123456"
        mock_message.status = "queued"
        whatsapp_service._twilio_client.messages.create.return_value = mock_message

        with patch('src.services.whatsapp_service.settings') as mock_settings:
            mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155551234"

            # Act
            result = await whatsapp_service.send_whatsapp_message(
                to_number="+27123456789",
                message="Your report has been received."
            )

        # Assert
        assert result == "SM123456"
        whatsapp_service._twilio_client.messages.create.assert_called_once()
        call_kwargs = whatsapp_service._twilio_client.messages.create.call_args[1]
        assert call_kwargs["to"] == "whatsapp:+27123456789"
        assert call_kwargs["body"] == "Your report has been received."

    async def test_send_whatsapp_no_client(self):
        """Test graceful handling when Twilio client not configured."""
        # Arrange
        with patch('src.services.whatsapp_service.settings') as mock_settings:
            mock_settings.TWILIO_ACCOUNT_SID = None
            mock_settings.TWILIO_AUTH_TOKEN = None

            mock_storage = MagicMock(spec=StorageService)
            service = WhatsAppService(
                redis_url="redis://localhost:6379/0",
                storage_service=mock_storage
            )

        # Act
        result = await service.send_whatsapp_message(
            to_number="+27123456789",
            message="Test message"
        )

        # Assert
        assert result is None

    async def test_process_incoming_message_text(self, whatsapp_service, test_user):
        """Test processing text-only message."""
        # Arrange
        mock_db = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.IntakeFlow') as mock_flow:

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="There is a pothole on Main Street"
            ))
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response="Thank you for your report."
            ))

            # Mock conversation manager
            mock_conv_instance = AsyncMock()
            mock_conv_instance.get_state = AsyncMock(return_value=MagicMock(
                language="en",
                turns=[]
            ))
            mock_conv_instance.create_session = AsyncMock(return_value=MagicMock(
                language="en",
                turns=[]
            ))
            mock_conv_instance.append_turn = AsyncMock()
            mock_conv_instance.close = AsyncMock()
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock IntakeFlow
            mock_flow_instance = MagicMock()
            mock_flow_instance.state = MagicMock(
                ticket_data=None,
                language="en",
                category="municipal",
                is_complete=False,
                ticket_id=None
            )
            mock_flow_instance.kickoff.return_value = None
            mock_flow.return_value = mock_flow_instance

            # Act
            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="There is a pothole on Main Street",
                media_items=[],
                session_id="test-session-123",
                db=mock_db
            )

        # Assert
        assert "response" in result
        assert result["is_complete"] is False
        mock_guardrails.process_input.assert_called_once()
        mock_flow_instance.kickoff.assert_called_once()

    async def test_process_incoming_message_with_media(self, whatsapp_service, test_user, mock_storage_service):
        """Test processing message with media attachments."""
        # Arrange
        mock_db = AsyncMock()
        media_items = [
            {"url": "https://api.twilio.com/media/ME123", "content_type": "image/jpeg"}
        ]

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.IntakeFlow') as mock_flow, \
             patch('src.services.whatsapp_service.settings') as mock_settings:

            mock_settings.TWILIO_ACCOUNT_SID = "AC123"
            mock_settings.TWILIO_AUTH_TOKEN = "auth_token"

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="I'm sending you a photo"
            ))
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response="Thank you for the photo."
            ))

            # Mock conversation manager
            mock_conv_instance = AsyncMock()
            mock_conv_instance.get_state = AsyncMock(return_value=None)
            mock_conv_instance.create_session = AsyncMock(return_value=MagicMock(
                language="en",
                turns=[]
            ))
            mock_conv_instance.append_turn = AsyncMock()
            mock_conv_instance.close = AsyncMock()
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock IntakeFlow
            mock_flow_instance = MagicMock()
            mock_flow_instance.state = MagicMock(
                ticket_data=None,
                language="en",
                category="municipal",
                is_complete=False,
                ticket_id=None
            )
            mock_flow_instance.kickoff.return_value = None
            mock_flow.return_value = mock_flow_instance

            # Act
            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body=None,  # No text, only media
                media_items=media_items,
                session_id="test-session-456",
                db=mock_db
            )

        # Assert
        assert "response" in result
        mock_storage_service.download_and_upload_media.assert_called_once()

        # Verify media download called with correct params
        call_kwargs = mock_storage_service.download_and_upload_media.call_args[1]
        assert call_kwargs["media_url"] == "https://api.twilio.com/media/ME123"
        assert call_kwargs["media_content_type"] == "image/jpeg"
        assert call_kwargs["auth_credentials"] == ("AC123", "auth_token")


class TestPhoneLookupHelpers:
    """Test phone number normalization and user lookup."""

    def test_normalize_south_african_number_with_zero_prefix(self):
        """Test 0XXXXXXXXX converted to +27XXXXXXXXX."""
        # This test would go in the whatsapp.py endpoint test file
        # since lookup_user_by_phone is in the endpoint module
        pass

    def test_normalize_whatsapp_prefix(self):
        """Test whatsapp: prefix is stripped."""
        # This test would go in the whatsapp.py endpoint test file
        pass

    def test_add_plus_if_missing(self):
        """Test + is added if missing from international number."""
        # This test would go in the whatsapp.py endpoint test file
        pass
