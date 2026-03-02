"""Statutory Report service layer.

Provides CRUD operations for the statutory report lifecycle:
    StatutoryReport -> StatutoryReportSnapshot

Key responsibilities:
- Report creation with period computation and uniqueness enforcement
- 5-stage approval workflow transitions with role gates (REPORT-05)
- Data snapshot at mm_approved transition (REPORT-06)
- SDBIP KPI data assembly for PDF/DOCX template rendering
- Municipality branding (name + logo_url) for REPORT-08
- Completeness validation before generation (REPORT-08)

Design notes:
- Period dates computed from financial_year string and quarter (South African: July-June)
- FK validation uses SELECT then 422/409 (not DB FK violation) for SQLite compatibility
- start_value= MUST always be passed to ReportWorkflow to bind non-initial states
- Snapshot serialised as JSON string (not dict) for DB storage efficiency
- assemble_report_data renders from snapshot if status >= mm_approved (REPORT-06)
- validate_report_completeness: returns is_complete + missing_items; S52 warns on
  missing scorecard/KPIs/actuals; S72 additionally checks Q2; S46/S121 check all 4 quarters
"""
import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.idp import IDPCycle, IDPGoal, IDPObjective
from src.models.municipality import Municipality
from src.models.notification import Notification, NotificationType
from src.models.pa import PerformanceAgreement
from src.models.sdbip import SDBIPActual, SDBIPKpi, SDBIPQuarterlyTarget, SDBIPScorecard
from src.models.statutory_report import (
    ReportStatus,
    ReportType,
    ReportWorkflow,
    StatutoryReport,
    StatutoryReportSnapshot,
    TransitionNotAllowed,
)
from src.models.user import User, UserRole
from src.schemas.statutory_report import StatutoryReportCreate

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Role gate configuration for report transitions
# ---------------------------------------------------------------------------

# Roles permitted to trigger each transition event (REPORT-05)
_TRANSITION_ROLES: dict[str, set[str]] = {
    "submit_for_review": {
        UserRole.PMS_OFFICER,
        UserRole.DEPARTMENT_MANAGER,
        UserRole.CFO,
        UserRole.MUNICIPAL_MANAGER,  # ADDED — was missing, caused 403 for MM (BUG-1 / REPORT-05)
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
    },
    "approve": {
        UserRole.MUNICIPAL_MANAGER,
        UserRole.CFO,
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
    },
    "submit_external": {
        UserRole.MUNICIPAL_MANAGER,
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
    },
    "table": {
        UserRole.MUNICIPAL_MANAGER,
        UserRole.SPEAKER,
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
    },
}


# ---------------------------------------------------------------------------
# Period computation helpers
# ---------------------------------------------------------------------------


def _compute_period(report_type: ReportType, financial_year: str, quarter: str | None) -> tuple[date, date]:
    """Compute period_start and period_end from financial_year and quarter.

    South African financial year runs July 1 to June 30.
    Quarters:
      Q1: Jul 1  - Sep 30  (same year as financial_year start)
      Q2: Oct 1  - Dec 31  (same year as financial_year start)
      Q3: Jan 1  - Mar 31  (next year, i.e., financial_year start + 1)
      Q4: Apr 1  - Jun 30  (next year, i.e., financial_year start + 1)

    Section 72 (mid-year assessment): Jul 1 - Dec 31 (H1)
    Section 46/121 (annual):          Jul 1 - Jun 30 (full year)

    Args:
        report_type: The statutory report type.
        financial_year: "YYYY/YY" string (e.g., "2025/26").
        quarter: "Q1"-"Q4" or None.

    Returns:
        Tuple of (period_start, period_end) as date objects.
    """
    # Extract start year from "YYYY/YY" (e.g., 2025 from "2025/26")
    start_year = int(financial_year.split("/")[0])
    next_year = start_year + 1

    if report_type == ReportType.SECTION_52:
        # Quarter-specific periods within the financial year
        quarter_periods = {
            "Q1": (date(start_year, 7, 1), date(start_year, 9, 30)),
            "Q2": (date(start_year, 10, 1), date(start_year, 12, 31)),
            "Q3": (date(next_year, 1, 1), date(next_year, 3, 31)),
            "Q4": (date(next_year, 4, 1), date(next_year, 6, 30)),
        }
        period_start, period_end = quarter_periods[quarter]  # type: ignore[index]
    elif report_type == ReportType.SECTION_72:
        # Mid-year assessment: H1 (Q1 + Q2)
        period_start = date(start_year, 7, 1)
        period_end = date(start_year, 12, 31)
    else:
        # Section 46 and Section 121: full financial year
        period_start = date(start_year, 7, 1)
        period_end = date(next_year, 6, 30)

    return period_start, period_end


