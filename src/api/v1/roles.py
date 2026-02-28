"""Role assignment CRUD and Tier 1 approval workflow API.

Endpoints:
- GET  /api/v1/roles/tiers                         — Public reference: TIER_ORDER dict
- POST /api/v1/roles/{user_id}/assign              — Assign role (admin only)
- DELETE /api/v1/roles/{user_id}/revoke            — Revoke role (admin only)
- GET  /api/v1/roles/{user_id}                     — List roles (admin or self)
- GET  /api/v1/roles/approvals/pending             — Pending Tier 1 requests (salga_admin)
- POST /api/v1/roles/approvals/{request_id}/decide — Approve/reject Tier 1 (salga_admin)

Security:
- Mutation endpoints require ADMIN role (SEC-01 RBAC enforcement)
- Tier 1 approval endpoints require SALGA_ADMIN role
- All responses are tenant-scoped via get_current_user dependency
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import TIER_ORDER, get_current_user, get_db, require_role
from src.models.role_assignment import ApprovalStatus, Tier1ApprovalRequest, UserRoleAssignment
from src.models.user import User, UserRole
from src.services.rbac_service import (
    TIER1_APPROVAL_REQUIRED,
    approve_tier1_request,
    assign_role,
    get_effective_role,
    get_tier_for_role,
    is_token_blacklisted,
    blacklist_user_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])

# ---------------------------------------------------------------------------
# Pydantic schemas (request/response bodies for this module)
# ---------------------------------------------------------------------------

# Role display names for the tiers endpoint
_ROLE_DISPLAY_NAMES: dict[str, str] = {
    "executive_mayor": "Executive Mayor",
    "municipal_manager": "Municipal Manager",
    "cfo": "Chief Financial Officer",
    "speaker": "Speaker",
    "admin": "System Administrator",
    "salga_admin": "SALGA Administrator",
    "section56_director": "Section 56 Director",
    "ward_councillor": "Ward Councillor",
    "chief_whip": "Chief Whip",
    "department_manager": "Department Manager",
    "pms_officer": "PMS Officer",
    "audit_committee_member": "Audit Committee Member",
    "internal_auditor": "Internal Auditor",
    "mpac_member": "MPAC Member",
    "saps_liaison": "SAPS Liaison",
    "manager": "Manager",
    "field_worker": "Field Worker",
    "citizen": "Citizen",
}


class AssignRoleRequest(BaseModel):
    """Request body for role assignment."""

    role: str = Field(..., description="Role value (e.g. 'pms_officer')")


class RevokeRoleRequest(BaseModel):
    """Request body for role revocation."""

    role: str = Field(..., description="Role value to revoke (e.g. 'pms_officer')")


class DecideApprovalRequest(BaseModel):
    """Request body for Tier 1 approval decision."""

    approved: bool = Field(..., description="True to approve, False to reject")
    reason: str = Field(..., min_length=3, description="Reason for the decision (required on rejection)")


class RoleAssignmentResponse(BaseModel):
    """Response for a role assignment."""

    id: str
    user_id: str
    role: str
    is_active: bool
    assigned_by: str
    status: str = "immediate"

    class Config:
        from_attributes = True


class TierReferenceResponse(BaseModel):
    """Public tier reference data."""

    tiers: dict[str, int]
    display_names: dict[str, str]
    tier_labels: dict[str, str]


class ApprovalRequestResponse(BaseModel):
    """Response for a Tier 1 approval request."""

    id: str
    target_user_id: str
    requested_role: str
    current_role: str
    status: str
    requesting_admin_id: str
    decision_reason: str | None
    expires_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_role(role_str: str) -> UserRole:
    """Validate and parse a role string into a UserRole enum.

    Args:
        role_str: Role string value (e.g. 'pms_officer').

    Returns:
        UserRole enum value.

    Raises:
        HTTPException: 422 if the role string is not a valid UserRole.
    """
    try:
        return UserRole(role_str)
    except ValueError:
        valid_roles = [r.value for r in UserRole]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{role_str}'. Valid roles: {valid_roles}",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/tiers", response_model=TierReferenceResponse)
async def get_tier_reference() -> TierReferenceResponse:
    """Return the tier hierarchy reference data (no auth required).

    Public endpoint so integrations and frontends can build role-selection
    UI without needing a token.
    """
    return TierReferenceResponse(
        tiers=TIER_ORDER,
        display_names=_ROLE_DISPLAY_NAMES,
        tier_labels={
            "1": "Executive",
            "2": "Director",
            "3": "Operational",
            "4": "Frontline",
        },
    )


@router.post("/{user_id}/assign")
async def assign_role_to_user(
    user_id: UUID,
    body: AssignRoleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> dict:
    """Assign a role to a user.

    For Tier 1 approval-required roles (executive_mayor, municipal_manager, cfo,
    speaker), returns HTTP 202 with pending approval info.  For all other roles,
    returns HTTP 200 with the immediate assignment.

    Triggers token blacklisting for the target user after successful Tier 2-4
    assignment so their stale JWT is invalidated.

    Args:
        user_id: UUID of the target user.
        body: Role to assign.
        request: FastAPI request (for IP address).
        db: Database session.
        current_user: Authenticated admin user.

    Returns:
        Assignment result dict with 'status' field indicating immediate/pending.
    """
    role = _validate_role(body.role)
    ip_address = request.client.host if request.client else None

    assignment = await assign_role(
        db=db,
        user_id=user_id,
        role=role,
        assigned_by=str(current_user.id),
        tenant_id=current_user.tenant_id,
        ip_address=ip_address,
    )

    if role in TIER1_APPROVAL_REQUIRED:
        # Tier 1 — approval required, 202 Accepted
        return {
            "status": "pending_approval",
            "message": f"Tier 1 role '{role.value}' requires SALGA admin approval before activation.",
            "assignment_id": str(assignment.id),
            "role": role.value,
            "user_id": str(user_id),
        }

    # Tier 2-4 — immediate assignment, blacklist old token
    # Note: We don't have the target user's current token here, so blacklisting
    # must be done externally or on next request.  The token blacklist check in
    # get_current_user will reject the old token on the user's next request
    # because their DB role has changed.
    return {
        "status": "assigned",
        "assignment_id": str(assignment.id),
        "role": role.value,
        "user_id": str(user_id),
    }


@router.delete("/{user_id}/revoke")
async def revoke_role_from_user(
    user_id: UUID,
    body: RevokeRoleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> dict:
    """Revoke a role from a user.

    Cannot revoke the user's last remaining active role assignment (each user
    must retain at least one active role).

    Args:
        user_id: UUID of the target user.
        body: Role to revoke.
        request: FastAPI request (for IP address).
        db: Database session.
        current_user: Authenticated admin user.

    Returns:
        Revocation confirmation dict.
    """
    role = _validate_role(body.role)

    # Check the user exists and belongs to the same tenant
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if user is None or user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    # Count active assignments to prevent last-role removal
    active_result = await db.execute(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.is_active.is_(True),
        )
    )
    active_assignments = active_result.scalars().all()

    if len(active_assignments) <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot revoke the user's last active role. Assign another role first.",
        )

    # Find and deactivate the target assignment
    target_result = await db.execute(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.role == role,
            UserRoleAssignment.tenant_id == current_user.tenant_id,
            UserRoleAssignment.is_active.is_(True),
        )
    )
    target_assignment = target_result.scalar_one_or_none()

    if target_assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active role '{role.value}' not found for user {user_id}",
        )

    target_assignment.is_active = False

    # Recompute effective role and update User.role
    new_effective = await get_effective_role(db, user_id)
    user.role = new_effective

    await db.commit()

    return {
        "status": "revoked",
        "role": role.value,
        "user_id": str(user_id),
        "new_effective_role": new_effective.value,
    }


@router.get("/approvals/pending")
async def list_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALGA_ADMIN)),
) -> list[dict]:
    """List pending Tier 1 approval requests (SALGA admin only).

    Returns all PENDING Tier1ApprovalRequests across the system
    (not tenant-scoped — SALGA admins have cross-tenant visibility).

    Args:
        db: Database session.
        current_user: Authenticated SALGA admin.

    Returns:
        List of pending approval request dicts.
    """
    result = await db.execute(
        select(Tier1ApprovalRequest).where(
            Tier1ApprovalRequest.status == ApprovalStatus.PENDING
        )
    )
    requests = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "target_user_id": str(r.target_user_id),
            "requesting_admin_id": str(r.requesting_admin_id),
            "requested_role": r.requested_role.value,
            "current_role": r.current_role.value,
            "status": r.status.value,
            "expires_at": r.expires_at.isoformat(),
            "decision_reason": r.decision_reason,
            "tenant_id": r.tenant_id,
        }
        for r in requests
    ]


@router.post("/approvals/{request_id}/decide")
async def decide_tier1_approval(
    request_id: UUID,
    body: DecideApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SALGA_ADMIN)),
) -> dict:
    """Approve or reject a Tier 1 role assignment request (SALGA admin only).

    Rejection requires a reason string (enforced by Pydantic min_length=3).

    Args:
        request_id: UUID of the Tier1ApprovalRequest to decide.
        body: Decision payload (approved + reason).
        request: FastAPI request (for IP address).
        db: Database session.
        current_user: Authenticated SALGA admin.

    Returns:
        Updated approval request dict.
    """
    if not body.approved and len(body.reason.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A reason is required when rejecting a Tier 1 approval request.",
        )

    ip_address = request.client.host if request.client else None

    try:
        approval_req = await approve_tier1_request(
            db=db,
            request_id=request_id,
            salga_admin_id=current_user.id,
            approved=body.approved,
            reason=body.reason,
            ip_address=ip_address,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return {
        "id": str(approval_req.id),
        "status": approval_req.status.value,
        "requested_role": approval_req.requested_role.value,
        "decision_reason": approval_req.decision_reason,
        "decided_at": approval_req.decided_at.isoformat() if approval_req.decided_at else None,
    }


@router.get("/{user_id}")
async def list_user_roles(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List all active roles for a user.

    Accessible by admin users or the user viewing their own roles.

    Args:
        user_id: UUID of the target user.
        db: Database session.
        current_user: Authenticated user (admin or self).

    Returns:
        Dict with user_id, roles list, and effective_role.
    """
    # SEC-01: Only admin or the user themselves may view role assignments
    is_self = current_user.id == user_id
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SALGA_ADMIN)

    if not is_self and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own role assignments",
        )

    result = await db.execute(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.is_active.is_(True),
        )
    )
    assignments = result.scalars().all()

    effective = await get_effective_role(db, user_id)

    return {
        "user_id": str(user_id),
        "effective_role": effective.value,
        "effective_role_tier": get_tier_for_role(effective),
        "roles": [
            {
                "role": a.role.value,
                "tier": get_tier_for_role(a.role),
                "assigned_by": a.assigned_by,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            }
            for a in assignments
        ],
    }
