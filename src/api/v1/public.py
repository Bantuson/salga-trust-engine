"""Public transparency API endpoints (unauthenticated).

Provides public access to aggregate municipal service metrics:
- Active municipalities list
- Average response times per municipality (TRNS-01)
- Resolution rates with monthly trends (TRNS-02)
- Geographic heatmap data (TRNS-03)
- System-wide summary statistics

TRNS-04: All endpoints accessible without authentication (no Depends(get_current_user)).
SEC-05: GBV/sensitive data filtering handled by PublicMetricsService layer.

All queries are cross-tenant (aggregate across municipalities) with mandatory
is_sensitive == False filters applied at the service layer.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_db
from src.middleware.rate_limit import PUBLIC_RATE_LIMIT, limiter
from src.services.public_metrics_service import PublicMetricsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/municipalities")
@limiter.limit(PUBLIC_RATE_LIMIT)
async def get_municipalities(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get list of active municipalities with basic public information.

    No authentication required (TRNS-04).

    Args:
        db: Database session

    Returns:
        list of {"id": str, "name": str, "code": str, "province": str}

    Note: Excludes contact_email for privacy.
    """
    service = PublicMetricsService()
    return await service.get_active_municipalities(db)


@router.get("/response-times")
@limiter.limit(PUBLIC_RATE_LIMIT)
async def get_response_times(
    request: Request,
    municipality_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get average response times per municipality (TRNS-01).

    No authentication required (TRNS-04).
    Excludes GBV/sensitive tickets (SEC-05, TRNS-05).

    Args:
        municipality_id: Optional filter to single municipality
        db: Database session

    Returns:
        list of {
            "municipality_id": str,
            "municipality_name": str,
            "avg_response_hours": float,
            "ticket_count": int
        }
    """
    service = PublicMetricsService()
    return await service.get_response_times(db, municipality_id=municipality_id)


@router.get("/resolution-rates")
@limiter.limit(PUBLIC_RATE_LIMIT)
async def get_resolution_rates(
    request: Request,
    municipality_id: str | None = None,
    months: int = 6,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get resolution rates per municipality with monthly trends (TRNS-02).

    No authentication required (TRNS-04).
    Excludes GBV/sensitive tickets (SEC-05, TRNS-05).

    Args:
        municipality_id: Optional filter to single municipality
        months: Number of months for trend data (default 6)
        db: Database session

    Returns:
        list of {
            "municipality_id": str,
            "municipality_name": str,
            "resolution_rate": float,
            "total_tickets": int,
            "resolved_tickets": int,
            "trend": [{"month": str, "rate": float}]
        }
    """
    service = PublicMetricsService()
    return await service.get_resolution_rates(
        db, municipality_id=municipality_id, months=months
    )


@router.get("/heatmap")
@limiter.limit(PUBLIC_RATE_LIMIT)
async def get_heatmap(
    request: Request,
    municipality_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get grid-aggregated heatmap data for geographic visualization (TRNS-03).

    No authentication required (TRNS-04).
    Excludes GBV/sensitive tickets (SEC-05, TRNS-05).
    Grid cells with <3 tickets suppressed (k-anonymity).

    Args:
        municipality_id: Optional filter to single municipality
        db: Database session

    Returns:
        list of {"lat": float, "lng": float, "intensity": int}

    Note: Returns empty list when PostGIS unavailable (SQLite tests).
    """
    service = PublicMetricsService()
    return await service.get_heatmap_data(db, municipality_id=municipality_id)


@router.get("/summary")
@limiter.limit(PUBLIC_RATE_LIMIT)
async def get_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get system-wide summary statistics.

    No authentication required (TRNS-04).
    Sensitive ticket count returned at system level only (TRNS-05).

    Args:
        db: Database session

    Returns:
        {
            "total_municipalities": int,
            "total_tickets": int,
            "total_sensitive_tickets": int
        }

    Note: Sensitive tickets counted system-wide, never per-municipality.
    """
    service = PublicMetricsService()
    return await service.get_system_summary(db)
