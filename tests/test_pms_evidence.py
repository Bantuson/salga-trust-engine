"""Unit tests for SDBIP portfolio of evidence (POE) upload and ClamAV scanning.

Tests cover:
1. test_evidence_upload          — upload succeeds with clean scan status (ClamAV disabled/mocked)
2. test_virus_rejected           — mock ClamAV returning FOUND -> 422 response
3. test_list_evidence_for_actual — returns all uploaded evidence documents
4. test_evidence_scan_fail_dev   — scan failure in dev mode -> warn but allow upload

All tests mock ClamAV. No real ClamAV daemon required for unit tests.
Tests use SQLite in-memory via the db_session fixture from conftest.py.
Tenant isolation enforced via set_tenant_context()/clear_tenant_context().
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.sdbip import (
    Quarter,
    SDBIPLayer,
)
from src.models.user import User, UserRole
from src.schemas.sdbip import (
    QuarterlyTargetBulkCreate,
    QuarterlyTargetCreate,
    SDBIPActualCreate,
    SDBIPKpiCreate,
    SDBIPScorecardCreate,
)
from src.services.evidence_service import EvidenceService
from src.services.sdbip_service import SDBIPService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_pms_officer(tenant_id: str | None = None) -> MagicMock:
    """Create a mock PMS officer user for evidence upload."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "pms@test.gov.za"
    user.full_name = "PMS Officer"
    user.role = UserRole.PMS_OFFICER
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


async def _create_actual(
    db: AsyncSession,
    tenant_id: str,
    user: MagicMock,
) -> "SDBIPActual":  # noqa: F821
    """Helper: create a KPI with targets and submit a Q1 actual. Returns the actual."""
    sdbip_service = SDBIPService()

    scorecard = await sdbip_service.create_scorecard(
        SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
        user, db,
    )
    kpi = await sdbip_service.create_kpi(
        scorecard.id,
        SDBIPKpiCreate(
            kpi_number="KPI-001",
            description="Evidence test KPI",
            unit_of_measurement="percentage",
            baseline=Decimal("70.00"),
            annual_target=Decimal("100.00"),
            weight=Decimal("20.00"),
        ),
        user, db,
    )
    await sdbip_service.set_quarterly_targets(
        kpi.id,
        QuarterlyTargetBulkCreate(
            targets=[
                QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=Decimal("100")),
                QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=Decimal("100")),
                QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=Decimal("100")),
                QuarterlyTargetCreate(quarter=Quarter.Q4, target_value=Decimal("100")),
            ]
        ),
        user, db,
    )
    actual = await sdbip_service.submit_actual(
        SDBIPActualCreate(
            kpi_id=kpi.id,
            quarter=Quarter.Q1,
            financial_year="2025/26",
            actual_value=Decimal("85"),
        ),
        user, db,
    )
    return actual


# ---------------------------------------------------------------------------
# Test 1: Evidence upload succeeds with clean scan status (ClamAV disabled)
# ---------------------------------------------------------------------------


class TestEvidenceUpload:
    """Tests for EvidenceService.scan_and_upload() with ClamAV disabled."""

    async def test_evidence_upload(self, db_session: AsyncSession):
        """Upload with CLAMAV_ENABLED=False succeeds; scan_status='clean'."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        # Patch CLAMAV_ENABLED=False (default behaviour)
        original = settings.CLAMAV_ENABLED
        settings.CLAMAV_ENABLED = False

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            doc = await service.scan_and_upload(
                file_content=b"This is a test PDF file content",
                filename="Q1_report.pdf",
                content_type="application/pdf",
                actual_id=actual.id,
                user=user,
                db=db_session,
            )
        finally:
            settings.CLAMAV_ENABLED = original
            clear_tenant_context()

        assert doc.id is not None
        assert doc.actual_id == actual.id
        assert doc.original_filename == "Q1_report.pdf"
        assert doc.content_type == "application/pdf"
        assert doc.file_size == len(b"This is a test PDF file content")
        assert doc.scan_status == "clean"
        assert doc.uploaded_by == str(user.id)
        assert "actuals/" in doc.storage_path
        assert "Q1_report.pdf" in doc.filename

    async def test_evidence_upload_clamav_enabled_clean(self, db_session: AsyncSession):
        """Upload with ClamAV enabled and returning clean result — scan_status='clean'."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        # Mock pyclamd to return None (clean — no virus found)
        mock_cd = MagicMock()
        mock_cd.scan_stream.return_value = None  # None = clean

        original = settings.CLAMAV_ENABLED
        settings.CLAMAV_ENABLED = True

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            with patch("src.services.evidence_service.pyclamd") as mock_pyclamd:
                mock_pyclamd.ClamdNetworkSocket.return_value = mock_cd

                doc = await service.scan_and_upload(
                    file_content=b"Clean file content",
                    filename="clean_report.pdf",
                    content_type="application/pdf",
                    actual_id=actual.id,
                    user=user,
                    db=db_session,
                )
        finally:
            settings.CLAMAV_ENABLED = original
            clear_tenant_context()

        assert doc.scan_status == "clean"
        assert doc.original_filename == "clean_report.pdf"


