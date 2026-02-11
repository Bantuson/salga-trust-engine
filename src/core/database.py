"""Database engine and session management."""
from collections.abc import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.config import settings
from src.core.tenant import get_tenant_context

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


# Set PostgreSQL session variable for RLS on every transaction start
# For async sessions, we need to listen on the engine's connect event
@event.listens_for(engine.sync_engine, "connect")
def set_search_path(dbapi_connection, connection_record):
    """Set default connection settings on new connections.

    This is a placeholder for future schema-per-tenant if needed.
    """
    pass


# For RLS context, we'll set it at the session level in get_db()
# since async event listeners need special handling


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database sessions.

    Sets PostgreSQL RLS context variable at the start of each session.
    Uses SET LOCAL to ensure the setting is transaction-scoped and doesn't
    leak across connections in the pool.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Set RLS context for this transaction
            tenant_id = get_tenant_context()
            if tenant_id:
                # SET LOCAL is transaction-scoped - automatically resets after commit/rollback
                await session.execute(
                    text("SET LOCAL app.current_tenant = :tenant_id"),
                    {"tenant_id": tenant_id}
                )
            yield session
        finally:
            await session.close()
