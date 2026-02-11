"""Pure unit tests for security module (Supabase JWT verification).

These tests require NO database connection.

NOTE: Password hashing is now handled by Supabase Auth (not local code).
Custom JWT creation replaced by Supabase Auth JWTs with app_metadata.
See test_supabase_auth.py for comprehensive Supabase Auth integration tests.
"""
import os
from datetime import timedelta, datetime, timezone
from uuid import uuid4

import jwt

# Set environment variables before importing settings
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret-for-unit-tests")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from src.core.config import settings
from src.core.security import verify_supabase_token


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
