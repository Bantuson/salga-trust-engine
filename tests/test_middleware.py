"""Tests for security middleware.

This file contains both unit tests (sanitization, rate limit config)
and integration tests (middleware behavior with FastAPI app).

Integration tests require database setup and are marked with @pytest.mark.integration.
Run unit tests only with: pytest tests/test_middleware.py -m "not integration"
"""
import uuid

import pytest

from src.core.sanitization import sanitize_html, sanitize_text_field
from src.middleware.rate_limit import (
    API_DEFAULT_RATE_LIMIT,
    AUTH_RATE_LIMIT,
    DATA_EXPORT_RATE_LIMIT,
    REGISTER_RATE_LIMIT,
)


@pytest.mark.integration
class TestTenantMiddleware:
    """Test tenant context middleware (requires running app)."""

    def test_health_endpoint_no_tenant_required(self):
        """Health endpoint should work without X-Tenant-ID header."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_docs_endpoint_no_tenant_required(self):
        """Documentation endpoints should work without X-Tenant-ID header."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.get("/docs")
        assert response.status_code == 200

    def test_api_endpoint_requires_tenant(self):
        """API endpoints should require X-Tenant-ID header."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.get("/api/v1/users/me")
        assert response.status_code == 400
        assert "X-Tenant-ID" in response.json()["detail"]

    def test_api_endpoint_rejects_invalid_uuid(self):
        """API endpoints should reject non-UUID tenant IDs."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.get(
            "/api/v1/users/me",
            headers={"X-Tenant-ID": "not-a-uuid"}
        )
        assert response.status_code == 400
        assert "UUID" in response.json()["detail"]

    def test_api_endpoint_accepts_valid_tenant(self):
        """API endpoints should accept valid UUID tenant IDs."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        # This will fail at auth stage, not tenant stage (proving tenant check passed)
        response = client.get(
            "/api/v1/users/me",
            headers={"X-Tenant-ID": str(uuid.uuid4())}
        )
        # Should fail with 401 (unauthorized) not 400 (bad request)
        # This proves tenant middleware passed but auth failed
        assert response.status_code == 401


@pytest.mark.integration
class TestSecurityHeaders:
    """Test security headers middleware (requires running app)."""

    def test_security_headers_present(self):
        """All responses should include OWASP-recommended security headers."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200

        # Check all required security headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-XSS-Protection"] == "0"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "Permissions-Policy" in response.headers
        assert "Content-Security-Policy" in response.headers


@pytest.mark.integration
class TestCORS:
    """Test CORS configuration (requires running app)."""

    def test_cors_allows_configured_origin(self):
        """CORS should allow configured origins."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET"
            }
        )
        # CORS preflight should succeed
        assert response.status_code == 200

    def test_cors_rejects_unknown_origin(self):
        """CORS should reject origins not in ALLOWED_ORIGINS."""
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        response = client.get(
            "/health",
            headers={"Origin": "http://evil.com"}
        )
        # Request succeeds but no CORS headers for unknown origin
        assert response.status_code == 200
        # Access-Control-Allow-Origin should not be present or not match evil.com
        allow_origin = response.headers.get("Access-Control-Allow-Origin")
        if allow_origin:
            assert allow_origin != "http://evil.com"
            assert allow_origin != "*"  # Should never be wildcard


# Pure unit tests - no pytest mark, will run
class TestSanitization:
    """Test input sanitization utilities (pure unit tests)."""

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
    """Test rate limiting configuration (pure unit tests)."""

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
