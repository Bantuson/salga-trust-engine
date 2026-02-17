"""Unit tests for Municipal services crew and ticket creation tool.

Tests crew instantiation, agent configuration, language-specific prompts,
and ticket creation tool with mocked database.
"""
import os
import re
from unittest.mock import MagicMock, patch

import pytest

# Set fake API key for CrewAI Agent initialization
os.environ["OPENAI_API_KEY"] = "sk-test-fake-key-for-unit-tests"

from src.agents.crews.municipal_crew import MunicipalCrew
from src.agents.tools.ticket_tool import _create_ticket_impl
from src.models.ticket import TicketCategory, TicketSeverity


@pytest.fixture
def mock_database_session():
    """Mock database session for ticket creation."""
    with patch("src.agents.tools.ticket_tool._get_sync_engine") as mock_engine:
        mock_session = MagicMock()
        mock_session_instance = MagicMock()
        mock_session.return_value = mock_session_instance

        # Mock the ticket object
        mock_ticket = MagicMock()
        mock_ticket.id = "550e8400-e29b-41d4-a716-446655440000"
        mock_ticket.tracking_number = "TKT-20260209-ABC123"
        mock_ticket.status = "open"
        mock_ticket.category = "water"
        mock_ticket.severity = "high"

        mock_session_instance.refresh = MagicMock(side_effect=lambda t: setattr(t, "id", mock_ticket.id))

        with patch("src.agents.tools.ticket_tool.Session", return_value=mock_session_instance):
            yield mock_session_instance


def test_municipal_crew_initialization_english():
    """Test MunicipalCrew instantiation with English language."""
    crew = MunicipalCrew(language="en")

    assert crew.language == "en"
    assert crew.llm is not None
    assert crew.agents_config is not None
    assert crew.tasks_config is not None


def test_municipal_crew_initialization_zulu():
    """Test MunicipalCrew instantiation with isiZulu language."""
    crew = MunicipalCrew(language="zu")

    assert crew.language == "zu"


def test_municipal_crew_initialization_afrikaans():
    """Test MunicipalCrew instantiation with Afrikaans language."""
    crew = MunicipalCrew(language="af")

    assert crew.language == "af"


def test_municipal_crew_initialization_invalid_language():
    """Test MunicipalCrew falls back to English for invalid language."""
    crew = MunicipalCrew(language="fr")  # French not supported

    assert crew.language == "en"  # Should fall back to English


def test_municipal_crew_custom_llm_object():
    """Test MunicipalCrew with custom LLM object."""
    from unittest.mock import MagicMock
    mock_llm = MagicMock()
    crew = MunicipalCrew(language="en", llm=mock_llm)

    assert crew.llm is mock_llm


def test_create_crew_structure():
    """Test create_crew returns properly configured Crew object."""
    crew_manager = MunicipalCrew(language="en")

    crew = crew_manager.create_crew(
        message="Water pipe burst on Main Street",
        user_id="user_123",
        tenant_id="tenant_456"
    )

    # Verify crew structure
    assert crew is not None
    assert len(crew.agents) == 1
    assert len(crew.tasks) == 1

    # Verify agent configuration
    agent = crew.agents[0]
    assert agent.role == "Municipal Services Intake Specialist"
    assert "en" in agent.goal or "english" in agent.goal.lower()
    assert len(agent.tools) == 1
    assert agent.tools[0].name == "create_municipal_ticket"

    # Verify task configuration
    task = crew.tasks[0]
    assert "Water pipe burst on Main Street" in task.description
    assert task.output_pydantic is not None


def test_create_crew_language_specific_prompts():
    """Test that agents use language-specific backstory prompts."""
    # English crew
    crew_en = MunicipalCrew(language="en")
    crew = crew_en.create_crew(
        message="Test message",
        user_id="user_123",
        tenant_id="tenant_456"
    )
    agent_en = crew.agents[0]
    assert "Municipal" in agent_en.backstory or "service" in agent_en.backstory.lower()

    # isiZulu crew
    crew_zu = MunicipalCrew(language="zu")
    crew = crew_zu.create_crew(
        message="Test message",
        user_id="user_123",
        tenant_id="tenant_456"
    )
    agent_zu = crew.agents[0]
    # Should contain isiZulu text
    assert any(word in agent_zu.backstory for word in ["Ungusosekela", "izakhamuzi", "amanzi", "umgwaqo"])


def test_create_crew_afrikaans_prompts():
    """Test Afrikaans language-specific prompts."""
    crew_af = MunicipalCrew(language="af")
    crew = crew_af.create_crew(
        message="Test message",
        user_id="user_123",
        tenant_id="tenant_456"
    )
    agent_af = crew.agents[0]
    # Should contain Afrikaans text
    assert any(word in agent_af.backstory for word in ["munisipale", "burger", "water", "paaie", "dienste"])


def test_create_crew_task_has_pydantic_output():
    """Test that task is configured with TicketData Pydantic output."""
    from src.schemas.ticket import TicketData

    crew_manager = MunicipalCrew(language="en")
    crew = crew_manager.create_crew(
        message="Test",
        user_id="user_123",
        tenant_id="tenant_456"
    )

    task = crew.tasks[0]
    assert task.output_pydantic == TicketData


def test_ticket_tool_validates_category():
    """Test create_municipal_ticket validates category."""
    with pytest.raises(ValueError, match="Invalid category"):
        _create_ticket_impl(
            category="invalid_category",
            description="This is a test description that is long enough",
            user_id="user_123",
            tenant_id="tenant_456",
            language="en",
            severity="medium"
        )


