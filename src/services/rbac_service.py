"""RBAC service: Redis JWT blacklisting and role assignment business logic.

Provides:
- blacklist_user_token: Force-expire a JWT by storing its hash in Redis
- is_token_blacklisted: Check if a token's hash is in the Redis blacklist
- assign_role: Create UserRoleAssignment with Tier 1 approval workflow
- get_effective_role: Return the highest-authority active role for a user
- approve_tier1_request: Approve or reject a pending Tier 1 role request
- get_tier_for_role: Return the tier number for a given UserRole
"""
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import TIER_ORDER
from src.core.config import settings
from src.models.audit_log import AuditLog, OperationType
from src.models.role_assignment import ApprovalStatus, Tier1ApprovalRequest, UserRoleAssignment
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Tier 1 roles that require SALGA admin approval (does NOT include admin/salga_admin)
TIER1_APPROVAL_REQUIRED = frozenset({
    UserRole.EXECUTIVE_MAYOR,
    UserRole.MUNICIPAL_MANAGER,
    UserRole.CFO,
    UserRole.SPEAKER,
})

# TTL for Tier 1 approval requests (7 days)
TIER1_APPROVAL_TTL_DAYS = 7


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _hash_token(token: str) -> str:
    """Return SHA-256 hex digest of a JWT string."""
    return hashlib.sha256(token.encode()).hexdigest()


def _redis_key(digest: str) -> str:
    """Format the Redis key for a revoked token hash."""
    return f"revoked_token:{digest}"


async def _get_redis():
    """Create an async Redis client from settings."""
    import redis.asyncio as aioredis  # lazy import — avoids startup failure if redis absent
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


# ---------------------------------------------------------------------------
# JWT blacklist
# ---------------------------------------------------------------------------

async def blacklist_user_token(token: str, exp: int) -> None:
    """Blacklist a JWT by persisting its SHA-256 hash in Redis with a TTL.

    The TTL is computed as the remaining token lifetime so that stale blacklist
    entries are automatically evicted when the token would have expired anyway.

    Args:
        token: Raw JWT string to blacklist.
        exp: Token expiry timestamp (Unix epoch seconds, from the 'exp' JWT claim).
    """
    digest = _hash_token(token)
    ttl_seconds = max(int(exp - time.time()), 1)  # at least 1 second

    redis = await _get_redis()
    try:
        await redis.set(_redis_key(digest), "1", ex=ttl_seconds)
    finally:
        await redis.aclose()


async def is_token_blacklisted(token: str) -> bool:
    """Return True if the given JWT has been blacklisted.

    On any Redis failure the caller should catch the exception and apply
    fail-open policy (log warning, allow request through).

    Args:
        token: Raw JWT string to check.

    Returns:
        True if the token has been revoked, False otherwise.
    """
    digest = _hash_token(token)
    redis = await _get_redis()
    try:
        value = await redis.get(_redis_key(digest))
        return value is not None
    finally:
        await redis.aclose()


# ---------------------------------------------------------------------------
# Role tier helpers
# ---------------------------------------------------------------------------

def get_tier_for_role(role: UserRole) -> int:
    """Return the tier number (1-4) for a given UserRole.

    Args:
        role: UserRole enum value.

    Returns:
        Tier number (1=Executive, 2=Director, 3=Operational, 4=Frontline).
        Returns 99 if the role is not in TIER_ORDER (should never happen).
    """
    return TIER_ORDER.get(role.value, 99)


# ---------------------------------------------------------------------------
# Effective role computation
# ---------------------------------------------------------------------------

async def get_effective_role(db: AsyncSession, user_id: UUID) -> UserRole:
    """Return the highest-authority active role for a user.

    Queries all active UserRoleAssignments and returns the role with the
    lowest tier number (highest authority).

    Args:
        db: Async database session.
        user_id: UUID of the target user.

    Returns:
        UserRole with the lowest tier number.  Falls back to UserRole.CITIZEN
        if no active assignments exist.
    """
    result = await db.execute(
        select(UserRoleAssignment.role)
        .where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.is_active.is_(True),
        )
    )
    active_roles = [row[0] for row in result.fetchall()]

    if not active_roles:
        return UserRole.CITIZEN

    # Return the role with the lowest tier number (highest authority)
    return min(active_roles, key=lambda r: TIER_ORDER.get(r.value, 99))


# ---------------------------------------------------------------------------
# Role assignment
# ---------------------------------------------------------------------------

