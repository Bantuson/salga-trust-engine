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

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
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
