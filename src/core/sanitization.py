"""Input sanitization utilities to prevent XSS and injection attacks."""
from typing import Annotated

import nh3
from pydantic import BeforeValidator


def sanitize_html(text: str) -> str:
    """Strip ALL HTML tags from text to prevent XSS.

    Args:
        text: Input text that may contain HTML

    Returns:
        Text with all HTML tags removed

    Example:
        >>> sanitize_html("<script>alert('xss')</script>Hello")
        "Hello"
    """
    if not text:
        return text
    # nh3.clean with empty tags set strips all HTML
    return nh3.clean(text, tags=set())


def sanitize_text_field(text: str, max_length: int = 5000) -> str:
    """Sanitize and normalize text field.

    Args:
        text: Input text
        max_length: Maximum allowed length

    Returns:
        Sanitized text, stripped of HTML, whitespace normalized, truncated
    """
    if not text:
        return text

    # Strip HTML tags
    sanitized = sanitize_html(text)

    # Normalize whitespace
    sanitized = sanitized.strip()

    # Truncate to max length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    return sanitized


def SanitizedStr(max_length: int = 5000):
    """Create a Pydantic field type that auto-sanitizes string input.

    Use in schemas to automatically sanitize user input:

    Example:
        class MySchema(BaseModel):
            title: SanitizedStr(200) = Field(...)
            description: SanitizedStr() = Field(...)

    Args:
        max_length: Maximum allowed length for the field

    Returns:
        Annotated string type with sanitization validator
    """
    return Annotated[
        str,
        BeforeValidator(lambda v: sanitize_text_field(v, max_length))
    ]
