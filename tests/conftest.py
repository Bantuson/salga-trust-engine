"""Pytest configuration and fixtures for testing."""
import os
import sys
import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch

# CRITICAL: Set Windows event loop policy BEFORE any async imports
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# CRITICAL: Set USE_SQLITE_TESTS env var BEFORE importing models
# This prevents GeoAlchemy2 from being imported in SQLite test environments
os.environ["USE_SQLITE_TESTS"] = "1"

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
import jwt as pyjwt
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.api.deps import get_db
from src.core.config import settings
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


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the in-memory rate limiter between tests to prevent rate limit bleed-over.

    This ensures tests that call rate-limited endpoints directly don't fail
    due to hits from previous tests in the same session. The slowapi Limiter
    exposes a `reset()` method that clears the MemoryStorage counters.
    """
    from src.middleware.rate_limit import limiter
    # Reset before each test so rate counters don't carry over between tests
    try:
        limiter.reset()
    except Exception:
        # Fallback: reset the inner storage directly
        try:
            limiter._storage.reset()
        except Exception:
            pass
    yield


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
    if not POSTGRES_AVAILABLE:
        # Disable GeoAlchemy2 DDL event listeners for SQLite.
        # GeoAlchemy2 registers after_create/before_drop events that call SpatiaLite
        # functions (RecoverGeometryColumn, DiscardGeometryColumn) which don't exist
        # in plain SQLite. We must remove these before create_all.
        try:
            from sqlalchemy import event, Table
            from geoalchemy2.admin import (
                after_create as ga2_after_create,
                before_drop as ga2_before_drop,
            )
            event.remove(Table, "after_create", ga2_after_create)
            event.remove(Table, "before_drop", ga2_before_drop)
        except Exception:
            pass
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        if not POSTGRES_AVAILABLE:
            # Re-disable in case geoalchemy2 re-registered during test session
            try:
                from sqlalchemy import event, Table
                from geoalchemy2.admin import before_drop as ga2_before_drop
                event.remove(Table, "before_drop", ga2_before_drop)
            except Exception:
                pass
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
def mock_supabase_admin():
    """Mock Supabase admin client for testing.

    Provides mocked auth.admin and storage methods used throughout the app.
    """
    mock = Mock()

    # Mock auth.admin methods
    mock.auth = Mock()
    mock.auth.admin = Mock()
    mock.auth.admin.create_user = AsyncMock(return_value=Mock(
        user=Mock(id=str(uuid4()), email="test@example.com")
    ))
    mock.auth.sign_in_with_password = AsyncMock(return_value=Mock(
        session=Mock(access_token="mock_token", refresh_token="mock_refresh"),
        user=Mock(id=str(uuid4()))
    ))
    mock.auth.refresh_session = AsyncMock(return_value=Mock(
        session=Mock(access_token="new_mock_token", refresh_token="new_refresh_token")
    ))
    mock.auth.sign_in_with_otp = AsyncMock(return_value=Mock(error=None))
    mock.auth.verify_otp = AsyncMock(return_value=Mock(
        session=Mock(access_token="mock_otp_token", refresh_token="mock_otp_refresh"),
        user=Mock(id=str(uuid4()))
    ))

    # Mock storage methods
    mock.storage = Mock()

    def from_(bucket_name):
        storage_mock = Mock()
        storage_mock.upload = AsyncMock(return_value=Mock(error=None))
        storage_mock.create_signed_url = Mock(return_value=Mock(
            signed_url=f"https://supabase.co/storage/v1/object/sign/{bucket_name}/test",
            error=None
        ))
        return storage_mock

    mock.storage.from_ = from_

    return mock


def create_supabase_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Helper function to create Supabase-format JWT tokens for tests.

    Args:
        data: Dict with 'sub', 'tenant_id', 'role', optionally 'email', 'full_name'
        expires_delta: Custom expiration time (default: 1 hour)

    Returns:
        Encoded JWT token string
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=1)

    payload = {
        "sub": data.get("sub", str(uuid4())),
        "aud": "authenticated",
        "role": "authenticated",
        "email": data.get("email", "test@example.com"),
        "app_metadata": {
            "role": data.get("role", "citizen"),
            "tenant_id": data.get("tenant_id", str(uuid4())),
        },
        "user_metadata": {
            "full_name": data.get("full_name", "Test User"),
            "preferred_language": data.get("preferred_language", "en")
        },
        "exp": datetime.now(timezone.utc) + expires_delta,
        "iat": datetime.now(timezone.utc),
    }

    secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
    return pyjwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture(scope="function")
def supabase_jwt_token():
    """Create a test JWT mimicking Supabase token structure.

    Returns a valid JWT token for testing auth flows.
    """
    return create_supabase_access_token({
        "sub": str(uuid4()),
        "email": "test@example.com",
        "role": "citizen",
        "tenant_id": str(uuid4()),
    })


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
        hashed_password="supabase_managed",  # Password managed by Supabase Auth
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
        hashed_password="supabase_managed",  # Password managed by Supabase Auth
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
    """Create an access token for admin user using Supabase JWT format."""
    payload = {
        "sub": str(admin_user.id),
        "aud": "authenticated",
        "role": "authenticated",
        "email": admin_user.email,
        "app_metadata": {
            "role": admin_user.role.value,
            "tenant_id": admin_user.tenant_id,
        },
        "user_metadata": {
            "full_name": admin_user.full_name,
        },
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
    }
    secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
    return pyjwt.encode(payload, secret, algorithm="HS256")


@pytest_asyncio.fixture(scope="function")
async def citizen_user(db_session: AsyncSession, test_municipality: Municipality) -> User:
    """Create a citizen user for tests."""
    user = User(
        email="citizen@example.com",
        hashed_password="supabase_managed",  # Password managed by Supabase Auth
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
    """Create an access token for citizen user using Supabase JWT format."""
    payload = {
        "sub": str(citizen_user.id),
        "aud": "authenticated",
        "role": "authenticated",
        "email": citizen_user.email,
        "app_metadata": {
            "role": citizen_user.role.value,
            "tenant_id": citizen_user.tenant_id,
        },
        "user_metadata": {
            "full_name": citizen_user.full_name,
        },
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
    }
    secret = settings.SUPABASE_JWT_SECRET or "test-supabase-jwt-secret"
    return pyjwt.encode(payload, secret, algorithm="HS256")
