"""Guardrails engine for wrapping agent interactions with safety filters.

This module provides the GuardrailsEngine class that orchestrates input validation
and output sanitization around agent calls. It implements the defense-in-depth
pattern recommended in Phase 2 research.
"""
import logging
from typing import Any, Callable

from src.guardrails.input_filters import InputValidationResult, validate_input
from src.guardrails.output_filters import OutputSanitizationResult, sanitize_output

logger = logging.getLogger(__name__)


class GuardrailsEngine:
    """Engine for applying input/output guardrails to agent interactions.

    This class wraps agent calls with:
    1. Input validation (prompt injection detection, sanitization)
    2. Agent execution (only if input passes validation)
    3. Output sanitization (PII masking, system info removal)

    All filtering is rule-based (no LLM calls) for performance and reliability.
    """

    def __init__(self):
        """Initialize guardrails engine.

        No configuration needed for rule-based implementation.
        For future LLM-based guardrails (NeMo, etc.), add config here.
        """
        logger.info("GuardrailsEngine initialized (rule-based filtering)")

    async def process_input(self, message: str) -> InputValidationResult:
        """Process and validate citizen input.

        Args:
            message: Raw citizen message

        Returns:
            InputValidationResult with safety verdict and flags
        """
        result = validate_input(message)

        if not result.is_safe:
            logger.warning(
                f"Input blocked by guardrails: {result.blocked_reason}",
                extra={
                    "flags": result.flags,
                    "message_length": len(message),
                },
            )

        if result.flags:
            logger.info(
                f"Input flags detected: {', '.join(result.flags)}",
                extra={"flags": result.flags},
            )

        return result

    async def process_output(self, response: str) -> OutputSanitizationResult:
        """Sanitize agent output to remove PII and system information.

        Args:
            response: Raw agent response

        Returns:
            OutputSanitizationResult with sanitized response and redaction log
        """
        result = sanitize_output(response)

        if result.redactions:
            logger.info(
                f"Output sanitized: {', '.join(result.redactions)}",
                extra={
                    "redactions": result.redactions,
                    "original_length": len(response),
                    "sanitized_length": len(result.sanitized_response),
                },
            )

        return result

    async def safe_agent_call(
        self,
        agent_func: Callable,
        message: str,
        **kwargs: Any
    ) -> dict[str, Any]:
        """Execute agent function with input/output guardrails.

        This is the main entry point for safe agent interactions:
        1. Validate input
        2. Call agent function if input is safe
        3. Sanitize output
        4. Return result with metadata

        Args:
            agent_func: Agent function to call (must accept message as first arg)
            message: Raw citizen message
            **kwargs: Additional arguments to pass to agent_func

        Returns:
            Dictionary with:
            - response: Sanitized agent response (or error message)
            - blocked: True if input was blocked, False otherwise
            - input_flags: List of input validation flags
            - output_redactions: List of output redactions (if agent called)
        """
        # Step 1: Validate input
        input_result = await self.process_input(message)

        if not input_result.is_safe:
            return {
                "response": input_result.blocked_reason or "Message blocked by safety filters",
                "blocked": True,
                "input_flags": input_result.flags,
                "output_redactions": [],
            }

        # Step 2: Call agent function with sanitized message
        try:
            agent_response = await agent_func(input_result.sanitized_message, **kwargs)
        except Exception as e:
            logger.error(
                f"Agent function raised exception: {e}",
                exc_info=True,
            )
            return {
                "response": "I apologize, but I encountered an error processing your request. Please try again.",
                "blocked": False,
                "input_flags": input_result.flags,
                "output_redactions": [],
                "error": str(e),
            }

        # Step 3: Sanitize output
        # Handle different response types (string, dict, etc.)
        if isinstance(agent_response, dict):
            response_text = agent_response.get("response", str(agent_response))
        else:
            response_text = str(agent_response)

        output_result = await self.process_output(response_text)

        # Step 4: Return result
        return {
            "response": output_result.sanitized_response,
            "blocked": False,
            "input_flags": input_result.flags,
            "output_redactions": output_result.redactions,
        }


# Module-level singleton for convenient imports
guardrails_engine = GuardrailsEngine()
