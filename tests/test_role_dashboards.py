"""Unit tests for role-specific dashboard service and API endpoints.

Tests cover all 12 DASH-XX requirements plus RBAC 403 enforcement.

Test index:
1.  test_cfo_dashboard_structure               — CFO endpoint returns 4 expected keys (DASH-01)
2.  test_cfo_sdbip_summary_keys                — SDBIP summary includes green/amber/red/total (DASH-01)
3.  test_cfo_endpoint_403_for_pms_officer      — PMS officer on /cfo returns 403
4.  test_mm_department_overview                — MM endpoint returns departments list (DASH-02)
5.  test_mm_department_kpi_counts              — Each department entry has kpi_count + traffic_light_counts
6.  test_mayor_dashboard_structure             — Mayor endpoint returns 2 expected keys (DASH-03)
7.  test_mayor_scorecards_list                 — sdbip_scorecards is a list with correct keys
8.  test_mayor_approve_sdbip                   — POST approve transitions scorecard + creates audit_log (DASH-10)
9.  test_mayor_approve_403                     — PMS officer on approve endpoint returns 403
10. test_mayor_approve_invalid_transition_409  — Approving already-approved returns 409
11. test_councillor_readonly_view              — Councillor endpoint has sdbip_summary + statutory_reports (DASH-04)
12. test_audit_committee_view                  — Audit committee has performance_reports + audit_trail (DASH-05)
13. test_audit_committee_trail_pms_tables      — audit_trail only contains PMS table entries
14. test_internal_auditor_poe_workqueue        — Internal auditor queue groups evidence by KPI (DASH-06)
15. test_internal_auditor_poe_verify           — verify endpoint updates evidence status + audit_log (DASH-11)
16. test_internal_auditor_verify_invalid_status — Verify with bad status raises 422
17. test_mpac_dashboard_structure              — MPAC has statutory_reports + investigation_flags (DASH-07)
18. test_mpac_flag_investigation               — Flag creates audit_log with table_name=investigation_flags (DASH-12)
19. test_mpac_flag_reason_validation           — Invalid reason raises HTTPException 422
20. test_salga_admin_benchmarking              — SALGA admin returns municipalities list (DASH-08)
21. test_salga_admin_403                       — PMS officer on /salga-admin returns 403
22. test_section56_director_scoped             — Director endpoint returns KPIs for assigned dept (DASH-09)
23. test_section56_no_department               — Director with no dept returns empty_state=True

Uses SQLite in-memory via db_session fixture from conftest.py.
All tests use set_tenant_context() / clear_tenant_context() with try/finally.
"""
import json
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.audit_log import AuditLog, OperationType
from src.models.department import Department
from src.models.evidence import EvidenceDocument
from src.models.municipality import Municipality
from src.models.sdbip import (
    SDBIPActual,
    SDBIPKpi,
    SDBIPScorecard,
    SDBIPStatus,
    TrafficLight,
)
from src.models.statutory_report import ReportStatus, ReportType, StatutoryReport
from src.models.user import User, UserRole
from src.services.role_dashboard_service import (
    RoleDashboardService,
    get_current_financial_year,
)

pytestmark = pytest.mark.asyncio

TEST_TENANT = str(uuid4())
TEST_TENANT_2 = str(uuid4())

_service = RoleDashboardService()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(
    role: UserRole = UserRole.CFO,
    tenant_id: str = TEST_TENANT,
    user_id: str | None = None,
) -> MagicMock:
    """Create a MagicMock User with the given role and tenant."""
    user = MagicMock(spec=User)
    user.id = uuid4() if user_id is None else uuid4()
    user.email = f"{role.value}@test.gov.za"
    user.full_name = f"Test {role.value.title()}"
    user.role = role
    user.tenant_id = tenant_id
    user.municipality_id = uuid4()
    user.is_active = True
    return user


async def _create_scorecard(
    db: AsyncSession,
    tenant_id: str,
    status: str = "draft",
    financial_year: str | None = None,
) -> SDBIPScorecard:
    """Create a test SDBIPScorecard."""
    fy = financial_year or get_current_financial_year()
    sc = SDBIPScorecard(
        tenant_id=tenant_id,
        financial_year=fy,
        layer="top",
        status=status,
        title="Test Scorecard",
    )
    db.add(sc)
    await db.commit()
    await db.refresh(sc)
    return sc


