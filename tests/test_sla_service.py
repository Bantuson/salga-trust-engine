"""Unit tests for SLAService (Phase 4).

Tests SLA deadline calculation, breach detection, warning detection,
and GBV exclusion from SLA monitoring.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.models.sla_config import SLAConfig
from src.models.ticket import Ticket, TicketStatus
from src.services.sla_service import SLAService

# Module-level marker
pytestmark = pytest.mark.asyncio


def make_mock_ticket(
    tracking_number="TKT-20260210-ABC123",
    category="water",
    is_sensitive=False,
    tenant_id=None,
    status="open",
    created_at=None,
    sla_response_deadline=None,
    sla_resolution_deadline=None,
    first_responded_at=None
):
    """Factory for mock Ticket objects."""
    ticket = MagicMock(spec=Ticket)
    ticket.id = uuid4()
    ticket.tracking_number = tracking_number
    ticket.category = category
    ticket.is_sensitive = is_sensitive
    ticket.tenant_id = tenant_id or uuid4()
    ticket.status = status
    ticket.created_at = created_at or datetime.now(timezone.utc)
    ticket.sla_response_deadline = sla_response_deadline
    ticket.sla_resolution_deadline = sla_resolution_deadline
    ticket.first_responded_at = first_responded_at
    return ticket


def make_mock_sla_config(
    municipality_id=None,
    category=None,
    response_hours=24,
    resolution_hours=168,
    warning_threshold_pct=80,
    is_active=True
):
    """Factory for mock SLAConfig objects."""
    config = MagicMock(spec=SLAConfig)
    config.id = uuid4()
    config.municipality_id = municipality_id or uuid4()
    config.category = category
    config.response_hours = response_hours
    config.resolution_hours = resolution_hours
    config.warning_threshold_pct = warning_threshold_pct
    config.is_active = is_active
    return config


async def test_get_sla_config_exact_match():
    """Test getting SLA config with exact municipality+category match."""
    # Arrange
    service = SLAService()
    municipality_id = uuid4()
    category = "water"
    config = make_mock_sla_config(
        municipality_id=municipality_id,
        category=category,
        response_hours=12,
        resolution_hours=72
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = config
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.get_sla_config(municipality_id, category, mock_db)

    # Assert
    assert result == config
    assert result.response_hours == 12
    assert result.resolution_hours == 72


async def test_get_sla_config_default_fallback():
    """Test getting SLA config falls back to municipality default (category=None)."""
    # Arrange
    service = SLAService()
    municipality_id = uuid4()
    category = "electricity"

    # Mock: no exact match, but default config exists
    default_config = make_mock_sla_config(
        municipality_id=municipality_id,
        category=None,  # Default for all categories
        response_hours=48,
        resolution_hours=240
    )

    mock_db = MagicMock()

    # First call returns None (no exact match)
    # Second call returns default config
    mock_result1 = MagicMock()
    mock_result1.scalar_one_or_none.return_value = None

    mock_result2 = MagicMock()
    mock_result2.scalar_one_or_none.return_value = default_config

    mock_db.execute = AsyncMock(side_effect=[mock_result1, mock_result2])

    # Act
    result = await service.get_sla_config(municipality_id, category, mock_db)

    # Assert
    assert result == default_config
    assert result.category is None


async def test_get_sla_config_system_defaults():
    """Test getting SLA config returns None when no config exists (system defaults)."""
    # Arrange
    service = SLAService()
    municipality_id = uuid4()
    category = "roads"

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.get_sla_config(municipality_id, category, mock_db)

    # Assert
    assert result is None


async def test_calculate_deadlines_from_config():
    """Test calculating deadlines uses config hours."""
    # Arrange
    service = SLAService()
    created_at = datetime(2026, 2, 10, 9, 0, 0, tzinfo=timezone.utc)
    ticket = make_mock_ticket(created_at=created_at, category="water")

    config = make_mock_sla_config(
        response_hours=12,
        resolution_hours=72
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = config
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    response_deadline, resolution_deadline = await service.calculate_deadlines(ticket, mock_db)

    # Assert
    assert response_deadline == created_at + timedelta(hours=12)
    assert resolution_deadline == created_at + timedelta(hours=72)


async def test_calculate_deadlines_system_defaults():
    """Test calculating deadlines uses system defaults when no config."""
    # Arrange
    service = SLAService()
    created_at = datetime(2026, 2, 10, 9, 0, 0, tzinfo=timezone.utc)
    ticket = make_mock_ticket(created_at=created_at, category="water")

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    response_deadline, resolution_deadline = await service.calculate_deadlines(ticket, mock_db)

    # Assert
    # System defaults: 24h response, 168h resolution
    assert response_deadline == created_at + timedelta(hours=24)
    assert resolution_deadline == created_at + timedelta(hours=168)


async def test_set_ticket_deadlines_skips_gbv():
    """Test set_ticket_deadlines skips GBV tickets (is_sensitive=True)."""
    # Arrange
    service = SLAService()
    ticket = make_mock_ticket(is_sensitive=True, category="gbv")

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    await service.set_ticket_deadlines(ticket, mock_db)

    # Assert
    # Should not call calculate_deadlines or commit
    mock_db.commit.assert_not_called()


async def test_set_ticket_deadlines_sets_fields():
    """Test set_ticket_deadlines sets response and resolution deadline fields."""
    # Arrange
    service = SLAService()
    created_at = datetime(2026, 2, 10, 9, 0, 0, tzinfo=timezone.utc)
    ticket = make_mock_ticket(is_sensitive=False, created_at=created_at)

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # Use system defaults
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()

    # Act
    await service.set_ticket_deadlines(ticket, mock_db)

    # Assert
    assert ticket.sla_response_deadline is not None
    assert ticket.sla_resolution_deadline is not None
    mock_db.commit.assert_called_once()


async def test_find_breached_tickets_response_breach():
    """Test finding tickets with response breach (open past response deadline)."""
    # Arrange
    service = SLAService()
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # Make naive for mock comparison
    created_at = now - timedelta(hours=30)
    response_deadline = now - timedelta(hours=6)  # 6 hours overdue

    ticket = make_mock_ticket(
        status="open",
        is_sensitive=False,
        created_at=created_at,
        sla_response_deadline=response_deadline,
        sla_resolution_deadline=now + timedelta(hours=100)
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ticket]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    breached = await service.find_breached_tickets(mock_db)

    # Assert
    assert len(breached) == 1
    assert breached[0]["ticket"] == ticket
    assert breached[0]["breach_type"] == "response_breach"
    assert breached[0]["overdue_by_hours"] > 5  # Approximately 6 hours


async def test_find_breached_tickets_resolution_breach():
    """Test finding tickets with resolution breach (in_progress past resolution deadline)."""
    # Arrange
    service = SLAService()
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # Make naive for mock comparison
    created_at = now - timedelta(hours=200)
    response_deadline = now - timedelta(hours=170)
    resolution_deadline = now - timedelta(hours=10)  # 10 hours overdue

    ticket = make_mock_ticket(
        status="in_progress",
        is_sensitive=False,
        created_at=created_at,
        sla_response_deadline=response_deadline,
        sla_resolution_deadline=resolution_deadline
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ticket]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    breached = await service.find_breached_tickets(mock_db)

    # Assert
    assert len(breached) == 1
    assert breached[0]["ticket"] == ticket
    assert breached[0]["breach_type"] == "resolution_breach"
    assert breached[0]["overdue_by_hours"] > 9  # Approximately 10 hours


async def test_find_breached_tickets_excludes_gbv():
    """Test find_breached_tickets excludes GBV tickets (is_sensitive=True)."""
    # Arrange
    service = SLAService()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # GBV ticket that would be breached
    gbv_ticket = make_mock_ticket(
        is_sensitive=True,
        status="open",
        created_at=now - timedelta(hours=50),
        sla_response_deadline=now - timedelta(hours=10)
    )

    # Municipal ticket that is breached
    municipal_ticket = make_mock_ticket(
        is_sensitive=False,
        status="open",
        created_at=now - timedelta(hours=30),
        sla_response_deadline=now - timedelta(hours=5)
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    # Query filters out GBV, only returns municipal
    mock_result.scalars.return_value.all.return_value = [municipal_ticket]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    breached = await service.find_breached_tickets(mock_db)

    # Assert
    assert len(breached) == 1
    assert breached[0]["ticket"] == municipal_ticket


async def test_find_breached_tickets_no_breaches():
    """Test find_breached_tickets returns empty list when all tickets within SLA."""
    # Arrange
    service = SLAService()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    ticket = make_mock_ticket(
        status="open",
        is_sensitive=False,
        created_at=now - timedelta(hours=10),
        sla_response_deadline=now + timedelta(hours=14),  # Still has time
        sla_resolution_deadline=now + timedelta(hours=158)
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ticket]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    breached = await service.find_breached_tickets(mock_db)

    # Assert
    assert len(breached) == 0


async def test_find_warning_tickets():
    """Test finding tickets approaching SLA breach (>= 80% elapsed)."""
    # Arrange
    service = SLAService()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Ticket at 85% of response time
    created_at = now - timedelta(hours=20.4)  # 20.4 / 24 = 85%
    response_deadline = created_at + timedelta(hours=24)

    ticket = make_mock_ticket(
        status="open",
        is_sensitive=False,
        created_at=created_at,
        sla_response_deadline=response_deadline,
        sla_resolution_deadline=now + timedelta(hours=100)
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ticket]

    # Mock get_sla_config for warning threshold - need two mock results (exact + default lookup)
    mock_result2 = MagicMock()
    mock_result2.scalar_one_or_none.return_value = None  # Exact match

    mock_result3 = MagicMock()
    mock_result3.scalar_one_or_none.return_value = None  # Default fallback

    mock_db.execute = AsyncMock(side_effect=[mock_result, mock_result2, mock_result3])

    # Act
    warnings = await service.find_warning_tickets(mock_db)

    # Assert
    assert len(warnings) == 1
    assert warnings[0]["ticket"] == ticket
    assert warnings[0]["warning_type"] == "response_warning"
    assert warnings[0]["elapsed_pct"] >= 80


async def test_find_warning_tickets_below_threshold():
    """Test find_warning_tickets excludes tickets below threshold."""
    # Arrange
    service = SLAService()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Ticket at 50% of response time (below 80% threshold)
    created_at = now - timedelta(hours=12)
    response_deadline = created_at + timedelta(hours=24)

    ticket = make_mock_ticket(
        status="open",
        is_sensitive=False,
        created_at=created_at,
        sla_response_deadline=response_deadline,
        sla_resolution_deadline=now + timedelta(hours=100)
    )

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ticket]

    # Mock get_sla_config for warning threshold lookup (exact + default)
    mock_result2 = MagicMock()
    mock_result2.scalar_one_or_none.return_value = None

    mock_result3 = MagicMock()
    mock_result3.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[mock_result, mock_result2, mock_result3])

    # Act
    warnings = await service.find_warning_tickets(mock_db)

    # Assert
    assert len(warnings) == 0


async def test_sla_cache():
    """Test SLA config caching prevents redundant database queries."""
    # Arrange
    service = SLAService()
    municipality_id = uuid4()
    category = "water"
    config = make_mock_sla_config(municipality_id=municipality_id, category=category)

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = config
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act - call twice with same parameters
    result1 = await service.get_sla_config(municipality_id, category, mock_db)
    result2 = await service.get_sla_config(municipality_id, category, mock_db)

    # Assert
    assert result1 == result2
    # Database should only be called once (second call uses cache)
    assert mock_db.execute.call_count == 1
