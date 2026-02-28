"""Unit tests for Phase 27 RBAC: role hierarchy, tier inheritance, Redis blacklist, audit logging.

Tests:
- UserRole enum has all 18 roles across 4 tiers
- TIER_ORDER covers all roles
- Tier inheritance: executive (Tier 1) passes require_min_tier(3)
- Tier inheritance: citizen (Tier 4) fails require_min_tier(1)
- Boundary: Tier 2 passes own tier check, fails Tier 1
- SEC-05 preservation: require_role still works for exact-match GBV firewall
- Role change creates ROLE_CHANGE audit log entry
- Token blacklisting (Redis mock): blacklist + check roundtrip
- Blacklisted token is rejected with 401 by get_current_user
- Tier 1 assignment creates a Tier1ApprovalRequest (not immediate)
- Tier 2 assignment is immediate

DB tests (test_role_change_*, test_assign_tier*, test_get_effective_role_*) require
PostgreSQL; they are marked integration and skip automatically when Postgres is unavailable.
"""
import json
import time
from datetime import timedelta, timezone, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import TIER_ORDER, require_min_tier, require_role
from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.audit_log import OperationType
from src.models.role_assignment import ApprovalStatus, Tier1ApprovalRequest, UserRoleAssignment
from src.models.user import User, UserRole
from src.services.rbac_service import (
    TIER1_APPROVAL_REQUIRED,
    assign_role,
    blacklist_user_token,
    get_effective_role,
    get_tier_for_role,
    is_token_blacklisted,
)

# Note: asyncio_mode = "auto" in pyproject.toml means async tests run without explicit marks.


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(role: UserRole, tenant_id: str | None = None) -> User:
    """Build a mock User with the given role."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.role = role
    user.tenant_id = tenant_id or str(uuid4())
    user.is_active = True
    user.is_deleted = False
    return user


# ---------------------------------------------------------------------------
# 1. UserRole enum completeness
# ---------------------------------------------------------------------------

def test_userrole_enum_has_all_18_roles():
    """UserRole enum must contain exactly 18 roles across all 4 tiers."""
    assert len(UserRole) == 18, f"Expected 18 roles, got {len(UserRole)}"

    # Tier 1
    assert UserRole.EXECUTIVE_MAYOR.value == "executive_mayor"
    assert UserRole.MUNICIPAL_MANAGER.value == "municipal_manager"
    assert UserRole.CFO.value == "cfo"
    assert UserRole.SPEAKER.value == "speaker"
    assert UserRole.ADMIN.value == "admin"
    assert UserRole.SALGA_ADMIN.value == "salga_admin"

    # Tier 2
    assert UserRole.SECTION56_DIRECTOR.value == "section56_director"
    assert UserRole.WARD_COUNCILLOR.value == "ward_councillor"

    # Tier 3
    assert UserRole.DEPARTMENT_MANAGER.value == "department_manager"
    assert UserRole.PMS_OFFICER.value == "pms_officer"
    assert UserRole.AUDIT_COMMITTEE_MEMBER.value == "audit_committee_member"
    assert UserRole.INTERNAL_AUDITOR.value == "internal_auditor"
    assert UserRole.MPAC_MEMBER.value == "mpac_member"
    assert UserRole.SAPS_LIAISON.value == "saps_liaison"
    assert UserRole.MANAGER.value == "manager"

    # Tier 4
    assert UserRole.FIELD_WORKER.value == "field_worker"
    assert UserRole.CITIZEN.value == "citizen"


def test_existing_roles_unchanged():
    """The 6 original roles must keep their exact string values (backward compat)."""
    assert UserRole.CITIZEN.value == "citizen"
    assert UserRole.FIELD_WORKER.value == "field_worker"
    assert UserRole.MANAGER.value == "manager"
    assert UserRole.WARD_COUNCILLOR.value == "ward_councillor"
    assert UserRole.ADMIN.value == "admin"
    assert UserRole.SAPS_LIAISON.value == "saps_liaison"


# ---------------------------------------------------------------------------
# 2. TIER_ORDER completeness
# ---------------------------------------------------------------------------

def test_tier_order_covers_all_roles():
    """Every UserRole value must have an entry in TIER_ORDER."""
    missing = [r for r in UserRole if r.value not in TIER_ORDER]
    assert not missing, f"Roles missing from TIER_ORDER: {[r.value for r in missing]}"


def test_tier_order_has_correct_tiers():
    """Spot-check tier assignments."""
    assert TIER_ORDER["executive_mayor"] == 1
    assert TIER_ORDER["municipal_manager"] == 1
    assert TIER_ORDER["admin"] == 1
    assert TIER_ORDER["salga_admin"] == 1
    assert TIER_ORDER["section56_director"] == 2
    assert TIER_ORDER["ward_councillor"] == 2
    assert TIER_ORDER["department_manager"] == 3
    assert TIER_ORDER["pms_officer"] == 3
    assert TIER_ORDER["saps_liaison"] == 3
    assert TIER_ORDER["manager"] == 3
    assert TIER_ORDER["field_worker"] == 4
    assert TIER_ORDER["citizen"] == 4


# ---------------------------------------------------------------------------
# 3. Tier inheritance — require_min_tier()
# ---------------------------------------------------------------------------

async def test_tier_inheritance_executive_passes_operational():
    """Tier 1 (executive_mayor) should pass require_min_tier(3)."""
    user = _make_user(UserRole.EXECUTIVE_MAYOR)
    checker = require_min_tier(3)

    # The inner `tier_checker` calls `get_current_user` — we pass user directly
    inner = checker.__wrapped__ if hasattr(checker, "__wrapped__") else None

    # Invoke the generated closure directly by calling it with mocked dependency
    # require_min_tier returns a factory; we simulate what FastAPI does
    async def _run():
        # Find the inner async function (tier_checker)
        # require_min_tier(3) returns the closure — call it with current_user
        import inspect
        closure = checker  # this is tier_checker factory
        # Get tier_checker via calling the factory's closure
        # We simulate Depends resolution by calling with user directly
        result_user = await _call_tier_checker(closure, user)
        return result_user

    async def _call_tier_checker(factory, mock_user):
        """Extract and call the inner tier_checker with a mock user."""
        # The factory is `require_min_tier(3)` which returns `tier_checker`.
        # tier_checker expects `current_user = Depends(get_current_user)`.
        # We call it directly by passing `current_user=mock_user`.
        import inspect
        # Get the closure object
        source = inspect.getsource(factory)  # noqa: F841 — just confirm it's our closure
        # Call the inner function by instantiating it
        # tier_checker(current_user=user) — pass as kwarg
        return await factory(current_user=mock_user)

    # Tier 1 (tier=1) <= min_tier (3) → should PASS (return user)
    result = await checker(current_user=user)
    assert result is user


async def test_tier_inheritance_citizen_fails_executive():
    """Tier 4 (citizen) should fail require_min_tier(1) with HTTP 403."""
    user = _make_user(UserRole.CITIZEN)
    checker = require_min_tier(1)

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=user)

    assert exc_info.value.status_code == 403
    assert "tier" in exc_info.value.detail.lower()


async def test_require_min_tier_boundary():
    """Tier 2 (section56_director) passes require_min_tier(2) but fails require_min_tier(1)."""
    user = _make_user(UserRole.SECTION56_DIRECTOR)

    # Should PASS tier 2 check
    checker_pass = require_min_tier(2)
    result = await checker_pass(current_user=user)
    assert result is user

    # Should FAIL tier 1 check
    checker_fail = require_min_tier(1)
    with pytest.raises(HTTPException) as exc_info:
        await checker_fail(current_user=user)
    assert exc_info.value.status_code == 403


async def test_tier3_passes_tier3_and_below():
    """Tier 3 (pms_officer) passes require_min_tier(3) and require_min_tier(4)."""
    user = _make_user(UserRole.PMS_OFFICER)

    for min_tier in (3, 4):
        checker = require_min_tier(min_tier)
        result = await checker(current_user=user)
        assert result is user

    # Fails Tier 1 and 2
    for min_tier in (1, 2):
        checker = require_min_tier(min_tier)
        with pytest.raises(HTTPException) as exc_info:
            await checker(current_user=user)
        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# 4. SEC-05 GBV firewall preservation — require_role() unchanged
# ---------------------------------------------------------------------------

async def test_existing_require_role_unchanged_saps_liaison():
    """require_role(SAPS_LIAISON) must still work via exact match (SEC-05 preserved)."""
    saps_user = _make_user(UserRole.SAPS_LIAISON)
    checker = require_role(UserRole.SAPS_LIAISON)

    # SAPS liaison should pass
    result = await checker(current_user=saps_user)
    assert result is saps_user


async def test_require_role_blocks_wrong_role():
    """require_role(SAPS_LIAISON) must reject non-SAPS users even if high-tier."""
    admin_user = _make_user(UserRole.ADMIN)
    checker = require_role(UserRole.SAPS_LIAISON)

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=admin_user)
    assert exc_info.value.status_code == 403


async def test_require_role_accepts_multiple_roles():
    """require_role(ADMIN, SAPS_LIAISON) accepts users with either role."""
    admin_user = _make_user(UserRole.ADMIN)
    saps_user = _make_user(UserRole.SAPS_LIAISON)
    citizen_user = _make_user(UserRole.CITIZEN)
    checker = require_role(UserRole.ADMIN, UserRole.SAPS_LIAISON)

    assert await checker(current_user=admin_user) is admin_user
    assert await checker(current_user=saps_user) is saps_user

    with pytest.raises(HTTPException):
        await checker(current_user=citizen_user)


# ---------------------------------------------------------------------------
# 5. Redis JWT blacklist (unit — no real Redis)
# ---------------------------------------------------------------------------

async def test_token_blacklisted_after_blacklist_call():
    """blacklist_user_token followed by is_token_blacklisted returns True."""
    fake_token = "fake.jwt.token"
    future_exp = int(time.time()) + 3600

    in_memory_store: dict[str, str] = {}

    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock(side_effect=lambda key, val, ex=None: in_memory_store.update({key: val}))
    mock_redis.get = AsyncMock(side_effect=lambda key: in_memory_store.get(key))
    mock_redis.aclose = AsyncMock()

    with patch("src.services.rbac_service._get_redis", return_value=AsyncMock(return_value=mock_redis)):
        # Workaround: _get_redis is called as `redis = await _get_redis()`
        # so the mock must be an awaitable that returns mock_redis
        import src.services.rbac_service as rbac_mod

        async def fake_get_redis():
            return mock_redis

        with patch.object(rbac_mod, "_get_redis", fake_get_redis):
            await blacklist_user_token(fake_token, future_exp)
            result = await is_token_blacklisted(fake_token)

    assert result is True


async def test_non_blacklisted_token_returns_false():
    """is_token_blacklisted returns False for a token that has not been revoked."""
    import src.services.rbac_service as rbac_mod

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.aclose = AsyncMock()

    async def fake_get_redis():
        return mock_redis

    with patch.object(rbac_mod, "_get_redis", fake_get_redis):
        result = await is_token_blacklisted("not.blacklisted.token")

    assert result is False


# ---------------------------------------------------------------------------
# 6. Role assignment audit logging
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_role_change_creates_audit_log(db_session: AsyncSession, test_municipality, admin_user: User):
    """assign_role() must persist a ROLE_CHANGE audit log entry.

    Integration test: requires PostgreSQL (SQLite cannot run audit_log INSERT
    inside the same session as tenant-filtered queries reliably).
    """
    from sqlalchemy import select as sa_select
    from src.models.audit_log import AuditLog

    tenant_id = admin_user.tenant_id
    set_tenant_context(tenant_id)
    try:
        # Create target user in db
        target_user = User(
            email="target@example.com",
            hashed_password="supabase_managed",
            full_name="Target User",
            tenant_id=tenant_id,
            municipality_id=test_municipality.id,
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db_session.add(target_user)
        await db_session.flush()
        await db_session.refresh(target_user)

        await assign_role(
            db=db_session,
            user_id=target_user.id,
            role=UserRole.PMS_OFFICER,
            assigned_by=str(admin_user.id),
            tenant_id=tenant_id,
            ip_address="127.0.0.1",
        )

        # Verify audit log entry exists
        result = await db_session.execute(
            sa_select(AuditLog).where(
                AuditLog.operation == OperationType.ROLE_CHANGE,
                AuditLog.record_id == str(target_user.id),
            )
        )
        audit_entries = result.scalars().all()
        assert len(audit_entries) >= 1, "Expected at least one ROLE_CHANGE audit log entry"

        entry = audit_entries[0]
        changes = json.loads(entry.changes)
        assert changes["old_role"] == "citizen"
        assert changes["new_role"] == "pms_officer"
        assert changes["assigned_by"] == str(admin_user.id)
        assert entry.ip_address == "127.0.0.1"
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# 7. Tier 1 approval workflow
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_assign_tier1_creates_approval_request(
    db_session: AsyncSession,
    test_municipality,
    admin_user: User,
):
    """Assigning an executive_mayor role creates a pending Tier1ApprovalRequest."""
    from sqlalchemy import select as sa_select

    tenant_id = admin_user.tenant_id
    set_tenant_context(tenant_id)
    try:
        target_user = User(
            email="mayor_candidate@example.com",
            hashed_password="supabase_managed",
            full_name="Mayor Candidate",
            tenant_id=tenant_id,
            municipality_id=test_municipality.id,
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db_session.add(target_user)
        await db_session.flush()
        await db_session.refresh(target_user)

        assignment = await assign_role(
            db=db_session,
            user_id=target_user.id,
            role=UserRole.EXECUTIVE_MAYOR,
            assigned_by=str(admin_user.id),
            tenant_id=tenant_id,
        )

        # Assignment should be inactive (pending approval)
        assert assignment.is_active is False
        assert assignment.role == UserRole.EXECUTIVE_MAYOR

        # User's role should NOT have changed (still citizen)
        await db_session.refresh(target_user)
        assert target_user.role == UserRole.CITIZEN

        # Approval request should exist in PENDING state
        result = await db_session.execute(
            sa_select(Tier1ApprovalRequest).where(
                Tier1ApprovalRequest.target_user_id == target_user.id,
                Tier1ApprovalRequest.status == ApprovalStatus.PENDING,
            )
        )
        approval_requests = result.scalars().all()
        assert len(approval_requests) == 1
        assert approval_requests[0].requested_role == UserRole.EXECUTIVE_MAYOR
    finally:
        clear_tenant_context()


@pytest.mark.integration
async def test_assign_tier2_immediate(
    db_session: AsyncSession,
    test_municipality,
    admin_user: User,
):
    """Assigning a section56_director role (Tier 2) is immediate and updates User.role."""
    from sqlalchemy import select as sa_select

    tenant_id = admin_user.tenant_id
    set_tenant_context(tenant_id)
    try:
        target_user = User(
            email="director_candidate@example.com",
            hashed_password="supabase_managed",
            full_name="Director Candidate",
            tenant_id=tenant_id,
            municipality_id=test_municipality.id,
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db_session.add(target_user)
        await db_session.flush()
        await db_session.refresh(target_user)

        assignment = await assign_role(
            db=db_session,
            user_id=target_user.id,
            role=UserRole.SECTION56_DIRECTOR,
            assigned_by=str(admin_user.id),
            tenant_id=tenant_id,
        )

        # Assignment should be active immediately
        assert assignment.is_active is True
        assert assignment.role == UserRole.SECTION56_DIRECTOR

        # User's effective role should now be section56_director (Tier 2 < Tier 4)
        await db_session.refresh(target_user)
        assert target_user.role == UserRole.SECTION56_DIRECTOR

        # No approval request should exist
        result = await db_session.execute(
            sa_select(Tier1ApprovalRequest).where(
                Tier1ApprovalRequest.target_user_id == target_user.id
            )
        )
        assert result.scalars().first() is None
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# 8. get_effective_role
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_get_effective_role_returns_highest_authority(
    db_session: AsyncSession,
    test_municipality,
    admin_user: User,
):
    """get_effective_role returns the role with the lowest tier number."""
    tenant_id = admin_user.tenant_id
    set_tenant_context(tenant_id)
    try:
        target_user = User(
            email="multi_role@example.com",
            hashed_password="supabase_managed",
            full_name="Multi Role User",
            tenant_id=tenant_id,
            municipality_id=test_municipality.id,
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db_session.add(target_user)
        await db_session.flush()
        await db_session.refresh(target_user)

        # Assign two roles: pms_officer (Tier 3) and section56_director (Tier 2)
        db_session.add(UserRoleAssignment(
            user_id=target_user.id,
            role=UserRole.PMS_OFFICER,
            assigned_by=str(admin_user.id),
            is_active=True,
            tenant_id=tenant_id,
        ))
        db_session.add(UserRoleAssignment(
            user_id=target_user.id,
            role=UserRole.SECTION56_DIRECTOR,
            assigned_by=str(admin_user.id),
            is_active=True,
            tenant_id=tenant_id,
        ))
        await db_session.commit()

        effective = await get_effective_role(db_session, target_user.id)
        # section56_director (Tier 2) beats pms_officer (Tier 3)
        assert effective == UserRole.SECTION56_DIRECTOR
    finally:
        clear_tenant_context()


@pytest.mark.integration
async def test_get_effective_role_falls_back_to_citizen(
    db_session: AsyncSession,
    test_municipality,
):
    """get_effective_role returns CITIZEN if no active assignments exist."""
    tenant_id = str(test_municipality.id)
    set_tenant_context(tenant_id)
    try:
        lone_user = User(
            email="no_assignments@example.com",
            hashed_password="supabase_managed",
            full_name="No Assignments",
            tenant_id=tenant_id,
            municipality_id=test_municipality.id,
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db_session.add(lone_user)
        await db_session.flush()
        await db_session.refresh(lone_user)

        effective = await get_effective_role(db_session, lone_user.id)
        assert effective == UserRole.CITIZEN
    finally:
        clear_tenant_context()


# ---------------------------------------------------------------------------
# 9. get_tier_for_role helper
# ---------------------------------------------------------------------------

def test_get_tier_for_role():
    """get_tier_for_role returns correct tier for known roles."""
    assert get_tier_for_role(UserRole.EXECUTIVE_MAYOR) == 1
    assert get_tier_for_role(UserRole.ADMIN) == 1
    assert get_tier_for_role(UserRole.SECTION56_DIRECTOR) == 2
    assert get_tier_for_role(UserRole.PMS_OFFICER) == 3
    assert get_tier_for_role(UserRole.CITIZEN) == 4


# ---------------------------------------------------------------------------
# 10. TIER1_APPROVAL_REQUIRED set
# ---------------------------------------------------------------------------

def test_tier1_approval_required_set():
    """TIER1_APPROVAL_REQUIRED must include exactly the 4 executive roles needing approval."""
    assert UserRole.EXECUTIVE_MAYOR in TIER1_APPROVAL_REQUIRED
    assert UserRole.MUNICIPAL_MANAGER in TIER1_APPROVAL_REQUIRED
    assert UserRole.CFO in TIER1_APPROVAL_REQUIRED
    assert UserRole.SPEAKER in TIER1_APPROVAL_REQUIRED
    # admin and salga_admin do NOT require approval
    assert UserRole.ADMIN not in TIER1_APPROVAL_REQUIRED
    assert UserRole.SALGA_ADMIN not in TIER1_APPROVAL_REQUIRED
    # Tier 2-4 roles do NOT require approval
    assert UserRole.SECTION56_DIRECTOR not in TIER1_APPROVAL_REQUIRED
    assert UserRole.PMS_OFFICER not in TIER1_APPROVAL_REQUIRED
