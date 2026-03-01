"""Performance Agreement (PA) service layer.

Provides CRUD operations for the PA hierarchy:
    PerformanceAgreement -> PAKpi -> PAQuarterlyScore

Key responsibilities:
- Agreement creation (draft status, unique constraint enforcement)
- KPI creation with SDBIP FK validation and weight sum enforcement
- State machine transitions with role-gated signing (PA-06)
- Quarterly score submission
- Annual score compilation (weighted average across quarterly scores)

Design notes:
- FK validation uses SELECT then 422 (not DB FK violation) for SQLite compatibility
- Weight sum enforcement at service layer (not DB constraint) for SQLite test compatibility
- start_value= MUST always be passed to PAWorkflow to bind non-initial states
- agreement_id captured before db.commit() to avoid MissingGreenlet in async context
- selectinload(PAKpi.quarterly_scores) required for async-safe compilation (no lazy load)
"""
import logging
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.pa import (
    ManagerRole,
    PAKpi,
    PAQuarterlyScore,
    PAStatus,
    PAWorkflow,
    PerformanceAgreement,
    TransitionNotAllowed,
)
from src.models.sdbip import SDBIPKpi
from src.models.user import User, UserRole
from src.schemas.pa import PACreate, PAKpiCreate, PAScoreCreate

logger = logging.getLogger(__name__)


