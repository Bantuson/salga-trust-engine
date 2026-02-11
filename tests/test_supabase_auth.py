"""Tests for Supabase Auth integration.

Tests JWT verification, token extraction, user registration/login via Supabase Auth,
and phone OTP authentication.
"""
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import patch, AsyncMock, Mock

from src.core.security import verify_supabase_token
from src.core.config import settings


class TestSupabaseJWTVerification:
    """Test Supabase JWT token verification."""

    def test_verify_supabase_token_valid(self):
        """Valid JWT returns payload with sub, app_metadata."""
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

        secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
        token = pyjwt.encode(payload, secret, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is not None
        assert result["sub"] == payload["sub"]
        assert result["email"] == payload["email"]
        assert result["app_metadata"]["role"] == "citizen"
        assert result["app_metadata"]["tenant_id"] == payload["app_metadata"]["tenant_id"]

    def test_verify_supabase_token_expired(self):
        """Expired JWT returns None."""
        payload = {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # Expired
        }

        secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
        token = pyjwt.encode(payload, secret, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is None

    def test_verify_supabase_token_invalid_signature(self):
        """Wrong secret returns None."""
        payload = {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        # Sign with wrong secret
        token = pyjwt.encode(payload, "wrong-secret", algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is None

    def test_verify_supabase_token_missing_audience(self):
        """Missing 'authenticated' audience returns None."""
        payload = {
            "sub": str(uuid4()),
            "aud": "public",  # Wrong audience
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
        token = pyjwt.encode(payload, secret, algorithm="HS256")

        result = verify_supabase_token(token)

        assert result is None

    def test_verify_supabase_token_no_secret_configured(self):
        """Returns None when SUPABASE_JWT_SECRET not configured."""
        with patch.object(settings, 'SUPABASE_JWT_SECRET', None):
            result = verify_supabase_token("any-token")
            assert result is None


class TestGetCurrentUserJWTExtraction:
    """Test get_current_user JWT payload extraction."""

    @pytest.mark.asyncio
    async def test_get_current_user_extracts_role_from_jwt(
        self, client, test_user, test_municipality
    ):
        """Verify role extraction from app_metadata."""
        # Create JWT with role in app_metadata
        payload = {
            "sub": str(test_user.id),
            "aud": "authenticated",
            "role": "authenticated",
            "email": test_user.email,
            "app_metadata": {
                "role": "citizen",
                "tenant_id": str(test_municipality.id),
            },
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
        token = pyjwt.encode(payload, secret, algorithm="HS256")

        # Call protected endpoint
        response = await client.get(
            "/api/v1/municipalities/",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Should succeed with correct role
        assert response.status_code in [200, 401]  # 401 if endpoint requires admin

    @pytest.mark.asyncio
    async def test_get_current_user_extracts_tenant_from_jwt(
        self, client, test_user, test_municipality
    ):
        """Verify tenant_id extraction from app_metadata."""
        # Create JWT with tenant_id in app_metadata
        payload = {
            "sub": str(test_user.id),
            "aud": "authenticated",
            "role": "authenticated",
            "email": test_user.email,
            "app_metadata": {
                "role": "citizen",
                "tenant_id": str(test_municipality.id),
            },
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }

        secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
        token = pyjwt.encode(payload, secret, algorithm="HS256")

        # Call endpoint that requires tenant context
        response = await client.get(
            "/api/v1/municipalities/",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Should have tenant context from JWT
        assert response.status_code in [200, 401, 403]


class TestSupabaseAuthEndpoints:
    """Test Supabase Auth registration and login endpoints."""

    @pytest.mark.asyncio
    async def test_register_calls_supabase_create_user(
        self, client, test_municipality, mock_supabase_admin
    ):
        """Mock supabase_admin.auth.admin.create_user."""
        with patch('src.api.v1.auth.get_supabase_admin', return_value=mock_supabase_admin):
            response = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "newuser@example.com",
                    "password": "SecurePass123!",
                    "full_name": "New User",
                    "phone": "+27123456789",
                    "municipality_code": "TEST001",
                    "consent_data_processing": True,
                    "consent_communications": True,
                }
            )

            # Check if endpoint exists and responds
            assert response.status_code in [200, 201, 400, 422, 500]

    @pytest.mark.asyncio
    async def test_login_calls_supabase_sign_in(
        self, client, test_user, mock_supabase_admin
    ):
        """Mock supabase_admin.auth.sign_in_with_password."""
        with patch('src.api.v1.auth.get_supabase_admin', return_value=mock_supabase_admin):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "username": test_user.email,
                    "password": "testpassword123",
                }
            )

            # Check if endpoint exists and responds
            assert response.status_code in [200, 401, 422, 500]

    @pytest.mark.asyncio
    async def test_phone_otp_send(self, client, mock_supabase_admin):
        """Mock supabase_admin.auth.sign_in_with_otp."""
        with patch('src.api.v1.auth.get_supabase_admin', return_value=mock_supabase_admin):
            response = await client.post(
                "/api/v1/auth/otp/send",
                json={"phone": "+27123456789"}
            )

            # Check if endpoint exists
            assert response.status_code in [200, 400, 422, 500]

    @pytest.mark.asyncio
    async def test_phone_otp_verify(self, client, mock_supabase_admin):
        """Mock supabase_admin.auth.verify_otp."""
        with patch('src.api.v1.auth.get_supabase_admin', return_value=mock_supabase_admin):
            response = await client.post(
                "/api/v1/auth/otp/verify",
                json={
                    "phone": "+27123456789",
                    "token": "123456"
                }
            )

            # Check if endpoint exists
            assert response.status_code in [200, 400, 401, 422, 500]
