"""Tests for Supabase Storage integration.

Tests file upload to evidence/documents/gbv-evidence buckets, signed URL generation,
and media download/upload flow.
"""
import pytest
from unittest.mock import patch, AsyncMock, Mock
from uuid import uuid4

from src.services.storage_service import StorageService


class TestSupabaseStorage:
    """Test Supabase Storage service."""

    @pytest.mark.asyncio
    async def test_upload_file_to_evidence_bucket(self):
        """Mock storage.from_('evidence').upload()."""
        mock_supabase = Mock()
        mock_bucket = Mock()
        mock_bucket.upload = AsyncMock(return_value=Mock(error=None))
        mock_supabase.storage.from_ = Mock(return_value=mock_bucket)

        with patch('src.services.storage_service.get_supabase_admin', return_value=mock_supabase):
            storage_service = StorageService()
            tenant_id = str(uuid4())
            file_id = str(uuid4())

            result = await storage_service.upload_file(
                bucket="evidence",
                path=f"{tenant_id}/{file_id}/test.jpg",
                content=b"fake image data",
                content_type="image/jpeg"
            )

            assert result is not None
            mock_supabase.storage.from_.assert_called_with("evidence")
            mock_bucket.upload.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_file_to_gbv_bucket(self):
        """Mock storage.from_('gbv-evidence').upload()."""
        mock_supabase = Mock()
        mock_bucket = Mock()
        mock_bucket.upload = AsyncMock(return_value=Mock(error=None))
        mock_supabase.storage.from_ = Mock(return_value=mock_bucket)

        with patch('src.services.storage_service.get_supabase_admin', return_value=mock_supabase):
            storage_service = StorageService()
            tenant_id = str(uuid4())
            file_id = str(uuid4())

            result = await storage_service.upload_file(
                bucket="gbv-evidence",
                path=f"{tenant_id}/{file_id}/sensitive.jpg",
                content=b"fake sensitive data",
                content_type="image/jpeg"
            )

            assert result is not None
            mock_supabase.storage.from_.assert_called_with("gbv-evidence")
            mock_bucket.upload.assert_called_once()

    def test_get_signed_url(self):
        """Mock storage.from_().create_signed_url()."""
        mock_supabase = Mock()
        mock_bucket = Mock()
        mock_bucket.create_signed_url = Mock(return_value=Mock(
            signed_url="https://supabase.co/storage/v1/object/sign/evidence/test.jpg?token=abc",
            error=None
        ))
        mock_supabase.storage.from_ = Mock(return_value=mock_bucket)

        with patch('src.services.storage_service.get_supabase_admin', return_value=mock_supabase):
            storage_service = StorageService()
            tenant_id = str(uuid4())
            file_id = str(uuid4())

            signed_url = storage_service.get_signed_url(
                bucket="evidence",
                path=f"{tenant_id}/{file_id}/test.jpg",
                expiry=3600
            )

            assert signed_url is not None
            assert "sign/evidence/" in signed_url
            mock_bucket.create_signed_url.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_and_upload_media(self):
        """Mock httpx download + Supabase upload."""
        mock_supabase = Mock()
        mock_bucket = Mock()
        mock_bucket.upload = AsyncMock(return_value=Mock(error=None))
        mock_supabase.storage.from_ = Mock(return_value=mock_bucket)

        # Mock httpx.AsyncClient.get
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b"fake media content"

        with patch('src.services.storage_service.get_supabase_admin', return_value=mock_supabase), \
             patch('httpx.AsyncClient.get', return_value=mock_response):
            storage_service = StorageService()
            tenant_id = str(uuid4())

            result = await storage_service.download_and_upload_media(
                media_url="https://api.twilio.com/media/MExxxx",
                tenant_id=tenant_id,
                ticket_id="temp-ticket-id",
                filename="whatsapp_media.jpg",
                is_sensitive=False
            )

            assert result is not None
            # Should upload to evidence bucket (not gbv-evidence)
            mock_supabase.storage.from_.assert_called_with("evidence")

    @pytest.mark.asyncio
    async def test_download_and_upload_media_sensitive(self):
        """GBV media goes to gbv-evidence bucket."""
        mock_supabase = Mock()
        mock_bucket = Mock()
        mock_bucket.upload = AsyncMock(return_value=Mock(error=None))
        mock_supabase.storage.from_ = Mock(return_value=mock_bucket)

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b"fake gbv media"

        with patch('src.services.storage_service.get_supabase_admin', return_value=mock_supabase), \
             patch('httpx.AsyncClient.get', return_value=mock_response):
            storage_service = StorageService()
            tenant_id = str(uuid4())

            result = await storage_service.download_and_upload_media(
                media_url="https://api.twilio.com/media/MExxxx",
                tenant_id=tenant_id,
                ticket_id="temp-ticket-id",
                filename="gbv_evidence.jpg",
                is_sensitive=True  # GBV ticket
            )

            assert result is not None
            # Should upload to gbv-evidence bucket
            mock_supabase.storage.from_.assert_called_with("gbv-evidence")

    def test_storage_service_no_supabase(self):
        """Returns None when Supabase not configured."""
        with patch('src.services.storage_service.get_supabase_admin', return_value=None):
            storage_service = StorageService()
            tenant_id = str(uuid4())
            file_id = str(uuid4())

            result = storage_service.generate_upload_url(
                purpose="evidence",
                tenant_id=tenant_id,
                file_id=file_id,
                filename="test.jpg",
                content_type="image/jpeg"
            )

            # Should return None or raise error when not configured
            # (graceful degradation for tests)
            assert result is None or "bucket" in result