class PAService:
    """Service class for Performance Agreement, PA KPI, and quarterly score CRUD."""

    # ------------------------------------------------------------------
    # Performance Agreements
    # ------------------------------------------------------------------

    async def create_agreement(
        self,
        data: PACreate,
        user: User,
        db: AsyncSession,
    ) -> PerformanceAgreement:
        """Create a new Performance Agreement in DRAFT status.

        Args:
            data: Validated PACreate payload.
            user: Authenticated requesting user (PMS officer or admin).
            db:   Async database session.

        Returns:
            Newly created PerformanceAgreement in draft status.

        Raises:
            HTTPException 422: section57_manager_id not found in users table.
            HTTPException 409: Duplicate PA for same (manager, financial_year, tenant).
        """
        # Validate section57_manager_id exists in users table (SELECT then 422)
        from src.models.user import User as UserModel
        manager_result = await db.execute(
            select(UserModel).where(UserModel.id == data.section57_manager_id)
        )
        if manager_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"section57_manager_id {data.section57_manager_id} not found in users table",
            )

        agreement = PerformanceAgreement(
            financial_year=data.financial_year,
            section57_manager_id=data.section57_manager_id,
            manager_role=data.manager_role,
            status=PAStatus.DRAFT,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(agreement)
        try:
            await db.commit()
            await db.refresh(agreement)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"A Performance Agreement already exists for manager "
                    f"{data.section57_manager_id} in financial year {data.financial_year}"
                ),
            )

        logger.info(
            "PerformanceAgreement created: %s for manager=%s FY=%s by %s",
            agreement.id, data.section57_manager_id, data.financial_year, user.id,
        )
        return agreement

    async def get_agreement(
        self,
        agreement_id: UUID,
        db: AsyncSession,
    ) -> PerformanceAgreement | None:
        """Fetch a single Performance Agreement by ID.

        Returns None if not found (callers should raise 404 as needed).
        """
        result = await db.execute(
            select(PerformanceAgreement).where(PerformanceAgreement.id == agreement_id)
        )
        return result.scalar_one_or_none()

    async def list_agreements(
        self,
        financial_year: str | None,
        db: AsyncSession,
    ) -> list[PerformanceAgreement]:
        """List Performance Agreements for the current tenant.

        Args:
            financial_year: Optional YYYY/YY filter (e.g., "2025/26").
            db:             Async database session.

        Returns:
            List of matching PerformanceAgreement instances.
        """
        stmt = select(PerformanceAgreement)
        if financial_year is not None:
            stmt = stmt.where(PerformanceAgreement.financial_year == financial_year)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def transition_agreement(
        self,
        agreement_id: UUID,
        event: str,
        user: User,
        db: AsyncSession,
    ) -> PerformanceAgreement:
        """Apply a state machine transition to a Performance Agreement.

        Valid events: "sign", "open_review", "assess"

        Role-gated signing (PA-06):
        - section57_director PA: MM, admin, or salga_admin may sign
        - municipal_manager PA:  executive_mayor, admin, or salga_admin may sign

        Args:
            agreement_id: UUID of the agreement to transition.
            event:        Event name to send to the state machine.
            user:         Requesting user (for role check + audit trail).
            db:           Async database session.

        Returns:
            Updated PerformanceAgreement with new status.

        Raises:
            HTTPException 404: Agreement not found.
            HTTPException 403: Insufficient role to sign.
            HTTPException 409: Transition not allowed in current state.
        """
        agreement = await self.get_agreement(agreement_id, db)
        if agreement is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Performance Agreement {agreement_id} not found",
            )

        # PA-06: Role-gated signing
        if event == "sign":
            if agreement.manager_role == ManagerRole.SECTION57_DIRECTOR:
                allowed_roles = {
                    UserRole.MUNICIPAL_MANAGER,
                    UserRole.ADMIN,
                    UserRole.SALGA_ADMIN,
                }
                role_description = "Municipal Manager, admin, or salga_admin"
            else:  # MUNICIPAL_MANAGER
                allowed_roles = {
                    UserRole.EXECUTIVE_MAYOR,
                    UserRole.ADMIN,
                    UserRole.SALGA_ADMIN,
                }
                role_description = "Executive Mayor, admin, or salga_admin"

            if user.role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"Signing a {agreement.manager_role} Performance Agreement "
                        f"requires: {role_description}"
                    ),
                )

        # PA-04/PA-05: assess guard — require at least one quarterly score
        if event == "assess":
            scores_result = await db.execute(
                select(PAQuarterlyScore)
                .join(PAKpi, PAQuarterlyScore.pa_kpi_id == PAKpi.id)
                .where(PAKpi.agreement_id == agreement_id)
            )
            has_scores = scores_result.scalars().first() is not None
            if not has_scores:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Cannot assess: no quarterly scores submitted",
                )
            # Compile annual score before finalising state (PA-04)
            await self.compile_annual_score(agreement_id, db)
            # Re-fetch agreement after compile commit (compile calls db.commit)
            agreement = await self.get_agreement(agreement_id, db)

        # Apply state machine transition (CRITICAL: always pass start_value=)
        try:
            machine = PAWorkflow(
                model=agreement,
                state_field="status",
                start_value=agreement.status,
            )
            machine.send(event)
        except TransitionNotAllowed as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot '{event}' from status '{agreement.status}'",
            ) from exc
        except Exception as exc:
            logger.warning(
                "PAWorkflow error for agreement %s event=%s: %s",
                agreement_id, event, exc,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid transition event '{event}': {exc}",
            ) from exc

        # POPIA: set retention flag when assessed
        if event == "assess":
            agreement.popia_retention_flag = True  # POPIA

        agreement.updated_by = str(user.id)

        # Capture ID before commit to avoid MissingGreenlet in async context
        captured_id = agreement.id

        await db.commit()
        await db.refresh(agreement)

        logger.info(
            "PerformanceAgreement %s transitioned via '%s' to '%s' by %s",
            captured_id, event, agreement.status, user.id,
        )
        return agreement

    # ------------------------------------------------------------------
    # PA KPIs
    # ------------------------------------------------------------------

    async def add_kpi(
        self,
        agreement_id: UUID,
        data: PAKpiCreate,
        user: User,
        db: AsyncSession,
    ) -> PAKpi:
        """Add a KPI to a Performance Agreement.

        Validates:
        - Agreement exists (404)
        - sdbip_kpi_id exists in sdbip_kpis table (422)
        - Adding this KPI would not exceed weight sum of 100 (422)

        Args:
            agreement_id: UUID of the parent PerformanceAgreement.
            data:         Validated PAKpiCreate payload.
            user:         Requesting user.
            db:           Async database session.

        Returns:
            Newly created PAKpi.

        Raises:
            HTTPException 404: Agreement not found.
            HTTPException 422: SDBIP KPI not found or weight sum would exceed 100.
        """
        agreement = await self.get_agreement(agreement_id, db)
        if agreement is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Performance Agreement {agreement_id} not found",
            )

        # Validate sdbip_kpi_id FK exists (SELECT then 422 for SQLite compatibility)
        sdbip_result = await db.execute(
            select(SDBIPKpi).where(SDBIPKpi.id == data.sdbip_kpi_id)
        )
        if sdbip_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"SDBIP KPI {data.sdbip_kpi_id} not found in sdbip_kpis table",
            )

        # Enforce weight sum <= 100 at service layer (not DB constraint)
        existing_weight_result = await db.execute(
            select(PAKpi).where(PAKpi.agreement_id == agreement_id)
        )
        existing_kpis = list(existing_weight_result.scalars().all())
        current_weight_sum = sum(k.weight for k in existing_kpis)
        if current_weight_sum + data.weight > Decimal("100"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Adding this KPI (weight={data.weight}) would exceed the maximum "
                    f"weight sum of 100 (current sum: {current_weight_sum})"
                ),
            )

        kpi = PAKpi(
            agreement_id=agreement_id,
            sdbip_kpi_id=data.sdbip_kpi_id,
            individual_target=data.individual_target,
            weight=data.weight,
            description=data.description,
            tenant_id=agreement.tenant_id,
            created_by=str(user.id),
        )
        db.add(kpi)
        await db.commit()
        await db.refresh(kpi)

        logger.info(
            "PAKpi created: %s for agreement=%s sdbip_kpi=%s weight=%s by %s",
            kpi.id, agreement_id, data.sdbip_kpi_id, data.weight, user.id,
        )
        return kpi

    async def list_kpis(
        self,
        agreement_id: UUID,
        db: AsyncSession,
    ) -> list[PAKpi]:
        """List all KPIs for a Performance Agreement."""
        result = await db.execute(
            select(PAKpi).where(PAKpi.agreement_id == agreement_id)
        )
        return list(result.scalars().all())

    async def get_kpis_with_scores(
        self,
        agreement_id: UUID,
        db: AsyncSession,
    ) -> list[PAKpi]:
        """Return KPIs for a Performance Agreement with quarterly_scores eager-loaded.

        Uses selectinload to avoid lazy-load failures in async context.
        Used by the list-kpis endpoint so the response includes nested score data.

        Args:
            agreement_id: UUID of the parent PerformanceAgreement.
            db:           Async database session.

        Returns:
            List of PAKpi instances with quarterly_scores populated.
        """
        result = await db.execute(
            select(PAKpi)
            .where(PAKpi.agreement_id == agreement_id)
            .options(selectinload(PAKpi.quarterly_scores))
        )
        return list(result.scalars().all())

    async def compile_annual_score(
        self,
        agreement_id: UUID,
        db: AsyncSession,
    ) -> Decimal:
        """Compile the annual assessment score from quarterly scores and KPI weights.

        Algorithm (PA-04):
            For each PAKpi with at least one quarterly score:
                avg_score = sum(quarter_scores) / count(quarter_scores)
            weighted_total = sum(avg_score * kpi.weight)
            annual_score = weighted_total / sum(kpi.weight)

        All arithmetic uses Decimal (not float) to match compute_achievement() in sdbip.py.
        Returns Decimal("0") on division by zero (no KPIs or all zero weight).
        Stores the result in agreement.annual_score and commits.

        Args:
            agreement_id: UUID of the PerformanceAgreement to score.
            db:           Async database session.

        Returns:
            Compiled annual score as Decimal.

        Raises:
            HTTPException 404: Agreement not found.
        """
        agreement = await self.get_agreement(agreement_id, db)
        if agreement is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Performance Agreement {agreement_id} not found",
            )

        # Fetch KPIs with scores eager-loaded (required for async context)
        kpis_result = await db.execute(
            select(PAKpi)
            .where(PAKpi.agreement_id == agreement_id)
            .options(selectinload(PAKpi.quarterly_scores))
        )
        kpis = list(kpis_result.scalars().all())

        weighted_total = Decimal("0")
        weight_sum = Decimal("0")

        for kpi in kpis:
            scores = kpi.quarterly_scores
            if not scores:
                continue  # Skip KPIs with no scores (partial compilation)
            avg_score = sum(Decimal(str(s.score)) for s in scores) / Decimal(str(len(scores)))
            weighted_total += avg_score * Decimal(str(kpi.weight))
            weight_sum += Decimal(str(kpi.weight))

        if weight_sum == Decimal("0"):
            annual_score = Decimal("0")
        else:
            annual_score = weighted_total / weight_sum

        # Capture ID before commit to avoid MissingGreenlet in async context
        captured_id = agreement.id
        agreement.annual_score = annual_score
        await db.commit()
        await db.refresh(agreement)

        logger.info(
            "PerformanceAgreement %s annual_score compiled: %s",
            captured_id, annual_score,
        )
        return annual_score

    async def get_kpi(
        self,
        kpi_id: UUID,
        db: AsyncSession,
    ) -> PAKpi | None:
        """Fetch a single PAKpi by ID.

        Returns None if not found (callers should raise 404 as needed).
        """
        result = await db.execute(
            select(PAKpi).where(PAKpi.id == kpi_id)
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # PA Quarterly Scores
    # ------------------------------------------------------------------

    async def add_score(
        self,
        pa_kpi_id: UUID,
        data: PAScoreCreate,
        user: User,
        db: AsyncSession,
    ) -> PAQuarterlyScore:
        """Submit a quarterly score for a PA KPI.

        Args:
            pa_kpi_id: UUID of the parent PAKpi.
            data:      Validated PAScoreCreate payload.
            user:      Authenticated user submitting the score.
            db:        Async database session.

        Returns:
            Newly created PAQuarterlyScore.

        Raises:
            HTTPException 404: PAKpi not found.
            HTTPException 409: Score already exists for this (pa_kpi_id, quarter).
        """
        from datetime import datetime, timezone

        kpi = await self.get_kpi(pa_kpi_id, db)
        if kpi is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PA KPI {pa_kpi_id} not found",
            )

        score = PAQuarterlyScore(
            pa_kpi_id=pa_kpi_id,
            quarter=data.quarter,
            score=data.score,
            notes=data.notes,
            scored_by=str(user.id),
            scored_at=datetime.now(timezone.utc),
            tenant_id=kpi.tenant_id,
            created_by=str(user.id),
        )
        db.add(score)
        try:
            await db.commit()
            await db.refresh(score)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"A score for PA KPI {pa_kpi_id} quarter {data.quarter} "
                    f"already exists"
                ),
            )

        logger.info(
            "PAQuarterlyScore submitted: pa_kpi=%s %s=%s by %s",
            pa_kpi_id, data.quarter, data.score, user.id,
        )
        return score

    # Alias for plan requirement naming consistency
    add_quarterly_score = add_score
