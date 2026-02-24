"""Unit tests for IntakeFlow message routing and orchestration.

Tests cover:
- IntakeState initialization and serialization
- Language detection in receive_and_route()
- ManagerCrew delegation via receive_and_route()
- Context dict construction passed to ManagerCrew
- State updated from manager result

Phase 6.9 architecture note:
    classify_message() and route_to_crew() were removed in Phase 6.9.
    All routing now goes through ManagerCrew.kickoff() via receive_and_route().
    Tests for the removed keyword-classification chain are no longer valid.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.flows.intake_flow import IntakeFlow
from src.agents.flows.state import IntakeState


@pytest.fixture
def mock_redis_url():
    """Mock Redis URL for testing."""
    return "redis://localhost:6379/0"


@pytest.fixture
def sample_state():
    """Sample intake state for testing."""
    return IntakeState(
        message_id="msg_123",
        user_id="user_456",
        tenant_id="tenant_789",
        session_id="session_abc",
        message="There is a water pipe burst on Main Street",
        phone="+27821234567",
        session_status="active",
        user_exists=True,
    )


# ── IntakeState model tests ────────────────────────────────────────────────────


def test_intake_state_initialization():
    """Test IntakeState model initialization and defaults."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Test message"
    )

    assert state.message_id == "msg_1"
    assert state.user_id == "user_1"
    assert state.tenant_id == "tenant_1"
    assert state.session_id == "session_1"
    assert state.message == "Test message"
    assert state.language == "en"  # Default
    assert state.category is None
    assert state.subcategory is None
    assert state.ticket_data is None
    assert state.ticket_id is None
    assert state.routing_confidence == 0.0
    assert state.turn_count == 0
    assert state.is_complete is False
    assert state.error is None


def test_intake_state_phase_69_fields():
    """Test Phase 6.9 ManagerCrew context fields default correctly."""
    state = IntakeState()

    # Phase 6.9 fields
    assert state.session_status == "none"
    assert state.user_exists is False
    assert state.pending_intent is None
    assert state.conversation_history == "(none)"
    assert state.phone == ""


