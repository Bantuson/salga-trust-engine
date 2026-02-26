"""
Pytest configuration for the eval test suite.

Sets up environment variables before CrewAI/LiteLLM imports to prevent
validation errors in tests that do not use real LLM API keys.
"""

import os
from pathlib import Path

import pytest

# Must be set before any CrewAI/deepeval/LiteLLM imports to suppress
# "No API key" validation errors during unit/eval test collection.
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-deepseek-key-for-tests")


@pytest.fixture
def tool_calls_captured():
    """Mutable list for step_callback to append tool calls."""
    return []


def make_step_callback(capture_list: list) -> callable:
    """
    Factory for CrewAI step_callback that captures tool calls.

    Usage:
        tool_calls = []
        crew = SomeCrew()
        crew.step_callback = make_step_callback(tool_calls)
        crew.kickoff(inputs={...})
        assert "lookup_user_tool" in tool_calls
    """

    def callback(step_output) -> None:
        if hasattr(step_output, "tool") and step_output.tool:
            capture_list.append(step_output.tool)

    return callback


@pytest.fixture
def playwright_judge():
    """PlaywrightJudge instance for eval tests.

    Creates a PlaywrightJudge pointed at the default local servers.
    Tests that drive actual Playwright interactions must provide
    send_message_fn, read_response_fn, and reset_session_fn callbacks.

    Usage:
        def test_something(playwright_judge):
            summary = playwright_judge.run_agent_eval(
                "auth",
                send_message_fn=...,
                read_response_fn=...,
                reset_session_fn=...,
            )
    """
    from tests.evals.playwright_judge import PlaywrightJudge

    return PlaywrightJudge()


@pytest.fixture
def eval_report_dir() -> Path:
    """Return the path to the eval reports directory.

    The directory is created if it does not exist.
    """
    reports_dir = Path(__file__).parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir
