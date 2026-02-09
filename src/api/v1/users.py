"""User management endpoints."""
from fastapi import APIRouter, Depends

from src.api.deps import get_current_active_user
from src.models.user import User
from src.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
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