# ---------------------------------------------------------------------------
# Test 2: Virus detected -> 422
# ---------------------------------------------------------------------------


class TestVirusRejected:
    """Tests for EvidenceService virus detection via mocked ClamAV."""

    async def test_virus_rejected(self, db_session: AsyncSession):
        """ClamAV returning FOUND raises HTTPException 422 with virus name."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        # Mock ClamAV to return virus found result
        mock_cd = MagicMock()
        mock_cd.scan_stream.return_value = {"stream": ("FOUND", "Win.Test.EICAR_HDB-1")}

        original = settings.CLAMAV_ENABLED
        original_env = settings.ENVIRONMENT
        settings.CLAMAV_ENABLED = True
        settings.ENVIRONMENT = "development"

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            with patch("src.services.evidence_service.pyclamd") as mock_pyclamd:
                mock_pyclamd.ClamdNetworkSocket.return_value = mock_cd

                with pytest.raises(HTTPException) as exc_info:
                    await service.scan_and_upload(
                        file_content=b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
                        filename="malware.exe",
                        content_type="application/octet-stream",
                        actual_id=actual.id,
                        user=user,
                        db=db_session,
                    )
        finally:
            settings.CLAMAV_ENABLED = original
            settings.ENVIRONMENT = original_env
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "virus" in exc_info.value.detail.lower() or "rejected" in exc_info.value.detail.lower()

    async def test_virus_rejected_production(self, db_session: AsyncSession):
        """ClamAV returning FOUND in production also raises 422 (same behavior)."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        mock_cd = MagicMock()
        mock_cd.scan_stream.return_value = {"stream": ("FOUND", "Trojan.Generic")}

        original = settings.CLAMAV_ENABLED
        original_env = settings.ENVIRONMENT
        settings.CLAMAV_ENABLED = True
        settings.ENVIRONMENT = "production"

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            with patch("src.services.evidence_service.pyclamd") as mock_pyclamd:
                mock_pyclamd.ClamdNetworkSocket.return_value = mock_cd

                with pytest.raises(HTTPException) as exc_info:
                    await service.scan_and_upload(
                        file_content=b"infected content",
                        filename="evil.pdf",
                        content_type="application/pdf",
                        actual_id=actual.id,
                        user=user,
                        db=db_session,
                    )
        finally:
            settings.CLAMAV_ENABLED = original
            settings.ENVIRONMENT = original_env
            clear_tenant_context()

        assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# Test 3: List evidence for an actual
# ---------------------------------------------------------------------------


class TestListEvidenceForActual:
    """Tests for EvidenceService.list_evidence()."""

    async def test_list_evidence_for_actual(self, db_session: AsyncSession):
        """list_evidence returns all documents uploaded for an actual."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        original = settings.CLAMAV_ENABLED
        settings.CLAMAV_ENABLED = False

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            # Upload 3 documents
            await service.scan_and_upload(
                file_content=b"Document 1 content",
                filename="doc1.pdf",
                content_type="application/pdf",
                actual_id=actual.id,
                user=user,
                db=db_session,
            )
            await service.scan_and_upload(
                file_content=b"Document 2 content - spreadsheet",
                filename="doc2.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                actual_id=actual.id,
                user=user,
                db=db_session,
            )
            await service.scan_and_upload(
                file_content=b"Document 3 content - image",
                filename="photo.jpg",
                content_type="image/jpeg",
                actual_id=actual.id,
                user=user,
                db=db_session,
            )

            docs = await service.list_evidence(actual.id, db_session)
        finally:
            settings.CLAMAV_ENABLED = original
            clear_tenant_context()

        assert len(docs) == 3
        filenames = {d.original_filename for d in docs}
        assert filenames == {"doc1.pdf", "doc2.xlsx", "photo.jpg"}
        # All should be clean (ClamAV disabled)
        assert all(d.scan_status == "clean" for d in docs)

    async def test_list_evidence_empty_for_new_actual(self, db_session: AsyncSession):
        """list_evidence returns empty list when no documents uploaded."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)
            docs = await service.list_evidence(actual.id, db_session)
        finally:
            clear_tenant_context()

        assert docs == []


