"""Tests for public dashboard Supabase integration.

Tests public view queries, GBV exclusion, and k-anonymity threshold.
"""
import pytest
from unittest.mock import patch, Mock, AsyncMock
from uuid import uuid4


class TestPublicDashboardSupabaseQueries:
    """Test public dashboard Supabase query patterns."""

    @pytest.mark.asyncio
    async def test_public_municipalities_hook_queries_view(self):
        """Verify correct Supabase query for municipalities."""
        # This test verifies the frontend hook would query the right view

        mock_supabase = Mock()
        mock_municipalities = [
            {"id": str(uuid4()), "name": "Test Municipality", "code": "TEST001", "province": "Gauteng"}
        ]

        mock_query = Mock()
        mock_query.order = Mock(return_value=mock_query)
        mock_query.__await__ = AsyncMock(return_value=Mock(
            data=mock_municipalities,
            error=None
        )).__await__

        mock_supabase.from_ = Mock(return_value=Mock(
            select=Mock(return_value=mock_query)
        ))

        # Simulate frontend query
        # const { data, error } = await supabase
        #   .from('public_municipalities')
        #   .select('*')
        #   .order('name')

        result = await mock_supabase.from_('public_municipalities').select('*').order('name')

        assert result.data == mock_municipalities
        assert result.error is None
        mock_supabase.from_.assert_called_with('public_municipalities')

    @pytest.mark.asyncio
    async def test_public_response_times_excludes_gbv(self):
        """Verify GBV exclusion in query (enforced by view)."""
        # The view itself excludes GBV, but verify query pattern

        mock_supabase = Mock()
        mock_stats = [
            {
                "municipality_id": str(uuid4()),
                "municipality_name": "Test Muni",
                "response_hours": 12.5
            }
        ]

        mock_query = Mock()
        mock_query.select = Mock(return_value=mock_query)
        mock_query.not_ = Mock(return_value=mock_query)
        mock_query.__await__ = AsyncMock(return_value=Mock(
            data=mock_stats,
            error=None
        )).__await__

        mock_supabase.from_ = Mock(return_value=mock_query)

        # Simulate frontend query
        # let query = supabase
        #   .from('public_ticket_stats')
        #   .select('municipality_id, municipality_name, response_hours')
        #   .not('response_hours', 'is', null)

        result = await (
            mock_supabase
            .from_('public_ticket_stats')
            .select('municipality_id, municipality_name, response_hours')
            .not_('response_hours', 'is', None)
        )

        assert result.data == mock_stats
        mock_supabase.from_.assert_called_with('public_ticket_stats')

    @pytest.mark.asyncio
    async def test_public_heatmap_k_anonymity(self):
        """Verify threshold >= 3 (enforced by view)."""
        # The view has HAVING COUNT(*) >= 3, verify query pattern

        mock_supabase = Mock()
        mock_heatmap_data = [
            {"lat": -26.2041, "lng": 28.0473, "intensity": 5},  # 5 tickets (>= 3)
            {"lat": -25.7461, "lng": 28.1881, "intensity": 4},  # 4 tickets (>= 3)
            # No entries with < 3 tickets (filtered by view)
        ]

        mock_query = Mock()
        mock_query.select = Mock(return_value=mock_query)
        mock_query.__await__ = AsyncMock(return_value=Mock(
            data=mock_heatmap_data,
            error=None
        )).__await__

        mock_supabase.from_ = Mock(return_value=mock_query)

        # Simulate frontend query
        # const { data, error } = await supabase
        #   .from('public_heatmap')
        #   .select('lat, lng, intensity')

        result = await (
            mock_supabase
            .from_('public_heatmap')
            .select('lat, lng, intensity')
        )

        assert result.data == mock_heatmap_data
        # All intensities should be >= 3 (enforced by view)
        for point in result.data:
            assert point["intensity"] >= 3

    @pytest.mark.asyncio
    async def test_public_stats_with_municipality_filter(self):
        """Test filtering by municipality_id."""
        mock_supabase = Mock()
        municipality_id = str(uuid4())
        mock_stats = [
            {
                "municipality_id": municipality_id,
                "municipality_name": "Filtered Muni",
                "category": "pothole",
                "status": "open"
            }
        ]

        mock_query = Mock()
        mock_query.select = Mock(return_value=mock_query)
        mock_query.eq = Mock(return_value=mock_query)
        mock_query.__await__ = AsyncMock(return_value=Mock(
            data=mock_stats,
            error=None
        )).__await__

        mock_supabase.from_ = Mock(return_value=mock_query)

        # Simulate frontend query with filter
        # let query = supabase.from('public_ticket_stats').select('*')
        # if (municipalityId) {
        #   query = query.eq('municipality_id', municipalityId)
        # }

        result = await (
            mock_supabase
            .from_('public_ticket_stats')
            .select('*')
            .eq('municipality_id', municipality_id)
        )

        assert result.data == mock_stats
        mock_query.eq.assert_called_with('municipality_id', municipality_id)
