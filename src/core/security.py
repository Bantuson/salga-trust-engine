"""Security utilities for Supabase JWT token verification.

This module handles JWT token verification for Supabase Auth.
Password hashing is delegated to Supabase Auth service.
"""
from typing import Any

import jwt

from src.core.config import settings


def verify_supabase_token(token: str) -> dict[str, Any] | None:
    """Verify and decode a Supabase JWT access token.

    Args:
        token: JWT token string from Supabase Auth

    Returns:
        Decoded token payload if valid, containing:
        - sub: User ID (UUID)
        - email: User email
        - phone: User phone (optional)
        - app_metadata: Dict with role and tenant_id
        - user_metadata: Dict with custom user data
        Returns None if token is invalid or expired

    Example payload:
        {
            "sub": "uuid-here",
            "email": "user@example.com",
            "phone": "+27123456789",
            "app_metadata": {
                "role": "citizen",
                "tenant_id": "uuid-here"
            },
            "user_metadata": {
                "full_name": "John Doe",
                "preferred_language": "en"
            }
        }
    """
    if not settings.SUPABASE_JWT_SECRET:
        # Graceful degradation for tests without Supabase
        return None

    try:
        # Decode JWT with Supabase JWT secret
        # Algorithm: HS256 (symmetric)
        # Audience: "authenticated" (Supabase default for access tokens)
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )

        return payload

    except jwt.ExpiredSignatureError:
        # Token has expired
        return None
    except jwt.InvalidTokenError:
        # Token is invalid (bad signature, malformed, etc.)
        return None
    except Exception:
        # Catch-all for unexpected errors
        return None
