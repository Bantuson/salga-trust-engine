"""Unit tests for Supabase user_metadata sync after OCR verification.

Phase 09-01: OCR-to-Supabase bridge — verifies that after successful OCR
verification, residence_verified is synced to Supabase user_metadata so
the frontend session gate unlocks without manual page reload.

These are pure unit tests (no PostgreSQL required). All DB and service
dependencies are mocked using AsyncMock/MagicMock.

Note: The verify_proof_of_residence endpoint is wrapped by @limiter.limit()
which validates the starlette.requests.Request. We call the underlying
function directly by extracting it from the endpoint's __wrapped__ attribute,
bypassing the rate-limiting decorator per the project's established testing
pattern (see STATE.md: "slowapi rate-limited endpoints cannot be called
directly in tests — inspect internal logic functions instead").
"""
import logging
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4


pytestmark = pytest.mark.asyncio


def _get_endpoint_fn():
    """Get the unwrapped verify_proof_of_residence function, bypassing slowapi.

    slowapi wraps the endpoint function and validates that 'request' is a real
    starlette.requests.Request. To test the business logic in isolation, we
    access __wrapped__ to get the original function before decoration.
    """
    from src.api.v1.verification import verify_proof_of_residence
    # slowapi wraps via functools.wraps, so __wrapped__ holds the original
    fn = verify_proof_of_residence
    while hasattr(fn, '__wrapped__'):
        fn = fn.__wrapped__
    return fn


def _make_mock_user(tenant_id=None):
    """Create a mock User object for testing."""
    user = MagicMock()
    user.id = uuid4()
    user.tenant_id = str(tenant_id or uuid4())
    user.verification_status = "unverified"
    user.verified_at = None
    return user


def _make_mock_media(file_id, tenant_id):
    """Create a mock MediaAttachment for testing."""
    media = MagicMock()
    media.file_id = file_id
    media.tenant_id = tenant_id
    media.s3_bucket = "test-bucket"
    media.s3_key = "proof_of_residence/file.jpg"
    return media


def _build_verified_mocks():
    """Build the standard set of mocks for a successful verified flow."""
    from src.services.ocr_service import ProofOfResidenceData

    mock_ocr = MagicMock()
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

    mock_storage = MagicMock()
    mock_storage.generate_presigned_get.return_value = "https://s3.amazonaws.com/download"

    mock_http_client = AsyncMock()
    mock_response = AsyncMock()
    mock_response.content = b"fake image data"
    mock_response.raise_for_status = MagicMock()
    mock_http_client.get.return_value = mock_response
    mock_http_client.__aenter__.return_value = mock_http_client
    mock_http_client.__aexit__.return_value = None

    return mock_ocr, mock_storage, mock_http_client


