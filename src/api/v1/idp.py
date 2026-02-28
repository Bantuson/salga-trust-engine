"""IDP (Integrated Development Plan) API routes.

All endpoints are gated by:
- require_pms_ready(): municipality must have settings locked, all departments
  with directors, and at least one PMS officer assigned.
- require_min_tier(3): Tier 3+ (Operational) or higher roles only.

Endpoint prefix: /api/v1/idp
"""
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier
from src.models.user import User
from src.schemas.idp import (
    IDPCycleCreate,
    IDPCycleResponse,
    IDPGoalCreate,
    IDPGoalResponse,
    IDPObjectiveCreate,
    IDPObjectiveResponse,
    IDPTransitionRequest,
    IDPVersionCreate,
    IDPVersionResponse,
)
from src.services.idp_service import IDPService
from src.services.pms_readiness import require_pms_ready

router = APIRouter(
    prefix="/api/v1/idp",
    tags=["IDP"],
)

_service = IDPService()


def _pms_deps() -> list:
    """Shared dependency list: PMS readiness gate + Tier 3+ check."""
    return [Depends(require_pms_ready()), Depends(require_min_tier(3))]


# ---------------------------------------------------------------------------
# IDP Cycles
# ---------------------------------------------------------------------------

@router.post(
    "/cycles",
    response_model=IDPCycleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Create a new 5-year IDP cycle",
)
async def create_cycle(
    payload: IDPCycleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IDPCycleResponse:
    """Create a new IDP cycle in draft status.

    The cycle title must be unique within the tenant.
    The cycle spans exactly 5 years (end_year = start_year + 5).
    """
    cycle = await _service.create_cycle(payload, current_user, db)
    return IDPCycleResponse.model_validate(cycle)


@router.get(
    "/cycles",
    response_model=list[IDPCycleResponse],
    dependencies=_pms_deps(),
    summary="List all IDP cycles for the current tenant",
)
async def list_cycles(
    db: AsyncSession = Depends(get_db),
) -> list[IDPCycleResponse]:
    """Return all IDP cycles for the authenticated user's municipality."""
    cycles = await _service.list_cycles(db)
    return [IDPCycleResponse.model_validate(c) for c in cycles]


@router.get(
    "/cycles/{cycle_id}",
    response_model=IDPCycleResponse,
    dependencies=_pms_deps(),
    summary="Get a single IDP cycle",
)
async def get_cycle(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> IDPCycleResponse:
    """Return a single IDP cycle by ID (404 if not found)."""
    from fastapi import HTTPException
    cycle = await _service.get_cycle(cycle_id, db)
    if cycle is None:
        raise HTTPException(status_code=404, detail=f"IDP cycle {cycle_id} not found")
    return IDPCycleResponse.model_validate(cycle)


@router.post(
    "/cycles/{cycle_id}/transition",
    response_model=IDPCycleResponse,
    dependencies=_pms_deps(),
    summary="Transition IDP cycle status",
)
async def transition_cycle(
    cycle_id: UUID,
    payload: IDPTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IDPCycleResponse:
    """Apply a state machine event to transition cycle status.

    - draft -> approved:      event="submit"
    - approved -> under_review: event="open_review"
    - under_review -> approved: event="re_approve"

    Returns 409 if the transition is not allowed in the current state.
    """
    cycle = await _service.transition_cycle(cycle_id, payload.event, current_user, db)
    return IDPCycleResponse.model_validate(cycle)


# ---------------------------------------------------------------------------
# IDP Goals
# ---------------------------------------------------------------------------

@router.post(
    "/cycles/{cycle_id}/goals",
    response_model=IDPGoalResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Add a strategic goal to an IDP cycle",
)
async def add_goal(
    cycle_id: UUID,
    payload: IDPGoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IDPGoalResponse:
    """Add a strategic goal aligned to a National KPA under an IDP cycle."""
    goal = await _service.add_goal(cycle_id, payload, current_user, db)
    return IDPGoalResponse.model_validate(goal)


@router.get(
    "/cycles/{cycle_id}/goals",
    response_model=list[IDPGoalResponse],
    dependencies=_pms_deps(),
    summary="List strategic goals for an IDP cycle",
)
async def list_goals(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[IDPGoalResponse]:
    """Return all strategic goals for a given IDP cycle."""
    goals = await _service.list_goals(cycle_id, db)
    return [IDPGoalResponse.model_validate(g) for g in goals]


# ---------------------------------------------------------------------------
# IDP Objectives
# ---------------------------------------------------------------------------

@router.post(
    "/goals/{goal_id}/objectives",
    response_model=IDPObjectiveResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Add an objective under a strategic goal",
)
async def add_objective(
    goal_id: UUID,
    payload: IDPObjectiveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IDPObjectiveResponse:
    """Add a strategic objective under an IDP goal.

    Objectives serve as SDBIP KPI anchor points (linked in Plan 28-04).
    """
    objective = await _service.add_objective(goal_id, payload, current_user, db)
    return IDPObjectiveResponse.model_validate(objective)


@router.get(
    "/goals/{goal_id}/objectives",
    response_model=list[IDPObjectiveResponse],
    dependencies=_pms_deps(),
    summary="List objectives for a strategic goal",
)
async def list_objectives(
    goal_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[IDPObjectiveResponse]:
    """Return all objectives under an IDP strategic goal."""
    objectives = await _service.list_objectives(goal_id, db)
    return [IDPObjectiveResponse.model_validate(o) for o in objectives]


# ---------------------------------------------------------------------------
# IDP Versions
# ---------------------------------------------------------------------------

@router.post(
    "/cycles/{cycle_id}/versions",
    response_model=IDPVersionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Create an annual IDP review version",
)
async def create_version(
    cycle_id: UUID,
    payload: IDPVersionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IDPVersionResponse:
    """Create an annual review version within an IDP cycle.

    Version numbers 1-5 must be unique per cycle.
    Financial year format: YYYY/YY (e.g., "2025/26").
    """
    version = await _service.create_version(cycle_id, payload, current_user, db)
    return IDPVersionResponse.model_validate(version)


@router.get(
    "/cycles/{cycle_id}/versions",
    response_model=list[IDPVersionResponse],
    dependencies=_pms_deps(),
    summary="List annual review versions for an IDP cycle",
)
async def list_versions(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[IDPVersionResponse]:
    """Return all annual review versions for an IDP cycle."""
    versions = await _service.list_versions(cycle_id, db)
    return [IDPVersionResponse.model_validate(v) for v in versions]


# ---------------------------------------------------------------------------
# Golden Thread
# ---------------------------------------------------------------------------


@router.get(
    "/cycles/{cycle_id}/golden-thread",
    dependencies=_pms_deps(),
    summary="Get the full IDP -> Goals -> Objectives -> KPIs golden thread",
)
async def get_golden_thread(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the full golden thread hierarchy for an IDP cycle.

    The golden thread represents statutory traceability from high-level
    IDP strategy (goals, objectives) down to measurable SDBIP KPIs.

    Uses selectinload eager loading for efficient single-query fetching.
    Returns 404 if the cycle does not exist.
    """
    return await _service.get_golden_thread(cycle_id, db)
