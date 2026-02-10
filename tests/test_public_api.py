"""Unit tests for Public API endpoints (Phase 6).

Tests unauthenticated public transparency endpoints:
- GET /api/v1/public/municipalities - List active municipalities
- GET /api/v1/public/response-times - Average response times per municipality
- GET /api/v1/public/resolution-rates - Resolution rates with trends
- GET /api/v1/public/heatmap - Grid-aggregated location data
- GET /api/v1/public/summary - System-wide summary

TRNS-04: All endpoints accessible without authentication (no 401/403).
SEC-05: Verifies GBV exclusion via service layer calls.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
from httpx import ASGITransport

from src.main import app

pytestmark = pytest.mark.asyncio


class TestPublicAPIUnauthenticated:
    """Test public API endpoints are accessible without authentication."""

    async def test_get_municipalities_no_auth_required(self):
        """Test GET /public/municipalities accessible without Authorization header."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_active_municipalities = AsyncMock(return_value=[
                {"id": str(uuid4()), "name": "City of Cape Town", "code": "CPT", "province": "Western Cape"}
            ])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/public/municipalities")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "City of Cape Town"

    async def test_get_response_times_no_auth_required(self):
        """Test GET /public/response-times accessible without Authorization header."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_response_times = AsyncMock(return_value=[
                {
                    "municipality_id": str(uuid4()),
                    "municipality_name": "eThekwini",
                    "avg_response_hours": 3.5,
                    "ticket_count": 200
                }
            ])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/public/response-times")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["municipality_name"] == "eThekwini"
            assert data[0]["avg_response_hours"] == 3.5

    async def test_get_resolution_rates_no_auth_required(self):
        """Test GET /public/resolution-rates accessible without Authorization header."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_resolution_rates = AsyncMock(return_value=[
                {
                    "municipality_id": str(uuid4()),
                    "municipality_name": "City of Johannesburg",
                    "resolution_rate": 82.5,
                    "total_tickets": 300,
                    "resolved_tickets": 247,
                    "trend": [{"month": "2026-01", "rate": 80.0}]
                }
            ])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/public/resolution-rates")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["resolution_rate"] == 82.5
            assert len(data[0]["trend"]) == 1

    async def test_get_heatmap_no_auth_required(self):
        """Test GET /public/heatmap accessible without Authorization header."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_heatmap_data = AsyncMock(return_value=[
                {"lat": -26.2041, "lng": 28.0473, "intensity": 15},
                {"lat": -33.9249, "lng": 18.4241, "intensity": 8}
            ])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/public/heatmap")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["lat"] == -26.2041
            assert data[0]["intensity"] == 15

    async def test_get_summary_no_auth_required(self):
        """Test GET /public/summary accessible without Authorization header."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_system_summary = AsyncMock(return_value={
                "total_municipalities": 5,
                "total_tickets": 1250,
                "total_sensitive_tickets": 42
            })
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/public/summary")

            assert response.status_code == 200
            data = response.json()
            assert data["total_municipalities"] == 5
            assert data["total_tickets"] == 1250
            assert data["total_sensitive_tickets"] == 42


class TestPublicAPIQueryParameters:
    """Test public API endpoints accept query parameters."""

    async def test_response_times_filters_by_municipality_id(self):
        """Test GET /public/response-times accepts municipality_id query param."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            municipality_id = str(uuid4())
            mock_service = MagicMock()
            mock_service.get_response_times = AsyncMock(return_value=[
                {
                    "municipality_id": municipality_id,
                    "municipality_name": "City of Tshwane",
                    "avg_response_hours": 2.8,
                    "ticket_count": 150
                }
            ])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get(f"/api/v1/public/response-times?municipality_id={municipality_id}")

            assert response.status_code == 200
            data = response.json()
            assert data[0]["municipality_id"] == municipality_id

            # Verify service was called with municipality_id
            mock_service.get_response_times.assert_called_once()
            call_args = mock_service.get_response_times.call_args
            assert call_args.kwargs.get("municipality_id") == municipality_id

    async def test_resolution_rates_accepts_months_parameter(self):
        """Test GET /public/resolution-rates accepts months query param."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_resolution_rates = AsyncMock(return_value=[])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/v1/public/resolution-rates?months=12")

            assert response.status_code == 200

            # Verify service was called with months=12
            mock_service.get_resolution_rates.assert_called_once()
            call_args = mock_service.get_resolution_rates.call_args
            assert call_args.kwargs.get("months") == 12

    async def test_heatmap_filters_by_municipality_id(self):
        """Test GET /public/heatmap accepts municipality_id query param."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            municipality_id = str(uuid4())
            mock_service = MagicMock()
            mock_service.get_heatmap_data = AsyncMock(return_value=[])
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get(f"/api/v1/public/heatmap?municipality_id={municipality_id}")

            assert response.status_code == 200

            # Verify service was called with municipality_id
            mock_service.get_heatmap_data.assert_called_once()
            call_args = mock_service.get_heatmap_data.call_args
            assert call_args.kwargs.get("municipality_id") == municipality_id


class TestPublicAPIGBVExclusion:
    """Test public API endpoints exclude GBV/sensitive data via service layer."""

    async def test_endpoints_call_service_methods(self):
        """Test all public endpoints call PublicMetricsService methods (GBV filtering at service layer)."""
        with patch('src.api.v1.public.PublicMetricsService') as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_active_municipalities = AsyncMock(return_value=[])
            mock_service.get_response_times = AsyncMock(return_value=[])
            mock_service.get_resolution_rates = AsyncMock(return_value=[])
            mock_service.get_heatmap_data = AsyncMock(return_value=[])
            mock_service.get_system_summary = AsyncMock(return_value={
                "total_municipalities": 0,
                "total_tickets": 0,
                "total_sensitive_tickets": 0
            })
            mock_service_class.return_value = mock_service

            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # Call all endpoints
                await client.get("/api/v1/public/municipalities")
                await client.get("/api/v1/public/response-times")
                await client.get("/api/v1/public/resolution-rates")
                await client.get("/api/v1/public/heatmap")
                await client.get("/api/v1/public/summary")

            # Verify all service methods were called (GBV filtering delegated to service layer)
            mock_service.get_active_municipalities.assert_called_once()
            mock_service.get_response_times.assert_called_once()
            mock_service.get_resolution_rates.assert_called_once()
            mock_service.get_heatmap_data.assert_called_once()
            mock_service.get_system_summary.assert_called_once()
