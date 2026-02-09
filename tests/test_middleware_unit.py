"""Unit tests for security middleware components.

These are pure unit tests that don't require database or FastAPI app.
"""
from src.core.sanitization import sanitize_html, sanitize_text_field
from src.middleware.rate_limit import (
    API_DEFAULT_RATE_LIMIT,
    AUTH_RATE_LIMIT,
    DATA_EXPORT_RATE_LIMIT,
    REGISTER_RATE_LIMIT,
)


class TestSanitization:
    """Test input sanitization utilities."""

    def test_sanitize_html_strips_script_tags(self):
        """sanitize_html should strip script tags completely."""
        result = sanitize_html("<script>alert('xss')</script>Hello")
        assert "script" not in result.lower()
        assert "alert" not in result.lower()
        assert "Hello" in result

    def test_sanitize_html_strips_all_tags(self):
        """sanitize_html should strip all HTML tags."""
        result = sanitize_html("<p><b>Bold</b> and <i>italic</i></p>")
        assert "<p>" not in result
        assert "<b>" not in result
        assert "<i>" not in result
        assert "Bold" in result
        assert "italic" in result

    def test_sanitize_preserves_text(self):
        """sanitize_html should preserve normal text."""
        text = "Normal text without HTML"
        result = sanitize_html(text)
        assert result == text

    def test_sanitize_text_field_truncates(self):
        """sanitize_text_field should truncate to max_length."""
        long_text = "a" * 10000
        result = sanitize_text_field(long_text, max_length=100)
        assert len(result) == 100

    def test_sanitize_text_field_strips_whitespace(self):
        """sanitize_text_field should strip leading/trailing whitespace."""
        result = sanitize_text_field("  hello  world  ")
        assert result == "hello  world"

    def test_sanitize_handles_empty_string(self):
        """sanitize functions should handle empty strings."""
        assert sanitize_html("") == ""
        assert sanitize_text_field("") == ""


class TestRateLimiting:
    """Test rate limiting configuration."""

    def test_rate_limit_format_valid(self):
        """Rate limit constants should be valid format strings."""
        # Valid format: "N/unit" where unit is second, minute, hour, day
        limits = [
            AUTH_RATE_LIMIT,
            REGISTER_RATE_LIMIT,
            API_DEFAULT_RATE_LIMIT,
            DATA_EXPORT_RATE_LIMIT,
        ]

        for limit in limits:
            # Should contain a slash
            assert "/" in limit, f"Invalid rate limit format: {limit}"

            # Should have number before slash
            parts = limit.split("/")
            assert len(parts) == 2, f"Invalid rate limit format: {limit}"
            assert parts[0].isdigit(), f"Rate limit should start with number: {limit}"

            # Should have valid time unit
            assert parts[1] in ["second", "minute", "hour", "day"], \
                f"Invalid time unit: {limit}"
