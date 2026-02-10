"""Unit tests for EscalationService (Phase 4).

Tests ticket escalation with PostgreSQL advisory locks,
manager assignment, and escalation history tracking.
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.models.assignment import TicketAssignment
from src.models.team import Team
from src.models.ticket import Ticket, TicketStatus
from src.services.escalation_service import EscalationService

# Module-level marker
pytestmark = pytest.mark.asyncio


def make_mock_ticket(
    tracking_number="TKT-20260210-ABC123",
    status="open",
    tenant_id=None,
    user_id=None,
    assigned_team_id=None
):
    """Factory for mock Ticket objects."""
    ticket = MagicMock(spec=Ticket)
    ticket.id = uuid4()
    ticket.tracking_number = tracking_number
    ticket.status = status
    ticket.tenant_id = tenant_id or uuid4()
    ticket.user_id = user_id or uuid4()
    ticket.assigned_team_id = assigned_team_id
    ticket.assigned_to = None
    ticket.escalated_at = None
    ticket.escalation_reason = None
    return ticket


def make_mock_team(
    name="Water Services Team",
    manager_id=None
):
    """Factory for mock Team objects."""
    team = MagicMock(spec=Team)
    team.id = uuid4()
    team.name = name
    team.manager_id = manager_id
    return team


async def test_escalate_ticket_success():
    """Test successful ticket escalation with lock acquisition."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    ticket = make_mock_ticket(status="open")

    # Mock advisory lock acquisition (returns True)
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[mock_lock_result, mock_ticket_result])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    result = await service.escalate_ticket(ticket_id, "response_breach", mock_db)

    # Assert
    assert result is True
    assert ticket.status == TicketStatus.ESCALATED
    assert ticket.escalation_reason == "response_breach"
    assert ticket.escalated_at is not None
    mock_db.commit.assert_called_once()


async def test_escalate_ticket_already_escalated():
    """Test escalating already escalated ticket returns False."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    ticket = make_mock_ticket(status="escalated")

    # Mock advisory lock acquisition
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[mock_lock_result, mock_ticket_result])

    # Act
    result = await service.escalate_ticket(ticket_id, "response_breach", mock_db)

    # Assert
    assert result is False


async def test_escalate_ticket_lock_not_acquired():
    """Test escalation returns False when advisory lock not acquired (another worker)."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()

    # Mock advisory lock acquisition (returns False)
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = False

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(return_value=mock_lock_result)

    # Act
    result = await service.escalate_ticket(ticket_id, "response_breach", mock_db)

    # Assert
    assert result is False


async def test_escalate_ticket_assigns_to_manager():
    """Test escalation assigns ticket to team manager when available."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    team_id = uuid4()
    manager_id = uuid4()

    ticket = make_mock_ticket(status="open", assigned_team_id=team_id)
    team = make_mock_team(name="Water Team", manager_id=manager_id)

    # Mock advisory lock acquisition
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    # Mock team load
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team

    # Mock assignment history query (no previous assignments)
    mock_assignment_result = MagicMock()
    mock_assignment_result.scalars.return_value.all.return_value = []

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[
        mock_lock_result,
        mock_ticket_result,
        mock_team_result,
        mock_assignment_result
    ])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    result = await service.escalate_ticket(ticket_id, "resolution_breach", mock_db)

    # Assert
    assert result is True
    assert ticket.assigned_to == manager_id


async def test_escalate_ticket_no_manager():
    """Test escalation when team has no manager - ticket still escalated but not reassigned."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    team_id = uuid4()

    ticket = make_mock_ticket(status="open", assigned_team_id=team_id)
    team = make_mock_team(name="Water Team", manager_id=None)

    # Mock advisory lock acquisition
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    # Mock team load
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team

    # Mock assignment history query
    mock_assignment_result = MagicMock()
    mock_assignment_result.scalars.return_value.all.return_value = []

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[
        mock_lock_result,
        mock_ticket_result,
        mock_team_result,
        mock_assignment_result
    ])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    result = await service.escalate_ticket(ticket_id, "resolution_breach", mock_db)

    # Assert
    assert result is True
    assert ticket.status == TicketStatus.ESCALATED
    assert ticket.assigned_to is None  # No manager to assign to


