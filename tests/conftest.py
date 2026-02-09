"""Pytest configuration and fixtures for testing."""
import sys
import asyncio

# CRITICAL: Set Windows event loop policy BEFORE any async imports
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.api.deps import get_db
from src.core.config import settings
from src.core.security import get_password_hash
from src.main import app
from src.models.base import Base
from src.models.municipality import Municipality
from src.models.user import User, UserRole


def _check_postgres() -> bool:
    """Check if PostgreSQL is reachable."""
    try:
        import psycopg
        # Try synchronous connection with short timeout
        db_url = settings.DATABASE_URL.replace("+psycopg", "")
        conn = psycopg.connect(
            db_url,
            connect_timeout=3,
        )
        conn.close()
        return True
    except Exception:
        return False


# Detect PostgreSQL availability
POSTGRES_AVAILABLE = _check_postgres()

# Override settings for testing
settings.ENVIRONMENT = "test"

# Create test database URL
if POSTGRES_AVAILABLE:
    # PostgreSQL: append "_test" to database name
    test_db_url = settings.DATABASE_URL.rsplit("/", 1)
    if len(test_db_url) == 2:
        test_db_url = f"{test_db_url[0]}/{test_db_url[1]}_test"
    else:
        test_db_url = f"{settings.DATABASE_URL}_test"
else:
    # SQLite fallback for unit tests
    test_db_url = "sqlite+aiosqlite:///./test.db"

# Create test engine
test_engine = create_async_engine(
    test_db_url,
    pool_pre_ping=True,
    echo=False,
)

# Create test session factory
TestAsyncSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for testing."""
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Override the get_db dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session with Windows compatibility."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def _skip_integration_tests_without_postgres(request):
    """Auto-skip integration tests when PostgreSQL is not available."""
    if request.node.get_closest_marker('integration'):
        if not POSTGRES_AVAILABLE:
            pytest.skip("PostgreSQL not available - skipping integration test")


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a test database session with cleanup after each test."""
    async with TestAsyncSessionLocal() as session:
        yield session
        # Cleanup: rollback any uncommitted changes
        await session.rollback()
        # Clean up tables after each test for isolation
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()


@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client (alias for client)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create test database tables before tests and drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def test_municipality(db_session: AsyncSession) -> Municipality:
    """Create a test municipality for tests."""
    municipality = Municipality(
        name="Test Municipality",
        code="TEST001",
        province="Gauteng",
        is_active=True
    )
    db_session.add(municipality)
    await db_session.commit()
    await db_session.refresh(municipality)
    return municipality


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession, test_municipality: Municipality) -> User:
    """Create a test user for tests."""
    user = User(
        email="testuser@example.com",
        hashed_password=get_password_hash("testpassword123"),
        full_name="Test User",
        phone="+27123456789",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        role=UserRole.CITIZEN,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession, test_municipality: Municipality) -> User:
    """Create an admin user for tests."""
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("adminpassword123"),
        full_name="Admin User",
        phone="+27987654321",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(admin_user: User) -> str:
    """Create an access token for admin user."""
    from src.core.security import create_access_token
    return create_access_token({
        "sub": str(admin_user.id),
        "tenant_id": admin_user.tenant_id,
        "role": admin_user.role.value,
    })


@pytest_asyncio.fixture(scope="function")
async def citizen_user(db_session: AsyncSession, test_municipality: Municipality) -> User:
    """Create a citizen user for tests."""
    user = User(
        email="citizen@example.com",
        hashed_password=get_password_hash("citizenpassword123"),
        full_name="Citizen User",
        phone="+27111222333",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        role=UserRole.CITIZEN,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def citizen_token(citizen_user: User) -> str:
    """Create an access token for citizen user."""
    from src.core.security import create_access_token
    return create_access_token({
        "sub": str(citizen_user.id),
        "tenant_id": citizen_user.tenant_id,
        "role": citizen_user.role.value,
    })
