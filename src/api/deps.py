"""API dependencies for FastAPI routes."""
import logging
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.audit import set_audit_context
from src.core.database import get_db
from src.core.security import verify_supabase_token
from src.core.tenant import set_tenant_context
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

__all__ = [
    "get_db",
    "get_current_user",
    "get_current_active_user",
    "require_role",
    "require_min_tier",
    "TIER_ORDER",
]

# ---------------------------------------------------------------------------
# Role tier hierarchy (Phase 27).
# Lower number = higher authority.  Tier 1 = Executive, Tier 4 = Frontline.
# Used by require_min_tier() to support inheritance-style permission checks.
# ---------------------------------------------------------------------------
TIER_ORDER: dict[str, int] = {
    # Tier 1 — Executive
    "executive_mayor": 1,
    "municipal_manager": 1,
    "cfo": 1,
    "speaker": 1,
    "admin": 1,
    "salga_admin": 1,
    # Tier 2 — Directors
    "section56_director": 2,
    "ward_councillor": 2,
    "chief_whip": 2,
    # Tier 3 — Operational
    "department_manager": 3,
    "pms_officer": 3,
    "audit_committee_member": 3,
    "internal_auditor": 3,
    "mpac_member": 3,
    "saps_liaison": 3,
    "manager": 3,
    # Tier 4 — Frontline
    "field_worker": 4,
    "citizen": 4,
}

# HTTPBearer security scheme for JWT token extraction
security = HTTPBearer()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate current user from Supabase JWT token.

    Args:
        request: FastAPI request object
        credentials: HTTP Authorization credentials containing Supabase JWT token
        db: Database session

    Returns:
        User object if token is valid and user exists

    Raises:
        HTTPException: 401 if token is invalid or user not found/inactive
    """
    # Extract token from credentials
    token = credentials.credentials

    # Verify Supabase JWT token
    payload = verify_supabase_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check Redis JWT blacklist (Phase 27 — force-logout on role change).
    # Fail-open on Redis connection errors: a Redis outage must not lock out users.
    try:
        from src.services.rbac_service import is_token_blacklisted  # noqa: PLC0415
        if await is_token_blacklisted(token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise  # re-raise our own 401
    except Exception as exc:  # noqa: BLE001 — Redis connection failure
        logger.warning("Redis blacklist check failed (fail-open): %s", exc)

    # Extract user_id from "sub" claim (Supabase Auth user ID)
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract role from app_metadata (injected by custom access token hook)
    app_metadata = payload.get("app_metadata", {})
    role = app_metadata.get("role", "citizen")  # Default to citizen if not set

    # Extract tenant_id from app_metadata and set tenant context
    tenant_id: str | None = app_metadata.get("tenant_id")
    if tenant_id:
        set_tenant_context(tenant_id)

    # Query user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    # Validate user exists and is active
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Set audit context for request tracking
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    set_audit_context(
        user_id=str(user.id),
        ip_address=ip_address,
        user_agent=user_agent
    )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are active and not deleted.

    Args:
        current_user: User from get_current_user dependency

    Returns:
        User object if active and not deleted

    Raises:
        HTTPException: 403 if user is inactive or deleted
    """
    if not current_user.is_active or current_user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or deleted"
        )

    return current_user


def require_role(*allowed_roles: UserRole) -> Callable:
    """Create a dependency that requires specific user role(s).

    This is a factory function that creates role-checking dependencies
    for protecting endpoints with role-based access control.

    Args:
        *allowed_roles: One or more UserRole values that are allowed

    Returns:
        Async dependency function that validates user role

    Example:
        @app.get("/admin", dependencies=[Depends(require_role(UserRole.ADMIN))])
        async def admin_endpoint():
            return {"message": "Admin only"}
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if current user has one of the allowed roles.

        Args:
            current_user: User from get_current_user dependency

        Returns:
            User object if role is authorized

        Raises:
            HTTPException: 403 if user role is not in allowed_roles
        """
        if current_user.role not in allowed_roles:
            roles_str = ", ".join([role.value for role in allowed_roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {roles_str}"
            )

        return current_user

    return role_checker


def require_min_tier(min_tier: int) -> Callable:
    """Create a dependency that enforces tier-based permission inheritance.

    Tier hierarchy (ascending privilege): 1=Executive, 2=Director, 3=Operational, 4=Frontline.

    A user passes if `TIER_ORDER[user.role] <= min_tier`.
    This means a Tier 1 user always passes a require_min_tier(3) check (inheriting
    access downward), but a Tier 4 citizen always fails require_min_tier(1).

    CRITICAL: Do NOT use this for SEC-05 GBV firewall checks.  Use require_role()
    with explicit UserRole.SAPS_LIAISON / UserRole.ADMIN for those endpoints.

    Args:
        min_tier: Minimum tier level required (1-4).  Lower = more restrictive.

    Returns:
        Async dependency function that validates the user's tier level.

    Example:
        @app.get("/pms/kpi", dependencies=[Depends(require_min_tier(3))])
        async def kpi_endpoint():
            # Accessible by Tier 1, 2, and 3 users
            ...
    """

    async def tier_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if current user's role tier is within the allowed range.

        Args:
            current_user: User from get_current_user dependency

        Returns:
            User object if tier check passes

        Raises:
            HTTPException: 403 if user's tier is higher (less privileged) than min_tier
        """
        user_tier = TIER_ORDER.get(current_user.role.value, 99)
        if user_tier > min_tier:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Requires tier {min_tier} or higher "
                    f"(Executive=1, Director=2, Operational=3, Frontline=4)"
                ),
            )
        return current_user

    return tier_checker