async def test_escalate_ticket_sets_escalation_fields():
    """Test escalation sets escalated_at and escalation_reason fields."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    ticket = make_mock_ticket(status="in_progress")

    # Mock advisory lock acquisition
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[mock_lock_result, mock_ticket_result])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    result = await service.escalate_ticket(ticket_id, "response_breach (overdue by 10.5h)", mock_db)

    # Assert
    assert result is True
    assert ticket.escalated_at is not None
    assert ticket.escalation_reason == "response_breach (overdue by 10.5h)"


async def test_escalate_ticket_creates_assignment_record():
    """Test escalation creates TicketAssignment record with reason='escalation'."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    team_id = uuid4()
    manager_id = uuid4()

    ticket = make_mock_ticket(status="open", assigned_team_id=team_id)
    team = make_mock_team(name="Water Team", manager_id=manager_id)

    # Mock advisory lock acquisition
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    # Mock team load
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team

    # Mock assignment history query
    mock_assignment_result = MagicMock()
    mock_assignment_result.scalars.return_value.all.return_value = []

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[
        mock_lock_result,
        mock_ticket_result,
        mock_team_result,
        mock_assignment_result
    ])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    result = await service.escalate_ticket(ticket_id, "resolution_breach", mock_db)

    # Assert
    assert result is True
    # Verify db.add was called with TicketAssignment
    mock_db.add.assert_called_once()
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, TicketAssignment)
    assert added_obj.reason == "escalation"
    assert added_obj.is_current is True


async def test_bulk_escalate_counts_correctly():
    """Test bulk_escalate returns correct count of escalated tickets."""
    # Arrange
    service = EscalationService()

    breached_tickets = [
        {"ticket_id": uuid4(), "breach_type": "response_breach", "overdue_by_hours": 5.2},
        {"ticket_id": uuid4(), "breach_type": "resolution_breach", "overdue_by_hours": 12.8},
        {"ticket_id": uuid4(), "breach_type": "response_breach", "overdue_by_hours": 3.1},
    ]

    # Mock escalate_ticket to return True for first 2, False for third
    async def mock_escalate(ticket_id, reason, db):
        if ticket_id == breached_tickets[2]["ticket_id"]:
            return False  # Already escalated or lock not acquired
        return True

    service.escalate_ticket = mock_escalate

    mock_db = MagicMock()

    # Act
    count = await service.bulk_escalate(breached_tickets, mock_db)

    # Assert
    assert count == 2


async def test_bulk_escalate_empty_list():
    """Test bulk_escalate with empty list returns 0."""
    # Arrange
    service = EscalationService()
    mock_db = MagicMock()

    # Act
    count = await service.bulk_escalate([], mock_db)

    # Assert
    assert count == 0


async def test_escalate_ticket_no_assigned_team():
    """Test escalation when ticket has no assigned team - still escalates."""
    # Arrange
    service = EscalationService()
    ticket_id = uuid4()
    ticket = make_mock_ticket(status="open", assigned_team_id=None)

    # Mock advisory lock acquisition
    mock_lock_result = MagicMock()
    mock_lock_result.scalar.return_value = True

    # Mock ticket load
    mock_ticket_result = MagicMock()
    mock_ticket_result.scalar_one_or_none.return_value = ticket

    # Mock assignment history query
    mock_assignment_result = MagicMock()
    mock_assignment_result.scalars.return_value.all.return_value = []

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=[
        mock_lock_result,
        mock_ticket_result,
        mock_assignment_result
    ])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    # Act
    result = await service.escalate_ticket(ticket_id, "response_breach", mock_db)

    # Assert
    assert result is True
    assert ticket.status == TicketStatus.ESCALATED
