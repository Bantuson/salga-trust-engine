"""Unit tests for NotificationService (Phase 4).

Tests trilingual WhatsApp notifications for ticket status updates,
escalation notices, and graceful degradation without Twilio credentials.
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from twilio.base.exceptions import TwilioRestException

from src.models.ticket import Ticket
from src.models.user import User
from src.services.notification_service import NotificationService

# Module-level marker
pytestmark = pytest.mark.asyncio


def make_mock_ticket(
    tracking_number="TKT-20260210-ABC123",
    language="en",
    user_id=None,
    tenant_id=None
):
    """Factory for mock Ticket objects."""
    ticket = MagicMock(spec=Ticket)
    ticket.id = uuid4()
    ticket.tracking_number = tracking_number
    ticket.language = language
    ticket.user_id = user_id or uuid4()
    ticket.tenant_id = tenant_id or uuid4()
    return ticket


def make_mock_user(
    phone="+27821234567",
    user_id=None
):
    """Factory for mock User objects."""
    user = MagicMock(spec=User)
    user.id = user_id or uuid4()
    user.phone = phone
    return user


@patch("src.services.notification_service.settings")
async def test_send_status_update_english(mock_settings):
    """Test sending status update in English with correct message format."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    mock_message = MagicMock()
    mock_message.sid = "SM123456"
    service._twilio_client.messages.create = MagicMock(return_value=mock_message)

    # Act
    result = await service.send_status_update(
        phone="+27821234567",
        tracking_number="TKT-20260210-ABC123",
        new_status="in_progress",
        language="en"
    )

    # Assert
    assert result == "SM123456"
    service._twilio_client.messages.create.assert_called_once()
    call_args = service._twilio_client.messages.create.call_args[1]
    assert "Update for TKT-20260210-ABC123" in call_args["body"]
    assert "being worked on" in call_args["body"]
    assert call_args["to"] == "whatsapp:+27821234567"


@patch("src.services.notification_service.settings")
async def test_send_status_update_zulu(mock_settings):
    """Test sending status update in isiZulu with correct status text."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    mock_message = MagicMock()
    mock_message.sid = "SM123456"
    service._twilio_client.messages.create = MagicMock(return_value=mock_message)

    # Act
    result = await service.send_status_update(
        phone="+27821234567",
        tracking_number="TKT-20260210-ABC123",
        new_status="resolved",
        language="zu"
    )

    # Assert
    assert result == "SM123456"
    call_args = service._twilio_client.messages.create.call_args[1]
    assert "Isibuyekezo se-TKT-20260210-ABC123" in call_args["body"]
    assert "ixazululiwe" in call_args["body"]


@patch("src.services.notification_service.settings")
async def test_send_status_update_afrikaans(mock_settings):
    """Test sending status update in Afrikaans with correct status text."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    mock_message = MagicMock()
    mock_message.sid = "SM123456"
    service._twilio_client.messages.create = MagicMock(return_value=mock_message)

    # Act
    result = await service.send_status_update(
        phone="+27821234567",
        tracking_number="TKT-20260210-ABC123",
        new_status="escalated",
        language="af"
    )

    # Assert
    assert result == "SM123456"
    call_args = service._twilio_client.messages.create.call_args[1]
    assert "Opdatering vir TKT-20260210-ABC123" in call_args["body"]
    assert "verwys na senior span" in call_args["body"]


@patch("src.services.notification_service.settings")
async def test_send_status_update_no_twilio_client(mock_settings):
    """Test sending status update without Twilio credentials returns None gracefully."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = None
    mock_settings.TWILIO_AUTH_TOKEN = None

    service = NotificationService()

    # Act
    result = await service.send_status_update(
        phone="+27821234567",
        tracking_number="TKT-20260210-ABC123",
        new_status="open",
        language="en"
    )

    # Assert
    assert result is None


@patch("src.services.notification_service.settings")
async def test_send_status_update_twilio_error(mock_settings):
    """Test sending status update handles TwilioRestException and returns None."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    service._twilio_client.messages.create = MagicMock(
        side_effect=TwilioRestException(
            status=400,
            uri="/Messages",
            msg="Invalid phone number",
            code=21211
        )
    )

    # Act
    result = await service.send_status_update(
        phone="+27821234567",
        tracking_number="TKT-20260210-ABC123",
        new_status="open",
        language="en"
    )

    # Assert
    assert result is None


@patch("src.services.notification_service.settings")
async def test_status_display_text_all_statuses(mock_settings):
    """Test all statuses have display text in all 3 languages."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    mock_message = MagicMock()
    mock_message.sid = "SM123456"
    service._twilio_client.messages.create = MagicMock(return_value=mock_message)

    statuses = ["open", "in_progress", "escalated", "resolved", "closed"]
    languages = ["en", "zu", "af"]

    # Act & Assert
    for status in statuses:
        for language in languages:
            result = await service.send_status_update(
                phone="+27821234567",
                tracking_number="TKT-TEST",
                new_status=status,
                language=language
            )
            # Should succeed (return message SID)
            assert result == "SM123456"


@patch("src.services.notification_service.settings")
async def test_send_escalation_notice(mock_settings):
    """Test sending escalation notice to citizen via WhatsApp."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    mock_message = MagicMock()
    mock_message.sid = "SM123456"
    service._twilio_client.messages.create = MagicMock(return_value=mock_message)

    ticket = make_mock_ticket(tracking_number="TKT-20260210-XYZ", language="en")
    user = make_mock_user(phone="+27821234567")

    # Mock database query
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.send_escalation_notice(ticket, mock_db)

    # Assert
    assert result == "SM123456"
    call_args = service._twilio_client.messages.create.call_args[1]
    assert "escalated" in call_args["body"]
    assert "TKT-20260210-XYZ" in call_args["body"]


@patch("src.services.notification_service.settings")
async def test_send_sla_warning_logs_only(mock_settings):
    """Test send_sla_warning logs warning but doesn't send WhatsApp."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"

    service = NotificationService()
    service._twilio_client = MagicMock()

    ticket = make_mock_ticket(tracking_number="TKT-20260210-ABC")
    mock_db = MagicMock()

    # Act
    await service.send_sla_warning(ticket, "response_warning", mock_db)

    # Assert
    # Should not call Twilio (internal warning only)
    service._twilio_client.messages.create.assert_not_called()


@patch("src.services.notification_service.settings")
async def test_send_status_update_adds_whatsapp_prefix(mock_settings):
    """Test send_status_update adds whatsapp: prefix to phone number."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"
    mock_settings.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555555555"

    service = NotificationService()
    service._twilio_client = MagicMock()
    mock_message = MagicMock()
    mock_message.sid = "SM123456"
    service._twilio_client.messages.create = MagicMock(return_value=mock_message)

    # Act - phone without whatsapp: prefix
    result = await service.send_status_update(
        phone="+27821234567",
        tracking_number="TKT-20260210-ABC123",
        new_status="open",
        language="en"
    )

    # Assert
    assert result == "SM123456"
    call_args = service._twilio_client.messages.create.call_args[1]
    assert call_args["to"] == "whatsapp:+27821234567"


@patch("src.services.notification_service.settings")
async def test_send_escalation_notice_no_user(mock_settings):
    """Test send_escalation_notice returns None when user not found."""
    # Arrange
    mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
    mock_settings.TWILIO_AUTH_TOKEN = "test_token"

    service = NotificationService()
    service._twilio_client = MagicMock()

    ticket = make_mock_ticket()

    # Mock database query - user not found
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.send_escalation_notice(ticket, mock_db)

    # Assert
    assert result is None
    service._twilio_client.messages.create.assert_not_called()
