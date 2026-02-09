"""Input validation and prompt injection detection for AI safety.

This module implements rule-based input filtering to prevent:
- Prompt injection attacks
- HTML/script injection (XSS)
- Empty or excessively long messages
- Suspicious content patterns

All filters are deterministic (no LLM calls) for performance and reliability.
"""
import re
from pydantic import BaseModel
import nh3


class InputValidationResult(BaseModel):
    """Result of input validation with safety verdict and detected issues.

    Attributes:
        is_safe: True if input passes all filters, False if blocked
        original_message: The original unmodified input
        sanitized_message: Input after sanitization (HTML stripped, etc.)
        flags: List of triggered filter names (warnings or blockers)
        blocked_reason: Human-readable explanation if blocked, None otherwise
    """

    is_safe: bool
    original_message: str
    sanitized_message: str
    flags: list[str] = []
    blocked_reason: str | None = None


def validate_input(message: str) -> InputValidationResult:
    """Validate citizen input through multiple safety filters.

    Applies filters in order:
    1. Length check (block >5000 chars)
    2. Empty check (block empty/whitespace-only)
    3. Prompt injection detection (block common patterns)
    4. HTML/script sanitization (strip tags, warn)
    5. Excessive special characters (flag suspicious content)

    Args:
        message: Raw citizen message

    Returns:
        InputValidationResult with safety verdict and flags
    """
    flags: list[str] = []
    is_safe = True
    blocked_reason = None
    sanitized = message

    # Filter 1: Length check
    if len(message) > 5000:
        flags.append("message_too_long")
        is_safe = False
        blocked_reason = "Message exceeds maximum length of 5000 characters"
        return InputValidationResult(
            is_safe=is_safe,
            original_message=message,
            sanitized_message=sanitized,
            flags=flags,
            blocked_reason=blocked_reason,
        )

    # Filter 2: Empty check
    if not message.strip():
        flags.append("empty_message")
        is_safe = False
        blocked_reason = "Message cannot be empty"
        return InputValidationResult(
            is_safe=is_safe,
            original_message=message,
            sanitized_message=sanitized,
            flags=flags,
            blocked_reason=blocked_reason,
        )

    # Filter 3: Prompt injection detection
    # Common prompt injection patterns (case-insensitive)
    injection_patterns = [
        r"ignore\s+previous\s+instructions",
        r"ignore\s+all\s+previous",
        r"you\s+are\s+now",
        r"new\s+instructions:",
        r"system\s+prompt:",
        r"forget\s+everything",
        r"disregard\s+all",
        r"act\s+as",
        r"pretend\s+you\s+are",
        r"jailbreak",
    ]

    message_lower = message.lower()
    for pattern in injection_patterns:
        if re.search(pattern, message_lower):
            flags.append("prompt_injection_detected")
            is_safe = False
            blocked_reason = (
                "Message contains suspicious patterns that may be attempting to "
                "manipulate the system. Please rephrase your message naturally."
            )
            return InputValidationResult(
                is_safe=is_safe,
                original_message=message,
                sanitized_message=sanitized,
                flags=flags,
                blocked_reason=blocked_reason,
            )

    # Filter 4: HTML/script injection sanitization
    # Use nh3 to strip HTML tags (already in dependencies)
    sanitized = nh3.clean(message)
    if sanitized != message:
        flags.append("html_stripped")
        # This is a warning, not a blocker

    # Filter 5: Excessive special characters
    # If message is >50% non-alphanumeric (excluding spaces and common punctuation)
    alphanumeric_count = sum(c.isalnum() or c.isspace() for c in sanitized)
    common_punctuation = set(".,!?;:'-\"")
    valid_chars = alphanumeric_count + sum(
        1 for c in sanitized if c in common_punctuation
    )

    if len(sanitized) > 0 and valid_chars / len(sanitized) < 0.5:
        flags.append("suspicious_content")
        # This is a warning, not a blocker

    return InputValidationResult(
        is_safe=is_safe,
        original_message=message,
        sanitized_message=sanitized,
        flags=flags,
        blocked_reason=blocked_reason,
    )
