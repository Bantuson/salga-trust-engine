"""Unit tests for WhatsApp service with mocked Twilio and S3.

Tests phone-to-user lookup, message processing, media handling,
GBV confirmation state machine, and message sending without real Twilio API calls.
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

    def _make_mock_conv_manager(self, routing_phase=None, language="en"):
        """Helper: build a mock ConversationManager with configurable state."""
        mock_conv_instance = AsyncMock()
        mock_state = MagicMock()
        mock_state.language = language
        mock_state.turns = []
        mock_state.routing_phase = routing_phase
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.create_session = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()
        return mock_conv_instance, mock_state

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
        """Test processing text-only message through ManagerCrew."""
        # Arrange
        mock_db = AsyncMock()
        mock_conv_instance, mock_state = self._make_mock_conv_manager()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls:

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="There is a pothole on Main Street"
            ))
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response="Thank you for your report."
            ))

            # Mock conversation manager
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock ManagerCrew
            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(return_value={
                "message": "Thank you for your report.",
                "routing_phase": "municipal",
                "agent": "municipal_intake",
                "tracking_number": None,
            })
            mock_manager_crew_cls.return_value = mock_crew_instance

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
        mock_guardrails.process_input.assert_called_once()
        mock_crew_instance.kickoff.assert_called_once()

    async def test_process_incoming_message_with_media(self, whatsapp_service, test_user, mock_storage_service):
        """Test processing message with media attachments."""
        # Arrange
        mock_db = AsyncMock()
        media_items = [
            {"url": "https://api.twilio.com/media/ME123", "content_type": "image/jpeg"}
        ]
        mock_conv_instance, mock_state = self._make_mock_conv_manager()
        mock_conv_instance.get_state = AsyncMock(return_value=None)  # Force create_session path

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls, \
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
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock ManagerCrew
            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(return_value={
                "message": "Thank you for the photo.",
                "routing_phase": "municipal",
                "agent": "municipal_intake",
                "tracking_number": None,
            })
            mock_manager_crew_cls.return_value = mock_crew_instance

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

    async def test_process_message_crew_exception(self, whatsapp_service, test_user):
        """Test ManagerCrew.kickoff() raising an exception."""
        # Arrange
        mock_db = AsyncMock()
        mock_conv_instance, mock_state = self._make_mock_conv_manager()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls:

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Test message"
            ))
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response="I apologize, but I encountered an error."
            ))

            # Mock conversation manager
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock ManagerCrew to raise exception
            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(side_effect=RuntimeError("LLM API unavailable"))
            mock_manager_crew_cls.return_value = mock_crew_instance

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

    async def test_process_message_with_tracking_number(self, whatsapp_service, test_user):
        """Test tracking number extraction from ManagerCrew result dict."""
        # Arrange
        mock_db = AsyncMock()
        test_tracking_number = "TKT-20260210-ABC123"
        mock_conv_instance, mock_state = self._make_mock_conv_manager()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls:

            # Mock guardrails
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="There is a pothole on Main Street"
            ))
            expected_response = f"Your report has been received. Tracking number: {test_tracking_number}."
            mock_guardrails.process_output = AsyncMock(return_value=MagicMock(
                sanitized_response=expected_response
            ))

            # Mock conversation manager
            mock_conv_mgr.return_value = mock_conv_instance

            # Mock ManagerCrew returning a tracking number
            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(return_value={
                "message": expected_response,
                "routing_phase": "municipal",
                "agent": "municipal_intake",
                "tracking_number": test_tracking_number,
            })
            mock_manager_crew_cls.return_value = mock_crew_instance

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


class TestGBVConfirmation:
    """Tests for GBV confirmation state machine in WhatsApp service."""

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
            service._twilio_client = MagicMock()
            return service

    @pytest.fixture
    def test_user(self):
        """Create test user."""
        return User(
            id=uuid4(),
            email="gbv_test@example.com",
            full_name="GBV Test User",
            phone="+27987654321",
            tenant_id=str(uuid4()),
            municipality_id=uuid4(),
            role=UserRole.CITIZEN,
            is_active=True,
            preferred_language="en"
        )

    def _make_mock_conv_state(self, routing_phase=None, language="en"):
        """Helper: create a mock ConversationState."""
        mock_state = MagicMock()
        mock_state.language = language
        mock_state.turns = []
        mock_state.routing_phase = routing_phase
        return mock_state

    async def test_gbv_first_signal_enters_confirmation(self, whatsapp_service, test_user):
        """First GBV classification from ManagerCrew enters gbv_pending_confirm state."""
        mock_db = AsyncMock()
        mock_state = self._make_mock_conv_state(routing_phase=None, language="en")

        mock_conv_instance = AsyncMock()
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="My husband is beating me"
            ))
            mock_guardrails.process_output = AsyncMock(side_effect=lambda msg: MagicMock(
                sanitized_response=msg
            ))
            mock_conv_mgr.return_value = mock_conv_instance

            # ManagerCrew classifies as GBV
            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(return_value={
                "message": "I hear you. Are you safe?",
                "routing_phase": "gbv",
                "agent": "gbv_intake",
            })
            mock_manager_crew_cls.return_value = mock_crew_instance

            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="My husband is beating me",
                media_items=[],
                session_id="gbv-test-session-1",
                db=mock_db
            )

        # The response should be the GBV confirmation message (NOT the crew's direct reply)
        assert "10111" in result["response"] or "0800 150 150" in result["response"]
        assert result["tracking_number"] is None
        assert result["is_complete"] is False
        # The conversation state should now be in gbv_pending_confirm
        assert mock_state.routing_phase == "gbv_pending_confirm"

    async def test_gbv_confirmed_routes_to_gbv_crew(self, whatsapp_service, test_user):
        """Citizen replying YES routes through GBVCrew (routing_phase becomes gbv)."""
        mock_db = AsyncMock()
        # Start in gbv_pending_confirm state
        mock_state = self._make_mock_conv_state(routing_phase="gbv_pending_confirm", language="en")

        mock_conv_instance = AsyncMock()
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="yes"
            ))
            mock_guardrails.process_output = AsyncMock(side_effect=lambda msg: MagicMock(
                sanitized_response=msg
            ))
            mock_conv_mgr.return_value = mock_conv_instance

            # ManagerCrew not expected to be called for YES confirmation (handled before)
            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(return_value={
                "message": "Your report has been forwarded to SAPS.",
                "routing_phase": "gbv",
                "agent": "gbv_intake",
            })
            mock_manager_crew_cls.return_value = mock_crew_instance

            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="yes",
                media_items=[],
                session_id="gbv-test-session-2",
                db=mock_db
            )

        # After YES confirmation, routing_phase should advance to gbv
        assert mock_state.routing_phase == "gbv"

    async def test_gbv_declined_routes_to_municipal(self, whatsapp_service, test_user):
        """Citizen replying NO gets treated as municipal report."""
        mock_db = AsyncMock()
        # Start in gbv_pending_confirm state
        mock_state = self._make_mock_conv_state(routing_phase="gbv_pending_confirm", language="en")

        mock_conv_instance = AsyncMock()
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="no"
            ))
            mock_guardrails.process_output = AsyncMock(side_effect=lambda msg: MagicMock(
                sanitized_response=msg
            ))
            mock_conv_mgr.return_value = mock_conv_instance

            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="no",
                media_items=[],
                session_id="gbv-test-session-3",
                db=mock_db
            )

        # After NO, routing_phase should change to municipal
        assert mock_state.routing_phase == "municipal"
        # Response should acknowledge and offer help
        assert "understood" in result["response"].lower() or "help" in result["response"].lower()
        assert result["tracking_number"] is None
        assert result["is_complete"] is False

    async def test_gbv_ambiguous_resends_confirmation(self, whatsapp_service, test_user):
        """Ambiguous reply (neither YES nor NO) resends GBV confirmation with emergency numbers."""
        mock_db = AsyncMock()
        # Start in gbv_pending_confirm state
        mock_state = self._make_mock_conv_state(routing_phase="gbv_pending_confirm", language="en")

        mock_conv_instance = AsyncMock()
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="maybe"
            ))
            mock_guardrails.process_output = AsyncMock(side_effect=lambda msg: MagicMock(
                sanitized_response=msg
            ))
            mock_conv_mgr.return_value = mock_conv_instance

            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="maybe",
                media_items=[],
                session_id="gbv-test-session-4",
                db=mock_db
            )

        # Ambiguous — confirmation message resent with emergency numbers
        assert "10111" in result["response"] or "0800 150 150" in result["response"]
        assert result["tracking_number"] is None
        assert result["is_complete"] is False
        # routing_phase should remain gbv_pending_confirm
        assert mock_state.routing_phase == "gbv_pending_confirm"

    async def test_gbv_confirmation_zulu_language(self, whatsapp_service, test_user):
        """GBV confirmation message uses isiZulu when session language is 'zu'."""
        mock_db = AsyncMock()
        # Start in gbv_pending_confirm with Zulu language
        mock_state = self._make_mock_conv_state(routing_phase="gbv_pending_confirm", language="zu")

        mock_conv_instance = AsyncMock()
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="maybe"
            ))
            # Return the confirmation message as-is so we can inspect it
            mock_guardrails.process_output = AsyncMock(side_effect=lambda msg: MagicMock(
                sanitized_response=msg
            ))
            mock_conv_mgr.return_value = mock_conv_instance

            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="maybe",
                media_items=[],
                session_id="gbv-test-session-zu",
                db=mock_db
            )

        # Zulu response should contain YEBO (Zulu word for YES)
        assert "YEBO" in result["response"]
        assert "10111" in result["response"]

    async def test_gbv_yebo_confirm_accepted(self, whatsapp_service, test_user):
        """isiZulu 'yebo' is recognized as GBV confirmation YES."""
        mock_db = AsyncMock()
        mock_state = self._make_mock_conv_state(routing_phase="gbv_pending_confirm", language="zu")

        mock_conv_instance = AsyncMock()
        mock_conv_instance.get_state = AsyncMock(return_value=mock_state)
        mock_conv_instance.append_turn = AsyncMock(return_value=mock_state)
        mock_conv_instance.close = AsyncMock()

        with patch('src.services.whatsapp_service.guardrails_engine') as mock_guardrails, \
             patch('src.services.whatsapp_service.ConversationManager') as mock_conv_mgr, \
             patch('src.services.whatsapp_service.ManagerCrew') as mock_manager_crew_cls:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="yebo"
            ))
            mock_guardrails.process_output = AsyncMock(side_effect=lambda msg: MagicMock(
                sanitized_response=msg
            ))
            mock_conv_mgr.return_value = mock_conv_instance

            mock_crew_instance = AsyncMock()
            mock_crew_instance.kickoff = AsyncMock(return_value={
                "message": "Report sent to SAPS.",
                "routing_phase": "gbv",
                "agent": "gbv_intake",
            })
            mock_manager_crew_cls.return_value = mock_crew_instance

            result = await whatsapp_service.process_incoming_message(
                user=test_user,
                message_body="yebo",
                media_items=[],
                session_id="gbv-test-session-yebo",
                db=mock_db
            )

        # 'yebo' should be recognized as YES — routing_phase advances to gbv
        assert mock_state.routing_phase == "gbv"


def test_gbv_confirmation_messages_have_emergency_numbers():
    """All GBV confirmation messages include SAPS and GBV helpline numbers."""
    from src.api.v1.crew_server import GBV_CONFIRMATION_MESSAGES

    for lang, msg in GBV_CONFIRMATION_MESSAGES.items():
        assert "10111" in msg, f"SAPS number missing in {lang} confirmation"
        assert "0800 150 150" in msg, f"GBV helpline missing in {lang} confirmation"
