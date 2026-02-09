"""Pure unit tests for security module (JWT, password hashing, token validation).

These tests require NO database connection.
"""
import os
from datetime import timedelta

import jwt

# Set environment variables before importing settings
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-for-jwt-security")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from src.core.config import settings
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)


class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_password_hash_produces_argon2_string(self):
        """get_password_hash should produce argon2 hash string."""
        result = get_password_hash("test")
        assert result.startswith("$argon2")

    def test_password_hash_different_each_time(self):
        """get_password_hash should produce different hashes due to salt."""
        hash1 = get_password_hash("test")
        hash2 = get_password_hash("test")
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """verify_password should return True for correct password."""
        password = "securepassword123"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """verify_password should return False for incorrect password."""
        password = "securepassword123"
        hashed = get_password_hash(password)
        assert verify_password("wrongpassword", hashed) is False


class TestAccessToken:
    """Test JWT access token creation and validation."""

    def test_create_access_token_contains_claims(self):
        """create_access_token should contain all required claims."""
        data = {
            "sub": "user-123",
            "tenant_id": "tenant-456",
            "role": "admin"
        }
        token = create_access_token(data)

        # Decode manually with PyJWT to inspect claims
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        assert payload["sub"] == "user-123"
        assert payload["tenant_id"] == "tenant-456"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload

    def test_create_access_token_custom_expiry(self):
        """create_access_token should respect custom expires_delta."""
        data = {"sub": "user-123", "tenant_id": "tenant-456", "role": "admin"}
        custom_delta = timedelta(minutes=10)
        token = create_access_token(data, expires_delta=custom_delta)

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # Check that exp is roughly 10 minutes from iat (allow 2 second tolerance)
        exp_delta = payload["exp"] - payload["iat"]
        expected_seconds = custom_delta.total_seconds()
        assert abs(exp_delta - expected_seconds) < 2

    def test_decode_access_token_valid(self):
        """decode_access_token should decode valid access token."""
        data = {"sub": "user-123", "tenant_id": "tenant-456", "role": "citizen"}
        token = create_access_token(data)

        payload = decode_access_token(token)

        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["tenant_id"] == "tenant-456"
        assert payload["role"] == "citizen"
        assert payload["type"] == "access"

    def test_decode_access_token_rejects_refresh(self):
        """decode_access_token should reject refresh tokens."""
        data = {"sub": "user-123", "tenant_id": "tenant-456", "role": "admin"}
        refresh_token = create_refresh_token(data)

        payload = decode_access_token(refresh_token)

        assert payload is None

    def test_decode_access_token_expired(self):
        """decode_access_token should return None for expired token."""
        data = {"sub": "user-123", "tenant_id": "tenant-456", "role": "admin"}
        # Create token that expired 1 second ago
        token = create_access_token(data, expires_delta=timedelta(seconds=-1))

        payload = decode_access_token(token)

        assert payload is None


class TestRefreshToken:
    """Test JWT refresh token creation and validation."""

    def test_create_refresh_token_type_is_refresh(self):
        """create_refresh_token should have type='refresh'."""
        data = {"sub": "user-123", "tenant_id": "tenant-456", "role": "admin"}
        token = create_refresh_token(data)

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-123"

    def test_decode_refresh_token_rejects_access(self):
        """decode_refresh_token should reject access tokens."""
        data = {"sub": "user-123", "tenant_id": "tenant-456", "role": "admin"}
        access_token = create_access_token(data)

        payload = decode_refresh_token(access_token)

        assert payload is None