def _build_mock_db(mock_media):
    """Build a mocked AsyncSession for the verify endpoint."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_media
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    return mock_db


async def test_verify_proof_of_residence_syncs_supabase_metadata():
    """After successful verification, Supabase admin.update_user_by_id is called.

    Verifies:
    - update_user_by_id is called exactly once with the user's UUID string
    - The payload contains user_metadata.residence_verified = True
    - The payload contains user_metadata.residence_verified_at (any non-null value)
    - The function returns a result with status 'verified'
    """
    from src.schemas.user import UserVerificationRequest

    verify_fn = _get_endpoint_fn()
    mock_user = _make_mock_user()
    file_id = str(uuid4())
    mock_media = _make_mock_media(file_id, mock_user.tenant_id)
    mock_ocr, mock_storage, mock_http_client = _build_verified_mocks()
    mock_db = _build_mock_db(mock_media)

    # Mock Supabase admin client
    mock_supabase_admin = MagicMock()
    mock_supabase_admin.auth.admin.update_user_by_id = MagicMock()

    verification_request = UserVerificationRequest(document_file_id=file_id)

    with patch('src.api.v1.verification.get_supabase_admin', return_value=mock_supabase_admin), \
         patch('src.api.v1.verification.StorageService', return_value=mock_storage), \
         patch('src.api.v1.verification.httpx.AsyncClient', return_value=mock_http_client), \
         patch('src.api.v1.verification.OCRService', return_value=mock_ocr), \
         patch('src.api.v1.verification.validate_image_quality', return_value={"valid": True}), \
         patch('src.api.v1.verification.strip_exif_metadata', return_value=b"stripped"):

        result = await verify_fn(
            request=MagicMock(),
            verification_request=verification_request,
            current_user=mock_user,
            db=mock_db
        )

    # Function must return verified status
    assert result.status == "verified"

    # update_user_by_id must be called exactly once
    mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once()
    call_args = mock_supabase_admin.auth.admin.update_user_by_id.call_args

    # First positional arg must be the user's UUID as string
    called_user_id = call_args[0][0]
    assert called_user_id == str(mock_user.id)

    # Second positional arg must contain residence_verified: True
    called_payload = call_args[0][1]
    assert called_payload["user_metadata"]["residence_verified"] is True
    assert "residence_verified_at" in called_payload["user_metadata"]


async def test_verify_proof_of_residence_supabase_failure_still_succeeds():
    """Supabase update_user_by_id failure must not break the endpoint.

    Even if the Supabase sync raises an exception, the endpoint must:
    - Return a result with status 'verified' (DB is already committed)
    - Not propagate the exception to the caller
    - Attempt the Supabase call (not silently skip it)
    """
    from src.schemas.user import UserVerificationRequest

    verify_fn = _get_endpoint_fn()
    mock_user = _make_mock_user()
    file_id = str(uuid4())
    mock_media = _make_mock_media(file_id, mock_user.tenant_id)
    mock_ocr, mock_storage, mock_http_client = _build_verified_mocks()
    mock_db = _build_mock_db(mock_media)

    # Mock Supabase admin client that raises on update
    mock_supabase_admin = MagicMock()
    mock_supabase_admin.auth.admin.update_user_by_id = MagicMock(
        side_effect=Exception("Supabase service unavailable")
    )

    verification_request = UserVerificationRequest(document_file_id=file_id)

    with patch('src.api.v1.verification.get_supabase_admin', return_value=mock_supabase_admin), \
         patch('src.api.v1.verification.StorageService', return_value=mock_storage), \
         patch('src.api.v1.verification.httpx.AsyncClient', return_value=mock_http_client), \
         patch('src.api.v1.verification.OCRService', return_value=mock_ocr), \
         patch('src.api.v1.verification.validate_image_quality', return_value={"valid": True}), \
         patch('src.api.v1.verification.strip_exif_metadata', return_value=b"stripped"):

        # Must NOT raise even though Supabase update raises
        result = await verify_fn(
            request=MagicMock(),
            verification_request=verification_request,
            current_user=mock_user,
            db=mock_db
        )

    # DB was committed — verification still succeeds
    assert result.status == "verified"
    # Supabase was attempted (not silently skipped)
    mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once()


async def test_verify_proof_of_residence_no_supabase_client_logs_warning(caplog):
    """When Supabase admin client is not configured, a warning is logged.

    The endpoint must:
    - Return a result with status 'verified'
    - Log a warning about the missing Supabase client
    - Not raise any exception
    """
    from src.schemas.user import UserVerificationRequest

    verify_fn = _get_endpoint_fn()
    mock_user = _make_mock_user()
    file_id = str(uuid4())
    mock_media = _make_mock_media(file_id, mock_user.tenant_id)
    mock_ocr, mock_storage, mock_http_client = _build_verified_mocks()
    mock_db = _build_mock_db(mock_media)

    verification_request = UserVerificationRequest(document_file_id=file_id)

    with caplog.at_level(logging.WARNING, logger="src.api.v1.verification"), \
         patch('src.api.v1.verification.get_supabase_admin', return_value=None), \
         patch('src.api.v1.verification.StorageService', return_value=mock_storage), \
         patch('src.api.v1.verification.httpx.AsyncClient', return_value=mock_http_client), \
         patch('src.api.v1.verification.OCRService', return_value=mock_ocr), \
         patch('src.api.v1.verification.validate_image_quality', return_value={"valid": True}), \
         patch('src.api.v1.verification.strip_exif_metadata', return_value=b"stripped"):

        result = await verify_fn(
            request=MagicMock(),
            verification_request=verification_request,
            current_user=mock_user,
            db=mock_db
        )

    # Function still succeeds
    assert result.status == "verified"

    # A warning must have been logged about missing Supabase client
    warning_logs = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warning_logs) >= 1
    assert "Supabase admin client not configured" in warning_logs[0].message
