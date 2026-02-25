"""Pure unit tests for security module (Supabase JWT verification).

These tests require NO database connection.

NOTE: Password hashing is now handled by Supabase Auth (not local code).
Custom JWT creation replaced by Supabase Auth JWTs with app_metadata.
See test_supabase_auth.py for comprehensive Supabase Auth integration tests.
"""
import os
from datetime import timedelta, datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import jwt
import pytest
from pydantic import ValidationError

# Set environment variables before importing settings
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret-for-unit-tests")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from src.api.v1.auth import _log_auth_event
from src.core.config import settings
from src.core.security import verify_supabase_token
from src.schemas.user import UserCreate


class TestSupabaseJWTVerification:
    """Test Supabase JWT token verification (local function)."""

    def test_verify_supabase_token_valid(self):
        """verify_supabase_token should decode valid token."""
        payload = {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "role": "authenticated",
            "email": "test@example.com",
            "app_metadata": {
                "role": "citizen",
                "tenant_id": str(uuid4()),
            },
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is not None
        assert result["sub"] == payload["sub"]
        assert result["email"] == payload["email"]
        assert result["app_metadata"]["role"] == "citizen"
        assert result["app_metadata"]["tenant_id"] == payload["app_metadata"]["tenant_id"]

    def test_verify_supabase_token_expired(self):
        """verify_supabase_token should return None for expired token."""
        payload = {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # Expired
        }

        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is None

    def test_verify_supabase_token_invalid_signature(self):
        """verify_supabase_token should return None for wrong secret."""
        payload = {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        # Sign with wrong secret
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is None

    def test_verify_supabase_token_wrong_audience(self):
        """verify_supabase_token should return None for wrong audience."""
        payload = {
            "sub": str(uuid4()),
            "aud": "public",  # Wrong audience (should be "authenticated")
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is None

    def test_verify_supabase_token_malformed(self):
        """verify_supabase_token should return None for malformed token."""
        result = verify_supabase_token("not-a-valid-jwt-token")

        assert result is None

    def test_verify_supabase_token_extracts_app_metadata(self):
        """verify_supabase_token should preserve app_metadata structure."""
        payload = {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "role": "authenticated",
            "email": "manager@example.com",
            "app_metadata": {
                "role": "manager",
                "tenant_id": str(uuid4()),
                "ward_id": "ward-123",  # Optional field
            },
            "user_metadata": {
                "full_name": "Test Manager",
                "preferred_language": "af",
            },
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is not None
        assert result["app_metadata"]["role"] == "manager"
        assert result["app_metadata"]["tenant_id"] == payload["app_metadata"]["tenant_id"]
        assert result["app_metadata"]["ward_id"] == "ward-123"
        assert result["user_metadata"]["full_name"] == "Test Manager"
        assert result["user_metadata"]["preferred_language"] == "af"


class TestPasswordValidation:
    """Test password complexity validation on UserCreate schema."""

    def test_password_min_length_12_accepted(self):
        """Password with 12+ chars and complexity requirements is accepted."""
        user = UserCreate(
            email="test@example.com",
            password="SecurePass12",
            full_name="Test User",
            municipality_code="JHB",
        )
        assert user.password == "SecurePass12"

    def test_password_below_12_chars_rejected(self):
        """Password shorter than 12 characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="test@example.com",
                password="Short1A",
                full_name="Test User",
                municipality_code="JHB",
            )
        assert "at least 12 characters" in str(exc_info.value).lower() or "ensure this value has at least 12" in str(exc_info.value).lower()

    def test_password_missing_uppercase_rejected(self):
        """Password without uppercase letter is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="test@example.com",
                password="alllowercase1",
                full_name="Test User",
                municipality_code="JHB",
            )
        assert "uppercase" in str(exc_info.value).lower()

    def test_password_missing_lowercase_rejected(self):
        """Password without lowercase letter is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="test@example.com",
                password="ALLUPPERCASE1",
                full_name="Test User",
                municipality_code="JHB",
            )
        assert "lowercase" in str(exc_info.value).lower()

    def test_password_missing_digit_rejected(self):
        """Password without digit is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="test@example.com",
                password="NoDigitsHere!",
                full_name="Test User",
                municipality_code="JHB",
            )
        assert "digit" in str(exc_info.value).lower()

    def test_password_multiple_failures_reported(self):
        """Multiple missing requirements reported in single error."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="test@example.com",
                password="nouppernodgt",
                full_name="Test User",
                municipality_code="JHB",
            )
        error_str = str(exc_info.value).lower()
        assert "uppercase" in error_str
        assert "digit" in error_str

    def test_password_symbols_not_required(self):
        """Password without symbols is accepted (symbols are optional)."""
        user = UserCreate(
            email="test@example.com",
            password="ValidPass1234",
            full_name="Test User",
            municipality_code="JHB",
        )
        assert user.password == "ValidPass1234"

    def test_password_max_length_128(self):
        """Password exceeding 128 characters is rejected."""
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                password="A" * 100 + "a" * 20 + "1" * 10,  # 130 chars
                full_name="Test User",
                municipality_code="JHB",
            )


class TestAuthEventLogging:
    """Test POPIA-safe auth event logging helper."""

    def test_log_auth_event_success_uses_info(self):
        """Success events logged at INFO level."""
        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.1"
        mock_request.headers.get.return_value = "Mozilla/5.0"

        with patch("src.api.v1.auth.logger") as mock_logger:
            _log_auth_event("login_success", mock_request, email_domain="example.com")
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            assert "login_success" in call_args[0][0]

    def test_log_auth_event_failure_uses_warning(self):
        """Failure events logged at WARNING level."""
        mock_request = MagicMock()
        mock_request.client.host = "10.0.0.1"
        mock_request.headers.get.return_value = "curl/7.0"

        with patch("src.api.v1.auth.logger") as mock_logger:
            _log_auth_event("login_failure", mock_request, reason="invalid_credentials")
            mock_logger.warning.assert_called_once()

    def test_log_auth_event_no_full_email(self):
        """Auth event logs email domain only, never full email."""
        mock_request = MagicMock()
        mock_request.client.host = "10.0.0.1"
        mock_request.headers.get.return_value = "test"

        with patch("src.api.v1.auth.logger") as mock_logger:
            _log_auth_event("login_success", mock_request, email_domain="example.com")
            call_kwargs = mock_logger.info.call_args[1]
            extra = call_kwargs.get("extra", {})
            assert extra.get("email_domain") == "example.com"
            # Verify no 'email' key in extra (only domain)
            assert "email" not in extra or extra.get("email") is None

    def test_log_auth_event_truncates_user_id(self):
        """User ID truncated to 8 chars for POPIA compliance."""
        mock_request = MagicMock()
        mock_request.client.host = "10.0.0.1"
        mock_request.headers.get.return_value = "test"

        full_uuid = "12345678-1234-1234-1234-123456789012"
        with patch("src.api.v1.auth.logger") as mock_logger:
            _log_auth_event("register_success", mock_request, user_id=full_uuid)
            call_kwargs = mock_logger.info.call_args[1]
            extra = call_kwargs.get("extra", {})
            assert extra.get("user_id") == "12345678..."
            assert full_uuid not in str(extra)

    def test_log_auth_event_handles_missing_client(self):
        """Handles request with no client (e.g., test environment)."""
        mock_request = MagicMock()
        mock_request.client = None
        mock_request.headers.get.return_value = "test"

        with patch("src.api.v1.auth.logger") as mock_logger:
            _log_auth_event("login_success", mock_request)
            call_kwargs = mock_logger.info.call_args[1]
            extra = call_kwargs.get("extra", {})
            assert extra.get("ip") == "unknown"

    def test_log_auth_event_truncates_user_agent(self):
        """User-agent truncated to 200 chars to prevent log injection."""
        mock_request = MagicMock()
        mock_request.client.host = "10.0.0.1"
        mock_request.headers.get.return_value = "A" * 500

        with patch("src.api.v1.auth.logger") as mock_logger:
            _log_auth_event("login_success", mock_request)
            call_kwargs = mock_logger.info.call_args[1]
            extra = call_kwargs.get("extra", {})
            assert len(extra.get("user_agent", "")) <= 200
