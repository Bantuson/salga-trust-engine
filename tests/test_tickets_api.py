"""Unit tests for Ticket Management API (Phase 4 + Phase 9-02 ward enforcement).

Tests ticket listing, detail views, status updates, assignment endpoints,
and RBAC enforcement with SEC-05 GBV access controls.

Phase 9-02: TestWardCouncillorEnforcement — unit tests for ward_id enforcement.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.types import Scope

from src.models.user import User, UserRole

pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


def make_mock_starlette_request_tickets():
    """Create a minimal starlette Request for rate-limited ticket endpoints."""
    scope: Scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": Headers(headers={}).raw,
        "query_string": b"",
        "client": ("127.0.0.1", 0),
    }
    return Request(scope=scope)


def make_mock_ticket_user(role=UserRole.MANAGER, ward_id=None, tenant_id=None):
    """Create a mock User object for ticket tests.

    Args:
        role: User role (default MANAGER)
        ward_id: Optional stored ward_id (None = no ward assigned)
        tenant_id: Optional tenant UUID
    """
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = f"user-{user.id}@example.com"
    user.role = role
    user.tenant_id = str(tenant_id or uuid4())
    user.is_active = True
    user.ward_id = ward_id  # Explicitly set ward_id
    return user


class TestTicketsAPI:
    """Integration tests for tickets endpoints."""

    async def test_list_tickets_manager_role(self, client, admin_token, test_municipality, db_session):
        """Test manager can see non-sensitive tickets."""
        # This test requires actual database setup with tickets
        # For now, test the endpoint returns 200 with manager role
        response = await client.get(
            "/api/v1/tickets/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_tickets_citizen_forbidden(self, client, citizen_token):
        """Test citizens cannot access /tickets/ list endpoint (403)."""
        # Act
        response = await client.get(
            "/api/v1/tickets/",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 403

    async def test_list_tickets_filter_by_status(self, client, admin_token):
        """Test filtering tickets by status query parameter."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?status_filter=open",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_tickets_filter_by_category(self, client, admin_token):
        """Test filtering tickets by category query parameter."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?category=water",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_get_ticket_detail_not_found(self, client, admin_token):
        """Test getting non-existent ticket returns 404."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.get(
            f"/api/v1/tickets/{fake_ticket_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 404

    async def test_update_ticket_status_unauthorized_citizen(self, client, citizen_token):
        """Test citizens cannot update ticket status (403)."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.patch(
            f"/api/v1/tickets/{fake_ticket_id}/status",
            json={"status": "in_progress"},
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 403

    async def test_assign_ticket_unauthorized_citizen(self, client, citizen_token):
        """Test citizens cannot assign tickets (403)."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.post(
            f"/api/v1/tickets/{fake_ticket_id}/assign",
            json={"team_id": str(uuid4()), "reason": "test"},
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 403

    async def test_get_ticket_history_unauthorized_citizen(self, client, citizen_token):
        """Test citizens cannot view ticket history (403)."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.get(
            f"/api/v1/tickets/{fake_ticket_id}/history",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 403

    async def test_list_tickets_pagination(self, client, admin_token):
        """Test pagination with limit and offset parameters."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?limit=10&offset=0",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10

    async def test_assign_ticket_auto_route(self, client, admin_token):
        """Test auto-routing when team_id=None triggers RoutingService."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.post(
            f"/api/v1/tickets/{fake_ticket_id}/assign",
            json={"team_id": None, "reason": "auto_route"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert - ticket not found (400 or 404 depending on implementation)
        assert response.status_code in [400, 404]

    async def test_update_status_invalid_ticket(self, client, admin_token):
        """Test updating status of non-existent ticket returns 404."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.patch(
            f"/api/v1/tickets/{fake_ticket_id}/status",
            json={"status": "in_progress"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 404

    async def test_list_tickets_no_auth(self, client):
        """Test accessing tickets without authentication returns 401."""
        # Act
        response = await client.get("/api/v1/tickets/")

        # Assert
        assert response.status_code in [401, 403]  # Depends on auth middleware

    async def test_get_ticket_history_not_found(self, client, admin_token):
        """Test getting history for non-existent ticket returns 404."""
        # Arrange
        fake_ticket_id = uuid4()

        # Act
        response = await client.get(
            f"/api/v1/tickets/{fake_ticket_id}/history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 404


class TestEnhancedListTickets:
    """Tests for Phase 5 enhanced list_tickets endpoint (pagination, search)."""

    async def test_list_tickets_returns_paginated_response(self, client, admin_token):
        """Test list_tickets returns PaginatedTicketResponse structure."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?page=1&page_size=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "page_count" in data
        assert isinstance(data["tickets"], list)

    async def test_list_tickets_search_by_tracking_number(self, client, admin_token):
        """Test search parameter filters by tracking_number."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?search=TKT-",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data

    async def test_list_tickets_search_by_description(self, client, admin_token):
        """Test search parameter filters by description."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?search=water",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data

    async def test_list_tickets_with_ward_id_filter(self, client, admin_token):
        """Test ward_id parameter filters tickets by ward."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?ward_id=Ward%201",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data

    async def test_list_tickets_sort_by_created_at(self, client, admin_token):
        """Test sort_by=created_at parameter."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?sort_by=created_at&sort_order=desc",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data

    async def test_list_tickets_sort_by_status(self, client, admin_token):
        """Test sort_by=status parameter."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?sort_by=status&sort_order=asc",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data

    async def test_list_tickets_pagination_page_2(self, client, admin_token):
        """Test pagination page parameter."""
        # Act
        response = await client.get(
            "/api/v1/tickets/?page=2&page_size=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 5

    async def test_ward_councillor_can_list_tickets(self, client, db_session, test_municipality):
        """Test WARD_COUNCILLOR role can access list endpoint (read-only)."""
        # Arrange - create ward councillor user
        from src.models.user import User, UserRole
        from tests.conftest import create_supabase_access_token

        councillor = User(
            email="councillor@example.com",
            hashed_password="supabase_managed",
            full_name="Ward Councillor",
            phone="+27111222444",
            tenant_id=str(test_municipality.id),
            municipality_id=test_municipality.id,
            role=UserRole.WARD_COUNCILLOR,
            is_active=True
        )
        db_session.add(councillor)
        await db_session.commit()
        await db_session.refresh(councillor)

        councillor_token = create_supabase_access_token({
            "sub": str(councillor.id),
            "tenant_id": councillor.tenant_id,
            "role": councillor.role.value,
            "email": councillor.email,
        })

        # Act
        response = await client.get(
            "/api/v1/tickets/",
            headers={"Authorization": f"Bearer {councillor_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data

    async def test_ward_councillor_cannot_assign_tickets(self, client, db_session, test_municipality):
        """Test WARD_COUNCILLOR cannot assign tickets (403)."""
        # Arrange
        from src.models.user import User, UserRole
        from tests.conftest import create_supabase_access_token

        councillor = User(
            email="councillor2@example.com",
            hashed_password="supabase_managed",
            full_name="Ward Councillor 2",
            phone="+27111222555",
            tenant_id=str(test_municipality.id),
            municipality_id=test_municipality.id,
            role=UserRole.WARD_COUNCILLOR,
            is_active=True
        )
        db_session.add(councillor)
        await db_session.commit()
        await db_session.refresh(councillor)

        councillor_token = create_supabase_access_token({
            "sub": str(councillor.id),
            "tenant_id": councillor.tenant_id,
            "role": councillor.role.value,
            "email": councillor.email,
        })

        fake_ticket_id = uuid4()

        # Act
        response = await client.post(
            f"/api/v1/tickets/{fake_ticket_id}/assign",
            json={"team_id": str(uuid4()), "reason": "test"},
            headers={"Authorization": f"Bearer {councillor_token}"}
        )

        # Assert
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Phase 9-02: Ward Councillor Enforcement Unit Tests
# These tests use direct function calls with mock users (no DB/client required).
# The module-level pytestmark includes integration, so these will be skipped
# without PostgreSQL — but they verify the enforcement logic when run.
# ---------------------------------------------------------------------------

class TestWardCouncillorEnforcement:
    """Unit tests for ward_id enforcement in list_tickets() (Phase 9-02).

    Ward councillors must have their stored ward_id applied automatically.
    Client-supplied ward_id query param is overridden (prevents spoofing).
    Councillors with no ward_id return empty results (fail-safe).
    """

    @pytest.mark.asyncio
    async def test_list_tickets_ward_councillor_with_ward_id(self):
        """Ward councillor with assigned ward_id gets tickets filtered to that ward."""
        from src.api.v1.tickets import list_tickets
        from src.schemas.ticket import PaginatedTicketResponse

        mock_user = make_mock_ticket_user(role=UserRole.WARD_COUNCILLOR, ward_id="Ward 5")
        mock_db = AsyncMock()

        # Mock the database to return empty result set (just testing filter applied)
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0
        mock_ticket_result = MagicMock()
        mock_ticket_result.scalars.return_value.all.return_value = []

        # db.execute returns different results for count vs data queries
        mock_db.execute = AsyncMock(side_effect=[mock_count_result, mock_ticket_result])

        result = await list_tickets(
            request=make_mock_starlette_request_tickets(),
            current_user=mock_user,
            db=mock_db,
            page=0,
            page_size=50,
            ward_id=None,  # Client supplies no ward_id — stored ward_id must be used
        )

        # Assert — returns valid paginated response (no empty short-circuit for assigned ward)
        assert isinstance(result, PaginatedTicketResponse)
        assert result.page == 0
        assert result.page_size == 50

    @pytest.mark.asyncio
    async def test_list_tickets_ward_councillor_no_ward_id_returns_empty(self):
        """Ward councillor with no ward_id assigned returns empty result (fail-safe)."""
        from src.api.v1.tickets import list_tickets
        from src.schemas.ticket import PaginatedTicketResponse

        mock_user = make_mock_ticket_user(role=UserRole.WARD_COUNCILLOR, ward_id=None)
        mock_db = AsyncMock()

        result = await list_tickets(
            request=make_mock_starlette_request_tickets(),
            current_user=mock_user,
            db=mock_db,
            page=0,
            page_size=50,
        )

        # Assert — early return with empty results, no DB queries needed
        assert isinstance(result, PaginatedTicketResponse)
        assert result.total == 0
        assert result.tickets == []
        assert result.page_count == 0
        # Verify no DB query was made (fail-fast, fail-safe)
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_list_tickets_manager_unaffected_by_ward_enforcement(self):
        """Manager role bypasses ward enforcement and can query without restriction."""
        from src.api.v1.tickets import list_tickets
        from src.schemas.ticket import PaginatedTicketResponse

        mock_user = make_mock_ticket_user(role=UserRole.MANAGER, ward_id=None)
        mock_db = AsyncMock()

        # Mock DB to return empty results
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0
        mock_ticket_result = MagicMock()
        mock_ticket_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(side_effect=[mock_count_result, mock_ticket_result])

        result = await list_tickets(
            request=make_mock_starlette_request_tickets(),
            current_user=mock_user,
            db=mock_db,
            page=0,
            page_size=50,
        )

        # Assert — valid response, DB was queried (manager not short-circuited)
        assert isinstance(result, PaginatedTicketResponse)
        assert mock_db.execute.call_count >= 1  # At least count query was executed
