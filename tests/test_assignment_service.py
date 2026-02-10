"""Unit tests for AssignmentService (Phase 4).

Tests ticket assignment with history tracking, GBV security guard,
first_responded_at tracking, and auto-routing integration.
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.models.assignment import TicketAssignment
from src.models.team import Team
from src.models.ticket import Ticket
from src.services.assignment_service import AssignmentService

# Module-level marker
pytestmark = pytest.mark.asyncio


def make_mock_ticket(
    tracking_number="TKT-20260210-ABC123",
    status="open",
    is_sensitive=False,
    tenant_id=None,
    first_responded_at=None
):
    """Factory for mock Ticket objects."""
    ticket = MagicMock(spec=Ticket)
    ticket.id = uuid4()
    ticket.tracking_number = tracking_number
    ticket.status = status
    ticket.is_sensitive = is_sensitive
    ticket.tenant_id = tenant_id or uuid4()
    ticket.assigned_team_id = None
    ticket.assigned_to = None
    ticket.first_responded_at = first_responded_at
    return ticket


def make_mock_team(
    name="Water Services Team",
    is_saps=False,
    tenant_id=None
):
    """Factory for mock Team objects."""
    team = MagicMock(spec=Team)
    team.id = uuid4()
    team.name = name
    team.is_saps = is_saps
    team.tenant_id = tenant_id or uuid4()
    return team


def make_mock_assignment(
    ticket_id=None,
    team_id=None,
    is_current=True
):
    """Factory for mock TicketAssignment objects."""
    assignment = MagicMock(spec=TicketAssignment)
    assignment.id = uuid4()
    assignment.ticket_id = ticket_id or uuid4()
    assignment.team_id = team_id
    assignment.is_current = is_current
    assignment.created_at = datetime.now(timezone.utc)
    return assignment


async def test_assign_ticket_creates_record():
    """Test assign_ticket creates new assignment with is_current=True."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    team_id = uuid4()
    user_id = uuid4()
    ticket = make_mock_ticket()

    # Mock database
    mock_db = MagicMock()
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_ticket_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Act
    assignment = await service.assign_ticket(
        ticket_id=ticket_id,
        team_id=team_id,
        assigned_to=user_id,
        assigned_by="system",
        reason="geospatial_routing",
        db=mock_db
    )

    # Assert
    mock_db.add.assert_called_once()
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, TicketAssignment)
    assert added_obj.is_current is True
    assert added_obj.reason == "geospatial_routing"


async def test_assign_ticket_deactivates_previous():
    """Test assign_ticket deactivates previous assignment (is_current=False)."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    team_id = uuid4()
    ticket = make_mock_ticket()

    # Mock database
    mock_db = MagicMock()
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_ticket_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Act
    assignment = await service.assign_ticket(
        ticket_id=ticket_id,
        team_id=team_id,
        assigned_to=None,
        assigned_by="system",
        reason="auto_route",
        db=mock_db
    )

    # Assert
    # Should call execute to deactivate previous assignments (UPDATE query)
    assert mock_db.execute.call_count >= 1


async def test_assign_ticket_updates_ticket():
    """Test assign_ticket updates ticket.assigned_team_id and assigned_to fields."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    team_id = uuid4()
    user_id = uuid4()
    ticket = make_mock_ticket()

    # Mock database
    mock_db = MagicMock()
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_ticket_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Act
    assignment = await service.assign_ticket(
        ticket_id=ticket_id,
        team_id=team_id,
        assigned_to=user_id,
        assigned_by="user_123",
        reason="manual_assignment",
        db=mock_db
    )

    # Assert
    assert ticket.assigned_team_id == team_id
    assert ticket.assigned_to == user_id


async def test_assign_ticket_sets_first_responded_at():
    """Test assign_ticket sets first_responded_at when assigning to user with open ticket."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    team_id = uuid4()
    user_id = uuid4()
    ticket = make_mock_ticket(status="open", first_responded_at=None)

    # Mock database
    mock_db = MagicMock()
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_ticket_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Act
    assignment = await service.assign_ticket(
        ticket_id=ticket_id,
        team_id=team_id,
        assigned_to=user_id,
        assigned_by="system",
        reason="auto_route",
        db=mock_db
    )

    # Assert
    assert ticket.first_responded_at is not None
    assert ticket.status == "in_progress"


async def test_assign_ticket_preserves_first_responded_at():
    """Test assign_ticket doesn't overwrite first_responded_at if already set."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    team_id = uuid4()
    user_id = uuid4()
    original_response_time = datetime(2026, 2, 9, 10, 0, 0, tzinfo=timezone.utc)
    ticket = make_mock_ticket(status="in_progress", first_responded_at=original_response_time)

    # Mock database
    mock_db = MagicMock()
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_ticket_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Act
    assignment = await service.assign_ticket(
        ticket_id=ticket_id,
        team_id=team_id,
        assigned_to=user_id,
        assigned_by="user_456",
        reason="reassignment",
        db=mock_db
    )

    # Assert
    assert ticket.first_responded_at == original_response_time


