"""User management endpoints."""
from fastapi import APIRouter, Depends
from starlette.requests import Request

from src.api.deps import get_current_active_user
from src.middleware.rate_limit import SENSITIVE_READ_RATE_LIMIT, limiter
from src.models.user import User
from src.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_current_user_profile(
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """Get current authenticated user's profile.

    Requires valid JWT authentication token.

    Args:
        current_user: Current authenticated user from token

    Returns:
        UserResponse with current user data
    """
    return UserResponse.model_validate(current_user)
