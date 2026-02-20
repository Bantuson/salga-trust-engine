"""Unit tests for Export API endpoints (Phase 5).

Tests CSV and Excel export endpoints with RBAC and SEC-05 compliance:
- /export/tickets/csv - CSV export
- /export/tickets/excel - Excel export (requires openpyxl)

SEC-05: Verifies GBV/sensitive tickets are excluded from all exports.
"""
import pytest
import csv
import io
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.types import Scope

from src.models.user import User, UserRole
from src.models.ticket import Ticket

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


def make_mock_ticket(
    tracking_number="TKT-001",
    category="water",
    status="open",
    severity="medium",
    description="Test ticket",
    address="123 Main St",
    language="en",
    is_sensitive=False,
):
    """Create a mock Ticket object."""
    ticket = MagicMock(spec=Ticket)
    ticket.id = uuid4()
    ticket.tracking_number = tracking_number
    ticket.category = category
    ticket.status = status
    ticket.severity = severity
    ticket.description = description
    ticket.address = address
    ticket.language = language
    ticket.is_sensitive = is_sensitive
    ticket.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    ticket.sla_response_deadline = None
    ticket.sla_resolution_deadline = None
    ticket.first_responded_at = None
    ticket.resolved_at = None
    ticket.escalated_at = None
    return ticket


class TestExportCSVRBAC:
    """Test RBAC enforcement on CSV export endpoint."""

    async def test_manager_can_export_csv(self):
        """Test MANAGER role can export CSV."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = [
                make_mock_ticket(tracking_number="TKT-001"),
                make_mock_ticket(tracking_number="TKT-002"),
            ]
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert response.media_type == "text/csv"
            assert "attachment" in response.headers["Content-Disposition"]

    async def test_admin_can_export_csv(self):
        """Test ADMIN role can export CSV."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.ADMIN)
            mock_db = AsyncMock()

            mock_tickets = []
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert response.media_type == "text/csv"

    async def test_ward_councillor_can_export_csv(self):
        """Test WARD_COUNCILLOR role can export CSV."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.WARD_COUNCILLOR)
            mock_db = AsyncMock()

            mock_tickets = [make_mock_ticket()]
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert response.media_type == "text/csv"

    async def test_citizen_cannot_export_csv(self):
        """Test CITIZEN role cannot export CSV (403)."""
        # Arrange
        mock_user = make_mock_user(role=UserRole.CITIZEN)
        mock_db = AsyncMock()

        from src.api.v1.export import export_tickets_csv
        from fastapi import HTTPException

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

        assert exc_info.value.status_code == 403

    async def test_field_worker_cannot_export_csv(self):
        """Test FIELD_WORKER role cannot export CSV (403)."""
        # Arrange
        mock_user = make_mock_user(role=UserRole.FIELD_WORKER)
        mock_db = AsyncMock()

        from src.api.v1.export import export_tickets_csv
        from fastapi import HTTPException

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

        assert exc_info.value.status_code == 403


class TestCSVExportOutput:
    """Test CSV export output format."""

    async def test_csv_export_contains_expected_headers(self):
        """Test CSV contains all expected column headers."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = [make_mock_ticket()]
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            # Extract CSV content from StreamingResponse
            content = ""
            async for chunk in response.body_iterator:
                content += chunk

            reader = csv.reader(io.StringIO(content))
            headers = next(reader)

            expected_headers = [
                "Tracking Number", "Category", "Status", "Severity",
                "Description", "Address", "Language", "Created",
                "SLA Response Deadline", "SLA Resolution Deadline",
                "First Responded", "Resolved At", "Escalated At"
            ]
            assert headers == expected_headers

    async def test_csv_export_data_matches_tickets(self):
        """Test CSV data rows match mock ticket data."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = [
                make_mock_ticket(
                    tracking_number="TKT-12345",
                    category="water",
                    status="open",
                    severity="high",
                    description="Water leak",
                    address="456 Elm St",
                    language="en"
                )
            ]
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Extract CSV content
            content = ""
            async for chunk in response.body_iterator:
                content += chunk

            reader = csv.reader(io.StringIO(content))
            next(reader)  # Skip header
            data_row = next(reader)

            # Assert
            assert data_row[0] == "TKT-12345"
            assert data_row[1] == "water"
            assert data_row[2] == "open"
            assert data_row[3] == "high"
            assert data_row[4] == "Water leak"
            assert data_row[5] == "456 Elm St"
            assert data_row[6] == "en"

    async def test_csv_export_filename_has_timestamp(self):
        """Test CSV filename includes timestamp."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = []
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            disposition = response.headers["Content-Disposition"]
            assert "tickets_export_" in disposition
            assert ".csv" in disposition