# ---------------------------------------------------------------------------
# StatutoryReportService
# ---------------------------------------------------------------------------


class StatutoryReportService:
    """Service class for statutory report creation, transitions, snapshots, and assembly."""

    # ------------------------------------------------------------------
    # Report CRUD
    # ------------------------------------------------------------------

    async def create_report(
        self,
        data: StatutoryReportCreate,
        user: User,
        db: AsyncSession,
    ) -> StatutoryReport:
        """Create a new StatutoryReport in DRAFTING status.

        Args:
            data: Validated StatutoryReportCreate payload.
            user: Authenticated requesting user (CFO, MM, or admin).
            db:   Async database session.

        Returns:
            Newly created StatutoryReport in drafting status.

        Raises:
            HTTPException 409: Duplicate report (same type, FY, quarter, tenant).
            HTTPException 422: quarter missing for SECTION_52 (already validated by schema).
        """
        # Compute period dates
        period_start, period_end = _compute_period(
            data.report_type, data.financial_year, data.quarter
        )

        report = StatutoryReport(
            tenant_id=user.tenant_id,
            report_type=data.report_type.value,
            financial_year=data.financial_year,
            quarter=data.quarter,
            period_start=datetime.combine(period_start, datetime.min.time()),
            period_end=datetime.combine(period_end, datetime.min.time()),
            title=data.title,
            status=ReportStatus.DRAFTING,
            created_by=str(user.id),
            updated_by=str(user.id),
        )

        db.add(report)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"A {data.report_type} report for {data.financial_year}"
                    + (f" Q{data.quarter}" if data.quarter else "")
                    + " already exists for this municipality."
                ),
            )

        await db.refresh(report)
        logger.info(
            "Statutory report created: id=%s type=%s FY=%s Q=%s tenant=%s",
            report.id,
            report.report_type,
            report.financial_year,
            report.quarter,
            report.tenant_id,
        )
        return report

    async def get_report(
        self,
        report_id: UUID,
        db: AsyncSession,
    ) -> StatutoryReport | None:
        """Fetch a single report by ID.

        Returns:
            StatutoryReport if found, None otherwise.
        """
        result = await db.execute(
            select(StatutoryReport).where(StatutoryReport.id == report_id)
        )
        return result.scalar_one_or_none()

    async def list_reports(
        self,
        financial_year: str | None,
        report_type: str | None,
        db: AsyncSession,
    ) -> list[StatutoryReport]:
        """List all reports for the current tenant, with optional filters.

        Args:
            financial_year: Optional filter (e.g., "2025/26").
            report_type:    Optional filter (e.g., "section_52").
            db:             Async database session.

        Returns:
            List of StatutoryReport ordered by created_at desc.
        """
        query = select(StatutoryReport).order_by(StatutoryReport.created_at.desc())

        if financial_year is not None:
            query = query.where(StatutoryReport.financial_year == financial_year)
        if report_type is not None:
            query = query.where(StatutoryReport.report_type == report_type)

        result = await db.execute(query)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # State machine transitions
    # ------------------------------------------------------------------

    async def transition_report(
        self,
        report_id: UUID,
        event: str,
        user: User,
        db: AsyncSession,
    ) -> StatutoryReport:
        """Apply a state machine transition to a statutory report.

        Args:
            report_id: UUID of the report to transition.
            event:     Transition event name (from ReportTransitionRequest).
            user:      Authenticated requesting user (for role gate).
            db:        Async database session.

        Returns:
            Updated StatutoryReport.

        Raises:
            HTTPException 404: Report not found.
            HTTPException 403: User's role not permitted for this transition.
            HTTPException 409: Transition not allowed in current state.
        """
        # Fetch report
        report = await self.get_report(report_id, db)
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statutory report {report_id} not found",
            )

        # Role gate
        user_role = user.role if isinstance(user.role, str) else user.role.value
        allowed_roles = _TRANSITION_ROLES.get(event, set())
        # Compare string values for both str roles and UserRole enum values
        allowed_values = {r.value if hasattr(r, "value") else r for r in allowed_roles}
        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{user_role}' is not permitted to trigger '{event}'. "
                    f"Allowed roles: {sorted(allowed_values)}"
                ),
            )

        # Apply state machine transition
        machine = ReportWorkflow(model=report, state_field="status", start_value=report.status)
        try:
            machine.send(event)
        except TransitionNotAllowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Transition '{event}' is not allowed from current status '{report.status}'."
                ),
            )

        # CRITICAL (REPORT-06): Snapshot data when Municipal Manager approves
        if event == "approve":
            await self._snapshot_report_data(report, db)
            report.approved_by = str(user.id)
            report.approved_at = datetime.now(timezone.utc)

        report.updated_by = str(user.id)

        await db.commit()
        await db.refresh(report)

        logger.info(
            "Statutory report transition: id=%s event=%s new_status=%s by=%s",
            report.id,
            event,
            report.status,
            user.id,
        )
        return report

    # ------------------------------------------------------------------
    # Data snapshot (REPORT-06)
    # ------------------------------------------------------------------

    async def _snapshot_report_data(
        self,
        report: StatutoryReport,
        db: AsyncSession,
    ) -> StatutoryReportSnapshot:
        """Snapshot all SDBIP KPI data for the report's scope at mm_approved.

        For Section 52: snapshots actuals for the specific quarter.
        For Section 72: snapshots Q1 + Q2 actuals.
        For Section 46/121: snapshots all 4 quarters.

        Also includes PA annual scores for Section 46/121 reports.

        Args:
            report: The StatutoryReport being approved.
            db:     Async database session.

        Returns:
            Created StatutoryReportSnapshot.
        """
        # Determine which quarters to include
        quarter_filter: list[str] | None
        if report.report_type == ReportType.SECTION_52:
            quarter_filter = [report.quarter] if report.quarter else None
        elif report.report_type == ReportType.SECTION_72:
            quarter_filter = ["Q1", "Q2"]
        else:
            quarter_filter = ["Q1", "Q2", "Q3", "Q4"]

        # Fetch SDBIP KPIs with quarterly targets and actuals
        kpi_query = (
            select(SDBIPKpi)
            .options(
                selectinload(SDBIPKpi.quarterly_targets),
                selectinload(SDBIPKpi.actuals),
                selectinload(SDBIPKpi.scorecard),
            )
        )
        kpi_result = await db.execute(kpi_query)
        kpis = list(kpi_result.scalars().unique().all())

        # Build KPI data list
        kpi_data = []
        for kpi in kpis:
            # Get quarterly target for the relevant quarter(s)
            target_map = {qt.quarter: str(qt.target_value) for qt in kpi.quarterly_targets}

            # Get actuals for relevant quarters
            if quarter_filter:
                relevant_actuals = [
                    a for a in kpi.actuals
                    if a.financial_year == report.financial_year
                    and a.quarter in quarter_filter
                ]
            else:
                relevant_actuals = [
                    a for a in kpi.actuals
                    if a.financial_year == report.financial_year
                ]

            for actual in relevant_actuals:
                kpi_data.append({
                    "kpi_id": str(kpi.id),
                    "kpi_number": kpi.kpi_number,
                    "description": kpi.description,
                    "unit": kpi.unit_of_measurement,
                    "baseline": str(kpi.baseline),
                    "annual_target": str(kpi.annual_target),
                    "quarterly_target": target_map.get(actual.quarter, "0"),
                    "actual_value": str(actual.actual_value),
                    "achievement_pct": str(actual.achievement_pct) if actual.achievement_pct is not None else "0",
                    "traffic_light": actual.traffic_light_status or "red",
                    "variance": str(
                        (actual.actual_value or Decimal(0)) -
                        Decimal(target_map.get(actual.quarter, "0"))
                    ),
                    "quarter": actual.quarter,
                    "department_id": str(kpi.department_id) if kpi.department_id else None,
                })

        # Include PA summary for annual reports (Section 46/121)
        pa_summaries = []
        if report.report_type in (ReportType.SECTION_46, ReportType.SECTION_121):
            pa_result = await db.execute(
                select(PerformanceAgreement).where(
                    PerformanceAgreement.financial_year == report.financial_year
                )
            )
            pas = list(pa_result.scalars().all())
            for pa in pas:
                pa_summaries.append({
                    "pa_id": str(pa.id),
                    "manager_id": str(pa.section57_manager_id),
                    "manager_role": pa.manager_role,
                    "annual_score": str(pa.annual_score) if pa.annual_score is not None else None,
                    "status": pa.status,
                })

        # Include IDP data for Section 121 snapshots
        idp_objectives: list[dict] = []
        municipality_vision = ""
        municipality_mission = ""
        if report.report_type == ReportType.SECTION_121:
            idp_data = await self._query_live_idp_data(report.financial_year, db)
            idp_objectives = idp_data["idp_objectives"]
            municipality_vision = idp_data["municipality_vision"]
            municipality_mission = idp_data["municipality_mission"]

        snapshot_data = {
            "report_id": str(report.id),
            "report_type": report.report_type,
            "financial_year": report.financial_year,
            "quarter": report.quarter,
            "snapshot_reason": "mm_approved",
            "kpis": kpi_data,
            "pa_summaries": pa_summaries,
            "idp_objectives": idp_objectives,
            "municipality_vision": municipality_vision,
            "municipality_mission": municipality_mission,
        }

        snapshot = StatutoryReportSnapshot(
            tenant_id=report.tenant_id,
            report_id=report.id,
            snapshot_data=json.dumps(snapshot_data, default=str),
            snapshot_at=datetime.now(timezone.utc),
            snapshot_reason="mm_approved",
            created_by=str(report.updated_by or report.created_by),
        )
        db.add(snapshot)
        # Note: commit is called by the caller (transition_report) after setting approved_by/at
        return snapshot

    async def get_report_snapshot(
        self,
        report_id: UUID,
        db: AsyncSession,
    ) -> StatutoryReportSnapshot | None:
        """Get the latest snapshot for a report.

        Returns:
            Most recent StatutoryReportSnapshot, or None if no snapshot exists.
        """
        result = await db.execute(
            select(StatutoryReportSnapshot)
            .where(StatutoryReportSnapshot.report_id == report_id)
            .order_by(StatutoryReportSnapshot.snapshot_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Completeness validation (REPORT-08)
    # ------------------------------------------------------------------

    async def validate_report_completeness(
        self,
        report: StatutoryReport,
        db: AsyncSession,
    ) -> dict:
        """Validate that all required data exists before generating a report.

        Checks vary by report type:
        - SECTION_52:  scorecard, KPIs, actuals for the specified quarter
        - SECTION_72:  scorecard, KPIs, actuals for Q1 AND Q2
        - SECTION_46:  scorecard, KPIs, actuals for all 4 quarters;
                       PA assessments incomplete is a warning (does not block)
        - SECTION_121: all S46 checks plus IDP cycle existence (warning only)

        Returns:
            dict with:
            - is_complete (bool): False if any blocking item is missing
            - missing_items (list[str]): human-readable descriptions of missing data
            - warnings (list[str]): non-blocking advisory messages
        """
        missing: list[str] = []
        warnings: list[str] = []
        fy = report.financial_year

        # --- Scorecard check ---
        scorecard_result = await db.execute(
            select(SDBIPScorecard).where(
                SDBIPScorecard.financial_year == fy
            ).limit(1)
        )
        scorecard = scorecard_result.scalar_one_or_none()
        if scorecard is None:
            missing.append(f"No SDBIP scorecard for {fy}")
            # If no scorecard, skip further SDBIP checks — they will all fail
            return {
                "is_complete": False,
                "missing_items": missing,
                "warnings": warnings,
            }

        # --- KPI check ---
        kpi_count_result = await db.execute(
            select(SDBIPKpi).where(
                SDBIPKpi.scorecard_id == scorecard.id
            ).limit(1)
        )
        if kpi_count_result.scalar_one_or_none() is None:
            missing.append(f"No KPIs found for {fy}")

        # --- Actuals check (varies by report type) ---
        if report.report_type == ReportType.SECTION_52:
            quarter = report.quarter or "Q1"
            actual_result = await db.execute(
                select(SDBIPActual).where(
                    SDBIPActual.financial_year == fy,
                    SDBIPActual.quarter == quarter,
                ).limit(1)
            )
            if actual_result.scalar_one_or_none() is None:
                missing.append(f"No actuals submitted for {quarter}")

        elif report.report_type == ReportType.SECTION_72:
            for quarter in ("Q1", "Q2"):
                actual_result = await db.execute(
                    select(SDBIPActual).where(
                        SDBIPActual.financial_year == fy,
                        SDBIPActual.quarter == quarter,
                    ).limit(1)
                )
                if actual_result.scalar_one_or_none() is None:
                    missing.append(f"No actuals submitted for {quarter}")

        else:
            # SECTION_46 and SECTION_121: all 4 quarters required
            for quarter in ("Q1", "Q2", "Q3", "Q4"):
                actual_result = await db.execute(
                    select(SDBIPActual).where(
                        SDBIPActual.financial_year == fy,
                        SDBIPActual.quarter == quarter,
                    ).limit(1)
                )
                if actual_result.scalar_one_or_none() is None:
                    missing.append(f"No actuals submitted for {quarter}")

            # PA assessment warning (non-blocking) for S46/S121
            pa_result = await db.execute(
                select(PerformanceAgreement).where(
                    PerformanceAgreement.financial_year == fy,
                    PerformanceAgreement.status == "assessed",
                ).limit(1)
            )
            if pa_result.scalar_one_or_none() is None:
                warnings.append(
                    f"No assessed Section 57 performance agreements for {fy}. "
                    "PA section will be empty but report can still be generated."
                )

            # IDP cycle warning for S121 (non-blocking)
            if report.report_type == ReportType.SECTION_121:
                start_year = int(fy.split("/")[0])
                idp_result = await db.execute(
                    select(IDPCycle).where(
                        IDPCycle.start_year <= start_year,
                        IDPCycle.end_year >= start_year,
                    ).limit(1)
                )
                if idp_result.scalar_one_or_none() is None:
                    warnings.append(
                        f"No IDP cycle found covering {fy}. "
                        "IDP alignment section will be empty but report can still be generated."
                    )

        return {
            "is_complete": len(missing) == 0,
            "missing_items": missing,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # Report data assembly (for template rendering)
    # ------------------------------------------------------------------

    async def assemble_report_data(
        self,
        report: StatutoryReport,
        db: AsyncSession,
    ) -> dict:
        """Assemble template context data for PDF/DOCX rendering.

        If the report has a snapshot (status >= mm_approved), renders from
        the snapshot to maintain auditability (REPORT-06).

        Otherwise, queries live SDBIP data for draft/review reports.

        Includes municipality branding (name + logo_url) for REPORT-08.

        Args:
            report: The StatutoryReport to render.
            db:     Async database session.

        Returns:
            Dict with keys:
            - municipality_name, logo_url
            - report_title, financial_year, quarter, period_start, period_end
            - kpis (list), departments (list), summary_stats (dict)
            - show_watermark (bool): True when status < mm_approved
            - h1_summary (dict, Section 72 only)
        """
        # Municipality branding (REPORT-08)
        # Municipality is NonTenantModel — query by tenant_id via direct filter
        try:
            muni_uuid = UUID(report.tenant_id)
        except (ValueError, AttributeError):
            muni_uuid = None
        if muni_uuid:
            muni_result = await db.execute(
                select(Municipality).where(Municipality.id == muni_uuid)
            )
        else:
            muni_result = None
        municipality = muni_result.scalar_one_or_none() if muni_result else None
        municipality_name = municipality.name if municipality else "Municipality"
        logo_url = municipality.logo_url if municipality else None

        # Determine whether to render from snapshot or live data
        snapshot_statuses = {
            ReportStatus.MM_APPROVED,
            ReportStatus.SUBMITTED,
            ReportStatus.TABLED,
        }
        use_snapshot = report.status in snapshot_statuses

        if use_snapshot:
            snapshot = await self.get_report_snapshot(report.id, db)
            if snapshot and snapshot.snapshot_data:
                raw_data = json.loads(snapshot.snapshot_data)
                kpi_list = raw_data.get("kpis", [])
            else:
                kpi_list = []
        else:
            # Live data query
            kpi_list = await self._query_live_kpi_data(report, db)

        # Compute summary stats
        total_kpis = len(kpi_list)
        green_count = sum(1 for k in kpi_list if k.get("traffic_light") == "green")
        amber_count = sum(1 for k in kpi_list if k.get("traffic_light") == "amber")
        red_count = total_kpis - green_count - amber_count

        if total_kpis > 0:
            green_pct = round(green_count / total_kpis * 100, 1)
            amber_pct = round(amber_count / total_kpis * 100, 1)
            red_pct = round(red_count / total_kpis * 100, 1)
            # Overall achievement: average of achievement_pct values
            achievement_values = [
                float(k.get("achievement_pct", 0)) for k in kpi_list
                if k.get("achievement_pct") is not None
            ]
            overall_achievement = round(
                sum(achievement_values) / len(achievement_values), 1
            ) if achievement_values else 0.0
        else:
            green_pct = amber_pct = red_pct = overall_achievement = 0.0

        summary_stats = {
            "total_kpis": total_kpis,
            "green_count": green_count,
            "amber_count": amber_count,
            "red_count": red_count,
            "green_pct": green_pct,
            "amber_pct": amber_pct,
            "red_pct": red_pct,
            "overall_achievement_pct": overall_achievement,
        }

        # Group KPIs by department for table rendering
        # For S46/S121: pivot actuals per KPI so each row has q1-q4 actuals
        is_annual = report.report_type in (ReportType.SECTION_46, ReportType.SECTION_121)
        if is_annual:
            departments = self._build_annual_departments(kpi_list)
        else:
            dept_map: dict[str | None, list] = {}
            for kpi in kpi_list:
                dept_id = kpi.get("department_id")
                dept_map.setdefault(dept_id, []).append(kpi)

            departments = [
                {
                    "name": dept_id or "Municipal-wide KPIs",
                    "kpis": dept_kpis,
                }
                for dept_id, dept_kpis in dept_map.items()
            ]

        # Section 72: compute H1 summary (Q1+Q2 combined)
        h1_summary = None
        if report.report_type == ReportType.SECTION_72:
            h1_kpis = [k for k in kpi_list if k.get("quarter") in ("Q1", "Q2")]
            h1_total = len(h1_kpis)
            h1_green = sum(1 for k in h1_kpis if k.get("traffic_light") == "green")
            h1_summary = {
                "total_kpis": h1_total,
                "green_count": h1_green,
                "on_track_pct": round(h1_green / h1_total * 100, 1) if h1_total else 0.0,
            }

        # Section 46/121: quarterly summary and PA data
        quarterly_summary: list[dict] = []
        pa_summaries: list[dict] = []
        red_kpis: list[dict] = []
        idp_objectives: list[dict] = []
        municipality_vision = ""
        municipality_mission = ""

        if is_annual:
            # Build quarterly summary from kpi_list
            quarterly_summary = self._build_quarterly_summary(kpi_list)

            # Red KPIs for recommendations (from pivoted annual departments)
            for dept in departments:
                for kpi in dept.get("kpis", []):
                    if kpi.get("annual_traffic_light", "").lower() == "red":
                        red_kpis.append(kpi)

            # PA summaries
            if use_snapshot:
                snapshot_pa = raw_data.get("pa_summaries", [])  # type: ignore[possibly-undefined]
                pa_summaries = self._enrich_pa_summaries(snapshot_pa)
            else:
                pa_summaries = await self._query_live_pa_summaries(report.financial_year, db)

            # IDP objectives and vision/mission for S121
            if report.report_type == ReportType.SECTION_121:
                if use_snapshot:
                    idp_objectives = raw_data.get("idp_objectives", [])  # type: ignore[possibly-undefined]
                    municipality_vision = raw_data.get("municipality_vision", "")
                    municipality_mission = raw_data.get("municipality_mission", "")
                else:
                    idp_data = await self._query_live_idp_data(report.financial_year, db)
                    idp_objectives = idp_data["idp_objectives"]
                    municipality_vision = idp_data["municipality_vision"]
                    municipality_mission = idp_data["municipality_mission"]

        return {
            "municipality_name": municipality_name,
            "logo_url": logo_url,
            "report_title": report.title,
            "financial_year": report.financial_year,
            "quarter": report.quarter,
            "period_start": report.period_start.strftime("%d %B %Y") if report.period_start else "",
            "period_end": report.period_end.strftime("%d %B %Y") if report.period_end else "",
            "kpis": kpi_list,
            "departments": departments,
            "summary_stats": summary_stats,
            "show_watermark": report.status not in snapshot_statuses,
            "h1_summary": h1_summary,
            "report_type": report.report_type,
            # S46/S121 specific
            "quarterly_summary": quarterly_summary,
            "pa_summaries": pa_summaries,
            "red_kpis": red_kpis,
            "idp_objectives": idp_objectives,
            "municipality_vision": municipality_vision,
            "municipality_mission": municipality_mission,
        }

    async def _query_live_kpi_data(
        self,
        report: StatutoryReport,
        db: AsyncSession,
    ) -> list[dict]:
        """Query live SDBIP data for draft/review report rendering.

        Same data structure as snapshot_data.kpis for template compatibility.
        """
        # Determine quarter filter
        if report.report_type == ReportType.SECTION_52:
            quarter_filter = [report.quarter] if report.quarter else []
        elif report.report_type == ReportType.SECTION_72:
            quarter_filter = ["Q1", "Q2"]
        else:
            quarter_filter = ["Q1", "Q2", "Q3", "Q4"]

        kpi_query = (
            select(SDBIPKpi)
            .options(
                selectinload(SDBIPKpi.quarterly_targets),
                selectinload(SDBIPKpi.actuals),
            )
        )
        kpi_result = await db.execute(kpi_query)
        kpis = list(kpi_result.scalars().unique().all())

        kpi_list = []
        for kpi in kpis:
            target_map = {qt.quarter: str(qt.target_value) for qt in kpi.quarterly_targets}
            relevant_actuals = [
                a for a in kpi.actuals
                if a.financial_year == report.financial_year
                and a.quarter in quarter_filter
            ]

            for actual in relevant_actuals:
                kpi_list.append({
                    "kpi_id": str(kpi.id),
                    "kpi_number": kpi.kpi_number,
                    "description": kpi.description,
                    "unit": kpi.unit_of_measurement,
                    "baseline": str(kpi.baseline),
                    "annual_target": str(kpi.annual_target),
                    "quarterly_target": target_map.get(actual.quarter, "0"),
                    "actual_value": str(actual.actual_value),
                    "achievement_pct": str(actual.achievement_pct) if actual.achievement_pct is not None else "0",
                    "traffic_light": actual.traffic_light_status or "red",
                    "variance": str(
                        (actual.actual_value or Decimal(0)) -
                        Decimal(target_map.get(actual.quarter, "0"))
                    ),
                    "quarter": actual.quarter,
                    "department_id": str(kpi.department_id) if kpi.department_id else None,
                    "deviation_reason": None,
                })

        return kpi_list

    # ------------------------------------------------------------------
    # Annual report data helpers (S46/S121)
    # ------------------------------------------------------------------

    def _build_annual_departments(self, kpi_list: list[dict]) -> list[dict]:
        """Pivot per-quarter actuals into per-KPI rows for annual report tables.

        Input kpi_list has one record per (kpi_id, quarter).
        Output has one row per kpi_id with q1_actual..q4_actual fields and
        a computed annual_achievement_pct and annual_traffic_light.
        """
        # Group records by (dept_id, kpi_id) to pivot quarters
        pivot: dict[tuple, dict] = {}
        for row in kpi_list:
            key = (row.get("department_id"), row.get("kpi_id"))
            if key not in pivot:
                pivot[key] = {
                    "kpi_id": row.get("kpi_id"),
                    "kpi_number": row.get("kpi_number", ""),
                    "description": row.get("description", ""),
                    "unit": row.get("unit", ""),
                    "baseline": row.get("baseline", ""),
                    "annual_target": row.get("annual_target", ""),
                    "department_id": row.get("department_id"),
                    "q1_actual": None,
                    "q2_actual": None,
                    "q3_actual": None,
                    "q4_actual": None,
                    "_achievement_values": [],
                    "_traffic_lights": [],
                }
            entry = pivot[key]
            quarter = row.get("quarter", "")
            actual_val = row.get("actual_value")
            if quarter == "Q1":
                entry["q1_actual"] = actual_val
            elif quarter == "Q2":
                entry["q2_actual"] = actual_val
            elif quarter == "Q3":
                entry["q3_actual"] = actual_val
            elif quarter == "Q4":
                entry["q4_actual"] = actual_val
            if row.get("achievement_pct") is not None:
                try:
                    entry["_achievement_values"].append(float(row["achievement_pct"]))
                except (ValueError, TypeError):
                    pass
            if row.get("traffic_light"):
                entry["_traffic_lights"].append(row["traffic_light"])

        # Compute annual aggregates
        pivoted_kpis: list[dict] = []
        for entry in pivot.values():
            vals = entry.pop("_achievement_values")
            lights = entry.pop("_traffic_lights")
            annual_pct = round(sum(vals) / len(vals), 1) if vals else 0.0
            entry["annual_achievement_pct"] = annual_pct
            # Worst-case traffic light
            if "red" in lights:
                entry["annual_traffic_light"] = "red"
            elif "amber" in lights:
                entry["annual_traffic_light"] = "amber"
            elif lights:
                entry["annual_traffic_light"] = "green"
            else:
                entry["annual_traffic_light"] = "red"
            pivoted_kpis.append(entry)

        # Group by department
        dept_map: dict[str | None, list] = {}
        for kpi in pivoted_kpis:
            dept_id = kpi.get("department_id")
            dept_map.setdefault(dept_id, []).append(kpi)

        return [
            {"name": dept_id or "Municipal-wide KPIs", "kpis": dept_kpis}
            for dept_id, dept_kpis in dept_map.items()
        ]

    def _build_quarterly_summary(self, kpi_list: list[dict]) -> list[dict]:
        """Build per-quarter summary rows from a flat kpi_list.

        Returns list of dicts: {quarter, assessed, green, amber, red, achievement_pct}
        ordered Q1 -> Q4.
        """
        quarter_data: dict[str, list] = {q: [] for q in ("Q1", "Q2", "Q3", "Q4")}
        for row in kpi_list:
            q = row.get("quarter")
            if q in quarter_data:
                quarter_data[q].append(row)

        summary = []
        for quarter in ("Q1", "Q2", "Q3", "Q4"):
            rows = quarter_data[quarter]
            assessed = len(rows)
            green = sum(1 for r in rows if r.get("traffic_light") == "green")
            amber = sum(1 for r in rows if r.get("traffic_light") == "amber")
            red = assessed - green - amber
            if assessed > 0:
                achievement_vals = [
                    float(r.get("achievement_pct", 0)) for r in rows
                    if r.get("achievement_pct") is not None
                ]
                achievement_pct = round(
                    sum(achievement_vals) / len(achievement_vals), 1
                ) if achievement_vals else 0.0
            else:
                achievement_pct = 0.0
            summary.append({
                "quarter": quarter,
                "assessed": assessed,
                "green": green,
                "amber": amber,
                "red": red,
                "achievement_pct": achievement_pct,
            })
        return summary

    def _enrich_pa_summaries(self, snapshot_pa: list[dict]) -> list[dict]:
        """Enrich snapshot PA data with rating labels for template rendering."""
        enriched = []
        for pa in snapshot_pa:
            annual_score = pa.get("annual_score")
            rating, rating_class = self._pa_rating(annual_score)
            enriched.append({
                "manager_name": pa.get("manager_id", "Unknown"),
                "role": pa.get("manager_role", ""),
                "status": pa.get("status", ""),
                "annual_score": annual_score,
                "rating": rating,
                "rating_class": rating_class,
            })
        return enriched

    def _pa_rating(self, annual_score) -> tuple[str, str]:
        """Return (rating label, CSS class) from annual_score (0-100 or None)."""
        if annual_score is None:
            return ("Not Assessed", "rating-below")
        try:
            score = float(annual_score)
        except (ValueError, TypeError):
            return ("Not Assessed", "rating-below")
        if score >= 80:
            return ("Exceeds Expectations", "rating-exceeds")
        elif score >= 50:
            return ("Meets Expectations", "rating-meets")
        else:
            return ("Below Expectations", "rating-below")

    async def _query_live_pa_summaries(
        self,
        financial_year: str,
        db: AsyncSession,
    ) -> list[dict]:
        """Query live PA data and return enriched summary list."""
        pa_result = await db.execute(
            select(PerformanceAgreement).where(
                PerformanceAgreement.financial_year == financial_year
            )
        )
        pas = list(pa_result.scalars().all())
        summaries = []
        for pa in pas:
            rating, rating_class = self._pa_rating(pa.annual_score)
            summaries.append({
                "manager_name": str(pa.section57_manager_id),
                "role": pa.manager_role,
                "status": pa.status,
                "annual_score": str(pa.annual_score) if pa.annual_score is not None else None,
                "rating": rating,
                "rating_class": rating_class,
            })
        return summaries

    async def _query_live_idp_data(
        self,
        financial_year: str,
        db: AsyncSession,
    ) -> dict:
        """Query IDP cycle data for S121 template context.

        Returns:
            dict with idp_objectives (list), municipality_vision (str), municipality_mission (str)
        """
        start_year = int(financial_year.split("/")[0])
        idp_result = await db.execute(
            select(IDPCycle)
            .options(
                selectinload(IDPCycle.goals)
                .selectinload(IDPGoal.objectives)
                .selectinload(IDPObjective.sdbip_kpis)
            )
            .where(
                IDPCycle.start_year <= start_year,
                IDPCycle.end_year >= start_year,
            )
            .limit(1)
        )
        cycle = idp_result.scalar_one_or_none()

        if cycle is None:
            return {
                "idp_objectives": [],
                "municipality_vision": "",
                "municipality_mission": "",
            }

        objectives = []
        for goal in cycle.goals:
            for obj in goal.objectives:
                # Count linked KPIs via relationship (lazy-loaded, 0 if no KPIs linked)
                linked_count = len(obj.sdbip_kpis) if hasattr(obj, "sdbip_kpis") else 0
                objectives.append({
                    "title": obj.title,
                    "national_kpa": goal.national_kpa,
                    "linked_kpi_count": linked_count,
                })

        return {
            "idp_objectives": objectives,
            "municipality_vision": cycle.vision or "",
            "municipality_mission": cycle.mission or "",
        }

    # ------------------------------------------------------------------
    # Notification helpers
    # ------------------------------------------------------------------

    async def create_notification(
        self,
        user_id: UUID,
        tenant_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        db: AsyncSession,
        link: str | None = None,
    ) -> Notification:
        """Create an in-app notification for a user.

        Args:
            user_id:           Target user's UUID.
            tenant_id:         Tenant scope for the notification.
            notification_type: NotificationType enum value.
            title:             Short notification title.
            message:           Full notification body.
            db:                Async database session.
            link:              Optional deep-link URL.

        Returns:
            Created Notification.
        """
        notification = Notification(
            tenant_id=tenant_id,
            user_id=user_id,
            type=notification_type.value,
            title=title,
            message=message,
            link=link,
            is_read=False,
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        return notification
