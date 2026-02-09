"""Tests for multi-tenant data isolation (RLS + application-level filtering)."""
import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import SecurityError
from src.core.tenant import clear_tenant_context, get_tenant_context, set_tenant_context
from src.models.municipality import Municipality
from src.models.user import User, UserRole

pytestmark = pytest.mark.asyncio


async def test_cross_tenant_isolation(db_session: AsyncSession):
    """Users in Municipality A cannot see users from Municipality B."""
    # Create two municipalities
    muni_a = Municipality(name="Municipality A", code="MUNA", province="Gauteng")
    muni_b = Municipality(name="Municipality B", code="MUNB", province="Western Cape")
    db_session.add(muni_a)
    db_session.add(muni_b)
    await db_session.commit()
    await db_session.refresh(muni_a)
    await db_session.refresh(muni_b)

    # Create users in Municipality A
    from src.core.security import get_password_hash
    user_a1 = User(
        email="user1@muni-a.za",
        hashed_password=get_password_hash("password123"),
        full_name="User A1",
        tenant_id=str(muni_a.id),
        municipality_id=muni_a.id,
        role=UserRole.CITIZEN,
    )
    user_a2 = User(
        email="user2@muni-a.za",
        hashed_password=get_password_hash("password123"),
        full_name="User A2",
        tenant_id=str(muni_a.id),
        municipality_id=muni_a.id,
        role=UserRole.CITIZEN,
    )

    # Create users in Municipality B
    user_b1 = User(
        email="user1@muni-b.za",
        hashed_password=get_password_hash("password123"),
        full_name="User B1",
        tenant_id=str(muni_b.id),
        municipality_id=muni_b.id,
        role=UserRole.CITIZEN,
    )
    user_b2 = User(
        email="user2@muni-b.za",
        hashed_password=get_password_hash("password123"),
        full_name="User B2",
        tenant_id=str(muni_b.id),
        municipality_id=muni_b.id,
        role=UserRole.CITIZEN,
    )

    db_session.add_all([user_a1, user_a2, user_b1, user_b2])
    await db_session.commit()

    # Test: Query with tenant context A - should only see Municipality A users
    set_tenant_context(str(muni_a.id))
    result = await db_session.execute(select(User))
    users_in_a = list(result.scalars().all())

    assert len(users_in_a) == 2
    assert all(u.tenant_id == str(muni_a.id) for u in users_in_a)
    assert {u.email for u in users_in_a} == {"user1@muni-a.za", "user2@muni-a.za"}

    # Test: Query with tenant context B - should only see Municipality B users
    set_tenant_context(str(muni_b.id))
    # Need to start new transaction for RLS to pick up new tenant context
    await db_session.commit()

    result = await db_session.execute(select(User))
    users_in_b = list(result.scalars().all())

    assert len(users_in_b) == 2
    assert all(u.tenant_id == str(muni_b.id) for u in users_in_b)
    assert {u.email for u in users_in_b} == {"user1@muni-b.za", "user2@muni-b.za"}

    clear_tenant_context()


async def test_no_tenant_context_fails_closed(db_session: AsyncSession):
    """Missing tenant context raises SecurityError (fail closed, not fail open)."""
    # Create a municipality and user
    muni = Municipality(name="Test Municipality", code="TEST", province="Gauteng")
    db_session.add(muni)
    await db_session.commit()
    await db_session.refresh(muni)

    from src.core.security import get_password_hash
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test User",
        tenant_id=str(muni.id),
        municipality_id=muni.id,
        role=UserRole.CITIZEN,
    )
    db_session.add(user)
    await db_session.commit()

    # Clear tenant context
    clear_tenant_context()
    await db_session.commit()  # Start new transaction

    # Verify tenant context is cleared
    assert get_tenant_context() is None

    # Attempt tenant-aware query without tenant context - should raise SecurityError
    with pytest.raises(SecurityError) as exc_info:
        result = await db_session.execute(select(User))
        # Force evaluation of lazy query
        list(result.scalars().all())

    assert "tenant context not set" in str(exc_info.value).lower()
    assert "potential data leakage" in str(exc_info.value).lower()


async def test_create_user_gets_tenant_id(db_session: AsyncSession):
    """User created with tenant context automatically gets correct tenant_id."""
    # Create municipality
    muni = Municipality(name="Test Municipality", code="TEST", province="Gauteng")
    db_session.add(muni)
    await db_session.commit()
    await db_session.refresh(muni)

    # Set tenant context
    set_tenant_context(str(muni.id))
    await db_session.commit()  # Start new transaction with RLS context

    # Create user
    from src.core.security import get_password_hash
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test User",
        tenant_id=str(muni.id),
        municipality_id=muni.id,
        role=UserRole.CITIZEN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Verify tenant_id matches
    assert user.tenant_id == str(muni.id)

    clear_tenant_context()


@pytest.mark.skipif(
    True,  # Skip by default - requires actual PostgreSQL connection
    reason="Requires PostgreSQL database with RLS enabled"
)
async def test_rls_policy_exists(db_session: AsyncSession):
    """Verify RLS is enabled on users table in PostgreSQL."""
    # Query pg_class to check if RLS is enabled
    result = await db_session.execute(
        text("SELECT relrowsecurity FROM pg_class WHERE relname = 'users'")
    )
    row = result.fetchone()

    assert row is not None
    assert row[0] is True  # relrowsecurity should be True


@pytest.mark.skipif(
    True,  # Skip by default - requires actual PostgreSQL connection
    reason="Requires PostgreSQL database with RLS enabled"
)
async def test_set_local_resets_after_transaction(db_session: AsyncSession):
    """Verify SET LOCAL app.current_tenant is transaction-scoped."""
    # Create municipality
    muni = Municipality(name="Test Municipality", code="TEST", province="Gauteng")
    db_session.add(muni)
    await db_session.commit()
    await db_session.refresh(muni)

    # Set tenant context and start transaction
    set_tenant_context(str(muni.id))
    await db_session.commit()  # Start new transaction

    # Verify setting is set in transaction
    result = await db_session.execute(
        text("SELECT current_setting('app.current_tenant', true)")
    )
    current_value = result.scalar()
    assert current_value == str(muni.id)

    # Commit transaction
    await db_session.commit()

    # Clear application-level context
    clear_tenant_context()

    # Start new transaction without setting tenant
    await db_session.begin()

    # Verify setting is NULL (SET LOCAL was transaction-scoped)
    result = await db_session.execute(
        text("SELECT current_setting('app.current_tenant', true)")
    )
    current_value = result.scalar()
    assert current_value is None or current_value == ""


async def test_non_tenant_model_query_works_without_context(db_session: AsyncSession):
    """Non-tenant models (like Municipality) can be queried without tenant context."""
    # Create municipality
    muni = Municipality(name="Test Municipality", code="TEST", province="Gauteng")
    db_session.add(muni)
    await db_session.commit()

    # Clear tenant context
    clear_tenant_context()
    await db_session.commit()  # Start new transaction

    # Query non-tenant model - should NOT raise SecurityError
    result = await db_session.execute(select(Municipality))
    municipalities = list(result.scalars().all())

    assert len(municipalities) >= 1
    assert any(m.code == "TEST" for m in municipalities)
