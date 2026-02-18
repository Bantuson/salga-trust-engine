"""Unit tests for TicketStatusCrew and lookup_ticket tool.

Tests cover:
- TicketStatusCrew instantiation (agent_key, task_key, memory_enabled=False)
- Tools list contains lookup_ticket
- _lookup_ticket_impl requires user_id (AssertionError on empty)
- _lookup_ticket_impl scopes queries by user_id
- GBV tickets return minimal info (SEC-05 pattern)
- Tracking number filter is applied when provided
- get_error_response format with Gugu identity

Note on Supabase mocking:
    get_supabase_admin is imported INSIDE _lookup_ticket_impl (inside the try block),
    not at module level. Therefore we must patch the source module:
    `src.core.supabase.get_supabase_admin` — not the ticket_lookup_tool module.
"""
import os
from unittest.mock import MagicMock, patch

import pytest

# Set fake OpenAI API key for CrewAI Agent initialization compatibility
os.environ.setdefault("OPENAI_API_KEY", "sk-fake-key-for-unit-tests-only")

from src.agents.crews.ticket_status_crew import TicketStatusCrew
from src.agents.tools.ticket_lookup_tool import _lookup_ticket_impl

# Patch target: where get_supabase_admin is DEFINED (imported inside function)
SUPABASE_PATCH = "src.core.supabase.get_supabase_admin"


def _make_supabase_mock(data: list) -> MagicMock:
    """Build a Supabase client mock returning `data` from .execute().

    Mocks the full chain:
        client.table().select().eq().order().limit().execute()

    If tracking_number filter is applied:
        client.table().select().eq().order().limit().eq().execute()

    The mock uses MagicMock's auto-chaining so .eq() returns the same mock
    at each level, making both filter cases work without separate setup.
    """
    mock_execute_result = MagicMock()
    mock_execute_result.data = data

    # Use a single chainable mock — MagicMock returns new MagicMocks for
    # attribute access and calls, so chaining works automatically.
    # We only need to make .execute() return our result at the end.
    mock_client = MagicMock()
    (
        mock_client
        .table.return_value
        .select.return_value
        .eq.return_value           # .eq("user_id", ...)
        .order.return_value
        .limit.return_value
        .eq.return_value           # .eq("tracking_number", ...) — optional second eq
        .execute.return_value
    ) = mock_execute_result

    # Also wire the non-tracking-number path (limit.execute directly)
    (
        mock_client
        .table.return_value
        .select.return_value
        .eq.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
    ) = mock_execute_result

    return mock_client


class TestTicketStatusCrewInstantiation:
    """Test TicketStatusCrew initialization and class attributes."""

    def test_ticket_status_crew_instantiation(self):
        """Verify TicketStatusCrew instantiates with correct agent/task keys."""
        mock_llm = MagicMock()
        crew = TicketStatusCrew(language="en", llm=mock_llm)

        assert crew.agent_key == "ticket_status_agent"
        assert crew.task_key == "ticket_status_task"
        assert crew.memory_enabled is False

    def test_ticket_status_crew_has_lookup_tool(self):
        """Tools list must contain the lookup_ticket tool."""
        mock_llm = MagicMock()
        crew = TicketStatusCrew(language="en", llm=mock_llm)

        tool_names = [tool.name for tool in crew.tools]
        assert "lookup_ticket" in tool_names

    def test_ticket_status_crew_invalid_language_falls_back(self):
        """Invalid language code falls back to 'en'."""
        mock_llm = MagicMock()
        crew = TicketStatusCrew(language="xx", llm=mock_llm)
        assert crew.language == "en"

    def test_ticket_status_crew_error_response_mentions_gugu(self):
        """get_error_response must mention Gugu and tracking number guidance."""
        mock_llm = MagicMock()
        crew = TicketStatusCrew(language="en", llm=mock_llm)

        response = crew.get_error_response(Exception("Supabase timeout"))

        assert isinstance(response, dict)
        assert "error" in response
        assert "message" in response
        assert "Gugu" in response["message"], (
            "Error response must mention Gugu for brand identity"
        )
        # Should also guide about tracking number
        assert "tracking" in response["message"].lower() or "report" in response["message"].lower()