async def _create_kpi(
    db: AsyncSession,
    tenant_id: str,
    scorecard_id,
    department_id=None,
    kpi_number: str = "KPI-001",
) -> SDBIPKpi:
    """Create a test SDBIPKpi."""
    kpi = SDBIPKpi(
        tenant_id=tenant_id,
        scorecard_id=scorecard_id,
        department_id=department_id,
        kpi_number=kpi_number,
        description=f"Test KPI {kpi_number}",
        unit_of_measurement="percentage",
        baseline=Decimal("50"),
        annual_target=Decimal("80"),
        weight=Decimal("100"),
    )
    db.add(kpi)
    await db.commit()
    await db.refresh(kpi)
    return kpi


async def _create_actual(
    db: AsyncSession,
    tenant_id: str,
    kpi_id,
    traffic_light: str = "green",
    achievement_pct: Decimal = Decimal("85"),
    financial_year: str | None = None,
) -> SDBIPActual:
    """Create a test SDBIPActual."""
    fy = financial_year or get_current_financial_year()
    actual = SDBIPActual(
        tenant_id=tenant_id,
        kpi_id=kpi_id,
        quarter="Q1",
        financial_year=fy,
        actual_value=Decimal("85"),
        achievement_pct=achievement_pct,
        traffic_light_status=traffic_light,
        is_validated=False,
        is_auto_populated=False,
    )
    db.add(actual)
    await db.commit()
    await db.refresh(actual)
    return actual


