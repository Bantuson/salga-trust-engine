"""Shared pytest fixtures for agent unit tests.

Provides mock LLM, mock tools, mock ConversationManager, and standard
context dicts for each agent type (auth, municipal, gbv, ticket_status).

These fixtures are used across test_auth_crew.py, test_municipal_crew.py,
test_gbv_crew.py, test_ticket_status_crew.py, test_intake_flow.py.
"""
import os

import pytest
from unittest.mock import MagicMock, AsyncMock

# Set fake API keys before any CrewAI imports
# Required: LiteLLM validates OPENAI_API_KEY presence at import time
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")


@pytest.fixture
def mock_llm():
    """Mock crewai.LLM that returns predictable responses.

    Default: call() returns "auth" (intent classification default).
    Override in test via mock_llm.call.return_value = "municipal" etc.
    """
    llm = MagicMock()
    llm.call.return_value = "auth"  # Default: classify as auth intent
    return llm


@pytest.fixture
def mock_conversation_manager():
    """Mock ConversationManager for session state.

    Provides get_or_create_state, save_state, append_turn, clear_session
    all as no-op mocks that return predictable default state.
    """
    mgr = MagicMock()
    mgr.get_or_create_state.return_value = MagicMock(
        turns=[],
        routing_phase="manager",
        session_status="none",
        user_id=None,
        language="en",
        pending_intent=""
    )
    mgr.save_state = MagicMock()
    mgr.append_turn = MagicMock()
    mgr.clear_session = MagicMock()
    return mgr


@pytest.fixture
def auth_context():
    """Standard auth agent context dict.

    Represents a new citizen who wants to report a pothole — triggers auth flow
    because session_status is "none" (unauthenticated).
    """
    return {
        "message": "Hi, I want to report a pothole",
        "phone": "+27821234567",
        "language": "en",
        "session_status": "none",
        "conversation_history": "(none)",
        "user_id": "",
    }


@pytest.fixture
def municipal_context():
    """Standard municipal agent context dict.

    Represents an authenticated citizen reporting a broken pipe.
    Has conversation_history showing the session has started.
    """
    return {
        "message": "There is a broken pipe on Main Road",
        "phone": "+27821234567",
        "language": "en",
        "conversation_history": "User: Hi\nGugu: Welcome!",
        "user_id": "user-uuid-123",
        "user_name": "Thabo",
    }


@pytest.fixture
def gbv_context():
    """Standard GBV agent context dict.

    Represents a citizen reporting a GBV incident.
    Note: GBV crew has memory=False — no cross-session data leakage.
    """
    return {
        "message": "I need help, my partner is threatening me",
        "phone": "+27821234567",
        "language": "en",
        "conversation_history": "(none)",
        "user_id": "user-uuid-456",
    }


@pytest.fixture
def ticket_status_context():
    """Standard ticket status context dict.

    Citizen querying status of a specific ticket by tracking number.
    """
    return {
        "message": "What is the status of TKT-20260225-abc123?",
        "phone": "+27821234567",
        "language": "en",
        "conversation_history": "(none)",
        "user_id": "user-uuid-789",
        "tracking_number": "TKT-20260225-abc123",
    }
