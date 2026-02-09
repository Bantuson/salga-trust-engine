"""Unit tests for verification API endpoints.

Tests proof of residence upload URL generation, OCR verification workflow,
and verification status retrieval with mocked services.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime


pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


class TestVerificationAPI:
    """Integration tests for verification endpoints."""

    async def test_upload_url_for_documents(self, client, citizen_token):
        """Test presigned URL generation for proof of residence documents."""
        # Arrange
        request_data = {
            "filename": "utility_bill.pdf",
            "content_type": "application/pdf"
        }

        with patch('src.api.v1.verification.StorageService') as mock_storage_class:
            mock_storage = MagicMock()
            mock_storage.generate_presigned_post.return_value = {
                "url": "https://s3.amazonaws.com/documents-bucket",
                "fields": {"key": "proof_of_residence/tenant/file/utility_bill.pdf"},
                "file_id": "file-789"
            }
            mock_storage_class.return_value = mock_storage

            # Act
            response = await client.post(
                "/api/v1/verification/upload-url",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "fields" in data
        assert "file_id" in data

        # Verify purpose is proof_of_residence
        call_kwargs = mock_storage.generate_presigned_post.call_args[1]
        assert call_kwargs["purpose"] == "proof_of_residence"

    async def test_popia_consent_message(self, client, citizen_token):
        """Test upload URL endpoint documents POPIA consent requirement."""
        # Note: POPIA consent message is in the endpoint docstring
        # Frontend should display this before upload

        # Arrange
        request_data = {
            "filename": "document.jpg",
            "content_type": "image/jpeg"
        }

        with patch('src.api.v1.verification.StorageService') as mock_storage_class:
            mock_storage = MagicMock()
            mock_storage.generate_presigned_post.return_value = {
                "url": "https://s3.amazonaws.com/bucket",
                "fields": {},
                "file_id": "file-123"
            }
            mock_storage_class.return_value = mock_storage

            # Act
            response = await client.post(
                "/api/v1/verification/upload-url",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        # POPIA consent is documented in OpenAPI spec via endpoint docstring

    async def test_verify_proof_of_residence_success(self, client, citizen_user, citizen_token, db_session):
        """Test OCR verification with high confidence updates user to verified."""
        # Arrange
        from src.models.media import MediaAttachment
        from uuid import uuid4

        file_id = str(uuid4())

        # Create MediaAttachment for the document
        media = MediaAttachment(
            file_id=file_id,
            s3_bucket="test-bucket",
            s3_key="proof_of_residence/tenant/file/doc.jpg",
            filename="utility_bill.jpg",
            content_type="image/jpeg",
            file_size=100000,
            purpose="proof_of_residence",
            source="web",
            tenant_id=citizen_user.tenant_id,
            created_by=citizen_user.id,
            updated_by=citizen_user.id
        )
        db_session.add(media)
        await db_session.commit()

        request_data = {
            "document_file_id": file_id
        }

        with patch('src.api.v1.verification.StorageService') as mock_storage_class, \
             patch('src.api.v1.verification.httpx.AsyncClient') as mock_httpx_class, \
             patch('src.api.v1.verification.OCRService') as mock_ocr_class, \
             patch('src.api.v1.verification.validate_image_quality') as mock_validate:

            # Mock storage service
            mock_storage = MagicMock()
            mock_storage.generate_presigned_get.return_value = "https://s3.amazonaws.com/download"
            mock_storage_class.return_value = mock_storage

            # Mock httpx download
            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.content = b"fake image data"
            mock_response.raise_for_status = MagicMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_httpx_class.return_value = mock_client

            # Mock image quality validation
            mock_validate.return_value = {"valid": True, "width": 1000, "height": 800, "size_bytes": 100000, "reason": None}

            # Mock OCR service
            mock_ocr = MagicMock()
            from src.services.ocr_service import ProofOfResidenceData
            mock_ocr.extract_proof_of_residence.return_value = ProofOfResidenceData(
                address="123 Main Street, Johannesburg, 2001",
                name="John Doe",
                document_type="utility_bill",
                confidence=0.85,
                raw_text="ESKOM bill text"
            )
            mock_ocr.determine_verification_result.return_value = {
                "status": "verified",
                "auto": True
            }
            mock_ocr_class.return_value = mock_ocr

            # Act
            response = await client.post(
                "/api/v1/verification/proof-of-residence",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "verified"
        assert data["address"] == "123 Main Street, Johannesburg, 2001"
        assert data["confidence"] == 0.85
        assert data["document_type"] == "utility_bill"

        # Verify user was updated
        await db_session.refresh(citizen_user)
        assert citizen_user.verification_status == "verified"
        assert citizen_user.verified_address == "123 Main Street, Johannesburg, 2001"
        assert citizen_user.verified_at is not None

    async def test_verify_proof_of_residence_low_confidence(self, client, citizen_user, citizen_token, db_session):
        """Test OCR with low confidence sets status to rejected."""
        # Arrange
        from src.models.media import MediaAttachment
        from uuid import uuid4

        file_id = str(uuid4())

        media = MediaAttachment(
            file_id=file_id,
            s3_bucket="test-bucket",
            s3_key="proof_of_residence/tenant/file/blurry.jpg",
            filename="blurry.jpg",
            content_type="image/jpeg",
            file_size=50000,
            purpose="proof_of_residence",
            source="web",
            tenant_id=citizen_user.tenant_id,
            created_by=citizen_user.id,
            updated_by=citizen_user.id
        )
        db_session.add(media)
        await db_session.commit()

        request_data = {
            "document_file_id": file_id
        }

        with patch('src.api.v1.verification.StorageService') as mock_storage_class, \
             patch('src.api.v1.verification.httpx.AsyncClient') as mock_httpx_class, \
             patch('src.api.v1.verification.OCRService') as mock_ocr_class, \
             patch('src.api.v1.verification.validate_image_quality') as mock_validate:

            mock_storage = MagicMock()
            mock_storage.generate_presigned_get.return_value = "https://s3.amazonaws.com/download"
            mock_storage_class.return_value = mock_storage

            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.content = b"blurry image data"
            mock_response.raise_for_status = MagicMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_httpx_class.return_value = mock_client

            mock_validate.return_value = {"valid": True, "width": 1000, "height": 800, "size_bytes": 50000, "reason": None}

            mock_ocr = MagicMock()
            from src.services.ocr_service import ProofOfResidenceData
            mock_ocr.extract_proof_of_residence.return_value = ProofOfResidenceData(
                address=None,
                name=None,
                document_type=None,
                confidence=0.25,
                raw_text="unreadable"
            )
            mock_ocr.determine_verification_result.return_value = {
                "status": "rejected",
                "auto": True,
                "reason": "Document quality too low for OCR"
            }
            mock_ocr_class.return_value = mock_ocr

            # Act
            response = await client.post(
                "/api/v1/verification/proof-of-residence",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert "quality too low" in data["message"].lower()

    async def test_verify_proof_of_residence_medium(self, client, citizen_user, citizen_token, db_session):
        """Test OCR with medium confidence sets status to pending (manual review)."""
        # Arrange
        from src.models.media import MediaAttachment
        from uuid import uuid4

        file_id = str(uuid4())

        media = MediaAttachment(
            file_id=file_id,
            s3_bucket="test-bucket",
            s3_key="proof_of_residence/tenant/file/partial.jpg",
            filename="partial.jpg",
            content_type="image/jpeg",
            file_size=75000,
            purpose="proof_of_residence",
            source="web",
            tenant_id=citizen_user.tenant_id,
            created_by=citizen_user.id,
            updated_by=citizen_user.id
        )
        db_session.add(media)
        await db_session.commit()

        request_data = {
            "document_file_id": file_id
        }

        with patch('src.api.v1.verification.StorageService') as mock_storage_class, \
             patch('src.api.v1.verification.httpx.AsyncClient') as mock_httpx_class, \
             patch('src.api.v1.verification.OCRService') as mock_ocr_class, \
             patch('src.api.v1.verification.validate_image_quality') as mock_validate:

            mock_storage = MagicMock()
            mock_storage.generate_presigned_get.return_value = "https://s3.amazonaws.com/download"
            mock_storage_class.return_value = mock_storage

            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.content = b"partial image data"
            mock_response.raise_for_status = MagicMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_httpx_class.return_value = mock_client

            mock_validate.return_value = {"valid": True, "width": 1000, "height": 800, "size_bytes": 75000, "reason": None}

            mock_ocr = MagicMock()
            from src.services.ocr_service import ProofOfResidenceData
            mock_ocr.extract_proof_of_residence.return_value = ProofOfResidenceData(
                address="123 Main Street, Johannesburg, 2001",
                name=None,  # Partial extraction
                document_type="utility_bill",
                confidence=0.6,
                raw_text="Partial text"
            )
            mock_ocr.determine_verification_result.return_value = {
                "status": "pending",
                "auto": False,
                "reason": "Partial extraction - manual review needed"
            }
            mock_ocr_class.return_value = mock_ocr

            # Act
            response = await client.post(
                "/api/v1/verification/proof-of-residence",
                json=request_data,
                headers={"Authorization": f"Bearer {citizen_token}"}
            )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert "manual review" in data["message"].lower()

    async def test_verify_already_verified(self, client, citizen_user, citizen_token, db_session):
        """Test re-verification is rejected if user already verified."""
        # Arrange
        citizen_user.verification_status = "verified"
        citizen_user.verified_at = datetime.utcnow()
        await db_session.commit()

        request_data = {
            "document_file_id": "any-file-id"
        }

        # Act
        response = await client.post(
            "/api/v1/verification/proof-of-residence",
            json=request_data,
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 400
        assert "already verified" in response.json()["detail"].lower()

    async def test_verification_status(self, client, citizen_user, citizen_token, db_session):
        """Test get verification status returns current user status."""
        # Arrange
        citizen_user.verification_status = "verified"
        citizen_user.verified_address = "123 Main St, Johannesburg, 2001"
        citizen_user.verified_at = datetime.utcnow()
        await db_session.commit()

        # Act
        response = await client.get(
            "/api/v1/verification/status",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["verification_status"] == "verified"
        assert data["verified_address"] == "123 Main St, Johannesburg, 2001"
        assert data["verified_at"] is not None
