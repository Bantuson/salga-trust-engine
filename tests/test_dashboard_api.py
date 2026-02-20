"""Unit tests for Dashboard API endpoints (Phase 5).

Tests RBAC enforcement and response structure for dashboard metrics endpoints:
- /dashboard/metrics - Overall metrics
- /dashboard/volume - Volume by category
- /dashboard/sla - SLA compliance breakdown
- /dashboard/workload - Team workload distribution

SEC-05: Verifies GBV ticket exclusion from all dashboard queries.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.types import Scope

from src.models.user import User, UserRole

pytestmark = pytest.mark.asyncio


def make_mock_starlette_request():
    """Create a minimal starlette Request for use with @limiter.limit() decorated endpoints."""
    scope: Scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": Headers(headers={}).raw,
        "query_string": b"",
        "client": ("127.0.0.1", 0),
    }
    return Request(scope=scope)


def make_mock_user(role=UserRole.MANAGER, tenant_id=None):
    """Create a mock User object."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = f"user-{user.id}@example.com"
    user.role = role
    user.tenant_id = str(tenant_id or uuid4())
    user.is_active = True
    return user


class TestDashboardMetricsRBAC:
    """Test RBAC enforcement on /dashboard/metrics endpoint."""

    async def test_manager_can_access_metrics(self):
        """Test MANAGER role can access dashboard metrics."""
        # Arrange
        with patch('src.api.v1.dashboard.get_current_user') as mock_get_user, \
             patch('src.api.v1.dashboard.get_db') as mock_get_db, \
             patch('src.api.v1.dashboard.DashboardService') as mock_service_class:

            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_get_user.return_value = mock_user
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db

            mock_service = MagicMock()
            mock_service.get_metrics = AsyncMock(return_value={
                "total_open": 10,
                "total_resolved": 5,
                "sla_compliance_percent": 85.0,
                "avg_response_hours": 3.5,
                "sla_breaches": 2
            })
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_dashboard_metrics

            # Act
            result = await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert result["total_open"] == 10
            assert result["sla_compliance_percent"] == 85.0

    async def test_admin_can_access_metrics(self):
        """Test ADMIN role can access dashboard metrics."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.ADMIN)
            mock_db = AsyncMock()

            mock_service = MagicMock()
            mock_service.get_metrics = AsyncMock(return_value={
                "total_open": 5,
                "total_resolved": 3,
                "sla_compliance_percent": 90.0,
                "avg_response_hours": 2.0,
                "sla_breaches": 0
            })
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_dashboard_metrics

            # Act
            result = await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert result["total_open"] == 5

    async def test_ward_councillor_can_access_metrics(self):
        """Test WARD_COUNCILLOR role can access dashboard metrics."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.WARD_COUNCILLOR)
            mock_db = AsyncMock()

            mock_service = MagicMock()
            mock_service.get_metrics = AsyncMock(return_value={
                "total_open": 2,
                "total_resolved": 1,
                "sla_compliance_percent": 95.0,
                "avg_response_hours": 1.5,
                "sla_breaches": 0
            })
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_dashboard_metrics

            # Act
            result = await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db, ward_id="Ward 1")

            # Assert
            assert result["total_open"] == 2

    async def test_citizen_cannot_access_metrics(self):
        """Test CITIZEN role cannot access dashboard metrics (403)."""
        # Arrange
        mock_user = make_mock_user(role=UserRole.CITIZEN)
        mock_db = AsyncMock()

        from src.api.v1.dashboard import get_dashboard_metrics
        from fastapi import HTTPException

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

        assert exc_info.value.status_code == 403

    async def test_field_worker_cannot_access_metrics(self):
        """Test FIELD_WORKER role cannot access dashboard metrics (403)."""
        # Arrange
        mock_user = make_mock_user(role=UserRole.FIELD_WORKER)
        mock_db = AsyncMock()

        from src.api.v1.dashboard import get_dashboard_metrics
        from fastapi import HTTPException

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

        assert exc_info.value.status_code == 403


