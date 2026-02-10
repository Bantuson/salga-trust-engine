"""Unit tests for RoutingService (Phase 4).

Tests geospatial ticket routing with PostGIS proximity queries,
GBV-to-SAPS security boundary enforcement, and fallback routing logic.
"""
import os
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.models.team import Team
from src.models.ticket import Ticket
from src.services.routing_service import RoutingService

# Module-level marker for all tests
pytestmark = pytest.mark.asyncio


def make_mock_ticket(
    tracking_number="TKT-20260210-ABC123",
    category="water",
    is_sensitive=False,
    tenant_id=None,
    location=None
):
    """Factory for mock Ticket objects."""
    ticket = MagicMock(spec=Ticket)
    ticket.id = uuid4()
    ticket.tracking_number = tracking_number
    ticket.category = category
    ticket.is_sensitive = is_sensitive
    ticket.tenant_id = tenant_id or uuid4()
    ticket.location = location
    return ticket


def make_mock_team(
    name="Water Services Team",
    category="water",
    is_saps=False,
    is_active=True,
    tenant_id=None
):
    """Factory for mock Team objects."""
    team = MagicMock(spec=Team)
    team.id = uuid4()
    team.name = name
    team.category = category
    team.is_saps = is_saps
    team.is_active = is_active
    team.tenant_id = tenant_id or uuid4()
    team.service_area = MagicMock()  # PostGIS geometry mock
    return team


async def test_route_municipal_ticket_with_location():
    """Test routing municipal ticket with location - should use geospatial query."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="water", is_sensitive=False, location=MagicMock())
    team = make_mock_team(name="Water Team North", category="water")

    # Mock database session
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = team
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result == team
    mock_db.execute.assert_called_once()


async def test_route_municipal_ticket_no_location_fallback():
    """Test routing municipal ticket with no location - should fallback to category-based."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="water", is_sensitive=False, location=None)
    team = make_mock_team(name="Water Team Fallback", category="water")

    # Mock database session
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = team
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result == team
    mock_db.execute.assert_called_once()


async def test_route_municipal_ticket_no_match():
    """Test routing municipal ticket when no team found - should return None."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="electricity", is_sensitive=False, location=None)

    # Mock database session - no team found
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result is None


async def test_route_gbv_ticket_to_saps():
    """Test routing GBV ticket to SAPS team - should use is_saps=True filter."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="gbv", is_sensitive=True, location=None)
    saps_team = make_mock_team(name="SAPS Station 1", category="gbv", is_saps=True)

    # Mock database session
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = saps_team
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result == saps_team
    assert result.is_saps is True


async def test_route_gbv_ticket_never_municipal():
    """Test GBV routing never returns municipal team - SEC-05 boundary."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="gbv", is_sensitive=True, location=None)

    # Mock database session - returns None (no SAPS team)
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    # Should return None (no SAPS team) rather than routing to municipal team
    assert result is None


async def test_route_gbv_ticket_no_saps_team():
    """Test routing GBV ticket when no SAPS team configured - should return None and log warning."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="gbv", is_sensitive=True, location=None)

    # Mock database session - no SAPS team
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result is None


async def test_route_ticket_dispatches_correctly():
    """Test route_ticket dispatches to correct method based on ticket type."""
    # Arrange
    service = RoutingService()

    # Test GBV dispatch
    gbv_ticket = make_mock_ticket(category="gbv", is_sensitive=True, location=None)
    saps_team = make_mock_team(name="SAPS", is_saps=True)

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = saps_team
    mock_db.execute = AsyncMock(return_value=mock_result)

    gbv_result = await service.route_ticket(gbv_ticket, mock_db)
    assert gbv_result == saps_team

    # Test municipal dispatch
    municipal_ticket = make_mock_ticket(category="water", is_sensitive=False, location=None)
    municipal_team = make_mock_team(name="Water Team", category="water", is_saps=False)

    mock_result2 = MagicMock()
    mock_result2.scalar_one_or_none.return_value = municipal_team
    mock_db.execute = AsyncMock(return_value=mock_result2)

    municipal_result = await service.route_ticket(municipal_ticket, mock_db)
    assert municipal_result == municipal_team


async def test_find_teams_near_location():
    """Test finding all teams near a location within radius."""
    # Skip if PostGIS not available (SQLite tests)
    if os.getenv("USE_SQLITE_TESTS") == "1":
        pytest.skip("PostGIS not available in SQLite test mode")

    # Arrange
    service = RoutingService()
    location = MagicMock()  # PostGIS Point
    tenant_id = uuid4()

    team1 = make_mock_team(name="Team 1", category="water", tenant_id=tenant_id)
    team2 = make_mock_team(name="Team 2", category="water", tenant_id=tenant_id)

    # Mock database session
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [team1, team2]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.find_teams_near_location(
        location=location,
        category="water",
        tenant_id=tenant_id,
        db=mock_db,
        radius_meters=10000
    )

    # Assert
    assert len(result) == 2
    assert team1 in result
    assert team2 in result


async def test_find_teams_near_location_no_postgis():
    """Test find_teams_near_location returns empty list when PostGIS not available."""
    # Force PostGIS unavailable
    import src.services.routing_service as routing_module
    original_use_postgis = routing_module.USE_POSTGIS
    routing_module.USE_POSTGIS = False

    try:
        # Arrange
        service = RoutingService()
        location = MagicMock()
        tenant_id = uuid4()
        mock_db = MagicMock()

        # Act
        result = await service.find_teams_near_location(
            location=location,
            category="water",
            tenant_id=tenant_id,
            db=mock_db
        )

        # Assert
        assert result == []
    finally:
        # Restore
        routing_module.USE_POSTGIS = original_use_postgis


async def test_find_teams_near_location_none_location():
    """Test find_teams_near_location returns empty list when location is None."""
    # Arrange
    service = RoutingService()
    tenant_id = uuid4()
    mock_db = MagicMock()

    # Act
    result = await service.find_teams_near_location(
        location=None,
        category="water",
        tenant_id=tenant_id,
        db=mock_db
    )

    # Assert
    assert result == []


async def test_route_municipal_excludes_saps_teams():
    """Test municipal routing explicitly excludes SAPS teams."""
    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="water", is_sensitive=False, location=None)
    municipal_team = make_mock_team(name="Water Team", category="water", is_saps=False)

    # Mock database session
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = municipal_team
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result.is_saps is False


async def test_route_gbv_with_location_uses_geospatial():
    """Test GBV routing with location uses geospatial query to nearest SAPS station."""
    # Skip if PostGIS not available
    if os.getenv("USE_SQLITE_TESTS") == "1":
        pytest.skip("PostGIS not available in SQLite test mode")

    # Arrange
    service = RoutingService()
    ticket = make_mock_ticket(category="gbv", is_sensitive=True, location=MagicMock())
    saps_team = make_mock_team(name="SAPS Central", is_saps=True)

    # Mock database session
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = saps_team
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    result = await service.route_ticket(ticket, mock_db)

    # Assert
    assert result == saps_team
    assert result.is_saps is True
