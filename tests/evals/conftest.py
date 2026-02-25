"""
Pytest configuration for the eval test suite.

Sets up environment variables before CrewAI/LiteLLM imports to prevent
validation errors in tests that do not use real LLM API keys.
"""

import os

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