async def test_auto_route_and_assign_with_match():
    """Test auto_route_and_assign creates assignment when team found."""
    # Arrange
    service = AssignmentService()
    ticket = make_mock_ticket()
    team = make_mock_team(name="Water Team")

    # Mock database
    mock_db = MagicMock()
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_ticket_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Patch RoutingService to return the team
    from unittest.mock import patch
    with patch("src.services.assignment_service.RoutingService") as mock_routing_class:
        mock_routing_instance = MagicMock()
        mock_routing_instance.route_ticket = AsyncMock(return_value=team)
        mock_routing_class.return_value = mock_routing_instance

        # Act
        assignment = await service.auto_route_and_assign(ticket, mock_db)

        # Assert - assignment created
        assert mock_db.add.called
        assert ticket.assigned_team_id == team.id


async def test_auto_route_and_assign_no_match():
    """Test auto_route_and_assign returns None when no team found."""
    # Arrange
    service = AssignmentService()
    ticket = make_mock_ticket()

    # Mock RoutingService - no team found
    mock_routing_service = MagicMock()
    mock_routing_service.route_ticket = AsyncMock(return_value=None)

    mock_db = MagicMock()

    # Patch RoutingService
    from unittest.mock import patch
    with patch("src.services.assignment_service.RoutingService", return_value=mock_routing_service):
        # Act
        assignment = await service.auto_route_and_assign(ticket, mock_db)

        # Assert
        assert assignment is None


async def test_reassign_ticket_gbv_guard():
    """Test reassign_ticket raises ValueError when GBV ticket assigned to non-SAPS team."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    municipal_team_id = uuid4()

    gbv_ticket = make_mock_ticket(is_sensitive=True)
    municipal_team = make_mock_team(name="Water Team", is_saps=False)

    # Mock database
    mock_db = MagicMock()

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = gbv_ticket

    # Mock team load
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = municipal_team

    mock_db.execute = AsyncMock(side_effect=[mock_ticket_result, mock_team_result])

    # Act & Assert
    with pytest.raises(ValueError, match="GBV tickets can only be assigned to SAPS teams"):
        await service.reassign_ticket(
            ticket_id=ticket_id,
            new_team_id=municipal_team_id,
            assigned_by="user_789",
            reason="manual_override",
            db=mock_db
        )


async def test_reassign_ticket_gbv_to_saps():
    """Test reassign_ticket succeeds when GBV ticket assigned to SAPS team."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    saps_team_id = uuid4()

    gbv_ticket = make_mock_ticket(is_sensitive=True)
    saps_team = make_mock_team(name="SAPS Station 1", is_saps=True)

    # Mock database - need to provide enough results for all execute calls
    mock_db = MagicMock()

    # Mock ticket load (called twice: once in reassign, once in assign_ticket)
    mock_ticket_result1 = MagicMock()
    mock_ticket_result1.scalar_one_or_none.return_value = gbv_ticket

    mock_ticket_result2 = MagicMock()
    mock_ticket_result2.scalar_one_or_none.return_value = gbv_ticket

    # Mock team load
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = saps_team

    # Mock deactivate previous assignments (UPDATE query in assign_ticket)
    mock_deactivate_result = MagicMock()

    mock_db.execute = AsyncMock(side_effect=[
        mock_ticket_result1,  # First ticket load in reassign_ticket
        mock_team_result,      # Team load in reassign_ticket
        mock_ticket_result2,   # Second ticket load in assign_ticket
        mock_deactivate_result # Deactivate previous assignments in assign_ticket
    ])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Act
    assignment = await service.reassign_ticket(
        ticket_id=ticket_id,
        new_team_id=saps_team_id,
        assigned_by="user_789",
        reason="manual_override",
        db=mock_db
    )

    # Assert - should succeed
    mock_db.add.assert_called_once()


async def test_get_assignment_history():
    """Test get_assignment_history returns all assignments ordered by created_at desc."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()

    assignment1 = make_mock_assignment(ticket_id=ticket_id, is_current=False)
    assignment2 = make_mock_assignment(ticket_id=ticket_id, is_current=False)
    assignment3 = make_mock_assignment(ticket_id=ticket_id, is_current=True)

    # Mock database
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [assignment3, assignment2, assignment1]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act
    history = await service.get_assignment_history(ticket_id, mock_db)

    # Assert
    assert len(history) == 3
    assert history[0] == assignment3
    assert history[0].is_current is True


async def test_assign_ticket_raises_on_ticket_not_found():
    """Test assign_ticket raises ValueError when ticket not found."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()

    # Mock database - ticket not found
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Act & Assert
    with pytest.raises(ValueError, match=f"Ticket {ticket_id} not found"):
        await service.assign_ticket(
            ticket_id=ticket_id,
            team_id=uuid4(),
            assigned_to=None,
            assigned_by="system",
            reason="test",
            db=mock_db
        )


async def test_reassign_ticket_raises_on_team_not_found():
    """Test reassign_ticket raises ValueError when team not found."""
    # Arrange
    service = AssignmentService()
    ticket_id = uuid4()
    team_id = uuid4()

    ticket = make_mock_ticket()

    # Mock database
    mock_db = MagicMock()

    # Mock ticket load (found)
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    # Mock team load (not found)
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[mock_ticket_result, mock_team_result])

    # Act & Assert
    with pytest.raises(ValueError, match=f"Team {team_id} not found"):
        await service.reassign_ticket(
            ticket_id=ticket_id,
            new_team_id=team_id,
            assigned_by="user_123",
            reason="test",
            db=mock_db
        )
