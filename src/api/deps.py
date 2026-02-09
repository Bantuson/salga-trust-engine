"""API dependencies for FastAPI routes."""
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.audit import set_audit_context
from src.core.database import get_db
from src.core.security import decode_access_token
from src.core.tenant import set_tenant_context
from src.models.user import User, UserRole

__all__ = ["get_db", "get_current_user", "get_current_active_user", "require_role"]

# HTTPBearer security scheme for JWT token extraction
security = HTTPBearer()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate current user from JWT token.

    Args:
        credentials: HTTP Authorization credentials containing JWT token
        db: Database session

    Returns:
        User object if token is valid and user exists

    Raises:
        HTTPException: 401 if token is invalid or user not found/inactive
    """
    # Extract token from credentials
    token = credentials.credentials

    # Decode JWT token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user_id from "sub" claim
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract tenant_id and set tenant context
    tenant_id: str | None = payload.get("tenant_id")
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
