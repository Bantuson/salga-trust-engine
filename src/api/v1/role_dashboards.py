"""Role-specific dashboard API endpoints for Phase 31.

Provides 13 endpoints under /api/v1/role-dashboards/ for all senior municipal
roles. Each endpoint enforces strict RBAC via require_role() dependency.

Endpoint summary:
  GET  /cfo                         — CFO (DASH-01)
  GET  /municipal-manager           — Municipal Manager (DASH-02)
  GET  /mayor                       — Executive Mayor (DASH-03)
  POST /mayor/approve-sdbip         — SDBIP approval action (DASH-10)
  GET  /councillor                  — Councillor (DASH-04)
  GET  /audit-committee             — Audit Committee (DASH-05)
  GET  /internal-auditor            — Internal Auditor (DASH-06)
  POST /internal-auditor/verify-evidence — POE verify action (DASH-11)
  GET  /mpac                        — MPAC (DASH-07)
  POST /mpac/flag-investigation      — Investigation flag action (DASH-12)
  GET  /salga-admin                 — SALGA Admin cross-municipality (DASH-08)
  GET  /salga-admin/export-csv      — CSV export of benchmarking data
  GET  /section56-director          — Section 56 Director (DASH-09)

Security: Every endpoint uses require_role() — unauthorized roles receive 403.
Multi-tenancy: tenant_id extracted from current_user.tenant_id (set by JWT).
"""
import csv
import io
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_role
from src.models.user import User, UserRole
from src.services.role_dashboard_service import RoleDashboardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/role-dashboards", tags=["role-dashboards"])

_service = RoleDashboardService()


# ---------------------------------------------------------------------------
# Request body schemas
# ---------------------------------------------------------------------------


class ApproveSDBIPRequest(BaseModel):
    """Request body for POST /mayor/approve-sdbip."""

    scorecard_id: UUID
    comment: str | None = None


class VerifyEvidenceRequest(BaseModel):
    """Request body for POST /internal-auditor/verify-evidence."""

    evidence_id: UUID
    status: str  # 'verified' or 'insufficient'


_VALID_INVESTIGATION_REASONS = (
    "performance_concern",
    "policy_violation",
    "procurement_irregularity",
    "other",
)


class FlagInvestigationRequest(BaseModel):
    """Request body for POST /mpac/flag-investigation."""

    report_id: UUID
    reason: str  # One of _VALID_INVESTIGATION_REASONS
    notes: str


# ---------------------------------------------------------------------------
# DASH-01: CFO Dashboard
# ---------------------------------------------------------------------------


