"""Statutory Reports API routes.

Provides REST endpoints for the full statutory report lifecycle:
- Create Section 52/72/46/121 reports
- List and retrieve reports
- Transition reports through the 5-stage approval chain
- Trigger PDF/DOCX generation via Celery
- Download generated files
- View data snapshots (for audit/debugging)

All endpoints require:
- require_pms_ready(): Municipality must have PMS settings configured
- require_min_tier(2): Tier 2 Directors and above (Section 56 Directors, CFO, MM, admin)

Exceptions:
- POST /{id}/transitions: Role check is inside service (not a separate tier dependency)
- POST /{id}/generate: Tier 2 is sufficient to trigger generation
- GET /{id}/download/{format}: Tier 2 is sufficient to download

Endpoint prefix: /api/v1/statutory-reports
"""
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_min_tier
from src.models.user import User
from src.schemas.statutory_report import (
    ReportSnapshotResponse,
    ReportTransitionRequest,
    StatutoryReportCreate,
    StatutoryReportResponse,
)
from src.services.pms_readiness import require_pms_ready
from src.services.statutory_report_service import StatutoryReportService

router = APIRouter(
    prefix="/api/v1/statutory-reports",
    tags=["Statutory Reports"],
)

_service = StatutoryReportService()


def _pms_deps() -> list:
    """Shared dependency list: PMS readiness gate + Tier 2+ check."""
    return [Depends(require_pms_ready()), Depends(require_min_tier(2))]


# ---------------------------------------------------------------------------
# Report CRUD
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=StatutoryReportResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pms_deps(),
    summary="Create a statutory report (REPORT-01, REPORT-02)",
)
async def create_report(
    payload: StatutoryReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatutoryReportResponse:
    """Create a new statutory report in DRAFTING status.

    Supported report types:
    - section_52: Quarterly performance report (requires quarter: Q1-Q4)
    - section_72: Mid-year budget and performance assessment
    - section_46: Annual performance report
    - section_121: Annual financial statements

    financial_year format: YYYY/YY (e.g., "2025/26")

    Returns 409 if a report with the same type, financial year, and quarter already exists.
    Returns 422 if quarter is missing for section_52.
    """
    report = await _service.create_report(payload, current_user, db)
    return StatutoryReportResponse.model_validate(report)


@router.get(
    "/",
    response_model=list[StatutoryReportResponse],
    dependencies=_pms_deps(),
    summary="List statutory reports",
)
async def list_reports(
    financial_year: str | None = Query(
        default=None,
        description="Filter by financial year (YYYY/YY format, e.g., '2025/26')",
    ),
    report_type: str | None = Query(
        default=None,
        description="Filter by report type (section_52, section_72, section_46, section_121)",
    ),
    db: AsyncSession = Depends(get_db),
) -> list[StatutoryReportResponse]:
    """Return all statutory reports for the authenticated municipality.

    Optional filters: financial_year and/or report_type.
    Results are ordered by creation date (newest first).
    """
    reports = await _service.list_reports(financial_year, report_type, db)
    return [StatutoryReportResponse.model_validate(r) for r in reports]


@router.get(
    "/{report_id}",
    response_model=StatutoryReportResponse,
    dependencies=_pms_deps(),
    summary="Get a single statutory report",
)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> StatutoryReportResponse:
    """Return a single statutory report by ID (404 if not found)."""
    report = await _service.get_report(report_id, db)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Statutory report {report_id} not found",
        )
    return StatutoryReportResponse.model_validate(report)


# ---------------------------------------------------------------------------
# State machine transitions (REPORT-05)
# ---------------------------------------------------------------------------


