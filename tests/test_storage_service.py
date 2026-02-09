"""Unit tests for S3 storage service.

Tests presigned URL generation, media download/upload, and error handling
with mocked boto3 and httpx clients.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4

from src.services.storage_service import StorageService, StorageServiceError


class TestStorageService:
    """Unit tests for StorageService."""

    @pytest.fixture
    def storage_service(self):
        """Create StorageService with mocked S3 client."""
        with patch('src.services.storage_service.boto3') as mock_boto3:
            # Mock S3 client
            mock_client = MagicMock()
            mock_boto3.client.return_value = mock_client

            # Mock settings
            with patch('src.services.storage_service.settings') as mock_settings:
                mock_settings.AWS_ACCESS_KEY_ID = "test_key_id"
                mock_settings.AWS_SECRET_ACCESS_KEY = "test_secret_key"
                mock_settings.AWS_REGION = "us-east-1"
                mock_settings.S3_BUCKET_EVIDENCE = "test-evidence-bucket"
                mock_settings.S3_BUCKET_DOCUMENTS = "test-documents-bucket"

                service = StorageService()
                service._client = mock_client

                yield service

    def test_generate_presigned_post_evidence(self, storage_service):
        """Test presigned POST generation for evidence uploads."""
        # Arrange
        mock_presigned = {
            "url": "https://s3.amazonaws.com/test-evidence-bucket",
            "fields": {
                "key": "evidence/tenant123/file456/photo.jpg",
                "Content-Type": "image/jpeg"
            }
        }
        storage_service._client.generate_presigned_post.return_value = mock_presigned

        # Act
        result = storage_service.generate_presigned_post(
            purpose="evidence",
            tenant_id="tenant123",
            user_id="user789",
            file_id="file456",
            filename="photo.jpg",
            content_type="image/jpeg",
            max_size=10 * 1024 * 1024
        )

        # Assert
        assert result["url"] == mock_presigned["url"]
        assert result["fields"] == mock_presigned["fields"]
        assert result["file_id"] == "file456"

        # Verify S3 client called with correct params
        storage_service._client.generate_presigned_post.assert_called_once()
        call_kwargs = storage_service._client.generate_presigned_post.call_args[1]
        assert call_kwargs["Bucket"] == "test-evidence-bucket"
        assert "evidence/tenant123/file456/photo.jpg" in call_kwargs["Key"]
        assert call_kwargs["ExpiresIn"] == 900

    def test_generate_presigned_post_documents(self, storage_service):
        """Test presigned POST generation for proof_of_residence documents."""
        # Arrange
        mock_presigned = {
            "url": "https://s3.amazonaws.com/test-documents-bucket",
            "fields": {
                "key": "proof_of_residence/tenant123/file789/document.pdf",
                "Content-Type": "application/pdf"
            }
        }
        storage_service._client.generate_presigned_post.return_value = mock_presigned

        # Act
        result = storage_service.generate_presigned_post(
            purpose="proof_of_residence",
            tenant_id="tenant123",
            user_id="user456",
            file_id="file789",
            filename="document.pdf",
            content_type="application/pdf"
        )

        # Assert
        call_kwargs = storage_service._client.generate_presigned_post.call_args[1]
        assert call_kwargs["Bucket"] == "test-documents-bucket"
        assert "proof_of_residence/tenant123/file789/document.pdf" in call_kwargs["Key"]

    def test_generate_presigned_post_no_credentials(self):
        """Test error when S3 not configured."""
        # Arrange
        with patch('src.services.storage_service.settings') as mock_settings:
            mock_settings.AWS_ACCESS_KEY_ID = None
            mock_settings.AWS_SECRET_ACCESS_KEY = None
            service = StorageService()

        # Act & Assert
        with pytest.raises(StorageServiceError, match="S3 storage service not configured"):
            service.generate_presigned_post(
                purpose="evidence",
                tenant_id="tenant123",
                user_id="user456",
                file_id="file789",
                filename="photo.jpg",
                content_type="image/jpeg"
            )

    @pytest.mark.asyncio
    async def test_download_and_upload_media(self, storage_service):
        """Test downloading media from Twilio and uploading to S3."""
        # Arrange
        media_content = b"fake image data"
        mock_response = AsyncMock()
        mock_response.content = media_content
        mock_response.raise_for_status = MagicMock()

        with patch('src.services.storage_service.httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.get.return_value = mock_response
            mock_httpx.return_value = mock_client

            # Act
            result = await storage_service.download_and_upload_media(
                media_url="https://api.twilio.com/media/ME123",
                media_content_type="image/jpeg",
                ticket_id="ticket456",
                tenant_id="tenant123",
                auth_credentials=("AC123", "auth_token")
            )

        # Assert
        assert result["s3_bucket"] == "test-evidence-bucket"
        assert "evidence/tenant123/ticket456/" in result["s3_key"]
        assert result["s3_key"].endswith(".jpg")
        assert result["content_type"] == "image/jpeg"
        assert result["file_size"] == len(media_content)
        assert "file_id" in result

        # Verify httpx called with auth
        mock_client.get.assert_called_once()
        call_kwargs = mock_client.get.call_args[1]
        assert call_kwargs["auth"] == ("AC123", "auth_token")

        # Verify S3 put_object called
        storage_service._client.put_object.assert_called_once()
        put_kwargs = storage_service._client.put_object.call_args[1]
        assert put_kwargs["Bucket"] == "test-evidence-bucket"
        assert put_kwargs["ContentType"] == "image/jpeg"
        assert put_kwargs["ServerSideEncryption"] == "AES256"

    @pytest.mark.asyncio
    async def test_download_and_upload_media_failure(self, storage_service):
        """Test graceful handling of media download failure."""
        # Arrange
        import httpx

        with patch('src.services.storage_service.httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            # Use httpx.HTTPError instead of generic Exception
            mock_client.get.side_effect = httpx.HTTPError("Network error")
            mock_httpx.return_value = mock_client

            # Act & Assert
            with pytest.raises(StorageServiceError, match="Failed to download media from Twilio"):
                await storage_service.download_and_upload_media(
                    media_url="https://api.twilio.com/media/ME123",
                    media_content_type="image/jpeg",
                    ticket_id="ticket456",
                    tenant_id="tenant123",
                    auth_credentials=("AC123", "auth_token")
                )

    def test_generate_presigned_get(self, storage_service):
        """Test presigned GET URL generation."""
        # Arrange
        expected_url = "https://s3.amazonaws.com/test-evidence-bucket/key?signature=abc"
        storage_service._client.generate_presigned_url.return_value = expected_url

        # Act
        result = storage_service.generate_presigned_get(
            bucket="test-evidence-bucket",
            key="evidence/tenant123/ticket456/file789.jpg",
            expiry=3600
        )

        # Assert
        assert result == expected_url
        storage_service._client.generate_presigned_url.assert_called_once_with(
            'get_object',
            Params={
                'Bucket': 'test-evidence-bucket',
                'Key': 'evidence/tenant123/ticket456/file789.jpg'
            },
            ExpiresIn=3600
        )

    def test_s3_key_format(self, storage_service):
        """Test S3 key follows pattern {purpose}/{tenant_id}/{file_id}/{filename}."""
        # Arrange
        mock_presigned = {
            "url": "https://s3.amazonaws.com/bucket",
            "fields": {"key": "evidence/tenant/file/name.jpg"}
        }
        storage_service._client.generate_presigned_post.return_value = mock_presigned

        # Act
        storage_service.generate_presigned_post(
            purpose="evidence",
            tenant_id="tenant_abc",
            user_id="user_xyz",
            file_id="file_123",
            filename="report.jpg",
            content_type="image/jpeg"
        )

        # Assert
        call_kwargs = storage_service._client.generate_presigned_post.call_args[1]
        s3_key = call_kwargs["Key"]

        # Key should be: evidence/tenant_abc/file_123/report.jpg
        assert s3_key.startswith("evidence/")
        assert "/tenant_abc/" in s3_key
        assert "/file_123/" in s3_key
        assert s3_key.endswith("/report.jpg")

    def test_get_extension_from_content_type(self):
        """Test content type to extension mapping."""
        # Test via static method
        assert StorageService._get_extension_from_content_type("image/jpeg") == "jpg"
        assert StorageService._get_extension_from_content_type("image/png") == "png"
        assert StorageService._get_extension_from_content_type("image/gif") == "gif"
        assert StorageService._get_extension_from_content_type("application/pdf") == "pdf"
        assert StorageService._get_extension_from_content_type("video/mp4") == "mp4"
        assert StorageService._get_extension_from_content_type("unknown/type") == "bin"