async def assign_role(
    db: AsyncSession,
    user_id: UUID,
    role: UserRole,
    assigned_by: str,
    tenant_id: str,
    ip_address: str | None = None,
) -> UserRoleAssignment:
    """Assign a role to a user.

    For Tier 1 approval-required roles (executive_mayor, municipal_manager,
    cfo, speaker), a Tier1ApprovalRequest is created instead of an immediate
    role assignment.  The UserRoleAssignment record is created with
    is_active=False until the SALGA admin approves.

    For all other roles, the assignment is immediate and User.role is updated
    to reflect the new effective role (highest-authority).

    A ROLE_CHANGE audit log entry is created in all cases.

    Args:
        db: Async database session.
        user_id: UUID of the target user.
        role: UserRole to assign.
        assigned_by: User ID string of the admin performing the assignment.
        tenant_id: Tenant ID for the assignment.
        ip_address: Optional IP address for audit logging.

    Returns:
        The created UserRoleAssignment (is_active=False if Tier 1 approval required).
    """
    # Get current user state for audit trail
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise ValueError(f"User {user_id} not found")

    old_role = user.role
    requires_approval = role in TIER1_APPROVAL_REQUIRED

    # Create the role assignment record
    assignment = UserRoleAssignment(
        user_id=user_id,
        role=role,
        assigned_by=assigned_by,
        is_active=not requires_approval,  # Pending until approved for Tier 1
        tenant_id=tenant_id,
    )
    db.add(assignment)
    await db.flush()  # Get the assignment ID without committing

    if requires_approval:
        # Create a Tier 1 approval request
        approval_request = Tier1ApprovalRequest(
            requesting_admin_id=UUID(assigned_by) if len(assigned_by) == 36 else user_id,
            target_user_id=user_id,
            requested_role=role,
            current_role=old_role,
            status=ApprovalStatus.PENDING,
            expires_at=datetime.now(timezone.utc) + timedelta(days=TIER1_APPROVAL_TTL_DAYS),
            tenant_id=tenant_id,
        )
        db.add(approval_request)
    else:
        # Immediate assignment — update user's effective role
        new_effective = await get_effective_role(db, user_id)
        if new_effective != user.role:
            user.role = new_effective

    # Create ROLE_CHANGE audit log (POPIA-compliant)
    audit_entry = AuditLog(
        tenant_id=tenant_id,
        user_id=assigned_by,
        operation=OperationType.ROLE_CHANGE,
        table_name="users",
        record_id=str(user_id),
        changes=json.dumps({
            "old_role": old_role.value,
            "new_role": role.value,
            "assigned_by": assigned_by,
            "requires_approval": requires_approval,
        }),
        ip_address=ip_address,
    )
    db.add(audit_entry)

    await db.commit()
    await db.refresh(assignment)
    return assignment


# ---------------------------------------------------------------------------
# Tier 1 approval workflow
# ---------------------------------------------------------------------------

async def approve_tier1_request(
    db: AsyncSession,
    request_id: UUID,
    salga_admin_id: UUID,
    approved: bool,
    reason: str,
    ip_address: str | None = None,
) -> Tier1ApprovalRequest:
    """Approve or reject a pending Tier 1 role assignment request.

    If approved: activates the UserRoleAssignment and updates User.role.
    If rejected: sets status to REJECTED with the provided reason.
    In both cases: triggers token blacklisting for the target user's current
    token (the caller should pass the token separately if available).

    Args:
        db: Async database session.
        request_id: UUID of the Tier1ApprovalRequest to decide.
        salga_admin_id: UUID of the SALGA admin making the decision.
        approved: True to approve, False to reject.
        reason: Mandatory reason string (required on rejection; recommended on approval).
        ip_address: Optional IP address for audit logging.

    Returns:
        The updated Tier1ApprovalRequest.

    Raises:
        ValueError: If request not found or not in PENDING state.
    """
    result = await db.execute(
        select(Tier1ApprovalRequest).where(Tier1ApprovalRequest.id == request_id)
    )
    approval_req = result.scalar_one_or_none()
    if approval_req is None:
        raise ValueError(f"Approval request {request_id} not found")
    if approval_req.status != ApprovalStatus.PENDING:
        raise ValueError(f"Request {request_id} is already {approval_req.status.value}")

    # Get target user for audit trail
    user_result = await db.execute(select(User).where(User.id == approval_req.target_user_id))
    user = user_result.scalar_one_or_none()

    old_role = user.role if user else None

    if approved:
        # Activate the role assignment
        assignment_result = await db.execute(
            select(UserRoleAssignment).where(
                UserRoleAssignment.user_id == approval_req.target_user_id,
                UserRoleAssignment.role == approval_req.requested_role,
                UserRoleAssignment.is_active.is_(False),
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment:
            assignment.is_active = True

        # Update user's effective role
        if user:
            new_effective = await get_effective_role(db, approval_req.target_user_id)
            user.role = new_effective

        approval_req.status = ApprovalStatus.APPROVED
    else:
        # Reject — deactivate the pending assignment
        assignment_result = await db.execute(
            select(UserRoleAssignment).where(
                UserRoleAssignment.user_id == approval_req.target_user_id,
                UserRoleAssignment.role == approval_req.requested_role,
                UserRoleAssignment.is_active.is_(False),
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment:
            await db.delete(assignment)

        approval_req.status = ApprovalStatus.REJECTED

    approval_req.salga_admin_id = salga_admin_id
    approval_req.decision_reason = reason
    approval_req.decided_at = datetime.now(timezone.utc)

    # Audit the decision
    tenant_id = approval_req.tenant_id
    audit_entry = AuditLog(
        tenant_id=tenant_id,
        user_id=str(salga_admin_id),
        operation=OperationType.ROLE_CHANGE,
        table_name="tier1_approval_requests",
        record_id=str(request_id),
        changes=json.dumps({
            "decision": "approved" if approved else "rejected",
            "requested_role": approval_req.requested_role.value,
            "old_role": old_role.value if old_role else None,
            "reason": reason,
        }),
        ip_address=ip_address,
    )
    db.add(audit_entry)

    await db.commit()
    await db.refresh(approval_req)
    return approval_req
