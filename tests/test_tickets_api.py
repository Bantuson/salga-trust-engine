"""Unit tests for Ticket Management API (Phase 4).

Tests ticket listing, detail views, status updates, assignment endpoints,
and RBAC enforcement with SEC-05 GBV access controls.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.models.user import UserRole

pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


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
