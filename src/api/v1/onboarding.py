"""Municipality onboarding wizard API for guided setup flow.

Provides endpoints for:
- Retrieving onboarding progress (which steps completed)
- Saving/updating individual step data (upsert pattern)
- Marking onboarding as complete

Security:
- All endpoints require authentication
- Only admins/managers can manage onboarding for their municipality
"""
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_role
from src.models.onboarding_state import OnboardingState
from src.models.user import User, UserRole
from src.schemas.onboarding import (
    OnboardingProgressResponse,
    OnboardingStepResponse,
    OnboardingStepSave,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# Valid step IDs in order
VALID_STEPS = ["profile", "team", "wards", "sla", "complete"]


@router.get("/state", response_model=OnboardingProgressResponse)
async def get_onboarding_state(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> OnboardingProgressResponse:
    """Get full onboarding progress for current user's municipality.

    Returns all saved steps with completion status and calculates overall
    progress percentage.

    Args:
        current_user: Authenticated admin/manager user
        db: Database session

    Returns:
        Onboarding progress with all steps and completion percentage

    Raises:
        HTTPException: 403 if user is not admin/manager
    """
    municipality_id = current_user.municipality_id

    # Fetch all onboarding steps for this municipality
    result = await db.execute(
        select(OnboardingState)
        .where(OnboardingState.municipality_id == municipality_id)
        .order_by(OnboardingState.created_at)
    )
    saved_steps = result.scalars().all()

    # Convert to response format (parse JSON step_data)
    steps = []
    for step in saved_steps:
        step_data_dict = json.loads(step.step_data) if step.step_data else None
        steps.append(
            OnboardingStepResponse(
                step_id=step.step_id,
                step_data=step_data_dict,
                is_completed=step.is_completed,
                completed_at=step.completed_at,
            )
        )

    # Calculate overall progress (completed steps / total steps)
    completed_count = sum(1 for step in saved_steps if step.is_completed)
    overall_progress = (completed_count / len(VALID_STEPS)) * 100

    return OnboardingProgressResponse(
        municipality_id=municipality_id,
        steps=steps,
        overall_progress=overall_progress,
    )


@router.put("/state/{step_id}", response_model=OnboardingStepResponse)
async def save_onboarding_step(
    step_id: str,
    step_data: OnboardingStepSave,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStepResponse:
    """Save or update onboarding step data (upsert pattern).

    Uses PostgreSQL's INSERT ... ON CONFLICT to upsert step data. Allows the
    wizard to be saved and resumed across sessions.

    Args:
        step_id: Step identifier (must match step_data.step_id)
        step_data: Step data to save
        current_user: Authenticated admin/manager user
        db: Database session

    Returns:
        Saved step data

    Raises:
        HTTPException: 400 if step_id mismatch or invalid step_id
        HTTPException: 403 if user is not admin/manager
    """
    # Validate step_id matches body
    if step_id != step_data.step_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Step ID mismatch: URL has '{step_id}', body has '{step_data.step_id}'"
        )

    # Validate step_id is valid
    if step_id not in VALID_STEPS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid step_id '{step_id}'. Must be one of: {', '.join(VALID_STEPS)}"
        )

    municipality_id = current_user.municipality_id

    # Serialize step_data dict to JSON string
    step_data_json = json.dumps(step_data.step_data) if step_data.step_data else None
    completed_at = datetime.now(timezone.utc) if step_data.is_completed else None

    # Upsert using PostgreSQL INSERT ... ON CONFLICT
    stmt = insert(OnboardingState).values(
        municipality_id=municipality_id,
        step_id=step_id,
        step_data=step_data_json,
        is_completed=step_data.is_completed,
        completed_at=completed_at,
    ).on_conflict_do_update(
        constraint='uq_onboarding_municipality_step',
        set_={
            'step_data': step_data_json,
            'is_completed': step_data.is_completed,
            'completed_at': completed_at,
            'updated_at': datetime.now(timezone.utc),
        }
    ).returning(OnboardingState)

    result = await db.execute(stmt)
    await db.commit()

    saved_step = result.scalar_one()

    logger.info(
        f"Onboarding step '{step_id}' saved for municipality {municipality_id} "
        f"by {current_user.full_name} (completed={step_data.is_completed})"
    )

    return OnboardingStepResponse(
        step_id=saved_step.step_id,
        step_data=json.loads(saved_step.step_data) if saved_step.step_data else None,
        is_completed=saved_step.is_completed,
        completed_at=saved_step.completed_at,
    )


@router.post("/complete", status_code=status.HTTP_200_OK)
async def complete_onboarding(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark onboarding as complete.

    Sets the 'complete' step to is_completed=true. This signals that the
    municipality has finished setup and is ready to go live.

    Args:
        current_user: Authenticated admin/manager user
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: 403 if user is not admin/manager
    """
    municipality_id = current_user.municipality_id

    # Upsert 'complete' step
    stmt = insert(OnboardingState).values(
        municipality_id=municipality_id,
        step_id='complete',
        step_data=json.dumps({'completed_by': str(current_user.id)}),
        is_completed=True,
        completed_at=datetime.now(timezone.utc),
    ).on_conflict_do_update(
        constraint='uq_onboarding_municipality_step',
        set_={
            'is_completed': True,
            'completed_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
    )

    await db.execute(stmt)
    await db.commit()

    logger.info(
        f"Onboarding completed for municipality {municipality_id} "
        f"by {current_user.full_name}"
    )

    # TODO: Optionally update municipality.is_active or onboarding_completed flag

    return {"message": "Onboarding complete", "municipality_id": str(municipality_id)}
