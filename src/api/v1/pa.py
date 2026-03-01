"""Performance Agreement (PA) API routes.

All endpoints are gated by:
- require_pms_ready(): municipality must have settings locked, all departments
  with directors, and at least one PMS officer assigned.
- require_min_tier(3): Tier 3+ (Operational) or higher roles only.

Exception: POST /agreements/{id}/transitions uses require_min_tier(1) because
signers (Municipal Manager, Executive Mayor) are Tier 1. The actual role check
is performed inside PAService.transition_agreement() based on the PA's
manager_role field (PA-06).

Endpoint prefix: /api/v1/pa
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier
from src.models.user import User
from src.schemas.pa import (
    PACreate,
    PAKpiCreate,
    PAKpiResponse,
    PAResponse,
    PAScoreCreate,
    PAScoreResponse,
    PATransitionRequest,
)
from src.services.pa_service import PAService
from src.services.pms_readiness import require_pms_ready

router = APIRouter(
    prefix="/api/v1/pa",
    tags=["Performance Agreements"],
)

_service = PAService()


def _pms_deps() -> list:
    """Shared dependency list: PMS readiness gate + Tier 3+ check."""
    return [Depends(require_pms_ready()), Depends(require_min_tier(3))]


# ---------------------------------------------------------------------------
# Performance Agreements
# ---------------------------------------------------------------------------


@router.post(
    "/agreements",
    response_model=PAResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Create a Performance Agreement for a Section 57 manager (PA-01)",
)
async def create_agreement(
    payload: PACreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PAResponse:
    """Create a Performance Agreement for a Section 57 manager in DRAFT status.

    - financial_year format: YYYY/YY (e.g., "2025/26")
    - manager_role: "section57_director" or "municipal_manager"
    - One PA per (manager, financial_year, tenant) — returns 409 on duplicate

    Returns 422 if section57_manager_id does not exist.
    Returns 409 if a PA already exists for this manager in this financial year.
    """
    agreement = await _service.create_agreement(payload, current_user, db)
    return PAResponse.model_validate(agreement)


@router.get(
    "/agreements",
    response_model=list[PAResponse],
    dependencies=_pms_deps(),
    summary="List Performance Agreements for the current tenant",
)
async def list_agreements(
    financial_year: str | None = Query(
        default=None,
        description="Filter by financial year (YYYY/YY format, e.g., '2025/26')",
    ),
    db: AsyncSession = Depends(get_db),
) -> list[PAResponse]:
    """Return all Performance Agreements for the authenticated user's municipality.

    Optionally filter by financial year (e.g., financial_year=2025/26).
    """
    agreements = await _service.list_agreements(financial_year, db)
    return [PAResponse.model_validate(a) for a in agreements]


@router.get(
    "/agreements/{agreement_id}",
    response_model=PAResponse,
    dependencies=_pms_deps(),
    summary="Get a single Performance Agreement",
)
async def get_agreement(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> PAResponse:
    """Return a single Performance Agreement by ID (404 if not found)."""
    agreement = await _service.get_agreement(agreement_id, db)
    if agreement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Performance Agreement {agreement_id} not found",
        )
    return PAResponse.model_validate(agreement)


# ---------------------------------------------------------------------------
# PA KPIs
# ---------------------------------------------------------------------------


@router.post(
    "/agreements/{agreement_id}/kpis",
    response_model=PAKpiResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Add a KPI to a Performance Agreement (PA-02)",
)
async def add_kpi(
    agreement_id: UUID,
    payload: PAKpiCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PAKpiResponse:
    """Add a KPI to a Performance Agreement.

    - sdbip_kpi_id: validated against sdbip_kpis table (422 if not found)
    - weight: 0-100 (422 if adding this KPI would exceed total weight of 100)
    - individual_target: manager's individual target for this KPI (>= 0)

    Returns 404 if agreement not found.
    Returns 422 if SDBIP KPI not found or weight sum would exceed 100.
    """
    kpi = await _service.add_kpi(agreement_id, payload, current_user, db)
    return PAKpiResponse.model_validate(kpi)


@router.get(
    "/agreements/{agreement_id}/kpis",
    response_model=list[PAKpiResponse],
    dependencies=_pms_deps(),
    summary="List KPIs for a Performance Agreement",
)
async def list_kpis(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[PAKpiResponse]:
    """Return all KPIs for a given Performance Agreement."""
    kpis = await _service.list_kpis(agreement_id, db)
    return [PAKpiResponse.model_validate(k) for k in kpis]


# ---------------------------------------------------------------------------
# PA State Machine Transitions
# ---------------------------------------------------------------------------


@router.post(
    "/agreements/{agreement_id}/transitions",
    response_model=PAResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(1))],
    summary="Transition PA state (sign/open_review/assess) (PA-05, PA-06)",
)
async def transition_agreement(
    agreement_id: UUID,
    payload: PATransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PAResponse:
    """Apply a state machine transition to a Performance Agreement.

    Valid events:
    - "sign":        draft -> signed       (MM signs director PA; ExecMayor signs MM PA)
    - "open_review": signed -> under_review
    - "assess":      under_review -> assessed (sets popia_retention_flag=True)

    Tier 1 gate is used because signers (MM, ExecMayor) are Tier 1.
    The actual role check happens inside the service based on the PA's manager_role.
    Admin and salga_admin bypass the role restriction.

    Returns 403 if user does not have the required signing role.
    Returns 409 if the transition is not allowed in the current state.
    """
    agreement = await _service.transition_agreement(
        agreement_id, payload.event, current_user, db
    )
    return PAResponse.model_validate(agreement)