def test_ticket_tool_validates_severity():
    """Test create_municipal_ticket validates severity."""
    with pytest.raises(ValueError, match="Invalid severity"):
        _create_ticket_impl(
            category="water",
            description="This is a test description that is long enough",
            user_id="user_123",
            tenant_id="tenant_456",
            language="en",
            severity="invalid_severity"
        )


def test_ticket_tool_accepts_valid_categories():
    """Test that all valid categories are accepted."""
    valid_categories = ["water", "roads", "electricity", "waste", "sanitation", "gbv", "other"]

    for category in valid_categories:
        with patch("src.agents.tools.ticket_tool._get_sync_engine") as mock_engine:
            mock_session = MagicMock()
            with patch("src.agents.tools.ticket_tool.Session", return_value=mock_session):
                # Mock ticket
                mock_ticket = MagicMock()
                mock_ticket.id = "550e8400-e29b-41d4-a716-446655440000"
                mock_ticket.tracking_number = "TKT-20260209-ABC123"
                mock_ticket.status = "open"
                mock_ticket.category = category
                mock_ticket.severity = "medium"

                try:
                    result = _create_ticket_impl(
                        category=category,
                        description="Test description that is long enough for validation",
                        user_id="user_123",
                        tenant_id="tenant_456",
                        language="en"
                    )
                    # If we get here without exception, validation passed
                    assert True
                except ValueError:
                    # Category validation failed
                    pytest.fail(f"Valid category '{category}' was rejected")


def test_ticket_tool_accepts_valid_severities():
    """Test that all valid severities are accepted."""
    valid_severities = ["low", "medium", "high", "critical"]

    for severity in valid_severities:
        with patch("src.agents.tools.ticket_tool._get_sync_engine") as mock_engine:
            mock_session = MagicMock()
            with patch("src.agents.tools.ticket_tool.Session", return_value=mock_session):
                mock_ticket = MagicMock()
                mock_ticket.id = "550e8400-e29b-41d4-a716-446655440000"
                mock_ticket.tracking_number = "TKT-20260209-ABC123"
                mock_ticket.status = "open"
                mock_ticket.category = "water"
                mock_ticket.severity = severity

                try:
                    result = _create_ticket_impl(
                        category="water",
                        description="Test description that is long enough for validation",
                        user_id="user_123",
                        tenant_id="tenant_456",
                        language="en",
                        severity=severity
                    )
                    assert True
                except ValueError:
                    pytest.fail(f"Valid severity '{severity}' was rejected")


def test_ticket_tool_tracking_number_format(mock_database_session):
    """Test that tracking number follows TKT-YYYYMMDD-XXXXXX format."""
    # Mock the ticket creation
    mock_ticket = MagicMock()
    mock_ticket.id = "550e8400-e29b-41d4-a716-446655440000"
    mock_ticket.tracking_number = "TKT-20260209-ABC123"
    mock_ticket.status = "open"
    mock_ticket.category = "water"
    mock_ticket.severity = "high"

    mock_database_session.add = MagicMock()
    mock_database_session.commit = MagicMock()
    mock_database_session.refresh = MagicMock(side_effect=lambda t: setattr(t, "__dict__", mock_ticket.__dict__))

    result = _create_ticket_impl(
        category="water",
        description="Test description that is long enough",
        user_id="user_123",
        tenant_id="tenant_456",
        language="en",
        severity="high"
    )

    # Verify tracking number format
    assert "tracking_number" in result
    tracking_number = result["tracking_number"]

    # Pattern: TKT-YYYYMMDD-XXXXXX (6 hex chars)
    pattern = r"^TKT-\d{8}-[A-F0-9]{6}$"
    assert re.match(pattern, tracking_number), f"Tracking number '{tracking_number}' does not match expected format"


def test_ticket_tool_returns_correct_structure(mock_database_session):
    """Test that ticket tool returns expected dictionary structure."""
    mock_ticket = MagicMock()
    mock_ticket.id = "550e8400-e29b-41d4-a716-446655440000"
    mock_ticket.tracking_number = "TKT-20260209-ABC123"
    mock_ticket.status = "open"
    mock_ticket.category = "water"
    mock_ticket.severity = "high"

    mock_database_session.add = MagicMock()
    mock_database_session.commit = MagicMock()
    mock_database_session.refresh = MagicMock(side_effect=lambda t: setattr(t, "__dict__", mock_ticket.__dict__))

    result = _create_ticket_impl(
        category="water",
        description="Water pipe burst on Main Street causing flooding",
        user_id="user_123",
        tenant_id="tenant_456",
        language="en",
        severity="high",
        address="123 Main Street"
    )

    # Verify result structure
    assert isinstance(result, dict)
    assert "id" in result
    assert "tracking_number" in result
    assert "status" in result
    assert "category" in result
    assert "severity" in result

    # Verify values
    assert result["status"] == "open"
    assert result["category"] == "water"
    assert result["severity"] == "high"


def test_yaml_configs_valid():
    """Test that YAML config files are valid and loadable."""
    import yaml
    from pathlib import Path

    config_dir = Path(__file__).parent.parent / "src" / "agents" / "config"

    # Test agents.yaml
    with open(config_dir / "agents.yaml", "r", encoding="utf-8") as f:
        agents_config = yaml.safe_load(f)

    assert agents_config is not None
    assert "municipal_intake_agent" in agents_config
    assert "role" in agents_config["municipal_intake_agent"]
    assert "goal" in agents_config["municipal_intake_agent"]

    # Test tasks.yaml
    with open(config_dir / "tasks.yaml", "r", encoding="utf-8") as f:
        tasks_config = yaml.safe_load(f)

    assert tasks_config is not None
    assert "municipal_intake_task" in tasks_config
    assert "description" in tasks_config["municipal_intake_task"]