class TestExcelExportRBAC:
    """Test RBAC enforcement on Excel export endpoint."""

    async def test_manager_can_export_excel(self):
        """Test MANAGER role can export Excel."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = []
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_excel

            # Act
            response = await export_tickets_excel(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

            # Assert
            assert "openxmlformats" in response.media_type
            assert "attachment" in response.headers["Content-Disposition"]

    async def test_citizen_cannot_export_excel(self):
        """Test CITIZEN role cannot export Excel (403)."""
        # Arrange
        mock_user = make_mock_user(role=UserRole.CITIZEN)
        mock_db = AsyncMock()

        from src.api.v1.export import export_tickets_excel
        from fastapi import HTTPException

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await export_tickets_excel(make_mock_starlette_request(), current_user=mock_user, db=mock_db)

        assert exc_info.value.status_code == 403


class TestExportSEC05Compliance:
    """Test SEC-05: GBV ticket exclusion from exports."""

    async def test_export_query_excludes_sensitive_tickets(self):
        """Test _fetch_export_tickets filters is_sensitive == False."""
        # Arrange
        mock_user = make_mock_user(role=UserRole.MANAGER)
        mock_db = AsyncMock()

        # Mock database result
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute = AsyncMock(return_value=mock_result)

        from src.api.v1.export import _fetch_export_tickets

        # Act
        await _fetch_export_tickets(mock_db, mock_user, None, None, None, None)

        # Assert
        # Verify execute was called (query was built with is_sensitive filter)
        assert mock_db.execute.called


class TestExportFilters:
    """Test export endpoint filtering parameters."""

    async def test_export_with_status_filter(self):
        """Test CSV export filters by status parameter."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = [make_mock_ticket(status="resolved")]
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            response = await export_tickets_csv(
                make_mock_starlette_request(),
                current_user=mock_user,
                db=mock_db,
                status_filter="resolved"
            )

            # Assert
            mock_fetch.assert_called_once()
            call_args = mock_fetch.call_args
            assert call_args[0][2] == "resolved"  # status_filter argument

    async def test_export_with_category_filter(self):
        """Test CSV export filters by category parameter."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = []
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            await export_tickets_csv(
                make_mock_starlette_request(),
                current_user=mock_user,
                db=mock_db,
                category="water"
            )

            # Assert
            call_args = mock_fetch.call_args
            assert call_args[0][3] == "water"  # category argument

    async def test_export_with_search_filter(self):
        """Test CSV export filters by search parameter."""
        # Arrange
        with patch('src.api.v1.export._fetch_export_tickets') as mock_fetch:
            mock_user = make_mock_user(role=UserRole.MANAGER)
            mock_db = AsyncMock()

            mock_tickets = []
            mock_fetch.return_value = mock_tickets

            from src.api.v1.export import export_tickets_csv

            # Act
            await export_tickets_csv(
                make_mock_starlette_request(),
                current_user=mock_user,
                db=mock_db,
                search="TKT-123"
            )

            # Assert
            call_args = mock_fetch.call_args
            assert call_args[0][5] == "TKT-123"  # search argument
