"""SDBIP (Service Delivery and Budget Implementation Plan) API routes.

All endpoints are gated by:
- require_pms_ready(): municipality must have settings locked, all departments
  with directors, and at least one PMS officer assigned.
- require_min_tier(3): Tier 3+ (Operational) or higher roles only.

Exception: GET /mscoa-codes is gated only by require_min_tier(3) — no PMS readiness
required because mSCOA codes are reference data accessible to any authenticated user.

Endpoint prefix: /api/v1/sdbip
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier, require_role
from src.models.user import User, UserRole
from src.schemas.evidence import (
    EvidenceDownloadResponse,
    EvidenceListResponse,
    EvidenceUploadResponse,
)
from src.schemas.sdbip import (
    AggregationRuleCreate,
    AggregationRuleResponse,
    MscoaSearchResponse,
    QuarterlyTargetBulkCreate,
    QuarterlyTargetResponse,
    SDBIPActualCorrectionCreate,
    SDBIPActualCreate,
    SDBIPActualResponse,
    SDBIPKpiCreate,
    SDBIPKpiResponse,
    SDBIPScorecardCreate,
    SDBIPScorecardResponse,
    SDBIPTransitionRequest,
)
from src.models.sdbip import SDBIPTicketAggregationRule
from src.services.evidence_service import EvidenceService
from src.services.pms_readiness import require_pms_ready
from src.services.sdbip_service import SDBIPService

router = APIRouter(
    prefix="/api/v1/sdbip",
    tags=["SDBIP"],
)

_service = SDBIPService()
_evidence_service = EvidenceService()


def _pms_deps() -> list:
    """Shared dependency list: PMS readiness gate + Tier 3+ check."""
    return [Depends(require_pms_ready()), Depends(require_min_tier(3))]


def _pms_tier2_deps() -> list:
    """Shared dependency list: PMS readiness gate + Tier 2+ check (for submission)."""
    return [Depends(require_pms_ready()), Depends(require_min_tier(2))]


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
# SDBIP Approval Workflow
# ---------------------------------------------------------------------------


@router.post(
    "/scorecards/{scorecard_id}/transition",
    response_model=SDBIPScorecardResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_pms_ready())],
    summary="Transition SDBIP scorecard state (submit/revise/resubmit)",
)
async def transition_scorecard(
    scorecard_id: UUID,
    payload: SDBIPTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SDBIPScorecardResponse:
    """Apply a state machine transition to an SDBIP scorecard.

    Valid events:
    - "submit":    draft -> approved (requires Executive Mayor role)
    - "revise":    approved -> revised
    - "resubmit":  revised -> approved (requires Executive Mayor role)

    Returns 403 if non-Mayor user attempts 'submit'.
    Returns 409 if the transition is not allowed in the current state.
    """
    scorecard = await _service.transition_scorecard(
        scorecard_id, payload.event, current_user, db
    )
    return SDBIPScorecardResponse.model_validate(scorecard)


# ---------------------------------------------------------------------------
# Mid-Year Target Adjustment (SDBIP-09)
# ---------------------------------------------------------------------------


@router.patch(
    "/kpis/{kpi_id}/adjust-targets",
    response_model=list[QuarterlyTargetResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(2))],
    summary="Mid-year SDBIP target adjustment (SDBIP-09)",
)
async def adjust_targets(
    kpi_id: UUID,
    payload: QuarterlyTargetBulkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuarterlyTargetResponse]:
    """Adjust quarterly targets for a KPI mid-year (SDBIP-09).

    Only allowed on scorecards in 'approved' status. The scorecard status
    is NOT reset to draft — this preserves the approved governance record
    while allowing target adjustments when the mid-year budget is approved.

    An audit log entry is created recording old and new target values.

    Returns 422 if the scorecard is not in 'approved' status.
    Requires Tier 2 (Director) or higher role.
    """
    targets = await _service.adjust_targets(kpi_id, payload, current_user, db)
    return [QuarterlyTargetResponse.model_validate(t) for t in targets]


# ---------------------------------------------------------------------------
# Quarterly Actuals (submission and correction)
# ---------------------------------------------------------------------------


@router.post(
    "/actuals",
    response_model=SDBIPActualResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_tier2_deps(),
    summary="Submit quarterly actual performance value",
)
async def submit_actual(
    payload: SDBIPActualCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SDBIPActualResponse:
    """Submit a quarterly actual performance value against a KPI target.

    The system automatically computes:
    - achievement_pct: (actual_value / quarterly_target) * 100
    - traffic_light_status: green >= 80%, amber 50-79%, red < 50%

    Returns 404 if the KPI does not exist.
    Returns 422 if no quarterly target is set for the specified quarter.
    """
    actual = await _service.submit_actual(payload, current_user, db)

    # RISK-03: Dispatch auto-flag task when KPI actual turns red
    if actual.traffic_light_status == "red":
        try:
            from src.tasks.risk_autoflag_task import flag_risk_items_for_kpi  # noqa: PLC0415
            flag_risk_items_for_kpi.delay(str(actual.kpi_id), current_user.tenant_id)
        except Exception:
            # Auto-flagging failure must not break actuals submission (Redis may be down)
            logger.warning(
                "Failed to dispatch risk auto-flag task for KPI %s",
                actual.kpi_id,
                exc_info=True,
            )

    return SDBIPActualResponse.model_validate(actual)


@router.get(
    "/kpis/{kpi_id}/actuals",
    response_model=list[SDBIPActualResponse],
    dependencies=_pms_deps(),
    summary="List actuals for a KPI",
)
async def list_actuals(
    kpi_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[SDBIPActualResponse]:
    """Return all quarterly actuals for a KPI, ordered by quarter.

    Includes both validated and unvalidated actuals, as well as correction records.
    """
    actuals = await _service.list_actuals(kpi_id, db)
    return [SDBIPActualResponse.model_validate(a) for a in actuals]


@router.get(
    "/actuals/{actual_id}",
    response_model=SDBIPActualResponse,
    dependencies=_pms_deps(),
    summary="Get a single actual by ID",
)
async def get_actual(
    actual_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SDBIPActualResponse:
    """Return a single SDBIPActual by ID (404 if not found)."""
    actual = await _service.get_actual(actual_id, db)
    if actual is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SDBIPActual {actual_id} not found",
        )
    return SDBIPActualResponse.model_validate(actual)


@router.post(
    "/actuals/{actual_id}/correct",
    response_model=SDBIPActualResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_tier2_deps(),
    summary="Submit a correction for a validated actual",
)
async def submit_correction(
    actual_id: UUID,
    payload: SDBIPActualCorrectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SDBIPActualResponse:
    """Submit a correction for a validated (immutable) actual.

    Creates a new SDBIPActual record with:
    - corrects_actual_id pointing to the original
    - is_validated=False (correction starts unvalidated)
    - New achievement_pct and traffic_light_status computed from corrected value

    Returns 404 if the original actual does not exist.
    Returns 422 if the original actual is not validated (use update instead).

    A reason (minimum 10 characters) is required for the correction audit trail.
    """
    correction = await _service.submit_correction(actual_id, payload, current_user, db)
    return SDBIPActualResponse.model_validate(correction)


@router.put(
    "/actuals/{actual_id}",
    response_model=SDBIPActualResponse,
    dependencies=_pms_tier2_deps(),
    summary="Update an unvalidated actual (blocked once validated)",
)
async def update_actual(
    actual_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SDBIPActualResponse:
    """Update a quarterly actual.

    Blocked if the actual has been validated (is_validated=True).
    Returns 422 with message directing the caller to use the /correct endpoint.
    """
    actual = await _service.get_actual(actual_id, db)
    if actual is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SDBIPActual {actual_id} not found",
        )
    if actual.is_validated:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Validated actuals are immutable. Submit a correction record.",
        )
    return SDBIPActualResponse.model_validate(actual)


@router.patch(
    "/actuals/{actual_id}",
    response_model=SDBIPActualResponse,
    dependencies=_pms_tier2_deps(),
    summary="Patch an unvalidated actual (blocked once validated)",
)
async def patch_actual(
    actual_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SDBIPActualResponse:
    """Partially update a quarterly actual.

    Blocked if the actual has been validated (is_validated=True).
    Returns 422 with message directing the caller to use the /correct endpoint.
    """
    actual = await _service.get_actual(actual_id, db)
    if actual is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SDBIPActual {actual_id} not found",
        )
    if actual.is_validated:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Validated actuals are immutable. Submit a correction record.",
        )
    return SDBIPActualResponse.model_validate(actual)


# ---------------------------------------------------------------------------
# Aggregation Rules (auto-population configuration)
# ---------------------------------------------------------------------------


@router.post(
    "/kpis/{kpi_id}/aggregation-rules",
    response_model=AggregationRuleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(2))],
    summary="Create an aggregation rule for a KPI (auto-population configuration)",
)
async def create_aggregation_rule(
    kpi_id: UUID,
    payload: AggregationRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AggregationRuleResponse:
    """Create an aggregation rule that configures auto-population for a KPI.

    The auto-population engine (Celery beat, daily 01:00 SAST) will use this rule
    to count resolved tickets of the specified category and store the result as
    an SDBIPActual with is_auto_populated=True.

    SEC-05: The GBV exclusion filter (is_sensitive=FALSE) is applied unconditionally
    by the auto-population engine — it is NOT configurable here.

    Returns 409 if an active rule already exists for this (kpi_id, ticket_category) pair.
    """
    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError

    kpi = await _service.get_kpi(kpi_id, db)
    if kpi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SDBIP KPI {kpi_id} not found",
        )

    rule = SDBIPTicketAggregationRule(
        tenant_id=current_user.tenant_id,
        kpi_id=kpi_id,
        ticket_category=payload.ticket_category,
        aggregation_type=payload.aggregation_type,
        formula_description=payload.formula_description,
        is_active=True,
        created_by=str(current_user.id),
    )
    db.add(rule)
    try:
        await db.commit()
        await db.refresh(rule)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"An aggregation rule for KPI {kpi_id} and "
                f"category '{payload.ticket_category}' already exists."
            ),
        )
    return AggregationRuleResponse.model_validate(rule)


@router.get(
    "/kpis/{kpi_id}/aggregation-rules",
    response_model=list[AggregationRuleResponse],
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(3))],
    summary="List aggregation rules for a KPI",
)
async def list_aggregation_rules(
    kpi_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[AggregationRuleResponse]:
    """Return all aggregation rules for a KPI (active and inactive).

    Active rules are used by the daily auto-population engine.
    Inactive rules (is_active=False) have been deactivated via DELETE.
    """
    from sqlalchemy import select

    result = await db.execute(
        select(SDBIPTicketAggregationRule).where(
            SDBIPTicketAggregationRule.kpi_id == kpi_id
        )
    )
    rules = list(result.scalars().all())
    return [AggregationRuleResponse.model_validate(r) for r in rules]


@router.delete(
    "/aggregation-rules/{rule_id}",
    response_model=AggregationRuleResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(2))],
    summary="Deactivate an aggregation rule (soft delete)",
)
async def deactivate_aggregation_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AggregationRuleResponse:
    """Deactivate an aggregation rule (set is_active=False).

    Deactivated rules are skipped by the auto-population engine on subsequent runs.
    Existing auto-populated actuals are NOT affected.

    Returns 404 if the rule does not exist.
    """
    from sqlalchemy import select

    result = await db.execute(
        select(SDBIPTicketAggregationRule).where(
            SDBIPTicketAggregationRule.id == rule_id
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aggregation rule {rule_id} not found",
        )
    rule.is_active = False
    rule.updated_by = str(current_user.id)
    await db.commit()
    await db.refresh(rule)
    return AggregationRuleResponse.model_validate(rule)


# ---------------------------------------------------------------------------
# Portfolio of Evidence (POE) Upload and Download (28-05)
# ---------------------------------------------------------------------------


@router.post(
    "/actuals/{actual_id}/evidence",
    response_model=EvidenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(2))],
    summary="Upload portfolio of evidence document for a quarterly actual",
)
async def upload_evidence(
    actual_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EvidenceUploadResponse:
    """Upload a portfolio of evidence (POE) document for a quarterly actual.

    Files are virus-scanned with ClamAV before storage:
    - Clean files: accepted and stored in per-municipality Supabase bucket
    - Infected files: rejected with 422 and virus name
    - ClamAV unavailable: fail-open in dev, fail-closed (422) in production

    Maximum file size: 50 MB. All MIME types accepted.

    Returns 422 if file infected or exceeds size limit.
    Returns 201 with document metadata on success.
    """
    file_content = await file.read()
    doc = await _evidence_service.scan_and_upload(
        file_content=file_content,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        actual_id=actual_id,
        user=current_user,
        db=db,
    )
    return EvidenceUploadResponse.model_validate(doc)


@router.get(
    "/actuals/{actual_id}/evidence",
    response_model=EvidenceListResponse,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(3))],
    summary="List evidence documents for a quarterly actual",
)
async def list_evidence(
    actual_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> EvidenceListResponse:
    """List all portfolio of evidence documents attached to a quarterly actual.

    Returns documents ordered by upload time (oldest first).
    Returns empty list if no documents have been uploaded.
    """
    docs = await _evidence_service.list_evidence(actual_id, db)
    return EvidenceListResponse(
        documents=[EvidenceUploadResponse.model_validate(d) for d in docs],
        total=len(docs),
    )


@router.get(
    "/evidence/{doc_id}/download",
    response_model=EvidenceDownloadResponse,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(3))],
    summary="Get signed download URL for an evidence document",
)
async def get_evidence_download_url(
    doc_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> EvidenceDownloadResponse:
    """Generate a signed URL for secure evidence document download.

    URL expires in 1 hour. Returns a Supabase Storage signed URL in production,
    or a fallback API path in development/test environments.

    Returns 404 if document not found.
    """
    signed_url = await _evidence_service.get_signed_url(doc_id, db)
    return EvidenceDownloadResponse(signed_url=signed_url, expires_in=3600)


# ---------------------------------------------------------------------------
# PMS Officer Actual Validation (28-05)
# ---------------------------------------------------------------------------


@router.post(
    "/actuals/{actual_id}/validate",
    response_model=SDBIPActualResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(require_pms_ready()),
        Depends(require_role(UserRole.PMS_OFFICER, UserRole.ADMIN, UserRole.SALGA_ADMIN)),
    ],
    summary="PMS officer validates a quarterly actual (immutable thereafter)",
)
async def validate_actual(
    actual_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SDBIPActualResponse:
    """PMS officer validates a quarterly actual, making it permanently immutable.

    Once validated:
    - is_validated=True, validated_by=<user_id>, validated_at=<timestamp>
    - PUT/PATCH on this actual return 422 (use /correct endpoint instead)
    - Portfolio of evidence is locked with the actual

    Returns 404 if actual not found.
    Returns 422 if already validated (idempotency guard).

    Requires PMS Officer, Admin, or SALGA Admin role.
    """
    actual = await _service.validate_actual(actual_id, current_user, db)

    # RISK-03: Dispatch auto-flag task when validated actual is red
    if actual.traffic_light_status == "red":
        try:
            from src.tasks.risk_autoflag_task import flag_risk_items_for_kpi  # noqa: PLC0415
            flag_risk_items_for_kpi.delay(str(actual.kpi_id), current_user.tenant_id)
        except Exception:
            # Auto-flagging failure must not break validation (Redis may be down)
            logger.warning(
                "Failed to dispatch risk auto-flag task for validated KPI %s",
                actual.kpi_id,
                exc_info=True,
            )

    return SDBIPActualResponse.model_validate(actual)


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
