"""Database engine and session management."""
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.config import settings

# Determine database URL: prefer Supabase, fall back to DATABASE_URL for local dev/tests
database_url = settings.SUPABASE_DB_URL or settings.DATABASE_URL

# Create async engine with connection pooling optimized for Supabase limits
# Supabase free tier: 60 connections
# Supabase Pro tier: 200 connections
# Conservative pool settings to prevent connection exhaustion
engine = create_async_engine(
    database_url,
    pool_pre_ping=True,
    pool_size=5,  # Reduced from 10 for Supabase connection limits
    max_overflow=10,  # Reduced from 20
    echo=settings.DEBUG,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database sessions.

    With Supabase Auth, RLS policies read tenant_id and role directly from
    JWT claims via auth.jwt() -> 'app_metadata'. No need to set session variables.

    IMPORTANT: The FastAPI backend uses service_role key which bypasses RLS.
    Defense-in-depth tenant filtering happens at the application level in
    base.py add_tenant_filter (see src/models/base.py).

    For client-side access (e.g., dashboard using supabase-js), the anon key
    is used and RLS policies are enforced automatically.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
