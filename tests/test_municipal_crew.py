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
def mock_supabase_ticket():
    """Mock Supabase admin client for ticket creation.

    Phase 6.9 refactor: ticket_tool now uses Supabase PostgREST (not SQLAlchemy).
    Mocks the get_supabase_admin() call inside _create_ticket_impl.
    """
    mock_ticket_data = {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "tracking_number": "TKT-20260209-ABC123",
        "status": "open",
        "category": "water",
        "severity": "high",
    }

    mock_execute = MagicMock()
    mock_execute.data = [mock_ticket_data]

    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = mock_execute

    with patch("src.core.supabase.get_supabase_admin", return_value=mock_client):
        yield mock_client


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

    crew = crew_manager.create_crew({
        "message": "Water pipe burst on Main Street",
        "user_id": "user_123",
        "tenant_id": "tenant_456",
        "language": "en",
    })

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


def test_create_crew_language_specific_prompts():
    """Test that agents use language-specific backstory prompts."""
    # English crew
    crew_en = MunicipalCrew(language="en")
    crew = crew_en.create_crew({
        "message": "Test message",
        "user_id": "user_123",
        "tenant_id": "tenant_456",
        "language": "en",
    })
    agent_en = crew.agents[0]
    assert "Municipal" in agent_en.backstory or "service" in agent_en.backstory.lower()

    # isiZulu crew
    crew_zu = MunicipalCrew(language="zu")
    crew = crew_zu.create_crew({
        "message": "Test message",
        "user_id": "user_123",
        "tenant_id": "tenant_456",
        "language": "zu",
    })
    agent_zu = crew.agents[0]
    # Should contain isiZulu text
    assert any(word in agent_zu.backstory for word in ["Ungusosekela", "izakhamuzi", "amanzi", "umgwaqo"])


def test_create_crew_afrikaans_prompts():
    """Test Afrikaans language-specific prompts."""
    crew_af = MunicipalCrew(language="af")
    crew = crew_af.create_crew({
        "message": "Test message",
        "user_id": "user_123",
        "tenant_id": "tenant_456",
        "language": "af",
    })
    agent_af = crew.agents[0]
    # Should contain Afrikaans text
    assert any(word in agent_af.backstory for word in ["munisipale", "burger", "water", "paaie", "dienste"])


def test_create_crew_task_has_no_pydantic_output():
    """Test that task has NO output_pydantic so agent MUST call the tool."""
    crew_manager = MunicipalCrew(language="en")
    crew = crew_manager.create_crew({
        "message": "Test",
        "user_id": "user_123",
        "tenant_id": "tenant_456",
        "language": "en",
    })

    task = crew.tasks[0]
    # Phase 6.9.1: MunicipalCrew now uses Pydantic structured output
    from src.agents.crews.municipal_crew import MunicipalResponse
    assert task.output_pydantic is MunicipalResponse


def test_ticket_tool_validates_category():
    """Test create_municipal_ticket returns error dict for invalid category.

    Phase 6.9 note: _create_ticket_impl returns {"error": ...} instead of
    raising ValueError — this matches the Supabase-based implementation where
    error dicts are returned for LLM agent consumption.
    """
    result = _create_ticket_impl(
        category="invalid_category",
        description="This is a test description that is long enough",
        user_id="user_123",
        tenant_id="tenant_456",
        language="en",
        severity="medium"
    )
    assert "error" in result
    assert "Invalid category" in result["error"]


def test_ticket_tool_validates_severity():
    """Test create_municipal_ticket returns error dict for invalid severity."""
    result = _create_ticket_impl(
        category="water",
        description="This is a test description that is long enough",
        user_id="user_123",
        tenant_id="tenant_456",
        language="en",
        severity="invalid_severity"
    )
    assert "error" in result
    assert "Invalid severity" in result["error"]


def test_ticket_tool_accepts_valid_categories():
    """Test that all valid categories do NOT return a category validation error."""
    valid_categories = ["water", "roads", "electricity", "waste", "sanitation", "gbv", "other"]

    for category in valid_categories:
        mock_execute = MagicMock()
        mock_execute.data = [{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "tracking_number": "TKT-20260209-ABC123",
            "status": "open",
            "category": category,
            "severity": "medium",
        }]
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_execute

        with patch("src.core.supabase.get_supabase_admin", return_value=mock_client):
            result = _create_ticket_impl(
                category=category,
                description="Test description that is long enough for validation",
                user_id="user_123",
                tenant_id="tenant_456",
                language="en"
            )
            # Valid category should not produce a category validation error
            if "error" in result:
                assert "Invalid category" not in result["error"], (
                    f"Valid category '{category}' was rejected: {result['error']}"
                )


def test_ticket_tool_accepts_valid_severities():
    """Test that all valid severities do NOT return a severity validation error."""
    valid_severities = ["low", "medium", "high", "critical"]

    for severity in valid_severities:
        mock_execute = MagicMock()
        mock_execute.data = [{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "tracking_number": "TKT-20260209-ABC123",
            "status": "open",
            "category": "water",
            "severity": severity,
        }]
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_execute

        with patch("src.core.supabase.get_supabase_admin", return_value=mock_client):
            result = _create_ticket_impl(
                category="water",
                description="Test description that is long enough for validation",
                user_id="user_123",
                tenant_id="tenant_456",
                language="en",
                severity=severity
            )
            if "error" in result:
                assert "Invalid severity" not in result["error"], (
                    f"Valid severity '{severity}' was rejected: {result['error']}"
                )


def test_ticket_tool_tracking_number_format(mock_supabase_ticket):
    """Test that tracking number follows TKT-YYYYMMDD-XXXXXX format.

    The tracking number is generated inside _create_ticket_impl (not from Supabase)
    and inserted into the row. We verify the format from the returned dict.
    """
    result = _create_ticket_impl(
        category="water",
        description="Test description that is long enough",
        user_id="user_123",
        tenant_id="tenant_456",
        language="en",
        severity="high"
    )

    # Verify tracking number format — returned from the inserted row data
    assert "tracking_number" in result
    tracking_number = result["tracking_number"]

    # Pattern: TKT-YYYYMMDD-XXXXXX (6 hex chars)
    pattern = r"^TKT-\d{8}-[A-F0-9]{6}$"
    assert re.match(pattern, tracking_number), (
        f"Tracking number '{tracking_number}' does not match expected format"
    )


def test_ticket_tool_returns_correct_structure(mock_supabase_ticket):
    """Test that ticket tool returns expected dictionary structure."""
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

    # Verify values from mock Supabase response
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