# ---------------------------------------------------------------------------
# Test 4: ClamAV scan failure in dev -> warn and allow (fail-open)
# ---------------------------------------------------------------------------


class TestEvidenceScanFailDev:
    """Tests for ClamAV unavailability handling in dev vs production."""

    async def test_evidence_scan_fail_dev(self, db_session: AsyncSession):
        """ClamAV connection error in development: warn but allow upload (fail-open)."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        original = settings.CLAMAV_ENABLED
        original_env = settings.ENVIRONMENT
        settings.CLAMAV_ENABLED = True
        settings.ENVIRONMENT = "development"

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            # Mock ClamAV to raise ConnectionError (daemon not running)
            mock_cd = MagicMock()
            mock_cd.scan_stream.side_effect = Exception(
                "ClamAV daemon not running at localhost:3310"
            )

            with patch("src.services.evidence_service.pyclamd") as mock_pyclamd:
                mock_pyclamd.ClamdNetworkSocket.return_value = mock_cd

                # In dev, should NOT raise — fail-open: allows upload
                doc = await service.scan_and_upload(
                    file_content=b"Test file content for scan failure test",
                    filename="test_doc.pdf",
                    content_type="application/pdf",
                    actual_id=actual.id,
                    user=user,
                    db=db_session,
                )
        finally:
            settings.CLAMAV_ENABLED = original
            settings.ENVIRONMENT = original_env
            clear_tenant_context()

        # Document should be created with scan_failed status (not rejected)
        assert doc.id is not None
        assert doc.scan_status == "scan_failed"
        assert doc.original_filename == "test_doc.pdf"

    async def test_evidence_scan_fail_production(self, db_session: AsyncSession):
        """ClamAV connection error in production: fail-closed (raises 422)."""
        service = EvidenceService()
        tenant_id = str(uuid4())
        user = make_mock_pms_officer(tenant_id=tenant_id)

        original = settings.CLAMAV_ENABLED
        original_env = settings.ENVIRONMENT
        settings.CLAMAV_ENABLED = True
        settings.ENVIRONMENT = "production"

        set_tenant_context(tenant_id)
        try:
            actual = await _create_actual(db_session, tenant_id, user)

            mock_cd = MagicMock()
            mock_cd.scan_stream.side_effect = Exception("ClamAV daemon not available")

            with patch("src.services.evidence_service.pyclamd") as mock_pyclamd:
                mock_pyclamd.ClamdNetworkSocket.return_value = mock_cd

                with pytest.raises(HTTPException) as exc_info:
                    await service.scan_and_upload(
                        file_content=b"File content in production",
                        filename="prod_doc.pdf",
                        content_type="application/pdf",
                        actual_id=actual.id,
                        user=user,
                        db=db_session,
                    )
        finally:
            settings.CLAMAV_ENABLED = original
            settings.ENVIRONMENT = original_env
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "production" in exc_info.value.detail.lower() or "scan" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Importability check
# ---------------------------------------------------------------------------


def test_evidence_imports():
    """EvidenceDocument model, EvidenceService, and schemas import cleanly."""
    from src.models.evidence import EvidenceDocument
    from src.schemas.evidence import (
        EvidenceDownloadResponse,
        EvidenceListResponse,
        EvidenceUploadResponse,
    )
    from src.services.evidence_service import EvidenceService

    assert EvidenceDocument is not None
    assert EvidenceService is not None
    assert EvidenceUploadResponse is not None
    assert EvidenceListResponse is not None
    assert EvidenceDownloadResponse is not None
    assert EvidenceDocument.__tablename__ == "evidence_documents"