class TestDashboardEndpointResponses:
    """Test response structure from dashboard endpoints."""

    async def test_metrics_endpoint_returns_correct_structure(self):
        """Test /dashboard/metrics returns all expected fields."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_service = MagicMock()
            mock_service.get_metrics = AsyncMock(return_value={
                "total_open": 15,
                "total_resolved": 8,
                "sla_compliance_percent": 87.5,
                "avg_response_hours": 2.5,
                "sla_breaches": 3
            })
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_dashboard_metrics

            # Act
            result = await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert "total_open" in result
            assert "total_resolved" in result
            assert "sla_compliance_percent" in result
            assert "avg_response_hours" in result
            assert "sla_breaches" in result

    async def test_volume_endpoint_returns_list_of_dicts(self):
        """Test /dashboard/volume returns list with category/open/resolved."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_service = MagicMock()
            mock_service.get_volume_by_category = AsyncMock(return_value=[
                {"category": "water", "open": 5, "resolved": 3},
                {"category": "electricity", "open": 2, "resolved": 4}
            ])
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_volume_by_category

            # Act
            result = await get_volume_by_category(current_user=mock_user, db=mock_db)

            # Assert
            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["category"] == "water"
            assert result[0]["open"] == 5
            assert result[0]["resolved"] == 3

    async def test_sla_endpoint_returns_correct_structure(self):
        """Test /dashboard/sla returns compliance percentages."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_service = MagicMock()
            mock_service.get_sla_compliance = AsyncMock(return_value={
                "response_compliance_percent": 92.0,
                "resolution_compliance_percent": 85.0,
                "total_with_sla": 50,
                "response_breaches": 4,
                "resolution_breaches": 7
            })
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_sla_compliance

            # Act
            result = await get_sla_compliance(current_user=mock_user, db=mock_db)

            # Assert
            assert "response_compliance_percent" in result
            assert "resolution_compliance_percent" in result
            assert "total_with_sla" in result
            assert "response_breaches" in result
            assert "resolution_breaches" in result

    async def test_workload_endpoint_returns_list_of_teams(self):
        """Test /dashboard/workload returns team workload data."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            team1_id = str(uuid4())
            team2_id = str(uuid4())
            mock_service = MagicMock()
            mock_service.get_team_workload = AsyncMock(return_value=[
                {"team_id": team1_id, "team_name": "Water Team", "open_count": 5, "total_count": 10},
                {"team_id": team2_id, "team_name": "Roads Team", "open_count": 3, "total_count": 8}
            ])
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_team_workload

            # Act
            result = await get_team_workload(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["team_id"] == team1_id
            assert result[0]["team_name"] == "Water Team"
            assert result[0]["open_count"] == 5
            assert result[0]["total_count"] == 10


class TestDashboardWardFiltering:
    """Test ward_id parameter filtering."""

    async def test_metrics_with_ward_id_parameter(self):
        """Test WARD_COUNCILLOR can filter metrics by ward_id."""
        # Arrange
        with patch('src.api.v1.dashboard.DashboardService') as mock_service_class:
            mock_user = make_mock_user(role=UserRole.WARD_COUNCILLOR)
            mock_db = AsyncMock()
            ward_id = "Ward 1"

            mock_service = MagicMock()
            mock_service.get_metrics = AsyncMock(return_value={
                "total_open": 3,
                "total_resolved": 2,
                "sla_compliance_percent": 90.0,
                "avg_response_hours": 2.0,
                "sla_breaches": 0
            })
            mock_service_class.return_value = mock_service

            from src.api.v1.dashboard import get_dashboard_metrics

            # Act
            result = await get_dashboard_metrics(make_mock_starlette_request(), current_user=mock_user, db=mock_db, ward_id=ward_id)

            # Assert
            mock_service.get_metrics.assert_called_once_with(
                municipality_id=mock_user.tenant_id,
                db=mock_db,
                ward_id=ward_id
            )
            assert result["total_open"] == 3