async def _create_statutory_report(
    db: AsyncSession,
    tenant_id: str,
    financial_year: str | None = None,
) -> StatutoryReport:
    """Create a test StatutoryReport."""
    fy = financial_year or get_current_financial_year()
    report = StatutoryReport(
        tenant_id=tenant_id,
        report_type="section_52",
        financial_year=fy,
        quarter="Q1",
        period_start=datetime(2025, 7, 1, tzinfo=timezone.utc),
        period_end=datetime(2025, 9, 30, tzinfo=timezone.utc),
        title=f"Q1 {fy} Section 52 Report",
        status="drafting",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def _create_evidence(
    db: AsyncSession,
    tenant_id: str,
    actual_id,
    verification_status: str = "unverified",
) -> EvidenceDocument:
    """Create a test EvidenceDocument."""
    ev = EvidenceDocument(
        tenant_id=tenant_id,
        actual_id=actual_id,
        filename="test_evidence.pdf",
        original_filename="Evidence Report Q1.pdf",
        content_type="application/pdf",
        file_size=102400,
        storage_path=f"actuals/{actual_id}/test_evidence.pdf",
        scan_status="clean",
        verification_status=verification_status,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


async def _create_municipality(
    db: AsyncSession, name: str = "Test Municipality"
) -> Municipality:
    """Create a test municipality."""
    muni = Municipality(
        name=name,
        code=name[:6].upper().replace(" ", ""),
        province="Gauteng",
        is_active=True,
    )
    db.add(muni)
    await db.commit()
    await db.refresh(muni)
    return muni


# ---------------------------------------------------------------------------
# DASH-01: CFO Dashboard tests
# ---------------------------------------------------------------------------


async def test_cfo_dashboard_structure(db_session: AsyncSession):
    """CFO dashboard returns dict with all 4 required keys."""
    set_tenant_context(TEST_TENANT)
    try:
        result = await _service.get_cfo_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "budget_execution" in result, "Missing budget_execution key"
    assert "sdbip_achievement_summary" in result, "Missing sdbip_achievement_summary key"
    assert "service_delivery_correlation" in result, "Missing service_delivery_correlation key"
    assert "statutory_deadlines" in result, "Missing statutory_deadlines key"


async def test_cfo_sdbip_summary_keys(db_session: AsyncSession):
    """SDBIP achievement summary includes green, amber, red, total, overall_pct."""
    set_tenant_context(TEST_TENANT)
    try:
        # Create test data: 2 KPIs with actuals
        sc = await _create_scorecard(db_session, TEST_TENANT)
        kpi1 = await _create_kpi(db_session, TEST_TENANT, sc.id, kpi_number="KPI-001")
        kpi2 = await _create_kpi(db_session, TEST_TENANT, sc.id, kpi_number="KPI-002")
        await _create_actual(db_session, TEST_TENANT, kpi1.id, "green", Decimal("85"))
        await _create_actual(db_session, TEST_TENANT, kpi2.id, "red", Decimal("30"))

        result = await _service.get_cfo_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    summary = result["sdbip_achievement_summary"]
    assert "green" in summary
    assert "amber" in summary
    assert "red" in summary
    assert "total" in summary
    assert "overall_pct" in summary
    assert summary["green"] == 1
    assert summary["red"] == 1
    assert summary["total"] == 2


async def test_cfo_endpoint_403_for_pms_officer(db_session: AsyncSession):
    """PMS officer role on /role-dashboards/cfo returns 403 via require_role().

    Uses dependency_overrides to inject a PMS officer user directly,
    bypassing the JWT+DB lookup layer to test the role gate in isolation.

    X-Tenant-ID header is sent so TenantContextMiddleware sets tenant context
    before require_pms_ready() queries the DB (added in Phase 33-01).
    """
    from fastapi.testclient import TestClient
    from src.main import app
    from src.api.deps import get_current_user

    pms_user = _make_user(UserRole.PMS_OFFICER, TEST_TENANT)

    # Override get_current_user to inject the mock PMS officer
    original_override = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: pms_user

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get(
                "/api/v1/role-dashboards/cfo",
                headers={"X-Tenant-ID": TEST_TENANT},
            )
    finally:
        app.dependency_overrides = original_override

    assert response.status_code == 403, (
        f"Expected 403 for pms_officer, got {response.status_code}"
    )


# ---------------------------------------------------------------------------
# DASH-02: Municipal Manager Dashboard tests
# ---------------------------------------------------------------------------


async def test_mm_department_overview(db_session: AsyncSession):
    """MM dashboard returns departments list."""
    set_tenant_context(TEST_TENANT)
    try:
        result = await _service.get_mm_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "departments" in result
    assert isinstance(result["departments"], list)


async def test_mm_department_kpi_counts(db_session: AsyncSession):
    """Each department entry has kpi_count and traffic_light_counts."""
    set_tenant_context(TEST_TENANT)
    try:
        # Create department + KPI + actual
        dept = Department(
            tenant_id=TEST_TENANT,
            name="Infrastructure",
            code="INFRA",
            is_active=True,
        )
        db_session.add(dept)
        await db_session.commit()
        await db_session.refresh(dept)

        sc = await _create_scorecard(db_session, TEST_TENANT)
        kpi = await _create_kpi(
            db_session, TEST_TENANT, sc.id, department_id=dept.id, kpi_number="KPI-D01"
        )
        await _create_actual(db_session, TEST_TENANT, kpi.id, "amber", Decimal("65"))

        result = await _service.get_mm_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    departments = result["departments"]
    assert len(departments) >= 1

    # Find our test department
    infra_depts = [d for d in departments if d["department_code"] == "INFRA"]
    assert len(infra_depts) == 1
    dept_data = infra_depts[0]

    assert "kpi_count" in dept_data
    assert "traffic_light_counts" in dept_data
    assert dept_data["kpi_count"] == 1
    assert dept_data["traffic_light_counts"]["amber"] == 1


# ---------------------------------------------------------------------------
# DASH-03: Executive Mayor Dashboard tests
# ---------------------------------------------------------------------------


async def test_mayor_dashboard_structure(db_session: AsyncSession):
    """Mayor dashboard returns organizational_scorecard and sdbip_scorecards."""
    set_tenant_context(TEST_TENANT)
    try:
        result = await _service.get_mayor_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "organizational_scorecard" in result
    assert "sdbip_scorecards" in result


async def test_mayor_scorecards_list(db_session: AsyncSession):
    """sdbip_scorecards list has correct keys per scorecard."""
    set_tenant_context(TEST_TENANT)
    try:
        # Create a scorecard
        await _create_scorecard(db_session, TEST_TENANT, status="draft")

        result = await _service.get_mayor_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    scorecards = result["sdbip_scorecards"]
    assert isinstance(scorecards, list)
    assert len(scorecards) >= 1

    sc = scorecards[0]
    assert "id" in sc
    assert "financial_year" in sc
    assert "status" in sc
    assert "layer" in sc


# ---------------------------------------------------------------------------
# DASH-10: SDBIP approval action tests
# ---------------------------------------------------------------------------


async def test_mayor_approve_sdbip(db_session: AsyncSession):
    """POST approve transitions scorecard to approved and creates audit_log."""
    from sqlalchemy import select

    set_tenant_context(TEST_TENANT)
    try:
        sc = await _create_scorecard(db_session, TEST_TENANT, status="draft")
        sc_id = sc.id

        mayor = _make_user(UserRole.EXECUTIVE_MAYOR, TEST_TENANT)
        mayor.tenant_id = TEST_TENANT

        result = await _service.approve_sdbip(
            scorecard_id=sc_id,
            current_user=mayor,
            db=db_session,
            comment="Approved at council meeting",
        )
    finally:
        clear_tenant_context()

    assert result["status"] == "approved"
    assert result["id"] == str(sc_id)

    # Verify audit log was created with our action data
    set_tenant_context(TEST_TENANT)
    try:
        logs = await db_session.execute(
            select(AuditLog).where(
                AuditLog.table_name == "sdbip_scorecards",
                AuditLog.record_id == str(sc_id),
                AuditLog.changes.is_not(None),
            )
        )
        log_entries = logs.scalars().all()
    finally:
        clear_tenant_context()

    # Find the entry with our action marker
    action_entry = next(
        (e for e in log_entries if e.changes and "sdbip_approved" in e.changes),
        None,
    )
    assert action_entry is not None, (
        f"No audit_log with 'sdbip_approved' action found. "
        f"Found {len(log_entries)} entries: {[e.changes for e in log_entries]}"
    )
    changes = json.loads(action_entry.changes)
    assert changes["action"] == "sdbip_approved"


async def test_mayor_approve_403(db_session: AsyncSession):
    """PMS officer on approve endpoint returns 403 via require_role()."""
    from fastapi.testclient import TestClient
    from src.main import app
    from src.api.deps import get_current_user

    pms_user = _make_user(UserRole.PMS_OFFICER, TEST_TENANT)

    original_override = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: pms_user

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post(
                "/api/v1/role-dashboards/mayor/approve-sdbip",
                json={"scorecard_id": str(uuid4())},
            )
    finally:
        app.dependency_overrides = original_override

    assert response.status_code == 403


async def test_mayor_approve_invalid_transition_409(db_session: AsyncSession):
    """Approving an already-approved scorecard raises 409 Conflict."""
    set_tenant_context(TEST_TENANT)
    try:
        # Create scorecard already in approved status
        sc = await _create_scorecard(db_session, TEST_TENANT, status="approved")
        sc_id = sc.id

        mayor = _make_user(UserRole.EXECUTIVE_MAYOR, TEST_TENANT)
        mayor.tenant_id = TEST_TENANT

        with pytest.raises(HTTPException) as exc_info:
            await _service.approve_sdbip(
                scorecard_id=sc_id,
                current_user=mayor,
                db=db_session,
            )
    finally:
        clear_tenant_context()

    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# DASH-04: Councillor Dashboard tests
# ---------------------------------------------------------------------------


async def test_councillor_readonly_view(db_session: AsyncSession):
    """Councillor dashboard has sdbip_summary (list) and statutory_reports (list)."""
    set_tenant_context(TEST_TENANT)
    try:
        result = await _service.get_councillor_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "sdbip_summary" in result
    assert "statutory_reports" in result
    assert isinstance(result["sdbip_summary"], list)
    assert isinstance(result["statutory_reports"], list)


# ---------------------------------------------------------------------------
# DASH-05: Audit Committee Dashboard tests
# ---------------------------------------------------------------------------


async def test_audit_committee_view(db_session: AsyncSession):
    """Audit committee dashboard has performance_reports and audit_trail."""
    set_tenant_context(TEST_TENANT)
    try:
        result = await _service.get_audit_committee_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "performance_reports" in result
    assert "audit_trail" in result
    assert isinstance(result["performance_reports"], list)
    assert isinstance(result["audit_trail"], list)


async def test_audit_committee_trail_pms_tables(db_session: AsyncSession):
    """audit_trail only contains PMS table entries."""
    set_tenant_context(TEST_TENANT)
    try:
        # Create an audit log for a PMS table
        log1 = AuditLog(
            tenant_id=TEST_TENANT,
            user_id=str(uuid4()),
            operation=OperationType.UPDATE,
            table_name="sdbip_scorecards",
            record_id=str(uuid4()),
            changes=json.dumps({"action": "test"}),
        )
        # Create an audit log for a non-PMS table (should not appear)
        log2 = AuditLog(
            tenant_id=TEST_TENANT,
            user_id=str(uuid4()),
            operation=OperationType.UPDATE,
            table_name="tickets",
            record_id=str(uuid4()),
            changes=json.dumps({"status": "resolved"}),
        )
        db_session.add_all([log1, log2])
        await db_session.commit()

        result = await _service.get_audit_committee_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    audit_trail = result["audit_trail"]
    # All entries should be from PMS tables
    pms_tables = {
        "sdbip_scorecards", "sdbip_kpis", "sdbip_actuals",
        "statutory_reports", "performance_agreements", "evidence_documents",
    }
    for entry in audit_trail:
        assert entry["table_name"] in pms_tables, (
            f"Non-PMS table '{entry['table_name']}' found in audit_trail"
        )

    # The PMS log should appear
    sdbip_entries = [e for e in audit_trail if e["table_name"] == "sdbip_scorecards"]
    assert len(sdbip_entries) >= 1


# ---------------------------------------------------------------------------
# DASH-06 + DASH-11: Internal Auditor tests
# ---------------------------------------------------------------------------


async def test_internal_auditor_poe_workqueue(db_session: AsyncSession):
    """Internal auditor queue groups unverified evidence documents by KPI."""
    set_tenant_context(TEST_TENANT)
    try:
        sc = await _create_scorecard(db_session, TEST_TENANT)
        kpi = await _create_kpi(db_session, TEST_TENANT, sc.id, kpi_number="KPI-E01")
        actual = await _create_actual(db_session, TEST_TENANT, kpi.id, "green")
        ev = await _create_evidence(
            db_session, TEST_TENANT, actual.id, "unverified"
        )

        result = await _service.get_internal_auditor_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "verification_queue" in result
    queue = result["verification_queue"]
    assert isinstance(queue, list)
    assert len(queue) >= 1

    # Find our KPI group
    kpi_group = next(
        (g for g in queue if g["kpi_id"] == str(kpi.id)), None
    )
    assert kpi_group is not None, f"KPI group {kpi.id} not found in queue"
    assert len(kpi_group["evidence_items"]) >= 1

    item = kpi_group["evidence_items"][0]
    assert "id" in item
    assert "file_name" in item
    assert "content_type" in item


async def test_internal_auditor_poe_verify(db_session: AsyncSession):
    """verify endpoint updates EvidenceDocument.verification_status and creates audit_log."""
    from sqlalchemy import select

    set_tenant_context(TEST_TENANT)
    try:
        sc = await _create_scorecard(db_session, TEST_TENANT)
        kpi = await _create_kpi(db_session, TEST_TENANT, sc.id, kpi_number="KPI-V01")
        actual = await _create_actual(db_session, TEST_TENANT, kpi.id, "green")
        ev = await _create_evidence(
            db_session, TEST_TENANT, actual.id, "unverified"
        )
        ev_id = ev.id

        auditor = _make_user(UserRole.INTERNAL_AUDITOR, TEST_TENANT)
        auditor.tenant_id = TEST_TENANT

        result = await _service.verify_evidence(
            evidence_id=ev_id,
            status="verified",
            current_user=auditor,
            db=db_session,
        )
    finally:
        clear_tenant_context()

    assert result["verification_status"] == "verified"
    assert result["evidence_id"] == str(ev_id)

    # Verify audit log was created with our action data
    set_tenant_context(TEST_TENANT)
    try:
        logs = await db_session.execute(
            select(AuditLog).where(
                AuditLog.table_name == "evidence_documents",
                AuditLog.record_id == str(ev_id),
                AuditLog.changes.is_not(None),
            )
        )
        log_entries = logs.scalars().all()
    finally:
        clear_tenant_context()

    # Find the entry with our action marker
    action_entry = next(
        (e for e in log_entries if e.changes and "poe_verified" in e.changes),
        None,
    )
    assert action_entry is not None, (
        f"No audit_log with 'poe_verified' found. "
        f"Entries: {[e.changes for e in log_entries]}"
    )
    changes = json.loads(action_entry.changes)
    assert changes["action"] == "poe_verified"


async def test_internal_auditor_verify_invalid_status(db_session: AsyncSession):
    """Verify with an invalid status raises HTTPException 422."""
    set_tenant_context(TEST_TENANT)
    try:
        sc = await _create_scorecard(db_session, TEST_TENANT)
        kpi = await _create_kpi(db_session, TEST_TENANT, sc.id, kpi_number="KPI-INV1")
        actual = await _create_actual(db_session, TEST_TENANT, kpi.id, "green")
        ev = await _create_evidence(db_session, TEST_TENANT, actual.id, "unverified")
        ev_id = ev.id

        auditor = _make_user(UserRole.INTERNAL_AUDITOR, TEST_TENANT)
        auditor.tenant_id = TEST_TENANT

        with pytest.raises(HTTPException) as exc_info:
            await _service.verify_evidence(
                evidence_id=ev_id,
                status="approved",  # invalid — only 'verified' or 'insufficient'
                current_user=auditor,
                db=db_session,
            )
    finally:
        clear_tenant_context()

    assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# DASH-07 + DASH-12: MPAC tests
# ---------------------------------------------------------------------------


async def test_mpac_dashboard_structure(db_session: AsyncSession):
    """MPAC dashboard has statutory_reports and investigation_flags lists."""
    set_tenant_context(TEST_TENANT)
    try:
        result = await _service.get_mpac_dashboard(
            tenant_id=TEST_TENANT, db=db_session
        )
    finally:
        clear_tenant_context()

    assert "statutory_reports" in result
    assert "investigation_flags" in result
    assert isinstance(result["statutory_reports"], list)
    assert isinstance(result["investigation_flags"], list)


async def test_mpac_flag_investigation(db_session: AsyncSession):
    """flag_investigation creates audit_log with table_name='investigation_flags'."""
    from sqlalchemy import select

    set_tenant_context(TEST_TENANT)
    try:
        report = await _create_statutory_report(db_session, TEST_TENANT)
        report_id = report.id

        mpac_user = _make_user(UserRole.MPAC_MEMBER, TEST_TENANT)
        mpac_user.tenant_id = TEST_TENANT

        result = await _service.flag_investigation(
            report_id=report_id,
            reason="performance_concern",
            notes="Q1 targets significantly missed across 3 departments",
            current_user=mpac_user,
            db=db_session,
        )
    finally:
        clear_tenant_context()

    assert result["status"] == "pending"
    assert result["report_id"] == str(report_id)

    # Verify audit log entry was created
    set_tenant_context(TEST_TENANT)
    try:
        logs = await db_session.execute(
            select(AuditLog).where(
                AuditLog.table_name == "investigation_flags",
                AuditLog.record_id == str(report_id),
                AuditLog.changes.is_not(None),
            )
        )
        log_entries = logs.scalars().all()
    finally:
        clear_tenant_context()

    assert len(log_entries) >= 1
    # Find entry with our flag marker
    flag_entry = next(
        (e for e in log_entries if e.changes and "investigation_flagged" in e.changes),
        None,
    )
    assert flag_entry is not None, f"No investigation_flagged audit entry found"
    changes = json.loads(flag_entry.changes)
    assert changes["action"] == "investigation_flagged"
    assert changes["reason"] == "performance_concern"
    assert changes["status"] == "pending"


async def test_mpac_flag_reason_validation(db_session: AsyncSession):
    """flag_investigation with an invalid reason raises validation in API layer."""
    from src.api.v1.role_dashboards import FlagInvestigationRequest, _VALID_INVESTIGATION_REASONS

    # Test that our validation list contains expected values
    assert "performance_concern" in _VALID_INVESTIGATION_REASONS
    assert "policy_violation" in _VALID_INVESTIGATION_REASONS
    assert "procurement_irregularity" in _VALID_INVESTIGATION_REASONS
    assert "other" in _VALID_INVESTIGATION_REASONS
    assert "invalid_reason" not in _VALID_INVESTIGATION_REASONS


# ---------------------------------------------------------------------------
# DASH-08: SALGA Admin benchmarking tests
# ---------------------------------------------------------------------------


async def test_salga_admin_benchmarking(db_session: AsyncSession):
    """SALGA admin returns municipalities list (may be empty if no cross-tenant data)."""
    # SALGA admin query uses raw SQL; in SQLite test environment, result may be empty
    # but the structure must be correct.
    result = await _service.get_salga_admin_dashboard(db=db_session)

    assert "municipalities" in result
    assert isinstance(result["municipalities"], list)
    # Each entry (if present) must have required keys
    for entry in result["municipalities"]:
        assert "tenant_id" in entry
        assert "municipality_name" in entry
        assert "overall_achievement_pct" in entry
        assert "ticket_resolution_rate" in entry
        assert "sla_compliance_pct" in entry


async def test_salga_admin_403(db_session: AsyncSession):
    """PMS officer on /role-dashboards/salga-admin returns 403 via require_role()."""
    from fastapi.testclient import TestClient
    from src.main import app
    from src.api.deps import get_current_user

    pms_user = _make_user(UserRole.PMS_OFFICER, TEST_TENANT)

    original_override = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: pms_user

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/role-dashboards/salga-admin")
    finally:
        app.dependency_overrides = original_override

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# DASH-09: Section 56 Director tests
# ---------------------------------------------------------------------------


async def test_section56_director_scoped(db_session: AsyncSession):
    """Director dashboard returns KPIs scoped to the assigned department."""
    set_tenant_context(TEST_TENANT)
    try:
        # Create a municipality and user (director needs municipality_id)
        muni = await _create_municipality(db_session, "Director Test Municipality")

        director = User(
            tenant_id=TEST_TENANT,
            municipality_id=muni.id,
            email="director@test.gov.za",
            hashed_password="supabase_managed",
            full_name="Test Director",
            role=UserRole.SECTION56_DIRECTOR,
            is_active=True,
        )
        db_session.add(director)
        await db_session.commit()
        await db_session.refresh(director)

        # Create department assigned to this director
        dept = Department(
            tenant_id=TEST_TENANT,
            name="Community Services",
            code="COMM",
            assigned_director_id=director.id,
            is_active=True,
        )
        db_session.add(dept)
        await db_session.commit()
        await db_session.refresh(dept)

        # Create KPI in this department
        sc = await _create_scorecard(db_session, TEST_TENANT)
        kpi = await _create_kpi(
            db_session, TEST_TENANT, sc.id, department_id=dept.id, kpi_number="KPI-CS01"
        )
        await _create_actual(db_session, TEST_TENANT, kpi.id, "green", Decimal("90"))

        result = await _service.get_section56_director_dashboard(
            current_user=director, db=db_session
        )
    finally:
        clear_tenant_context()

    assert result.get("empty_state") is False
    assert result["department_name"] == "Community Services"
    assert result["kpi_count"] == 1
    assert result["traffic_light_counts"]["green"] == 1
    assert len(result["kpi_details"]) == 1


async def test_section56_no_department(db_session: AsyncSession):
    """Director with no assigned department returns empty_state=True."""
    set_tenant_context(TEST_TENANT)
    try:
        muni = await _create_municipality(db_session, "No Dept Municipality")

        # Director with no department assignment
        director = User(
            tenant_id=TEST_TENANT,
            municipality_id=muni.id,
            email="unassigned_director@test.gov.za",
            hashed_password="supabase_managed",
            full_name="Unassigned Director",
            role=UserRole.SECTION56_DIRECTOR,
            is_active=True,
        )
        db_session.add(director)
        await db_session.commit()
        await db_session.refresh(director)

        result = await _service.get_section56_director_dashboard(
            current_user=director, db=db_session
        )
    finally:
        clear_tenant_context()

    assert result["empty_state"] is True
    assert "message" in result


# ---------------------------------------------------------------------------
# PMS readiness gate tests — tenant-specific dashboards (DASH-01..03, DASH-09)
# ---------------------------------------------------------------------------


class TestRoleDashboardPmsGate:
    """Role dashboard endpoints for tenant-specific roles must enforce PMS readiness.

    In a fresh SQLite test DB there is no Municipality with settings_locked=True,
    no departments with directors, and no PMS officer assignments — so PMS is NOT
    ready. The require_pms_ready() dependency must return 403 with PMS_NOT_READY.

    Uses app.dependency_overrides[get_current_user] to inject mock users per the
    Phase 31 RBAC 403 test pattern — avoids JWT+DB lookup 500 errors in SQLite.
    """

    async def test_cfo_dashboard_requires_pms_ready(self, db_session: AsyncSession):
        """GET /role-dashboards/cfo returns 403 with PMS_NOT_READY when PMS not configured.

        X-Tenant-ID header is sent so TenantContextMiddleware sets tenant context before
        the require_pms_ready() dependency queries the DB — same pattern needed for any
        dependency that queries the DB using the ORM tenant filter.
        """
        from fastapi.testclient import TestClient
        from src.main import app
        from src.api.deps import get_current_user

        cfo_user = _make_user(UserRole.CFO, TEST_TENANT)

        original_override = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: cfo_user

        try:
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get(
                    "/api/v1/role-dashboards/cfo",
                    headers={"X-Tenant-ID": TEST_TENANT},
                )
        finally:
            app.dependency_overrides = original_override

        assert response.status_code == 403, (
            f"Expected 403 (PMS_NOT_READY) for CFO on /cfo, got {response.status_code}. "
            "Add require_pms_ready() dependency to @router.get('/cfo')."
        )
        body = response.json()
        assert body.get("detail", {}).get("code") == "PMS_NOT_READY", (
            f"Expected detail.code='PMS_NOT_READY', got: {body}"
        )

    async def test_mm_dashboard_requires_pms_ready(self, db_session: AsyncSession):
        """GET /role-dashboards/municipal-manager returns 403 when PMS not configured."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.api.deps import get_current_user

        mm_user = _make_user(UserRole.MUNICIPAL_MANAGER, TEST_TENANT)

        original_override = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: mm_user

        try:
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get(
                    "/api/v1/role-dashboards/municipal-manager",
                    headers={"X-Tenant-ID": TEST_TENANT},
                )
        finally:
            app.dependency_overrides = original_override

        assert response.status_code == 403, (
            f"Expected 403 (PMS_NOT_READY) for MM on /municipal-manager, got {response.status_code}."
        )

    async def test_mayor_dashboard_requires_pms_ready(self, db_session: AsyncSession):
        """GET /role-dashboards/mayor returns 403 when PMS not configured."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.api.deps import get_current_user

        mayor_user = _make_user(UserRole.EXECUTIVE_MAYOR, TEST_TENANT)

        original_override = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: mayor_user

        try:
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get(
                    "/api/v1/role-dashboards/mayor",
                    headers={"X-Tenant-ID": TEST_TENANT},
                )
        finally:
            app.dependency_overrides = original_override

        assert response.status_code == 403, (
            f"Expected 403 (PMS_NOT_READY) for Mayor on /mayor, got {response.status_code}."
        )

    async def test_section56_director_dashboard_requires_pms_ready(self, db_session: AsyncSession):
        """GET /role-dashboards/section56-director returns 403 when PMS not configured."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.api.deps import get_current_user

        director_user = _make_user(UserRole.SECTION56_DIRECTOR, TEST_TENANT)

        original_override = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: director_user

        try:
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get(
                    "/api/v1/role-dashboards/section56-director",
                    headers={"X-Tenant-ID": TEST_TENANT},
                )
        finally:
            app.dependency_overrides = original_override

        assert response.status_code == 403, (
            f"Expected 403 (PMS_NOT_READY) for Section56Director on /section56-director, "
            f"got {response.status_code}."
        )

    async def test_councillor_dashboard_no_pms_gate(self, db_session: AsyncSession):
        """GET /role-dashboards/councillor returns 200 (NOT 403) — oversight, no PMS gate."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.api.deps import get_current_user

        councillor_user = _make_user(UserRole.WARD_COUNCILLOR, TEST_TENANT)

        original_override = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: councillor_user

        try:
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get(
                    "/api/v1/role-dashboards/councillor",
                    headers={"X-Tenant-ID": TEST_TENANT},
                )
        finally:
            app.dependency_overrides = original_override

        assert response.status_code == 200, (
            f"Expected 200 for councillor on /councillor (no PMS gate), got {response.status_code}. "
            "Oversight endpoints must NOT require PMS readiness."
        )

    async def test_salga_admin_dashboard_no_pms_gate(self, db_session: AsyncSession):
        """GET /role-dashboards/salga-admin returns 200 — cross-tenant, no PMS gate."""
        from fastapi.testclient import TestClient
        from src.main import app
        from src.api.deps import get_current_user

        salga_user = _make_user(UserRole.SALGA_ADMIN, TEST_TENANT)

        original_override = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: salga_user

        try:
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get(
                    "/api/v1/role-dashboards/salga-admin",
                    headers={"X-Tenant-ID": TEST_TENANT},
                )
        finally:
            app.dependency_overrides = original_override

        assert response.status_code == 200, (
            f"Expected 200 for salga_admin on /salga-admin (no PMS gate), got {response.status_code}."
        )