@router.get("/cfo")
async def get_cfo_dashboard(
    current_user: User = Depends(
        require_role(UserRole.CFO, UserRole.ADMIN, UserRole.SALGA_ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
):
    """CFO dashboard: budget execution, SDBIP summary, service delivery correlation,
    statutory deadlines.

    Allowed roles: CFO, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_cfo_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-02: Municipal Manager Dashboard
# ---------------------------------------------------------------------------


@router.get("/municipal-manager")
async def get_mm_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.MUNICIPAL_MANAGER, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Municipal Manager dashboard: per-department KPI overview.

    Allowed roles: MUNICIPAL_MANAGER, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_mm_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-03: Executive Mayor Dashboard
# ---------------------------------------------------------------------------


@router.get("/mayor")
async def get_mayor_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.EXECUTIVE_MAYOR, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Executive Mayor dashboard: organisational scorecard + SDBIP scorecard list.

    Allowed roles: EXECUTIVE_MAYOR, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_mayor_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-10: SDBIP Approval action
# ---------------------------------------------------------------------------


@router.post("/mayor/approve-sdbip")
async def approve_sdbip(
    body: ApproveSDBIPRequest,
    current_user: User = Depends(
        require_role(
            UserRole.EXECUTIVE_MAYOR, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Approve an SDBIP scorecard (Executive Mayor sign-off).

    Transitions the scorecard via SDBIPWorkflow.send('submit').
    Creates an audit_log entry with action='sdbip_approved'.

    Allowed roles: EXECUTIVE_MAYOR, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles. Returns 409 if transition is invalid.
    """
    return await _service.approve_sdbip(
        scorecard_id=body.scorecard_id,
        current_user=current_user,
        db=db,
        comment=body.comment,
    )


# ---------------------------------------------------------------------------
# DASH-04: Councillor Dashboard
# ---------------------------------------------------------------------------


@router.get("/councillor")
async def get_councillor_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.WARD_COUNCILLOR,
            UserRole.CHIEF_WHIP,
            UserRole.ADMIN,
            UserRole.SALGA_ADMIN,
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Councillor dashboard: read-only SDBIP KPI summary + statutory reports.

    Allowed roles: WARD_COUNCILLOR, CHIEF_WHIP, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_councillor_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-05: Audit Committee Dashboard
# ---------------------------------------------------------------------------


@router.get("/audit-committee")
async def get_audit_committee_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.AUDIT_COMMITTEE_MEMBER, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Audit Committee dashboard: all performance reports + PMS audit trail.

    Returns last 100 AuditLog entries for PMS tables.

    Allowed roles: AUDIT_COMMITTEE_MEMBER, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_audit_committee_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-06: Internal Auditor Dashboard
# ---------------------------------------------------------------------------


@router.get("/internal-auditor")
async def get_internal_auditor_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.INTERNAL_AUDITOR, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Internal Auditor dashboard: unverified POE workqueue grouped by KPI.

    Allowed roles: INTERNAL_AUDITOR, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_internal_auditor_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-11: POE Verify action
# ---------------------------------------------------------------------------


@router.post("/internal-auditor/verify-evidence")
async def verify_evidence(
    body: VerifyEvidenceRequest,
    current_user: User = Depends(
        require_role(
            UserRole.INTERNAL_AUDITOR, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Verify or reject a Portfolio of Evidence document.

    Updates EvidenceDocument.verification_status to 'verified' or 'insufficient'.
    Creates an AuditLog entry for the action.

    Allowed roles: INTERNAL_AUDITOR, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles. Returns 422 if status value is invalid.
    """
    return await _service.verify_evidence(
        evidence_id=body.evidence_id,
        status=body.status,
        current_user=current_user,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-07: MPAC Dashboard
# ---------------------------------------------------------------------------


@router.get("/mpac")
async def get_mpac_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.MPAC_MEMBER, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """MPAC dashboard: statutory reports + investigation flags.

    Investigation flags are append-only AuditLog entries with
    table_name='investigation_flags'. Current status = latest entry per record.

    Allowed roles: MPAC_MEMBER, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_mpac_dashboard(
        tenant_id=current_user.tenant_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-12: Flag investigation action
# ---------------------------------------------------------------------------


@router.post("/mpac/flag-investigation")
async def flag_investigation(
    body: FlagInvestigationRequest,
    current_user: User = Depends(
        require_role(
            UserRole.MPAC_MEMBER, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Flag a statutory report for investigation.

    Creates an AuditLog entry with table_name='investigation_flags'.
    reason must be one of: performance_concern, policy_violation,
    procurement_irregularity, other.

    Allowed roles: MPAC_MEMBER, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles. Returns 422 if reason is invalid.
    """
    if body.reason not in _VALID_INVESTIGATION_REASONS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid investigation reason '{body.reason}'. "
                f"Must be one of: {', '.join(_VALID_INVESTIGATION_REASONS)}"
            ),
        )
    return await _service.flag_investigation(
        report_id=body.report_id,
        reason=body.reason,
        notes=body.notes,
        current_user=current_user,
        db=db,
    )


# ---------------------------------------------------------------------------
# DASH-08: SALGA Admin Dashboard (cross-municipality benchmarking)
# ---------------------------------------------------------------------------


@router.get("/salga-admin")
async def get_salga_admin_dashboard(
    current_user: User = Depends(
        require_role(UserRole.SALGA_ADMIN, UserRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
):
    """SALGA Admin cross-municipality benchmarking dashboard.

    Performs cross-tenant queries using raw SQL text() to bypass ORM tenant filter.
    Returns all municipalities ranked by KPI achievement percentage.
    SEC-05: ticket resolution rate queries exclude is_sensitive=True.

    Allowed roles: SALGA_ADMIN, ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_salga_admin_dashboard(db=db)


@router.get("/salga-admin/export-csv")
async def export_salga_admin_csv(
    current_user: User = Depends(
        require_role(UserRole.SALGA_ADMIN, UserRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Export SALGA Admin benchmarking data as CSV.

    Reuses get_salga_admin_dashboard data and formats as CSV stream.
    Content-Disposition: attachment; filename=salga-benchmarking.csv

    Allowed roles: SALGA_ADMIN, ADMIN.
    Returns 403 for all other roles.
    """
    data = await _service.get_salga_admin_dashboard(db=db)
    municipalities = data.get("municipalities", [])

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "tenant_id",
            "municipality_name",
            "category",
            "province",
            "overall_achievement_pct",
            "ticket_resolution_rate",
            "sla_compliance_pct",
        ],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(municipalities)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=salga-benchmarking.csv"
        },
    )


# ---------------------------------------------------------------------------
# DASH-09: Section 56 Director Dashboard
# ---------------------------------------------------------------------------


@router.get("/section56-director")
async def get_section56_director_dashboard(
    current_user: User = Depends(
        require_role(
            UserRole.SECTION56_DIRECTOR, UserRole.ADMIN, UserRole.SALGA_ADMIN
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Section 56 Director dashboard: department-scoped KPIs.

    Resolves the director's department via Department.assigned_director_id.
    Returns empty_state=True if no department is assigned.

    Allowed roles: SECTION56_DIRECTOR, ADMIN, SALGA_ADMIN.
    Returns 403 for all other roles.
    """
    return await _service.get_section56_director_dashboard(
        current_user=current_user,
        db=db,
    )
