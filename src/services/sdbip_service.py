"""SDBIP (Service Delivery and Budget Implementation Plan) service layer.

Provides CRUD operations for the SDBIP hierarchy:
    SDBIPScorecard -> SDBIPKpi -> SDBIPQuarterlyTarget

Key responsibilities:
- Scorecard creation (top-layer vs departmental validation)
- KPI creation with mSCOA code and IDP objective FK validation
- Quarterly target upsert (delete-then-insert to enforce exactly 4 per KPI)
- mSCOA reference search (segment filter + description ilike)

The mSCOA reference table is a NonTenantModel — queries bypass the
do_orm_execute tenant filter (no tenant_id column). This is intentional:
mSCOA codes are global National Treasury reference data.
"""
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.idp import IDPObjective
from src.models.mscoa_reference import MscoaReference
from src.models.sdbip import (
    Quarter,
    SDBIPKpi,
    SDBIPLayer,
    SDBIPQuarterlyTarget,
    SDBIPScorecard,
    SDBIPStatus,
)
from src.models.user import User
from src.schemas.sdbip import (
    QuarterlyTargetBulkCreate,
    SDBIPKpiCreate,
    SDBIPScorecardCreate,
)

logger = logging.getLogger(__name__)


class SDBIPService:
    """Service class for SDBIP scorecard, KPI, and quarterly target CRUD."""

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