class TestLookupTicketImplSecurity:
    """Test _lookup_ticket_impl security requirements."""

    def test_requires_user_id_raises_assertion_on_empty_string(self):
        """_lookup_ticket_impl raises AssertionError when user_id is empty string."""
        with pytest.raises(AssertionError):
            _lookup_ticket_impl(user_id="")

    def test_requires_user_id_raises_assertion_on_none(self):
        """_lookup_ticket_impl raises AssertionError when user_id is falsy."""
        with pytest.raises(AssertionError):
            _lookup_ticket_impl(user_id=None)  # type: ignore

    def test_user_id_scoped_query(self):
        """_lookup_ticket_impl calls .eq('user_id', user_id) on the query."""
        mock_client = _make_supabase_mock(data=[])

        with patch(SUPABASE_PATCH, return_value=mock_client):
            result = _lookup_ticket_impl(user_id="user-uuid-123")

        # Verify .eq() was called with user_id scope — on select().eq(...)
        mock_client.table.return_value.select.return_value.eq.assert_called_with(
            "user_id", "user-uuid-123"
        )
        assert result == {"tickets": [], "count": 0, "total": 0}

    def test_tracking_number_filter_applied_when_provided(self):
        """_lookup_ticket_impl calls .eq('tracking_number', ...) when tracking_number given."""
        mock_client = _make_supabase_mock(data=[])

        with patch(SUPABASE_PATCH, return_value=mock_client):
            _lookup_ticket_impl(
                user_id="user-uuid-123",
                tracking_number="TKT-20260218-A1B2C3"
            )

        # Tracking number filter is applied after limit() — verify the second .eq()
        limit_mock = (
            mock_client
            .table.return_value
            .select.return_value
            .eq.return_value
            .order.return_value
            .limit.return_value
        )
        limit_mock.eq.assert_called_once_with("tracking_number", "TKT-20260218-A1B2C3")


class TestLookupTicketImplGBVMinimalInfo:
    """Test GBV / sensitive ticket SEC-05 minimal info pattern."""

    def test_gbv_ticket_returns_minimal_info_only(self):
        """Sensitive tickets return 'sensitive report' category and helpline numbers."""
        sensitive_ticket = {
            "tracking_number": "TKT-20260218-GBVABC",
            "category": "gbv",
            "status": "open",
            "severity": "critical",
            "address": "123 Private Street, Cape Town",
            "is_sensitive": True,
            "created_at": "2026-02-18T10:00:00Z",
            "updated_at": "2026-02-18T10:00:00Z",
            "resolved_at": None,
            "first_responded_at": None,
            "escalated_at": None,
        }

        mock_client = _make_supabase_mock(data=[sensitive_ticket])

        with patch(SUPABASE_PATCH, return_value=mock_client):
            result = _lookup_ticket_impl(user_id="user-uuid-123")

        assert result["count"] == 1
        ticket = result["tickets"][0]

        # SEC-05: Category must be sanitized to "sensitive report"
        assert ticket["category"] == "sensitive report", (
            "GBV ticket must show 'sensitive report' not actual category"
        )

        # SEC-05: Must include SAPS helpline numbers
        assert "10111" in ticket.get("note", ""), "SAPS 10111 must be in GBV ticket note"
        assert "0800 150 150" in ticket.get("note", ""), "GBV helpline must be in note"

        # SEC-05: Must NOT expose address, description, or severity
        assert "address" not in ticket, "GBV ticket must NOT expose address"
        assert "description" not in ticket, "GBV ticket must NOT expose description"
        assert "severity" not in ticket, "GBV ticket must NOT expose severity"

    def test_non_sensitive_ticket_returns_full_info(self):
        """Standard municipal tickets return all status fields."""
        standard_ticket = {
            "tracking_number": "TKT-20260218-WATER1",
            "category": "water",
            "status": "open",
            "severity": "high",
            "address": "45 Jan Smuts Ave",
            "is_sensitive": False,
            "created_at": "2026-02-18T10:00:00Z",
            "updated_at": "2026-02-18T10:00:00Z",
            "resolved_at": None,
            "first_responded_at": None,
            "escalated_at": None,
        }

        mock_client = _make_supabase_mock(data=[standard_ticket])

        with patch(SUPABASE_PATCH, return_value=mock_client):
            result = _lookup_ticket_impl(user_id="user-uuid-123")

        ticket = result["tickets"][0]

        # Standard ticket: real category, full fields
        assert ticket["category"] == "water"
        assert ticket["status"] == "open"
        assert ticket["address"] == "45 Jan Smuts Ave"
        assert ticket["severity"] == "high"


class TestLookupTicketImplClientNotConfigured:
    """Test graceful handling when Supabase client is None."""

    def test_returns_error_dict_when_client_not_configured(self):
        """Returns error dict (not exception) when Supabase not configured."""
        with patch(SUPABASE_PATCH, return_value=None):
            result = _lookup_ticket_impl(user_id="user-uuid-123")

        assert "error" in result
        assert result["tickets"] == []
        assert result["count"] == 0
