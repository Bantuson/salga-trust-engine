"""Risk register API endpoints.

Provides CRUD operations for risk items linked to SDBIP KPIs, department-filtered
views for CFO/MM governance, and mitigation strategy management.

RBAC:
- GET / (list) and GET /summary: CFO, Municipal Manager, Executive Mayor, Admin, SALGA Admin only (RISK-04)
- All other endpoints: Tier 2+ (Section 56 Director and above)
- All endpoints require PMS readiness gate (municipality must be configured)

Endpoint prefix: /api/v1/risk-register
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier, require_role
from src.models.user import User, UserRole
from src.schemas.risk import (
    RiskItemCreate,
    RiskItemResponse,
    RiskItemUpdate,
    RiskMitigationCreate,
    RiskMitigationResponse,
    RiskRegisterSummary,
)
from src.services.pms_readiness import require_pms_ready
from src.services.risk_service import RiskService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/risk-register",
    tags=["risk-register"],
)

_service = RiskService()

# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

_pms_deps = lambda: [Depends(require_pms_ready())]  # noqa: E731
_pms_tier2_deps = lambda: [Depends(require_pms_ready()), Depends(require_min_tier(2))]  # noqa: E731

# CFO/MM/ExecMayor/Admin/SalgaAdmin only
_risk_view_roles = (
    UserRole.CFO,
    UserRole.MUNICIPAL_MANAGER,
    UserRole.EXECUTIVE_MAYOR,
    UserRole.ADMIN,
    UserRole.SALGA_ADMIN,
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=RiskItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_tier2_deps(),
    summary="Create a risk item linked to a SDBIP KPI",
)
async def create_risk_item(
    data: RiskItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RiskItemResponse:
    """Create a new risk item with auto-computed risk_rating (RISK-01).

    Risk rating is computed from likelihood x impact using ISO 31000 5x5 matrix:
    - critical: score >= 15
    - high:     score >= 8
    - medium:   score >= 4
    - low:      score < 4

    Optional initial mitigations can be included in the request body (RISK-02).

    Returns 201 with the created risk item including any mitigations.
    Requires Tier 2 (Director) or higher role.
    """
    risk_item = await _service.create_risk_item(data, current_user, db)
    return RiskItemResponse.model_validate(risk_item)


@router.get(
    "/",
    response_model=list[RiskItemResponse],
    dependencies=[
        Depends(require_pms_ready()),
        Depends(require_role(*_risk_view_roles)),
    ],
    summary="List risk register — department-filtered view for CFO/MM (RISK-04)",
)
async def list_risk_items(
    department_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RiskItemResponse]:
    """List all risk items for the tenant, with optional department filter.

    CFO and Municipal Manager can filter by department_id to view scoped risk items.
    Results ordered by risk severity (critical first), then by creation date.

    Requires CFO, Municipal Manager, Executive Mayor, Admin, or SALGA Admin role.
    """
    items = await _service.list_risk_items(
        current_user.tenant_id, db, department_id=department_id
    )
    return [RiskItemResponse.model_validate(item) for item in items]


@router.get(
    "/summary",
    response_model=RiskRegisterSummary,
    dependencies=[
        Depends(require_pms_ready()),
        Depends(require_role(*_risk_view_roles)),
    ],
    summary="Risk register summary counts by rating",
)
async def get_risk_register_summary(
    department_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RiskRegisterSummary:
    """Get aggregate risk counts (total, critical, high, medium, low, auto_flagged).

    Used by CFO/MM dashboard summary widget. Supports department filter.

    Requires CFO, Municipal Manager, Executive Mayor, Admin, or SALGA Admin role.
    """
    summary = await _service.get_risk_register_summary(
        current_user.tenant_id, db, department_id=department_id
    )
    return RiskRegisterSummary(**summary)


@router.get(
    "/{risk_item_id}",
    response_model=RiskItemResponse,
    dependencies=_pms_tier2_deps(),
    summary="Get a single risk item with its mitigations",
)
async def get_risk_item(
    risk_item_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> RiskItemResponse:
    """Get a single risk item including all mitigation strategies.

    Returns 404 if risk item is not found or has been soft-deleted.
    Requires Tier 2 (Director) or higher role.
    """
    risk_item = await _service.get_risk_item(risk_item_id, db)
    if risk_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Risk item {risk_item_id} not found",
        )
    return RiskItemResponse.model_validate(risk_item)


@router.put(
    "/{risk_item_id}",
    response_model=RiskItemResponse,
    dependencies=_pms_tier2_deps(),
    summary="Update a risk item (recomputes risk_rating if scores change)",
)
async def update_risk_item(
    risk_item_id: UUID,
    data: RiskItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RiskItemResponse:
    """Update a risk item. Risk rating is recomputed if likelihood or impact changes.

    Manual edits clear the is_auto_flagged flag, allowing CFO to override auto-flags.

    Returns 404 if risk item not found.
    Requires Tier 2 (Director) or higher role.
    """
    try:
        risk_item = await _service.update_risk_item(risk_item_id, data, current_user, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    return RiskItemResponse.model_validate(risk_item)


@router.delete(
    "/{risk_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=_pms_tier2_deps(),
    summary="Soft-delete a risk item",
)
async def delete_risk_item(
    risk_item_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a risk item (sets is_deleted=True).

    Returns 404 if risk item not found.
    Requires Tier 2 (Director) or higher role.
    """
    try:
        await _service.delete_risk_item(risk_item_id, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.post(
    "/{risk_item_id}/mitigations",
    response_model=RiskMitigationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_tier2_deps(),
    summary="Add a mitigation strategy to a risk item (RISK-02)",
)
async def add_mitigation(
    risk_item_id: UUID,
    data: RiskMitigationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RiskMitigationResponse:
    """Add a mitigation strategy to an existing risk item.

    Returns 404 if risk item not found.
    Requires Tier 2 (Director) or higher role.
    """
    try:
        mitigation = await _service.add_mitigation(risk_item_id, data, current_user, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    return RiskMitigationResponse.model_validate(mitigation)
