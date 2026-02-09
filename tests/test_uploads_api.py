"""Unit tests for uploads API endpoints.

Tests presigned URL generation, upload confirmation, content type validation,
and file size limits with mocked StorageService.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi import status


pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


class TestUploadsAPI:
    """Integration tests for uploads endpoints."""

    async def test_presigned_upload_image(self, client, citizen_token):
        """Test presigned URL generation for valid image upload."""
        # Arrange
        request_data = {
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "file_size": 2 * 1024 * 1024,  # 2MB
            "purpose": "evidence"
        }

        with patch('src.api.v1.uploads.StorageService') as mock_storage_class:
            mock_storage = MagicMock()
            mock_storage.generate_presigned_post.return_value = {
                "url": "https://s3.amazonaws.com/bucket",
                "fields": {"key": "evidence/tenant/file/photo.jpg"},
                "file_id": "file-123"
            }
            mock_storage_class.return_value = mock_storage

            # Act
            response = await client.post(
                "/api/v1/uploads/presigned",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://s3.amazonaws.com/bucket"
        assert "fields" in data
        assert "file_id" in data

    async def test_presigned_upload_pdf(self, client, citizen_token):
        """Test presigned URL generation for PDF document."""
        # Arrange
        request_data = {
            "filename": "document.pdf",
            "content_type": "application/pdf",
            "file_size": 3 * 1024 * 1024,  # 3MB
            "purpose": "proof_of_residence"
        }

        with patch('src.api.v1.uploads.StorageService') as mock_storage_class:
            mock_storage = MagicMock()
            mock_storage.generate_presigned_post.return_value = {
                "url": "https://s3.amazonaws.com/bucket",
                "fields": {"key": "documents/tenant/file/document.pdf"},
                "file_id": "file-456"
            }
            mock_storage_class.return_value = mock_storage

            # Act
            response = await client.post(
                "/api/v1/uploads/presigned",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data

    async def test_presigned_upload_invalid_type(self, client, citizen_token):
        """Test rejection for unsupported content type."""
        # Arrange
        request_data = {
            "filename": "video.mp4",
            "content_type": "video/mp4",  # Not allowed
            "file_size": 5 * 1024 * 1024,
            "purpose": "evidence"
        }

        # Act
        response = await client.post(
            "/api/v1/uploads/presigned",
            json=request_data,
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"].lower()

    async def test_presigned_upload_too_large(self, client, citizen_token):
        """Test rejection for file exceeding max size."""
        # Arrange
        request_data = {
            "filename": "huge.jpg",
            "content_type": "image/jpeg",
            "file_size": 15 * 1024 * 1024,  # 15MB (exceeds 10MB limit)
            "purpose": "evidence"
        }

        # Act
        response = await client.post(
            "/api/v1/uploads/presigned",
            json=request_data,
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 400
        assert "exceeds maximum" in response.json()["detail"].lower()

    async def test_confirm_upload(self, client, citizen_token, db_session):
        """Test upload confirmation creates MediaAttachment record."""
        # Arrange
        file_id = "test-file-123"
        purpose = "evidence"

        # Act
        response = await client.post(
            f"/api/v1/uploads/confirm?file_id={file_id}&purpose={purpose}",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == file_id
        assert data["purpose"] == purpose
        assert data["ticket_id"] is None  # Not linked to ticket yet

    async def test_confirm_upload_invalid_file_id(self, client, citizen_token):
        """Test confirmation with invalid file_id is accepted (file created)."""
        # Note: Current implementation doesn't validate file_id exists in S3
        # It creates MediaAttachment record regardless
        # In production, would verify S3 object exists

        # Arrange
        file_id = "nonexistent-file"
        purpose = "evidence"

        # Act
        response = await client.post(
            f"/api/v1/uploads/confirm?file_id={file_id}&purpose={purpose}",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        # Current implementation accepts any file_id
        assert response.status_code == 200

    async def test_presigned_upload_requires_auth(self, client):
        """Test presigned upload endpoint returns 401 without JWT."""
        # Arrange
        request_data = {
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "file_size": 2 * 1024 * 1024,
            "purpose": "evidence"
        }

        # Act
        response = await client.post(
            "/api/v1/uploads/presigned",
            json=request_data
            # No Authorization header
        )

        # Assert
        assert response.status_code == 401

    async def test_storage_service_unavailable(self, client, citizen_token):
        """Test graceful handling when S3 service unavailable."""
        # Arrange
        request_data = {
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "file_size": 2 * 1024 * 1024,
            "purpose": "evidence"
        }

        with patch('src.api.v1.uploads.StorageService') as mock_storage_class:
            mock_storage = MagicMock()
            from src.services.storage_service import StorageServiceError
            mock_storage.generate_presigned_post.side_effect = StorageServiceError("S3 not configured")
            mock_storage_class.return_value = mock_storage

            # Act
            response = await client.post(
                "/api/v1/uploads/presigned",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()
