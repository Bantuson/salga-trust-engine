"""Unit tests for IntakeFlow message routing and orchestration.

Tests language detection, category classification, and routing logic
with mocked LLM calls.
"""
from unittest.mock import MagicMock, patch

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
        message="There is a water pipe burst on Main Street"
    )


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
        subcategory="water"
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


@patch("src.agents.flows.intake_flow.language_detector")
def test_intake_flow_receive_message(mock_lang_detector, mock_redis_url, sample_state):
    """Test receive_message detects language and updates state."""
    # Mock language detector
    mock_lang_detector.detect.return_value = "en"

    # Create flow with initial state
    flow = IntakeFlow(redis_url=mock_redis_url)
    # Use the internal _state to set initial state for testing
    flow._state = sample_state

    # Call receive_message
    language = flow.receive_message()

    # Verify
    assert language == "en"
    assert flow.state.language == "en"
    assert flow.state.turn_count == 1
    mock_lang_detector.detect.assert_called_once_with(
        "There is a water pipe burst on Main Street",
        fallback="en"
    )


@patch("src.agents.flows.intake_flow.language_detector")
def test_intake_flow_detect_zulu(mock_lang_detector, mock_redis_url):
    """Test language detection for isiZulu message."""
    mock_lang_detector.detect.return_value = "zu"

    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Amanzi ayaphuma emgwaqeni"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    language = flow.receive_message()

    assert language == "zu"
    assert flow.state.language == "zu"


def test_classify_message_municipal_water(mock_redis_url):
    """Test classification of municipal water issue."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Water pipe burst on Main Street"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "municipal"
    assert flow.state.category == "municipal"
    assert flow.state.subcategory == "water"
    assert flow.state.routing_confidence >= 0.8


def test_classify_message_municipal_roads(mock_redis_url):
    """Test classification of municipal roads issue."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Pothole on Jan Smuts Avenue"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "municipal"
    assert flow.state.category == "municipal"
    assert flow.state.subcategory == "roads"


def test_classify_message_municipal_electricity(mock_redis_url):
    """Test classification of municipal electricity issue."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Streetlight broken on corner"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "municipal"
    assert flow.state.category == "municipal"
    assert flow.state.subcategory == "electricity"


def test_classify_message_municipal_waste(mock_redis_url):
    """Test classification of municipal waste issue."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Trash not collected this week"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "municipal"
    assert flow.state.category == "municipal"
    assert flow.state.subcategory == "waste"


def test_classify_message_municipal_sanitation(mock_redis_url):
    """Test classification of municipal sanitation issue."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Sewage overflow in the street"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "municipal"
    assert flow.state.category == "municipal"
    assert flow.state.subcategory == "sanitation"


def test_classify_message_gbv_english(mock_redis_url):
    """Test classification of GBV report in English."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="My husband hits me"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "gbv"
    assert flow.state.category == "gbv"
    assert flow.state.subcategory is None
    assert flow.state.routing_confidence >= 0.8


def test_classify_message_gbv_zulu(mock_redis_url):
    """Test classification of GBV report in isiZulu."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Umyeni wami uyangihlukumeza"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "gbv"
    assert flow.state.category == "gbv"
    assert flow.state.subcategory is None


def test_classify_message_gbv_afrikaans(mock_redis_url):
    """Test classification of GBV report in Afrikaans."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Huishoudelike geweld"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "gbv"
    assert flow.state.category == "gbv"


def test_classify_message_default_municipal(mock_redis_url):
    """Test default classification to municipal for unclear messages."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="I need help with something"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    category = flow.classify_message()

    assert category == "municipal"
    assert flow.state.category == "municipal"
    assert flow.state.routing_confidence < 0.6  # Low confidence


def test_route_to_crew_municipal(mock_redis_url):
    """Test routing to municipal crew."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Water leak",
        category="municipal"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    route = flow.route_to_crew()

    assert route == "municipal_intake"


def test_route_to_crew_gbv(mock_redis_url):
    """Test routing to GBV crew."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Domestic violence",
        category="gbv"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    route = flow.route_to_crew()

    assert route == "gbv_intake"


def test_handle_municipal(mock_redis_url):
    """Test municipal intake handler."""
    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="Water pipe burst",
        language="en",
        category="municipal",
        subcategory="water"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    result = flow.handle_municipal()

    assert isinstance(result, dict)
    assert "category" in result
    assert "description" in result
    assert flow.state.ticket_data is not None
    assert flow.state.is_complete is True


@pytest.mark.asyncio
async def test_handle_gbv(mock_redis_url):
    """Test GBV intake handler with GBVCrew."""
    from unittest.mock import AsyncMock, patch

    state = IntakeState(
        message_id="msg_1",
        user_id="user_1",
        tenant_id="tenant_1",
        session_id="session_1",
        message="GBV report - domestic violence",
        category="gbv"
    )

    flow = IntakeFlow(redis_url=mock_redis_url)
    flow._state = state

    # Mock GBVCrew.kickoff to return success
    with patch('src.agents.crews.gbv_crew.GBVCrew.kickoff', new_callable=AsyncMock) as mock_kickoff:
        mock_kickoff.return_value = {
            "tracking_number": "TKT-20260209-ABC123",
            "category": "gbv",
            "severity": "high"
        }

        # Mock conversation manager clear_session
        flow._conversation_manager.clear_session = AsyncMock()

        result = await flow.handle_gbv()

        assert isinstance(result, dict)
        assert "tracking_number" in result
        assert result["category"] == "gbv"
        assert flow.state.is_complete is True

        # Verify session was cleared
        flow._conversation_manager.clear_session.assert_called_once_with(
            user_id="user_1",
            session_id="session_1",
            is_gbv=True
        )