@router.post(
    "/{report_id}/transitions",
    response_model=StatutoryReportResponse,
    status_code=status.HTTP_200_OK,
    dependencies=_pms_deps(),
    summary="Transition report status (REPORT-05)",
)
async def transition_report(
    report_id: UUID,
    payload: ReportTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatutoryReportResponse:
    """Apply a state machine transition to a statutory report.

    Valid events:
    - "submit_for_review": drafting -> internal_review
      (PMS officer, department_manager, CFO, admin, salga_admin)
    - "approve":           internal_review -> mm_approved  (triggers REPORT-06 snapshot)
      (municipal_manager, CFO, admin, salga_admin)
    - "submit_external":   mm_approved -> submitted
      (municipal_manager, admin, salga_admin)
    - "table":             submitted -> tabled
      (municipal_manager, speaker, admin, salga_admin)

    Returns 403 if the user's role is not permitted for the transition.
    Returns 409 if the transition is not allowed in the current state.
    Returns 404 if the report is not found.
    """
    report = await _service.transition_report(report_id, payload.event, current_user, db)
    return StatutoryReportResponse.model_validate(report)


# ---------------------------------------------------------------------------
# Report generation (PDF/DOCX via Celery)
# ---------------------------------------------------------------------------


@router.post(
    "/{report_id}/generate",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=_pms_deps(),
    summary="Queue PDF/DOCX report generation (REPORT-08)",
)
async def generate_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Queue a Celery task to generate PDF and DOCX files for the report.

    The task:
    1. Assembles template context (from snapshot if mm_approved+, or live data)
    2. Renders Jinja2 HTML template
    3. Generates PDF via WeasyPrint
    4. Generates DOCX via docxtpl (if template available)
    5. Updates report.pdf_storage_path and report.docx_storage_path

    Returns 202 Accepted with task_id for polling.
    Returns 404 if the report does not exist.
    """
    report = await _service.get_report(report_id, db)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Statutory report {report_id} not found",
        )

    # Dispatch Celery task
    from src.tasks.report_generation_task import generate_statutory_report

    task = generate_statutory_report.delay(str(report_id), str(current_user.id))

    return {
        "task_id": task.id,
        "message": "Report generation queued",
        "report_id": str(report_id),
    }


# ---------------------------------------------------------------------------
# Snapshot (REPORT-06)
# ---------------------------------------------------------------------------


@router.get(
    "/{report_id}/snapshot",
    response_model=ReportSnapshotResponse,
    dependencies=_pms_deps(),
    summary="Get data snapshot for a report (REPORT-06)",
)
async def get_snapshot(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ReportSnapshotResponse:
    """Return the most recent data snapshot for a statutory report.

    Snapshots are created when the report transitions to mm_approved.
    Returns 404 if no snapshot exists (report not yet approved).

    Note: snapshot_data (raw JSON) is excluded from this response.
    Use a direct database query or export endpoint for raw snapshot data.
    """
    snapshot = await _service.get_report_snapshot(report_id, db)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No snapshot found for report {report_id}. Report may not yet be approved.",
        )
    return ReportSnapshotResponse.model_validate(snapshot)


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------


@router.get(
    "/{report_id}/download/{file_format}",
    dependencies=_pms_deps(),
    summary="Download generated PDF or DOCX file (REPORT-08)",
)
async def download_report(
    report_id: UUID,
    file_format: str,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Download the generated PDF or DOCX file for a report.

    file_format must be "pdf" or "docx".

    Returns 404 if:
    - The report does not exist
    - The file has not yet been generated (run /generate first)

    Returns 422 if file_format is not "pdf" or "docx".
    """
    if file_format not in ("pdf", "docx"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="file_format must be 'pdf' or 'docx'",
        )

    report = await _service.get_report(report_id, db)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Statutory report {report_id} not found",
        )

    storage_path = (
        report.pdf_storage_path if file_format == "pdf" else report.docx_storage_path
    )

    if storage_path is None or not Path(storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"{file_format.upper()} file not yet generated for report {report_id}. "
                "Call POST /{report_id}/generate first."
            ),
        )

    media_type = (
        "application/pdf" if file_format == "pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    filename = f"{report.report_type}_{report.financial_year.replace('/', '-')}_{report_id}.{file_format}"

    return FileResponse(
        path=storage_path,
        media_type=media_type,
        filename=filename,
    )
