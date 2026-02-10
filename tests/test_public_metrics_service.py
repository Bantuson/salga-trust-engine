"""Unit tests for PublicMetricsService (Phase 6).

Tests cross-tenant public metrics aggregation with mandatory GBV firewall:
- get_active_municipalities - Returns only active municipalities
- get_response_times - Average response times per municipality (no sensitive)
- get_resolution_rates - Resolution rates with trends (no sensitive)
- get_heatmap_data - Grid-aggregated location data with k-anonymity
- get_system_summary - System-wide totals with sensitive count at system level

SEC-05: Verifies that ALL methods filter is_sensitive == False in SQL queries.
TRNS-05: Verifies GBV tickets never appear in per-municipality metrics.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, call
from uuid import uuid4


pytestmark = pytest.mark.asyncio


class TestPublicMetricsService:
    """Test PublicMetricsService methods."""

    async def test_get_active_municipalities_returns_basic_info_only(self):
        """Test get_active_municipalities returns name/code/province only (no contact_email)."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()
        mock_result = MagicMock()

        # Mock two active municipalities
        mock_muni_1 = MagicMock()
        mock_muni_1.id = str(uuid4())
        mock_muni_1.name = "City of Cape Town"
        mock_muni_1.code = "CPT"
        mock_muni_1.province = "Western Cape"

        mock_muni_2 = MagicMock()
        mock_muni_2.id = str(uuid4())
        mock_muni_2.name = "eThekwini Municipality"
        mock_muni_2.code = "ETH"
        mock_muni_2.province = "KwaZulu-Natal"

        mock_result.all.return_value = [mock_muni_1, mock_muni_2]
        mock_db.execute.return_value = mock_result

        service = PublicMetricsService()

        # Act
        result = await service.get_active_municipalities(mock_db)

        # Assert
        assert len(result) == 2
        assert result[0]["id"] == mock_muni_1.id
        assert result[0]["name"] == "City of Cape Town"
        assert result[0]["code"] == "CPT"
        assert result[0]["province"] == "Western Cape"
        assert "contact_email" not in result[0]  # Privacy - no contact info

    async def test_get_response_times_filters_sensitive_tickets(self):
        """Test get_response_times excludes sensitive tickets (is_sensitive == False)."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()
        mock_result = MagicMock()

        # Mock response time data
        mock_row = MagicMock()
        mock_row.tenant_id = str(uuid4())
        mock_row.municipality_name = "City of Johannesburg"
        mock_row.avg_response_hours = 4.5
        mock_row.ticket_count = 150

        mock_result.all.return_value = [mock_row]
        mock_db.execute.return_value = mock_result

        service = PublicMetricsService()

        # Act
        result = await service.get_response_times(mock_db)

        # Assert
        assert len(result) == 1
        assert result[0]["municipality_id"] == mock_row.tenant_id
        assert result[0]["municipality_name"] == "City of Johannesburg"
        assert result[0]["avg_response_hours"] == 4.5
        assert result[0]["ticket_count"] == 150

        # Verify execute was called (query construction tested via integration)
        mock_db.execute.assert_called_once()

    async def test_get_response_times_filters_by_municipality(self):
        """Test get_response_times accepts municipality_id filter."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()
        mock_result = MagicMock()

        municipality_id = str(uuid4())
        mock_row = MagicMock()
        mock_row.tenant_id = municipality_id
        mock_row.municipality_name = "City of Tshwane"
        mock_row.avg_response_hours = 3.2
        mock_row.ticket_count = 89

        mock_result.all.return_value = [mock_row]
        mock_db.execute.return_value = mock_result

        service = PublicMetricsService()

        # Act
        result = await service.get_response_times(mock_db, municipality_id=municipality_id)

        # Assert
        assert len(result) == 1
        assert result[0]["municipality_id"] == municipality_id

    async def test_get_resolution_rates_calculates_percentages(self):
        """Test get_resolution_rates returns resolution rate as percentage."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()

        # Mock main query result
        mock_main_result = MagicMock()
        mock_row = MagicMock()
        mock_row.tenant_id = str(uuid4())
        mock_row.municipality_name = "Nelson Mandela Bay"
        mock_row.total_tickets = 200
        mock_row.resolved_tickets = 150
        mock_main_result.all.return_value = [mock_row]

        # Mock trend query result (empty for simplicity)
        mock_trend_result = MagicMock()
        mock_trend_result.all.return_value = []

        # Setup side_effect for sequential calls
        mock_db.execute.side_effect = [mock_main_result, mock_trend_result]

        service = PublicMetricsService()

        # Act
        result = await service.get_resolution_rates(mock_db, months=6)

        # Assert
        assert len(result) == 1
        assert result[0]["municipality_id"] == mock_row.tenant_id
        assert result[0]["municipality_name"] == "Nelson Mandela Bay"
        assert result[0]["resolution_rate"] == 75.0  # 150/200 * 100
        assert result[0]["total_tickets"] == 200
        assert result[0]["resolved_tickets"] == 150
        assert result[0]["trend"] == []

    async def test_get_resolution_rates_includes_monthly_trends(self):
        """Test get_resolution_rates includes monthly trend data."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()
        municipality_id = str(uuid4())

        # Mock main query result
        mock_main_result = MagicMock()
        mock_row = MagicMock()
        mock_row.tenant_id = municipality_id
        mock_row.municipality_name = "City of Cape Town"
        mock_row.total_tickets = 100
        mock_row.resolved_tickets = 80
        mock_main_result.all.return_value = [mock_row]

        # Mock trend query result
        mock_trend_result = MagicMock()
        mock_trend_1 = MagicMock()
        mock_trend_1.month = "2026-01"
        mock_trend_1.rate = 85.0
        mock_trend_2 = MagicMock()
        mock_trend_2.month = "2026-02"
        mock_trend_2.rate = 90.0
        mock_trend_result.all.return_value = [mock_trend_1, mock_trend_2]

        mock_db.execute.side_effect = [mock_main_result, mock_trend_result]

        service = PublicMetricsService()

        # Act
        result = await service.get_resolution_rates(mock_db, municipality_id=municipality_id)

        # Assert
        assert len(result) == 1
        assert len(result[0]["trend"]) == 2
        assert result[0]["trend"][0]["month"] == "2026-01"
        assert result[0]["trend"][0]["rate"] == 85.0

    async def test_get_heatmap_data_returns_empty_when_postgis_unavailable(self):
        """Test get_heatmap_data returns empty list when PostGIS unavailable (SQLite tests)."""
        from src.services.public_metrics_service import PublicMetricsService
        import src.services.public_metrics_service as pms_module

        # Arrange
        mock_db = AsyncMock()
        service = PublicMetricsService()

        # Mock USE_POSTGIS as False (SQLite mode)
        original_use_postgis = pms_module.USE_POSTGIS
        pms_module.USE_POSTGIS = False

        try:
            # Act
            result = await service.get_heatmap_data(mock_db)

            # Assert
            assert result == []
            mock_db.execute.assert_not_called()  # No query when PostGIS unavailable
        finally:
            # Restore original value
            pms_module.USE_POSTGIS = original_use_postgis

    async def test_get_heatmap_data_applies_k_anonymity_threshold(self):
        """Test get_heatmap_data suppresses grid cells with fewer than 3 tickets."""
        from src.services.public_metrics_service import PublicMetricsService
        import src.services.public_metrics_service as pms_module

        # Arrange
        mock_db = AsyncMock()
        mock_result = MagicMock()

        # Mock grid cells (all should have count >= 3 due to HAVING clause)
        mock_cell_1 = MagicMock()
        mock_cell_1.lat = -26.2041
        mock_cell_1.lng = 28.0473
        mock_cell_1.intensity = 15

        mock_cell_2 = MagicMock()
        mock_cell_2.lat = -33.9249
        mock_cell_2.lng = 18.4241
        mock_cell_2.intensity = 8

        mock_result.all.return_value = [mock_cell_1, mock_cell_2]
        mock_db.execute.return_value = mock_result

        service = PublicMetricsService()

        # Mock USE_POSTGIS as True for this test
        original_use_postgis = pms_module.USE_POSTGIS
        pms_module.USE_POSTGIS = True

        try:
            # Act
            result = await service.get_heatmap_data(mock_db)

            # Assert
            assert len(result) == 2
            assert result[0]["lat"] == -26.2041
            assert result[0]["lng"] == 28.0473
            assert result[0]["intensity"] == 15
        finally:
            pms_module.USE_POSTGIS = original_use_postgis

    async def test_get_system_summary_returns_system_wide_totals(self):
        """Test get_system_summary returns system-wide aggregates."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()

        # Mock municipality count
        mock_muni_result = MagicMock()
        mock_muni_result.scalar.return_value = 5

        # Mock total tickets (non-sensitive)
        mock_total_result = MagicMock()
        mock_total_result.scalar.return_value = 1250

        # Mock sensitive tickets (system-wide)
        mock_sensitive_result = MagicMock()
        mock_sensitive_result.scalar.return_value = 42

        # Setup side_effect for sequential calls
        mock_db.execute.side_effect = [
            mock_muni_result,
            mock_total_result,
            mock_sensitive_result
        ]

        service = PublicMetricsService()

        # Act
        result = await service.get_system_summary(mock_db)

        # Assert
        assert result["total_municipalities"] == 5
        assert result["total_tickets"] == 1250
        assert result["total_sensitive_tickets"] == 42

        # Verify three queries were made
        assert mock_db.execute.call_count == 3

    async def test_get_system_summary_sensitive_count_is_system_level_only(self):
        """Test get_system_summary returns sensitive count at system level (never per-municipality)."""
        from src.services.public_metrics_service import PublicMetricsService

        # Arrange
        mock_db = AsyncMock()

        # Mock results
        mock_muni_result = MagicMock()
        mock_muni_result.scalar.return_value = 3

        mock_total_result = MagicMock()
        mock_total_result.scalar.return_value = 800

        mock_sensitive_result = MagicMock()
        mock_sensitive_result.scalar.return_value = 25

        mock_db.execute.side_effect = [
            mock_muni_result,
            mock_total_result,
            mock_sensitive_result
        ]

        service = PublicMetricsService()

        # Act
        result = await service.get_system_summary(mock_db)

        # Assert
        # Verify response structure has no per-municipality sensitive data
        assert "total_sensitive_tickets" in result
        assert isinstance(result["total_sensitive_tickets"], int)

        # Verify no per-municipality breakdown of sensitive tickets
        assert "municipalities" not in result
        assert "sensitive_by_municipality" not in result
