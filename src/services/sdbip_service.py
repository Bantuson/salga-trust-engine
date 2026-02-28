"""SDBIP (Service Delivery and Budget Implementation Plan) service layer.

Provides CRUD operations for the SDBIP hierarchy:
    SDBIPScorecard -> SDBIPKpi -> SDBIPQuarterlyTarget -> SDBIPActual

Key responsibilities:
- Scorecard creation (top-layer vs departmental validation)
- KPI creation with mSCOA code and IDP objective FK validation
- Quarterly target upsert (delete-then-insert to enforce exactly 4 per KPI)
- SDBIP approval state machine transitions (draft -> approved -> revised)
- Mid-year target adjustment (SDBIP-09: update targets without draft reset)
- Quarterly actuals submission with auto-computed achievement and traffic light
- Correction records for validated actuals (immutability chain)
- mSCOA reference search (segment filter + description ilike)

The mSCOA reference table is a NonTenantModel — queries bypass the
do_orm_execute tenant filter (no tenant_id column). This is intentional:
mSCOA codes are global National Treasury reference data.
"""
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from statemachine.exceptions import TransitionNotAllowed

from src.models.audit_log import AuditLog, OperationType
from src.models.idp import IDPObjective
from src.models.mscoa_reference import MscoaReference
from src.models.sdbip import (
    Quarter,
    SDBIPActual,
    SDBIPKpi,
    SDBIPLayer,
    SDBIPQuarterlyTarget,
    SDBIPScorecard,
    SDBIPStatus,
    SDBIPWorkflow,
    compute_achievement,
)
from src.models.user import User, UserRole
from src.schemas.sdbip import (
    QuarterlyTargetBulkCreate,
    SDBIPActualCorrectionCreate,
    SDBIPActualCreate,
    SDBIPKpiCreate,
    SDBIPScorecardCreate,
)

logger = logging.getLogger(__name__)


