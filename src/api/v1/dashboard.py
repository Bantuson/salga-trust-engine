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
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db
from src.middleware.rate_limit import SENSITIVE_READ_RATE_LIMIT, limiter
from src.models.user import User, UserRole
from src.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_date_param(date_str: str | None, param_name: str) -> datetime | None:
    """Parse an optional YYYY-MM-DD date string to a timezone-aware datetime.

    Args:
        date_str: Optional date string in YYYY-MM-DD format
        param_name: Parameter name for error messages

    Returns:
        Timezone-aware datetime or None

    Raises:
        HTTPException: 400 if date string is not in YYYY-MM-DD format
    """
    if date_str is None:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {param_name} format. Use YYYY-MM-DD."
        )


@router.get("/metrics")
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_dashboard_metrics(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
    start_date: str | None = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    end_date: str | None = Query(default=None, description="End date filter (YYYY-MM-DD)"),
) -> dict:
    """Get aggregated dashboard metrics.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors
        start_date: Optional start date in YYYY-MM-DD format for time-series filtering
        end_date: Optional end date in YYYY-MM-DD format for time-series filtering

    Returns:
        dict with total_open, total_resolved, sla_compliance_percent,
        avg_response_hours, sla_breaches

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 400 if date params are invalid format
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

    parsed_start = _parse_date_param(start_date, "start_date")
    parsed_end = _parse_date_param(end_date, "end_date")

    service = DashboardService()
    metrics = await service.get_metrics(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )

    return metrics


@router.get("/volume")
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_volume_by_category(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
    start_date: str | None = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    end_date: str | None = Query(default=None, description="End date filter (YYYY-MM-DD)"),
) -> list[dict]:
    """Get ticket volume grouped by category.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors
        start_date: Optional start date in YYYY-MM-DD format for time-series filtering
        end_date: Optional end date in YYYY-MM-DD format for time-series filtering

    Returns:
        list of {"category": str, "open": int, "resolved": int}

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 400 if date params are invalid format
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    parsed_start = _parse_date_param(start_date, "start_date")
    parsed_end = _parse_date_param(end_date, "end_date")

    service = DashboardService()
    volume = await service.get_volume_by_category(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )

    return volume


@router.get("/sla")
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_sla_compliance(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
    start_date: str | None = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    end_date: str | None = Query(default=None, description="End date filter (YYYY-MM-DD)"),
) -> dict:
    """Get SLA compliance breakdown.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors
        start_date: Optional start date in YYYY-MM-DD format for time-series filtering
        end_date: Optional end date in YYYY-MM-DD format for time-series filtering

    Returns:
        dict with response_compliance_percent, resolution_compliance_percent,
        total_with_sla, response_breaches, resolution_breaches

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 400 if date params are invalid format
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    parsed_start = _parse_date_param(start_date, "start_date")
    parsed_end = _parse_date_param(end_date, "end_date")

    service = DashboardService()
    sla = await service.get_sla_compliance(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )

    return sla


@router.get("/workload")
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_team_workload(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ward_id: str | None = None,
    start_date: str | None = Query(default=None, description="Start date filter (YYYY-MM-DD)"),
    end_date: str | None = Query(default=None, description="End date filter (YYYY-MM-DD)"),
) -> list[dict]:
    """Get team workload distribution.

    Args:
        current_user: Authenticated user (must be MANAGER, ADMIN, or WARD_COUNCILLOR)
        db: Database session
        ward_id: Optional ward filter for ward councillors
        start_date: Optional start date in YYYY-MM-DD format for time-series filtering
        end_date: Optional end date in YYYY-MM-DD format for time-series filtering

    Returns:
        list of {"team_id": str, "team_name": str, "open_count": int, "total_count": int}

    Raises:
        HTTPException: 403 if user not authorized
        HTTPException: 400 if date params are invalid format
    """
    # RBAC check
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dashboard metrics"
        )

    parsed_start = _parse_date_param(start_date, "start_date")
    parsed_end = _parse_date_param(end_date, "end_date")

    service = DashboardService()
    workload = await service.get_team_workload(
        municipality_id=current_user.tenant_id,
        db=db,
        ward_id=ward_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )

    return workload
