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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier
from src.models.role_assignment import UserRoleAssignment
from src.models.user import User, UserRole
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
# Eligible Managers (for frontend PA creation form)
# ---------------------------------------------------------------------------

# Roles eligible for Section 57 performance agreements
_ELIGIBLE_ROLES = {UserRole.SECTION56_DIRECTOR, UserRole.MUNICIPAL_MANAGER}


@router.get(
    "/eligible-managers",
    dependencies=_pms_deps(),
    summary="List users eligible for Section 57 performance agreements",
)
async def list_eligible_managers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return users with section56_director or municipal_manager role assignments.

    Used by the frontend to populate the manager selector when creating a PA.
    """
    result = await db.execute(
        select(User.id, User.full_name, User.email, UserRoleAssignment.role)
        .join(UserRoleAssignment, User.id == UserRoleAssignment.user_id)
        .where(
            UserRoleAssignment.role.in_(_ELIGIBLE_ROLES),
            UserRoleAssignment.is_active.is_(True),
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
    )
    rows = result.all()
    return [
        {
            "id": str(row.id),
            "full_name": row.full_name,
            "email": row.email,
            "role": row.role.value,
        }
        for row in rows
    ]


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
    summary="List KPIs for a Performance Agreement (with quarterly scores)",
)
async def list_kpis(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[PAKpiResponse]:
    """Return all KPIs for a given Performance Agreement with nested quarterly scores.

    Uses get_kpis_with_scores() which eager-loads quarterly_scores via selectinload
    so the response includes nested score data for frontend display (PA-02).
    """
    kpis = await _service.get_kpis_with_scores(agreement_id, db)
    return [PAKpiResponse.model_validate(k) for k in kpis]


# ---------------------------------------------------------------------------
# PA Quarterly Scores
# ---------------------------------------------------------------------------


@router.post(
    "/kpis/{pa_kpi_id}/scores",
    response_model=PAScoreResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(1))],
    summary="Submit a quarterly score for a PA KPI (PA-03)",
)
async def add_quarterly_score(
    pa_kpi_id: UUID,
    payload: PAScoreCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PAScoreResponse:
    """Submit a quarterly performance score for a PA KPI.

    Tier 1 gate is used because evaluators (MM, ExecMayor) are Tier 1.
    Admin and salga_admin bypass the tier restriction.

    - quarter: Q1, Q2, Q3, or Q4
    - score: 0-100 (inclusive)
    - notes: optional assessor notes

    Returns 404 if PA KPI not found.
    Returns 409 if a score already exists for this (pa_kpi_id, quarter).
    """
    score = await _service.add_score(pa_kpi_id, payload, current_user, db)
    return PAScoreResponse.model_validate(score)


@router.post(
    "/agreements/{agreement_id}/compile-score",
    response_model=PAResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(2))],
    summary="Compile annual assessment score from quarterly scores (PA-04)",
)
async def compile_annual_score(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> PAResponse:
    """Compute and store the weighted annual score for a Performance Agreement.

    Annual score = sum(avg_quarterly_score_per_kpi * kpi_weight) / sum(kpi_weights)

    Tier 2 gate (Directors and above).

    Returns 404 if agreement not found.
    Returns the updated PerformanceAgreement with annual_score set.
    """
    await _service.compile_annual_score(agreement_id, db)
    agreement = await _service.get_agreement(agreement_id, db)
    if agreement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Performance Agreement {agreement_id} not found",
        )
    return PAResponse.model_validate(agreement)


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