class SDBIPService:
    """Service class for SDBIP scorecard, KPI, quarterly target, and actuals CRUD."""

    # ------------------------------------------------------------------
    # Scorecards
    # ------------------------------------------------------------------

    async def create_scorecard(
        self,
        data: SDBIPScorecardCreate,
        user: User,
        db: AsyncSession,
    ) -> SDBIPScorecard:
        """Create a new SDBIP scorecard in DRAFT status.

        Args:
            data: Validated SDBIPScorecardCreate payload.
            user: Authenticated requesting user.
            db:   Async database session.

        Returns:
            Newly created SDBIPScorecard.

        Raises:
            HTTPException 422: departmental scorecard missing department_id.
        """
        layer = SDBIPLayer(data.layer)

        # Business rule: departmental scorecards require department_id
        if layer == SDBIPLayer.DEPARTMENTAL and data.department_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="department_id is required for departmental SDBIP scorecards",
            )

        # Business rule: top-layer scorecards must not have a department
        if layer == SDBIPLayer.TOP:
            department_id = None
        else:
            department_id = data.department_id

        scorecard = SDBIPScorecard(
            financial_year=data.financial_year,
            layer=layer.value,
            department_id=department_id,
            title=data.title,
            status=SDBIPStatus.DRAFT,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(scorecard)
        await db.commit()
        await db.refresh(scorecard)
        logger.info("SDBIPScorecard created: %s by %s", scorecard.id, user.id)
        return scorecard

    async def get_scorecard(
        self,
        scorecard_id: UUID,
        db: AsyncSession,
    ) -> SDBIPScorecard | None:
        """Fetch a single SDBIP scorecard by ID.

        Returns None if not found (callers should raise 404 as needed).
        """
        result = await db.execute(
            select(SDBIPScorecard).where(SDBIPScorecard.id == scorecard_id)
        )
        return result.scalar_one_or_none()

    async def list_scorecards(
        self,
        financial_year: str | None,
        db: AsyncSession,
    ) -> list[SDBIPScorecard]:
        """List SDBIP scorecards for the current tenant, optionally filtered by financial year.

        Args:
            financial_year: Optional YYYY/YY filter (e.g., "2025/26").
            db:             Async database session.

        Returns:
            List of matching SDBIPScorecard instances.
        """
        stmt = select(SDBIPScorecard)
        if financial_year is not None:
            stmt = stmt.where(SDBIPScorecard.financial_year == financial_year)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def transition_scorecard(
        self,
        scorecard_id: UUID,
        event: str,
        user: User,
        db: AsyncSession,
    ) -> SDBIPScorecard:
        """Apply a state machine transition to an SDBIP scorecard.

        Valid events: "submit", "revise", "resubmit"

        The "submit" event (draft -> approved) requires the Executive Mayor role.
        Admin and salga_admin bypass this restriction.

        Args:
            scorecard_id: UUID of the scorecard to transition.
            event:        Event name to send to the state machine.
            user:         Requesting user (for role check + audit trail).
            db:           Async database session.

        Returns:
            Updated SDBIPScorecard with new status.

        Raises:
            HTTPException 404: Scorecard not found.
            HTTPException 403: Non-Mayor user attempted 'submit'.
            HTTPException 409: Transition not allowed in current state.
        """
        scorecard = await self.get_scorecard(scorecard_id, db)
        if scorecard is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SDBIP scorecard {scorecard_id} not found",
            )

        # Mayor sign-off gate: only executive_mayor, admin, or salga_admin
        # may submit a scorecard for approval.
        _mayor_roles = {
            UserRole.EXECUTIVE_MAYOR,
            UserRole.ADMIN,
            UserRole.SALGA_ADMIN,
        }
        if event == "submit" and user.role not in _mayor_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mayor sign-off required for SDBIP approval",
            )

        try:
            machine = SDBIPWorkflow(
                model=scorecard,
                state_field="status",
                start_value=scorecard.status,
            )
            machine.send(event)
        except TransitionNotAllowed as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot '{event}' from status '{scorecard.status}'",
            ) from exc
        except Exception as exc:
            logger.warning(
                "SDBIPWorkflow error for scorecard %s event=%s: %s",
                scorecard_id, event, exc,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid transition event '{event}': {exc}",
            ) from exc

        scorecard.updated_by = str(user.id)
        await db.commit()
        await db.refresh(scorecard)
        logger.info(
            "SDBIPScorecard %s transitioned via '%s' to '%s' by %s",
            scorecard_id, event, scorecard.status, user.id,
        )
        return scorecard

    async def adjust_targets(
        self,
        kpi_id: UUID,
        targets: QuarterlyTargetBulkCreate,
        user: User,
        db: AsyncSession,
    ) -> list[SDBIPQuarterlyTarget]:
        """Mid-year target adjustment (SDBIP-09).

        Updates quarterly targets for a KPI on an APPROVED scorecard without
        resetting the scorecard back to draft status. Creates an audit log entry
        with the old and new target values.

        Args:
            kpi_id:  UUID of the KPI whose targets are being adjusted.
            targets: Validated QuarterlyTargetBulkCreate (exactly 4 quarters).
            user:    Requesting user (Tier 2+ enforced at API layer).
            db:      Async database session.

        Returns:
            List of 4 newly created SDBIPQuarterlyTarget instances.

        Raises:
            HTTPException 404: KPI not found.
            HTTPException 422: Scorecard is not in 'approved' status.
        """
        kpi = await self.get_kpi(kpi_id, db)
        if kpi is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SDBIP KPI {kpi_id} not found",
            )

        scorecard = await self.get_scorecard(kpi.scorecard_id, db)
        if scorecard is None or scorecard.status != SDBIPStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Mid-year adjustments only allowed on approved SDBIPs",
            )

        # Capture old targets for audit log
        old_targets_result = await db.execute(
            select(SDBIPQuarterlyTarget)
            .where(SDBIPQuarterlyTarget.kpi_id == kpi_id)
            .order_by(SDBIPQuarterlyTarget.quarter)
        )
        old_targets = [
            {"quarter": t.quarter, "target_value": str(t.target_value)}
            for t in old_targets_result.scalars().all()
        ]

        # Delete existing quarterly targets (upsert pattern)
        await db.execute(
            delete(SDBIPQuarterlyTarget).where(SDBIPQuarterlyTarget.kpi_id == kpi_id)
        )

        # Insert new targets
        new_target_objs = []
        for target_data in targets.targets:
            target = SDBIPQuarterlyTarget(
                kpi_id=kpi_id,
                quarter=target_data.quarter.value,
                target_value=target_data.target_value,
                tenant_id=kpi.tenant_id,
                created_by=str(user.id),
            )
            db.add(target)
            new_target_objs.append(target)

        # Scorecard status MUST remain 'approved' — SDBIP-09 requirement
        # (do NOT change scorecard.status here)

        # Audit log entry for mid-year adjustment (POPIA-compliant)
        new_targets_data = [
            {"quarter": t.quarter.value, "target_value": str(t.target_value)}
            for t in targets.targets
        ]
        audit_entry = AuditLog(
            tenant_id=str(kpi.tenant_id),
            user_id=str(user.id),
            operation=OperationType.UPDATE,
            table_name="sdbip_quarterly_targets",
            record_id=str(kpi_id),
            changes=json.dumps({
                "action": "midyear_adjustment",
                "old_targets": old_targets,
                "new_targets": new_targets_data,
            }),
        )
        db.add(audit_entry)

        await db.commit()
        for t in new_target_objs:
            await db.refresh(t)

        logger.info(
            "Mid-year target adjustment for kpi=%s by %s; scorecard status unchanged",
            kpi_id, user.id,
        )
        return new_target_objs

    # ------------------------------------------------------------------
    # KPIs
    # ------------------------------------------------------------------

    async def create_kpi(
        self,
        scorecard_id: UUID,
        data: SDBIPKpiCreate,
        user: User,
        db: AsyncSession,
    ) -> SDBIPKpi:
        """Create a KPI within an SDBIP scorecard.

        Validates:
        - Scorecard exists and belongs to tenant
        - mSCOA code FK exists (if provided)
        - IDP objective FK exists (if provided)

        Args:
            scorecard_id: UUID of the parent SDBIP scorecard.
            data:         Validated SDBIPKpiCreate payload.
            user:         Requesting user.
            db:           Async database session.

        Returns:
            Newly created SDBIPKpi.

        Raises:
            HTTPException 404: Scorecard not found.
            HTTPException 422: Invalid mSCOA code ID or IDP objective ID.
        """
        scorecard = await self.get_scorecard(scorecard_id, db)
        if scorecard is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SDBIP scorecard {scorecard_id} not found",
            )

        # Validate mSCOA code FK (NonTenantModel — no tenant filter)
        if data.mscoa_code_id is not None:
            mscoa_result = await db.execute(
                select(MscoaReference).where(MscoaReference.id == data.mscoa_code_id)
            )
            if mscoa_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid mSCOA code: {data.mscoa_code_id} not found in mscoa_reference",
                )

        # Validate IDP objective FK (TenantAwareModel — tenant filter applied automatically)
        if data.idp_objective_id is not None:
            objective_result = await db.execute(
                select(IDPObjective).where(IDPObjective.id == data.idp_objective_id)
            )
            if objective_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"IDP objective {data.idp_objective_id} not found",
                )

        kpi = SDBIPKpi(
            scorecard_id=scorecard_id,
            idp_objective_id=data.idp_objective_id,
            department_id=data.department_id,
            mscoa_code_id=data.mscoa_code_id,
            responsible_director_id=data.responsible_director_id,
            kpi_number=data.kpi_number,
            description=data.description,
            unit_of_measurement=data.unit_of_measurement,
            baseline=data.baseline,
            annual_target=data.annual_target,
            weight=data.weight,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(kpi)
        await db.commit()
        await db.refresh(kpi)
        logger.info("SDBIPKpi created: %s (%s) by %s", kpi.id, kpi.kpi_number, user.id)
        return kpi

    async def list_kpis(
        self,
        scorecard_id: UUID,
        db: AsyncSession,
    ) -> list[SDBIPKpi]:
        """List all KPIs for an SDBIP scorecard."""
        result = await db.execute(
            select(SDBIPKpi).where(SDBIPKpi.scorecard_id == scorecard_id)
        )
        return list(result.scalars().all())

    async def get_kpi(
        self,
        kpi_id: UUID,
        db: AsyncSession,
    ) -> SDBIPKpi | None:
        """Fetch a single SDBIP KPI by ID.

        Returns None if not found (callers should raise 404 as needed).
        """
        result = await db.execute(
            select(SDBIPKpi).where(SDBIPKpi.id == kpi_id)
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Quarterly Targets
    # ------------------------------------------------------------------

    async def set_quarterly_targets(
        self,
        kpi_id: UUID,
        data: QuarterlyTargetBulkCreate,
        user: User,
        db: AsyncSession,
    ) -> list[SDBIPQuarterlyTarget]:
        """Set all 4 quarterly targets for a KPI (upsert pattern: delete + insert).

        Deletes any existing quarterly targets for the KPI, then inserts all 4 new ones.
        This guarantees exactly one target per quarter at all times.

        Args:
            kpi_id: UUID of the parent SDBIP KPI.
            data:   Validated QuarterlyTargetBulkCreate (exactly 4 quarters required).
            user:   Requesting user.
            db:     Async database session.

        Returns:
            List of 4 newly created SDBIPQuarterlyTarget instances.

        Raises:
            HTTPException 404: KPI not found.
        """
        kpi = await self.get_kpi(kpi_id, db)
        if kpi is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SDBIP KPI {kpi_id} not found",
            )

        # Delete existing quarterly targets (upsert pattern)
        await db.execute(
            delete(SDBIPQuarterlyTarget).where(SDBIPQuarterlyTarget.kpi_id == kpi_id)
        )

        # Insert all 4 new targets
        targets = []
        for target_data in data.targets:
            target = SDBIPQuarterlyTarget(
                kpi_id=kpi_id,
                quarter=target_data.quarter.value,
                target_value=target_data.target_value,
                tenant_id=kpi.tenant_id,
                created_by=str(user.id),
            )
            db.add(target)
            targets.append(target)

        await db.commit()
        for t in targets:
            await db.refresh(t)

        logger.info(
            "SDBIPQuarterlyTargets set for kpi=%s (4 quarters) by %s", kpi_id, user.id
        )
        return targets

    async def get_quarterly_targets(
        self,
        kpi_id: UUID,
        db: AsyncSession,
    ) -> list[SDBIPQuarterlyTarget]:
        """Get all quarterly targets for a KPI, ordered by quarter."""
        result = await db.execute(
            select(SDBIPQuarterlyTarget)
            .where(SDBIPQuarterlyTarget.kpi_id == kpi_id)
            .order_by(SDBIPQuarterlyTarget.quarter)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Quarterly Actuals
    # ------------------------------------------------------------------

    async def submit_actual(
        self,
        data: SDBIPActualCreate,
        user: User,
        db: AsyncSession,
    ) -> SDBIPActual:
        """Submit a quarterly actual performance value for a KPI.

        Automatically computes achievement percentage and traffic-light status
        based on the quarterly target for the specified KPI and quarter.

        Args:
            data: Validated SDBIPActualCreate payload.
            user: Authenticated director/manager submitting the actual.
            db:   Async database session.

        Returns:
            Newly created SDBIPActual with computed achievement_pct and traffic_light_status.

        Raises:
            HTTPException 404: KPI not found.
            HTTPException 422: No quarterly target set for the specified quarter.
        """
        # Load KPI — validates it belongs to the tenant (TenantAwareModel filter)
        kpi = await self.get_kpi(data.kpi_id, db)
        if kpi is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SDBIP KPI {data.kpi_id} not found",
            )

        # Load quarterly target for this KPI and quarter
        target_result = await db.execute(
            select(SDBIPQuarterlyTarget).where(
                SDBIPQuarterlyTarget.kpi_id == data.kpi_id,
                SDBIPQuarterlyTarget.quarter == data.quarter.value,
            )
        )
        target = target_result.scalar_one_or_none()
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No quarterly target set for {data.quarter.value}",
            )

        # Compute achievement percentage and traffic-light status
        pct, traffic = compute_achievement(data.actual_value, target.target_value)

        actual = SDBIPActual(
            kpi_id=data.kpi_id,
            quarter=data.quarter.value,
            financial_year=data.financial_year,
            actual_value=data.actual_value,
            achievement_pct=pct,
            traffic_light_status=traffic,
            submitted_by=str(user.id),
            submitted_at=datetime.now(timezone.utc),
            is_validated=False,
            is_auto_populated=False,
            tenant_id=kpi.tenant_id,
            created_by=str(user.id),
        )
        db.add(actual)
        await db.commit()
        await db.refresh(actual)
        logger.info(
            "SDBIPActual submitted: kpi=%s %s/%s actual=%s pct=%s [%s] by %s",
            data.kpi_id, data.quarter, data.financial_year,
            data.actual_value, pct, traffic, user.id,
        )
        return actual

    async def get_actual(
        self,
        actual_id: UUID,
        db: AsyncSession,
    ) -> SDBIPActual | None:
        """Fetch a single SDBIPActual by ID.

        Returns None if not found (callers should raise 404 as needed).
        """
        result = await db.execute(
            select(SDBIPActual).where(SDBIPActual.id == actual_id)
        )
        return result.scalar_one_or_none()

    async def list_actuals(
        self,
        kpi_id: UUID,
        db: AsyncSession,
    ) -> list[SDBIPActual]:
        """Return all actuals for a KPI ordered by quarter.

        Args:
            kpi_id: UUID of the parent SDBIP KPI.
            db:     Async database session.

        Returns:
            List of SDBIPActual instances for the KPI, ordered by quarter ascending.
        """
        result = await db.execute(
            select(SDBIPActual)
            .where(SDBIPActual.kpi_id == kpi_id)
            .order_by(SDBIPActual.quarter)
        )
        return list(result.scalars().all())

    async def submit_correction(
        self,
        actual_id: UUID,
        data: SDBIPActualCorrectionCreate,
        user: User,
        db: AsyncSession,
    ) -> SDBIPActual:
        """Submit a correction for a validated (immutable) actual.

        Creates a new SDBIPActual record with corrects_actual_id pointing to the
        original. The original validated record is NOT modified — it remains
        permanently immutable as part of the audit chain.

        Args:
            actual_id: UUID of the original validated actual to correct.
            data:      Validated SDBIPActualCorrectionCreate payload (new value + reason).
            user:      Authenticated user submitting the correction.
            db:        Async database session.

        Returns:
            Newly created correction SDBIPActual (is_validated=False initially).

        Raises:
            HTTPException 404: Original actual not found.
            HTTPException 422: Original actual is not validated (use update instead).
        """
        # Load original actual
        original = await self.get_actual(actual_id, db)
        if original is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SDBIPActual {actual_id} not found",
            )

        # Corrections only allowed on validated actuals
        if not original.is_validated:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only validated actuals require corrections — update the original instead",
            )

        # Load quarterly target for computing achievement on the correction
        target_result = await db.execute(
            select(SDBIPQuarterlyTarget).where(
                SDBIPQuarterlyTarget.kpi_id == original.kpi_id,
                SDBIPQuarterlyTarget.quarter == original.quarter,
            )
        )
        target = target_result.scalar_one_or_none()
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No quarterly target found for KPI {original.kpi_id} {original.quarter}",
            )

        # Compute achievement for the corrected value
        pct, traffic = compute_achievement(data.actual_value, target.target_value)

        correction = SDBIPActual(
            kpi_id=original.kpi_id,
            quarter=original.quarter,
            financial_year=original.financial_year,
            actual_value=data.actual_value,
            achievement_pct=pct,
            traffic_light_status=traffic,
            submitted_by=str(user.id),
            submitted_at=datetime.now(timezone.utc),
            is_validated=False,
            is_auto_populated=False,
            corrects_actual_id=original.id,
            source_query_ref=f"Correction: {data.reason}",
            tenant_id=original.tenant_id,
            created_by=str(user.id),
        )
        db.add(correction)
        await db.commit()
        await db.refresh(correction)
        logger.info(
            "SDBIPActual correction submitted: original=%s correction=%s pct=%s [%s] by %s",
            actual_id, correction.id, pct, traffic, user.id,
        )
        return correction

    # ------------------------------------------------------------------
    # mSCOA Reference Search
    # ------------------------------------------------------------------

    async def search_mscoa(
        self,
        segment: str | None,
        q: str | None,
        db: AsyncSession,
    ) -> list[MscoaReference]:
        """Search mSCOA budget codes by segment and/or description keyword.

        MscoaReference is a NonTenantModel — no tenant filter applied.
        Returns up to 50 results ordered by segment then code.

        Args:
            segment: Exact segment filter (case-insensitive): IE, FX, IA, etc.
            q:       Description keyword search (case-insensitive ilike).
            db:      Async database session.

        Returns:
            List of up to 50 matching MscoaReference instances.
        """
        stmt = (
            select(MscoaReference)
            .where(MscoaReference.is_active == True)  # noqa: E712
            .order_by(MscoaReference.segment, MscoaReference.code)
            .limit(50)
        )

        if segment is not None:
            stmt = stmt.where(
                func.lower(MscoaReference.segment) == segment.lower()
            )

        if q is not None and q.strip():
            stmt = stmt.where(
                MscoaReference.description.ilike(f"%{q.strip()}%")
            )

        result = await db.execute(stmt)
        return list(result.scalars().all())
