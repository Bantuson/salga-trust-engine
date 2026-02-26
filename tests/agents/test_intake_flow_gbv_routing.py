"""Regression tests for SAPS-context GBV routing — Phase 10.3 Plan 10.

Validates that the _is_saps_context() heuristic correctly intercepts
adversarial phrasing where a citizen describes a GBV case using police/SAPS
terminology, which previously bypassed the GBV safety net and misrouted to
ticket_status (UAT gap GBV-4).

SEC-05: These tests guard the 5-layer GBV firewall. Failures here indicate
a regression in the safety layer that routes GBV victims to emergency services.

Tests:
  1. test_saps_context_routes_to_gbv — SAPS+personal-case messages → gbv, no LLM call
  2. test_standard_ticket_status_unaffected — ticket queries continue to route correctly
  3. test_generic_saps_mention_not_gbv — generic SAPS mentions don't trigger GBV routing
"""
import os
from unittest.mock import MagicMock, patch

import pytest

# Fake API keys MUST be set before any CrewAI import (per conftest pattern)
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_flow(message: str):
    """Create an IntakeFlow with state.message set for testing.

    Mirrors the pattern from test_intake_flow.py — set fields on the
    existing state object (Flow.state is a read-only property).
    """
    from src.agents.flows.intake_flow import IntakeFlow

    flow = IntakeFlow()
    flow.state.message = message
    flow.state.session_status = "active"
    flow.state.routing_phase = "manager"
    return flow


# ---------------------------------------------------------------------------
# Test 1: SAPS-context messages route to GBV (no LLM call made)
# ---------------------------------------------------------------------------

def test_saps_context_routes_to_gbv():
    """_classify_raw_intent() returns 'gbv' for SAPS+personal-case messages.

    SEC-05: Citizens describing a GBV case using police/officer terminology
    must reach the GBV agent. The LLM is NOT called — the deterministic
    heuristic short-circuits before the LLM import.
    """
    adversarial_messages = [
        "I want to know about the SAPS officers assigned to my case",
        "detective assigned to my report still hasn't called me back",
        "investigating officer handling my matter is unavailable",
    ]

    for message in adversarial_messages:
        flow = _make_flow(message)

        # Verify heuristic fires
        assert flow._is_saps_context(message) is True, (
            f"_is_saps_context() should return True for: {message!r}"
        )

        # Patch get_routing_llm at the source module — it must NOT be called.
        # The lazy import inside _classify_raw_intent() uses `from src.agents.llm import
        # get_routing_llm`; since the heuristic short-circuits before that line, the
        # mock will never be invoked.
        with patch("src.agents.llm.get_routing_llm") as mock_get_llm:
            result = flow._classify_raw_intent()

        assert result == "gbv", (
            f"Expected 'gbv' for SAPS-context message, got {result!r}: {message!r}"
        )
        # Confirm LLM was never instantiated (heuristic short-circuited before import)
        mock_get_llm.assert_not_called(), (
            f"get_routing_llm() should not be called for SAPS-context message: {message!r}"
        )


# ---------------------------------------------------------------------------
# Test 2: Standard ticket_status messages are unaffected
# ---------------------------------------------------------------------------

def test_standard_ticket_status_unaffected():
    """Standard ticket queries continue to route to ticket_status via LLM.

    Ensures the new heuristic does not interfere with legitimate ticket_status
    routing for messages that contain no SAPS-context.
    """
    ticket_messages = [
        "status of TKT-20240315-A1B2",
        "where is my complaint TKT-123",
    ]

    for message in ticket_messages:
        flow = _make_flow(message)

        # Verify heuristic does NOT fire
        assert flow._is_saps_context(message) is False, (
            f"_is_saps_context() should return False for ticket query: {message!r}"
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "ticket_status"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow._classify_raw_intent()

        assert result == "ticket_status", (
            f"Expected 'ticket_status' for ticket query, got {result!r}: {message!r}"
        )


# ---------------------------------------------------------------------------
# Test 3: Generic SAPS mentions do not trigger GBV routing
# ---------------------------------------------------------------------------

def test_generic_saps_mention_not_gbv():
    """Generic SAPS mentions without personal-case context return False.

    Prevents false positives: "report this to SAPS" is a legitimate municipal
    service query or general statement, not a GBV personal case.
    """
    generic_saps_messages = [
        "report pothole to SAPS",
        "sergeant at local station",
        "police are already aware",
    ]

    for message in generic_saps_messages:
        flow = _make_flow(message)

        assert flow._is_saps_context(message) is False, (
            f"_is_saps_context() should return False for generic SAPS mention: {message!r}"
        )
