"""Dashboard metrics API endpoints.

Provides real-time metrics for municipal operations dashboard:
- Overall ticket metrics (volumes, SLA compliance, response times)
- Volume breakdown by category
- SLA compliance details
- Team workload distribution

RBAC: Accessible by MANAGER, ADMIN, WARD_COUNCILLOR only.
SEC-05: All queries exclude GBV/sensitive tickets.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db
from src.models.user import User, UserRole
from src.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/metrics")
async def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
) -> dict:
    """Get aggregated dashboard metrics.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors

    Returns:
        dict with total_open, total_resolved, sla_compliance_percent,
        avg_response_hours, sla_breaches

    Raises:
        HTTPException: 403 if user not authorized
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    # Ward councillor enforcement (interim: accept ward_id from query param)
    if current_user.role == UserRole.WARD_COUNCILLOR and ward_id:
        logger.info(
            f"WARD_COUNCILLOR {current_user.id} accessing metrics for ward {ward_id}"
        )

    service = DashboardService()
    metrics = await service.get_metrics(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id
    )

    return metrics


@router.get("/volume")
async def get_volume_by_category(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
) -> list[dict]:
    """Get ticket volume grouped by category.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors

    Returns:
        list of {"category": str, "open": int, "resolved": int}

    Raises:
        HTTPException: 403 if user not authorized
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    service = DashboardService()
    volume = await service.get_volume_by_category(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id
    )

    return volume


@router.get("/sla")
async def get_sla_compliance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
) -> dict:
    """Get SLA compliance breakdown.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors

    Returns:
        dict with response_compliance_percent, resolution_compliance_percent,
        total_with_sla, response_breaches, resolution_breaches

    Raises:
        HTTPException: 403 if user not authorized
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    service = DashboardService()
    sla = await service.get_sla_compliance(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id
    )

    return sla


@router.get("/workload")
async def get_team_workload(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
) -> list[dict]:
    """Get team workload distribution.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors

    Returns:
        list of {"team_id": str, "team_name": str, "open_count": int, "total_count": int}

    Raises:
        HTTPException: 403 if user not authorized
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    service = DashboardService()
    workload = await service.get_team_workload(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id
    )

    return workload
