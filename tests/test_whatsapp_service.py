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

    async def test_process_empty_message_and_no_media(self, whatsapp_service, test_user):
        """Test early return for empty input."""
        # Arrange
        mock_db = AsyncMock()

        # Act
        result = await whatsapp_service.process_incoming_message(
            user=test_user,
            message_body=None,
            media_items=[],
            session_id="test-session-empty",
            db=mock_db
        )

        # Assert
        assert result["response"] == "Please send a message with text or photos."
        assert result["is_complete"] is False
        assert result["tracking_number"] is None

    async def test_process_message_blocked_by_guardrails(self, whatsapp_service, test_user):
        """Test input blocked by guardrails."""
        # Arrange
        mock_db = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails:
            # Mock guardrails to block input
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=False,
                blocked_reason="Inappropriate content detected"
            ))

            # Act
            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="Some inappropriate message",
                media_items=[],
                session_id="test-session-blocked",
                db=mock_db
            )

        # Assert
        assert "Inappropriate content detected" in result["response"]
        assert result["tracking_number"] is None

    async def test_process_message_flow_exception(self, whatsapp_service, test_user):
        """Test flow.kickoff() raising an exception."""
        # Arrange
        mock_db = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.IntakeFlow') as mock_flow:

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Test message"
            ))
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response="I apologize, but I encountered an error."
            ))

            # Mock conversation manager
            mock_conv_instance = AsyncMock()
            mock_conv_instance.get_state = AsyncMock(return_value=MagicMock(
                language="en",
                turns=[]
            ))
            mock_conv_instance.append_turn = AsyncMock()
            mock_conv_instance.close = AsyncMock()
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock IntakeFlow to raise exception
            mock_flow_instance = MagicMock()
            mock_flow_instance.state = MagicMock(language="en")
            mock_flow_instance.kickoff.side_effect = RuntimeError("LLM API unavailable")
            mock_flow.return_value = mock_flow_instance

            # Act
            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="Test message",
                media_items=[],
                session_id="test-session-error",
                db=mock_db
            )

        # Assert
        assert "error" in result["response"] or "apologize" in result["response"]
        assert result["is_complete"] is False

    async def test_send_whatsapp_with_existing_prefix(self, whatsapp_service):
        """Test send when number already has whatsapp: prefix."""
        # Arrange
        mock_message = MagicMock()
        mock_message.sid = "SM999999"
        mock_message.status = "queued"
        whatsapp_service._twilio_client.messages.create.return_value = mock_message

        with patch('src.services.whatsapp_service.settings') as mock_settings:
            mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155551234"

            # Act
            result = await whatsapp_service.send_whatsapp_message(
                to_number="whatsapp:+27123456789",  # Already has prefix
                message="Test message"
            )

        # Assert
        assert result == "SM999999"
        call_kwargs = whatsapp_service._twilio_client.messages.create.call_args[1]
        # Should NOT double-prefix
        assert call_kwargs["to"] == "whatsapp:+27123456789"
        assert not call_kwargs["to"].startswith("whatsapp:whatsapp:")

    async def test_send_whatsapp_twilio_exception(self, whatsapp_service):
        """Test Twilio REST exception handling."""
        from twilio.base.exceptions import TwilioRestException

        # Arrange
        whatsapp_service._twilio_client.messages.create.side_effect = TwilioRestException(
            status=400,
            uri="/test",
            msg="Bad request",
            code=21211
        )

        with patch('src.services.whatsapp_service.settings') as mock_settings:
            mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155551234"

            # Act
            result = await whatsapp_service.send_whatsapp_message(
                to_number="+27123456789",
                message="Test message"
            )

        # Assert - should return None gracefully
        assert result is None

    async def test_process_message_with_ticket_and_tracking_number(self, whatsapp_service, test_user):
        """Test tracking number extraction from ticket_data (03-06 fix)."""
        # Arrange
        mock_db = AsyncMock()
        test_ticket_id = str(uuid4())
        test_tracking_number = "TKT-20260210-ABC123"

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.IntakeFlow') as mock_flow_class:

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="There is a pothole on Main Street"
            ))

            # Mock conversation manager
            mock_conv_instance = AsyncMock()
            mock_conv_instance.get_state = AsyncMock(return_value=MagicMock(
                language="en",
                turns=[]
            ))
            mock_conv_instance.append_turn = AsyncMock()
            mock_conv_instance.close = AsyncMock()
            mock_conv_mgr.return_value = mock_conv_instance

            # Create a mock flow instance that will update its state after kickoff
            mock_flow_instance = MagicMock()

            # Define a side_effect for kickoff that updates the state
            def kickoff_side_effect():
                # After kickoff, update state with ticket_data
                mock_flow_instance.state.ticket_data = {
                    "tracking_number": test_tracking_number,
                    "category": "roads"
                }
                mock_flow_instance.state.ticket_id = test_ticket_id
                mock_flow_instance.state.is_complete = True
                mock_flow_instance.state.category = "municipal"
                return None

            mock_flow_instance.kickoff.side_effect = kickoff_side_effect
            mock_flow_class.return_value = mock_flow_instance

            # Mock process_output to return response with tracking number
            expected_response = f"Your report has been received and logged. Your tracking number is {test_tracking_number}. We will investigate this issue and keep you updated."
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response=expected_response
            ))

            # Act
            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="There is a pothole on Main Street",
                media_items=[],
                session_id="test-session-tracking",
                db=mock_db
            )

        # Assert
        assert result["tracking_number"] == test_tracking_number
        assert test_tracking_number in result["response"]
