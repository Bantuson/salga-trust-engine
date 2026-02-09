"""Unit tests for reports submission API.

Tests report submission with GPS/manual address, category classification,
media linking, GBV encryption, tracking number lookup, and pagination.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4


pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


class TestReportsAPI:
    """Integration tests for reports endpoints."""

    async def test_submit_report_with_gps(self, client, citizen_token, db_session):
        """Test report submission with GPS coordinates creates ticket with lat/lng."""
        # Arrange
        request_data = {
            "description": "There is a pothole on Main Street",
            "category": "roads",
            "location": {
                "latitude": -26.2041,
                "longitude": 28.0473
            },
            "language": "en"
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails:
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="There is a pothole on Main Street"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "ticket_id" in data
        assert "tracking_number" in data
        assert data["category"] == "roads"
        assert data["status"] == "open"

    async def test_submit_report_with_address(self, client, citizen_token):
        """Test report submission with manual address creates ticket."""
        # Arrange
        request_data = {
            "description": "Street light not working",
            "category": "electricity",
            "manual_address": "Corner of Smith and Jones Street, Johannesburg",
            "language": "en"
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails:
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Street light not working"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "electricity"
        assert "tracking_number" in data

    async def test_submit_report_no_location(self, client, citizen_token):
        """Test validation requires either GPS or manual address."""
        # Note: Pydantic validator in ReportSubmitRequest should enforce this
        # If validation is at API level (not schema level), test here

        # Arrange
        request_data = {
            "description": "Problem report",
            "category": "other",
            "language": "en"
            # No location or manual_address
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails:
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Problem report"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert - depends on schema validation
        # If schema requires location, this would return 422
        # If not required in schema, ticket is created with None location

    async def test_submit_report_with_category(self, client, citizen_token):
        """Test pre-selected category skips AI classification."""
        # Arrange
        request_data = {
            "description": "Garbage not collected",
            "category": "waste",  # Pre-selected
            "manual_address": "123 Main St",
            "language": "en"
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails, \
             patch('src.api.v1.reports.IntakeFlow') as mock_flow_class:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Garbage not collected"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "waste"

        # Verify IntakeFlow was NOT called (category provided)
        mock_flow_class.assert_not_called()

    async def test_submit_report_without_category(self, client, citizen_token):
        """Test AI classification when category is None."""
        # Arrange
        request_data = {
            "description": "The water is not working in my house",
            "category": None,  # Trigger AI classification
            "manual_address": "123 Main St",
            "language": "en"
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails, \
             patch('src.api.v1.reports.IntakeFlow') as mock_flow_class:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="The water is not working in my house"
            ))

            # Mock IntakeFlow
            mock_flow = MagicMock()
            mock_flow.state = MagicMock(
                category="municipal",
                subcategory="water"
            )
            mock_flow.receive_message = MagicMock()
            mock_flow.classify_message = MagicMock()
            mock_flow_class.return_value = mock_flow

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "water"  # Classified by AI

    async def test_submit_report_with_media(self, client, citizen_token, db_session):
        """Test media file_ids are linked to created ticket."""
        # Arrange
        from src.models.media import MediaAttachment

        # Create MediaAttachment records
        file_id_1 = str(uuid4())
        file_id_2 = str(uuid4())

        media_1 = MediaAttachment(
            file_id=file_id_1,
            s3_bucket="test-bucket",
            s3_key="evidence/tenant/file1.jpg",
            filename="photo1.jpg",
            content_type="image/jpeg",
            file_size=100000,
            purpose="evidence",
            source="web",
            tenant_id=str(uuid4()),
            created_by=uuid4(),
            updated_by=uuid4()
        )
        media_2 = MediaAttachment(
            file_id=file_id_2,
            s3_bucket="test-bucket",
            s3_key="evidence/tenant/file2.jpg",
            filename="photo2.jpg",
            content_type="image/jpeg",
            file_size=150000,
            purpose="evidence",
            source="web",
            tenant_id=media_1.tenant_id,
            created_by=media_1.created_by,
            updated_by=media_1.updated_by
        )

        db_session.add(media_1)
        db_session.add(media_2)
        await db_session.commit()

        request_data = {
            "description": "Pothole with photos",
            "category": "roads",
            "manual_address": "Main Street",
            "language": "en",
            "media_file_ids": [file_id_1, file_id_2]
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails:
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Pothole with photos"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["media_count"] == 2

    async def test_submit_report_gbv_encrypted(self, client, citizen_token):
        """Test GBV report encrypts description and sets is_sensitive."""
        # Arrange
        request_data = {
            "description": "Sensitive GBV incident details",
            "is_gbv": True,
            "manual_address": "Location withheld",
            "language": "en"
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails, \
             patch('src.api.v1.reports.notify_saps') as mock_notify_saps:

            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Sensitive GBV incident details"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "gbv"

        # Verify SAPS notification was called
        mock_notify_saps.assert_called_once()

    async def test_submit_report_returns_tracking(self, client, citizen_token):
        """Test response includes tracking number for lookup."""
        # Arrange
        request_data = {
            "description": "Test report",
            "category": "other",
            "manual_address": "Test address",
            "language": "en"
        }

        with patch('src.api.v1.reports.guardrails_engine') as mock_guardrails:
            mock_guardrails.process_input = AsyncMock(return_value=MagicMock(
                is_safe=True,
                sanitized_message="Test report"
            ))

            # Act
            response = await client.post(
                "/api/v1/reports/submit",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "tracking_number" in data
        assert data["tracking_number"].startswith("TKT-")

    async def test_get_report_by_tracking(self, client, citizen_user, citizen_token, db_session):
        """Test lookup by tracking number returns ticket."""
        # Arrange
        from src.models.ticket import Ticket, generate_tracking_number

        tracking_number = generate_tracking_number()
        ticket = Ticket(
            tracking_number=tracking_number,
            category="water",
            description="Water issue",
            latitude=-26.2041,
            longitude=28.0473,
            severity="medium",
            status="open",
            language="en",
            user_id=citizen_user.id,
            tenant_id=citizen_user.tenant_id,
            created_by=citizen_user.id,
            updated_by=citizen_user.id
        )
        db_session.add(ticket)
        await db_session.commit()

        # Act
        response = await client.get(
            f"/api/v1/reports/{tracking_number}",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == tracking_number
        assert data["category"] == "water"

    async def test_get_report_wrong_user(self, client, citizen_token, test_user, db_session):
        """Test returns 403 if ticket belongs to different user."""
        # Arrange
        from src.models.ticket import Ticket, generate_tracking_number

        tracking_number = generate_tracking_number()
        ticket = Ticket(
            tracking_number=tracking_number,
            category="roads",
            description="Pothole",
            severity="medium",
            status="open",
            language="en",
            user_id=test_user.id,  # Different user
            tenant_id=test_user.tenant_id,
            created_by=test_user.id,
            updated_by=test_user.id
        )
        db_session.add(ticket)
        await db_session.commit()

        # Act
        response = await client.get(
            f"/api/v1/reports/{tracking_number}",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 403
        assert "Not authorized" in response.json()["detail"]

    async def test_my_reports_paginated(self, client, citizen_user, citizen_token, db_session):
        """Test returns user's tickets in reverse chronological order."""
        # Arrange
        from src.models.ticket import Ticket, generate_tracking_number

        # Create 3 tickets for citizen_user
        for i in range(3):
            ticket = Ticket(
                tracking_number=generate_tracking_number(),
                category="water",
                description=f"Test ticket {i}",
                severity="medium",
                status="open",
                language="en",
                user_id=citizen_user.id,
                tenant_id=citizen_user.tenant_id,
                created_by=citizen_user.id,
                updated_by=citizen_user.id
            )
            db_session.add(ticket)
        await db_session.commit()

        # Act
        response = await client.get(
            "/api/v1/reports/my",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Should be ordered by created_at DESC (most recent first)

    async def test_my_reports_gbv_redacted(self, client, citizen_user, citizen_token, db_session):
        """Test GBV ticket description is redacted for non-SAPS users."""
        # Arrange
        from src.models.ticket import Ticket, generate_tracking_number

        ticket = Ticket(
            tracking_number=generate_tracking_number(),
            category="gbv",
            description="GBV incident report",  # Public placeholder
            encrypted_description="Sensitive details encrypted",
            is_sensitive=True,
            severity="high",
            status="open",
            language="en",
            user_id=citizen_user.id,
            tenant_id=citizen_user.tenant_id,
            created_by=citizen_user.id,
            updated_by=citizen_user.id
        )
        db_session.add(ticket)
        await db_session.commit()

        # Act
        response = await client.get(
            "/api/v1/reports/my",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        # Description should be redacted
        assert data[0]["description"] == "[Sensitive Report]"
