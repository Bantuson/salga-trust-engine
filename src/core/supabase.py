"""Supabase client management.

This module provides singleton Supabase clients for admin and anonymous access.
- supabase_admin: bypasses RLS, used for backend operations
- supabase_anon: respects RLS, used for testing public access patterns
"""
from typing import Optional
from supabase import Client, create_client

from src.core.config import settings


# Lazy-initialized singletons
_supabase_admin: Optional[Client] = None
_supabase_anon: Optional[Client] = None


def get_supabase_admin() -> Optional[Client]:
    """Get Supabase admin client (service_role).

    This client bypasses Row Level Security (RLS) and should only be used
    in backend operations. It has full database access.

    Returns:
        Supabase client with service_role key, or None if not configured
    """
    global _supabase_admin

    if _supabase_admin is None and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        _supabase_admin = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )

    return _supabase_admin


def get_supabase_anon() -> Optional[Client]:
    """Get Supabase anonymous client (anon key).

    This client respects Row Level Security (RLS) and is useful for testing
    public access patterns.

    Returns:
        Supabase client with anon key, or None if not configured
    """
    global _supabase_anon

    if _supabase_anon is None and settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
        _supabase_anon = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY
        )

    return _supabase_anon


# Legacy aliases for direct access (will be phased out in favor of factory functions)
supabase_admin = get_supabase_admin()
supabase_anon = get_supabase_anon()