def test_intake_state_serialization():
    """Test IntakeState JSON serialization/deserialization."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Test message",
        language="zu",
        category="municipal",
        subcategory="water",
        session_status="active",
        user_exists=True,
        phone="+27821234567",
    )

    # Serialize to JSON
    json_data = state.model_dump_json()
    assert isinstance(json_data, str)

    # Deserialize from JSON
    restored_state = IntakeState.model_validate_json(json_data)
    assert restored_state.message_id == state.message_id
    assert restored_state.language == "zu"
    assert restored_state.category == "municipal"
    assert restored_state.subcategory == "water"
    assert restored_state.session_status == "active"
    assert restored_state.user_exists is True
    assert restored_state.phone == "+27821234567"


# ── IntakeFlow receive_and_route() tests ──────────────────────────────────────


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_detects_language(
    mock_get_llm, mock_lang_detector, mock_redis_url, sample_state
):
    """receive_and_route() calls language_detector.detect before routing."""
    mock_lang_detector.detect.return_value = "en"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    # Mock ManagerCrew to avoid real API calls
    mock_manager_result = {"message": "Hello! I'm Gugu.", "routing": "greeting"}
    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value=mock_manager_result)

    with patch("src.agents.crews.manager_crew.ManagerCrew", return_value=mock_manager):
        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = sample_state
        result = await flow.receive_and_route()

    # Language detector was called with the message
    mock_lang_detector.detect.assert_called_once_with(
        "There is a water pipe burst on Main Street",
        fallback="en"
    )
    assert result is not None


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_detects_zulu(
    mock_get_llm, mock_lang_detector, mock_redis_url
):
    """receive_and_route() uses detected language for ManagerCrew init."""
    mock_lang_detector.detect.return_value = "zu"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    state = IntakeState(
        message="Amanzi ayaphuma emgwaqeni",
        session_status="active",
        user_exists=True,
    )

    mock_manager_result = {"message": "Sawubona!"}
    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value=mock_manager_result)

    with patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:
        MockManagerCrew.return_value = mock_manager

        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = state
        await flow.receive_and_route()

        # ManagerCrew was instantiated with the detected language
        MockManagerCrew.assert_called_once()
        call_kwargs = MockManagerCrew.call_args
        assert call_kwargs[1]["language"] == "zu" or call_kwargs[0][0] == "zu"


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_passes_full_context_to_manager(
    mock_get_llm, mock_lang_detector, mock_redis_url
):
    """receive_and_route() builds correct context dict for ManagerCrew.kickoff()."""
    mock_lang_detector.detect.return_value = "en"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    state = IntakeState(
        message="I want to check my water leak report",
        user_id="user-uuid-123",
        tenant_id="tenant-abc",
        phone="+27821234567",
        session_status="active",
        user_exists=True,
        pending_intent="ticket_status",
        conversation_history="Citizen: Hi\nGugu: Hello!",
    )

    mock_manager_result = {"message": "Your report TKT-20260218-ABC123 is open."}
    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value=mock_manager_result)

    with patch("src.agents.crews.manager_crew.ManagerCrew", return_value=mock_manager):
        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = state
        await flow.receive_and_route()

    # Verify kickoff was called with the expected context
    mock_manager.kickoff.assert_called_once()
    context_passed = mock_manager.kickoff.call_args[0][0]

    assert context_passed["message"] == "I want to check my water leak report"
    assert context_passed["user_id"] == "user-uuid-123"
    assert context_passed["language"] == "en"
    assert context_passed["phone"] == "+27821234567"
    assert context_passed["session_status"] == "active"
    assert context_passed["conversation_history"] == "Citizen: Hi\nGugu: Hello!"
    assert context_passed["pending_intent"] == "ticket_status"


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_stores_result_in_state(
    mock_get_llm, mock_lang_detector, mock_redis_url, sample_state
):
    """receive_and_route() stores ManagerCrew result in state.ticket_data."""
    mock_lang_detector.detect.return_value = "en"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    expected_result = {
        "message": "Your report has been submitted. Tracking: TKT-20260218-A1B2C3",
        "tracking_number": "TKT-20260218-A1B2C3",
        "routing": "municipal_report",
    }
    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value=expected_result)

    with patch("src.agents.crews.manager_crew.ManagerCrew", return_value=mock_manager):
        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = sample_state
        result = await flow.receive_and_route()

    # State must be updated
    assert flow.state.ticket_data == expected_result
    assert flow.state.is_complete is True
    assert result == expected_result


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_increments_turn_count(
    mock_get_llm, mock_lang_detector, mock_redis_url
):
    """receive_and_route() increments state.turn_count on each call."""
    mock_lang_detector.detect.return_value = "en"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    state = IntakeState(message="Hi", turn_count=3)

    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value={"message": "Hello!"})

    with patch("src.agents.crews.manager_crew.ManagerCrew", return_value=mock_manager):
        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = state
        await flow.receive_and_route()

    assert flow.state.turn_count == 4


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_pending_intent_none_becomes_none_string(
    mock_get_llm, mock_lang_detector, mock_redis_url
):
    """receive_and_route() passes 'none' string when pending_intent is None."""
    mock_lang_detector.detect.return_value = "en"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    state = IntakeState(message="Hello", pending_intent=None)

    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value={"message": "Hi!"})

    with patch("src.agents.crews.manager_crew.ManagerCrew", return_value=mock_manager):
        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = state
        await flow.receive_and_route()

    context_passed = mock_manager.kickoff.call_args[0][0]
    # None pending_intent becomes "none" string (avoids KeyError in format())
    assert context_passed["pending_intent"] == "none"


@patch("src.agents.flows.intake_flow.language_detector")
@patch("src.agents.flows.intake_flow.get_crew_llm")
async def test_receive_and_route_sets_state_language_from_detected(
    mock_get_llm, mock_lang_detector, mock_redis_url
):
    """receive_and_route() updates state.language from detected language."""
    mock_lang_detector.detect.return_value = "af"
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm

    state = IntakeState(message="Water lek op Hoofstraat", language="en")  # starts as en

    mock_manager = MagicMock()
    mock_manager.kickoff = AsyncMock(return_value={"message": "Hallo!"})

    with patch("src.agents.crews.manager_crew.ManagerCrew", return_value=mock_manager):
        flow = IntakeFlow(redis_url=mock_redis_url)
        flow._state = state
        await flow.receive_and_route()

    assert flow.state.language == "af"
