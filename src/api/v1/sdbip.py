"""SDBIP (Service Delivery and Budget Implementation Plan) API routes.

All endpoints are gated by:
- require_pms_ready(): municipality must have settings locked, all departments
  with directors, and at least one PMS officer assigned.
- require_min_tier(3): Tier 3+ (Operational) or higher roles only.

Exception: GET /mscoa-codes is gated only by require_min_tier(3) — no PMS readiness
required because mSCOA codes are reference data accessible to any authenticated user.

Endpoint prefix: /api/v1/sdbip
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier
from src.models.user import User
from src.schemas.sdbip import (
    MscoaSearchResponse,
    QuarterlyTargetBulkCreate,
    QuarterlyTargetResponse,
    SDBIPKpiCreate,
    SDBIPKpiResponse,
    SDBIPScorecardCreate,
    SDBIPScorecardResponse,
)
from src.services.pms_readiness import require_pms_ready
from src.services.sdbip_service import SDBIPService

router = APIRouter(
    prefix="/api/v1/sdbip",
    tags=["SDBIP"],
)

_service = SDBIPService()


def _pms_deps() -> list:
    """Shared dependency list: PMS readiness gate + Tier 3+ check."""
    return [Depends(require_pms_ready()), Depends(require_min_tier(3))]


# ---------------------------------------------------------------------------
# SDBIP Scorecards
# ---------------------------------------------------------------------------


@router.post(
    "/scorecards",
    response_model=SDBIPScorecardResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Create an SDBIP scorecard (top-layer or departmental)",
)
async def create_scorecard(
    payload: SDBIPScorecardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SDBIPScorecardResponse:
    """Create a new SDBIP scorecard in draft status.

    - layer="top": Municipal top-layer scorecard (department_id must be null)
    - layer="departmental": Department-level scorecard (department_id required)

    Financial year format: YYYY/YY (e.g., "2025/26").
    """
    scorecard = await _service.create_scorecard(payload, current_user, db)
    return SDBIPScorecardResponse.model_validate(scorecard)


@router.get(
    "/scorecards",
    response_model=list[SDBIPScorecardResponse],
    dependencies=_pms_deps(),
    summary="List SDBIP scorecards for the current tenant",
)
async def list_scorecards(
    financial_year: str | None = Query(
        default=None,
        description="Filter by financial year (YYYY/YY format, e.g., '2025/26')",
    ),
    db: AsyncSession = Depends(get_db),
) -> list[SDBIPScorecardResponse]:
    """Return all SDBIP scorecards for the authenticated user's municipality.

    Optionally filter by financial year (e.g., financial_year=2025/26).
    """
    scorecards = await _service.list_scorecards(financial_year, db)
    return [SDBIPScorecardResponse.model_validate(s) for s in scorecards]


@router.get(
    "/scorecards/{scorecard_id}",
    response_model=SDBIPScorecardResponse,
    dependencies=_pms_deps(),
    summary="Get a single SDBIP scorecard",
)
async def get_scorecard(
    scorecard_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SDBIPScorecardResponse:
    """Return a single SDBIP scorecard by ID (404 if not found)."""
    from fastapi import HTTPException

    scorecard = await _service.get_scorecard(scorecard_id, db)
    if scorecard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SDBIP scorecard {scorecard_id} not found",
        )
    return SDBIPScorecardResponse.model_validate(scorecard)


# ---------------------------------------------------------------------------
# SDBIP KPIs
# ---------------------------------------------------------------------------


@router.post(
    "/scorecards/{scorecard_id}/kpis",
    response_model=SDBIPKpiResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Create a KPI within an SDBIP scorecard",
)
async def create_kpi(
    scorecard_id: UUID,
    payload: SDBIPKpiCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SDBIPKpiResponse:
    """Create a KPI within an SDBIP scorecard.

    - If mscoa_code_id provided: validated against mscoa_reference table (422 if not found)
    - If idp_objective_id provided: validated against idp_objectives table (422 if not found)
    - weight must be between 0 and 100 (sum of KPI weights per scorecard should total 100)
    """
    kpi = await _service.create_kpi(scorecard_id, payload, current_user, db)
    return SDBIPKpiResponse.model_validate(kpi)


@router.get(
    "/scorecards/{scorecard_id}/kpis",
    response_model=list[SDBIPKpiResponse],
    dependencies=_pms_deps(),
    summary="List KPIs for an SDBIP scorecard",
)
async def list_kpis(
    scorecard_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[SDBIPKpiResponse]:
    """Return all KPIs for a given SDBIP scorecard."""
    kpis = await _service.list_kpis(scorecard_id, db)
    return [SDBIPKpiResponse.model_validate(k) for k in kpis]


@router.get(
    "/kpis/{kpi_id}",
    response_model=SDBIPKpiResponse,
    dependencies=_pms_deps(),
    summary="Get a single SDBIP KPI",
)
async def get_kpi(
    kpi_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SDBIPKpiResponse:
    """Return a single SDBIP KPI by ID (404 if not found)."""
    from fastapi import HTTPException

    kpi = await _service.get_kpi(kpi_id, db)
    if kpi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SDBIP KPI {kpi_id} not found",
        )
    return SDBIPKpiResponse.model_validate(kpi)


# ---------------------------------------------------------------------------
# Quarterly Targets
# ---------------------------------------------------------------------------


@router.put(
    "/kpis/{kpi_id}/quarterly-targets",
    response_model=list[QuarterlyTargetResponse],
    dependencies=_pms_deps(),
    summary="Set all 4 quarterly targets for a KPI",
)
async def set_quarterly_targets(
    kpi_id: UUID,
    payload: QuarterlyTargetBulkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuarterlyTargetResponse]:
    """Set (replace) quarterly targets for a KPI.

    Exactly 4 targets must be provided (Q1, Q2, Q3, Q4 — one for each quarter).
    Existing targets are replaced atomically (delete + insert).

    South African financial year: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun.
    """
    targets = await _service.set_quarterly_targets(kpi_id, payload, current_user, db)
    return [QuarterlyTargetResponse.model_validate(t) for t in targets]


@router.get(
    "/kpis/{kpi_id}/quarterly-targets",
    response_model=list[QuarterlyTargetResponse],
    dependencies=_pms_deps(),
    summary="Get quarterly targets for a KPI",
)
async def get_quarterly_targets(
    kpi_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[QuarterlyTargetResponse]:
    """Return all quarterly targets for a KPI (up to 4, ordered by quarter)."""
    targets = await _service.get_quarterly_targets(kpi_id, db)
    return [QuarterlyTargetResponse.model_validate(t) for t in targets]


# ---------------------------------------------------------------------------
# mSCOA Reference Lookup
# ---------------------------------------------------------------------------


@router.get(
    "/mscoa-codes",
    response_model=list[MscoaSearchResponse],
    dependencies=[Depends(require_min_tier(3))],  # NO PMS readiness gate — reference data
    summary="Search mSCOA budget codes (National Treasury reference table)",
)
async def search_mscoa_codes(
    segment: str | None = Query(
        default=None,
        description="Filter by mSCOA segment (e.g., IE, FX, IA). Case-insensitive.",
    ),
    q: str | None = Query(
        default=None,
        description="Search description keyword (case-insensitive contains match)",
    ),
    db: AsyncSession = Depends(get_db),
) -> list[MscoaSearchResponse]:
    """Search the National Treasury mSCOA v5.5 budget code reference table.

    This endpoint does NOT require PMS readiness — it returns global reference data
    accessible to any Tier 3+ user for budget code selection.

    Returns up to 50 results ordered by segment, then code.

    Examples:
    - /mscoa-codes?segment=IE — all expenditure codes
    - /mscoa-codes?q=employee — codes matching "employee" in description
    - /mscoa-codes?segment=FX&q=water — FX codes matching "water"
    """
    codes = await _service.search_mscoa(segment, q, db)
    return [MscoaSearchResponse.model_validate(c) for c in codes]
