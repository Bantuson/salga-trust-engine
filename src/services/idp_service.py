"""IDP (Integrated Development Plan) service layer.

Provides CRUD operations and state machine transitions for the IDP hierarchy:
    IDPCycle -> IDPGoal -> IDPObjective

The golden thread method returns the full nested structure for a cycle,
including goals and objectives (KPIs will be populated in Wave 3+ when
SDBIP models are linked).
"""
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from statemachine.exceptions import TransitionNotAllowed

from src.models.idp import (
    IDPCycle,
    IDPGoal,
    IDPObjective,
    IDPStatus,
    IDPVersion,
    IDPWorkflow,
)
from src.models.user import User
from src.schemas.idp import (
    IDPCycleCreate,
    IDPGoalCreate,
    IDPObjectiveCreate,
    IDPVersionCreate,
)

logger = logging.getLogger(__name__)


class IDPService:
    """Service class for IDP CRUD and state machine operations."""

    # ------------------------------------------------------------------
    # IDP Cycles
    # ------------------------------------------------------------------

    async def create_cycle(
        self,
        data: IDPCycleCreate,
        user: User,
        db: AsyncSession,
    ) -> IDPCycle:
        """Create a new IDP cycle in DRAFT status.

        Args:
            data:  Validated IDPCycleCreate payload.
            user:  Authenticated requesting user (must be Tier 3+).
            db:    Async database session.

        Returns:
            Newly created IDPCycle instance.
        """
        cycle = IDPCycle(
            title=data.title,
            vision=data.vision,
            mission=data.mission,
            start_year=data.start_year,
            end_year=data.end_year,
            status=IDPStatus.DRAFT,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(cycle)
        await db.commit()
        await db.refresh(cycle)
        logger.info("IDPCycle created: %s by %s", cycle.id, user.id)
        return cycle

    async def get_cycle(
        self,
        cycle_id: UUID,
        db: AsyncSession,
    ) -> IDPCycle | None:
        """Fetch a single IDP cycle by ID.

        Returns None if not found (callers should raise 404 as needed).
        """
        result = await db.execute(
            select(IDPCycle).where(IDPCycle.id == cycle_id)
        )
        return result.scalar_one_or_none()

    async def list_cycles(self, db: AsyncSession) -> list[IDPCycle]:
        """Return all IDP cycles for the current tenant (filtered by RLS)."""
        result = await db.execute(select(IDPCycle))
        return list(result.scalars().all())

    async def transition_cycle(
        self,
        cycle_id: UUID,
        event: str,
        user: User,
        db: AsyncSession,
    ) -> IDPCycle:
        """Apply a state machine transition to an IDP cycle.

        Valid events: "submit", "open_review", "re_approve"

        Args:
            cycle_id: UUID of the cycle to transition.
            event:    Event name to send to the state machine.
            user:     Requesting user (for audit trail).
            db:       Async database session.

        Returns:
            Updated IDPCycle with new status.

        Raises:
            HTTPException 404: Cycle not found.
            HTTPException 409: Transition not allowed in current state.
        """
        cycle = await self.get_cycle(cycle_id, db)
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IDP cycle {cycle_id} not found",
            )

        try:
            machine = IDPWorkflow(
                model=cycle,
                state_field="status",
                start_value=cycle.status,
            )
            machine.send(event)
        except TransitionNotAllowed as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid state transition: {exc}",
            ) from exc
        except Exception as exc:
            # Catch unknown events (e.g. typo in event name)
            logger.warning("IDPWorkflow error for cycle %s event=%s: %s", cycle_id, event, exc)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid transition event '{event}': {exc}",
            ) from exc

        cycle.updated_by = str(user.id)
        await db.commit()
        await db.refresh(cycle)
        logger.info(
            "IDPCycle %s transitioned via '%s' to '%s' by %s",
            cycle_id, event, cycle.status, user.id,
        )
        return cycle

    # ------------------------------------------------------------------
    # IDP Goals
    # ------------------------------------------------------------------

    async def add_goal(
        self,
        cycle_id: UUID,
        data: IDPGoalCreate,
        user: User,
        db: AsyncSession,
    ) -> IDPGoal:
        """Add a strategic goal to an IDP cycle.

        Args:
            cycle_id: UUID of the parent IDP cycle.
            data:     Validated IDPGoalCreate payload.
            user:     Requesting user.
            db:       Async database session.

        Returns:
            Newly created IDPGoal.

        Raises:
            HTTPException 404: Parent cycle not found.
        """
        cycle = await self.get_cycle(cycle_id, db)
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IDP cycle {cycle_id} not found",
            )

        goal = IDPGoal(
            cycle_id=cycle_id,
            title=data.title,
            description=data.description,
            national_kpa=data.national_kpa.value,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        return goal

    async def list_goals(
        self,
        cycle_id: UUID,
        db: AsyncSession,
    ) -> list[IDPGoal]:
        """List all goals for an IDP cycle."""
        result = await db.execute(
            select(IDPGoal).where(IDPGoal.cycle_id == cycle_id)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # IDP Objectives
    # ------------------------------------------------------------------

    async def add_objective(
        self,
        goal_id: UUID,
        data: IDPObjectiveCreate,
        user: User,
        db: AsyncSession,
    ) -> IDPObjective:
        """Add an objective under an IDP strategic goal.

        Args:
            goal_id: UUID of the parent IDP goal.
            data:    Validated IDPObjectiveCreate payload.
            user:    Requesting user.
            db:      Async database session.

        Returns:
            Newly created IDPObjective.

        Raises:
            HTTPException 404: Parent goal not found.
        """
        result = await db.execute(select(IDPGoal).where(IDPGoal.id == goal_id))
        goal = result.scalar_one_or_none()
        if goal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IDP goal {goal_id} not found",
            )

        objective = IDPObjective(
            goal_id=goal_id,
            title=data.title,
            description=data.description,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(objective)
        await db.commit()
        await db.refresh(objective)
        return objective

    async def list_objectives(
        self,
        goal_id: UUID,
        db: AsyncSession,
    ) -> list[IDPObjective]:
        """List all objectives for an IDP goal."""
        result = await db.execute(
            select(IDPObjective).where(IDPObjective.goal_id == goal_id)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # IDP Versions
    # ------------------------------------------------------------------

    async def create_version(
        self,
        cycle_id: UUID,
        data: IDPVersionCreate,
        user: User,
        db: AsyncSession,
    ) -> IDPVersion:
        """Create an annual review version for an IDP cycle.

        Args:
            cycle_id: UUID of the parent IDP cycle.
            data:     Validated IDPVersionCreate payload.
            user:     Requesting user.
            db:       Async database session.

        Returns:
            Newly created IDPVersion.

        Raises:
            HTTPException 404: Parent cycle not found.
            HTTPException 409: version_number already exists for this cycle.
        """
        cycle = await self.get_cycle(cycle_id, db)
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IDP cycle {cycle_id} not found",
            )

        version = IDPVersion(
            cycle_id=cycle_id,
            version_number=data.version_number,
            financial_year=data.financial_year,
            notes=data.notes,
            tenant_id=user.tenant_id,
            created_by=str(user.id),
        )
        db.add(version)
        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()
            if "uq_idp_version_cycle" in str(exc) or "UNIQUE constraint" in str(exc):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Version {data.version_number} already exists for cycle {cycle_id}",
                ) from exc
            raise
        await db.refresh(version)
        return version

    async def list_versions(
        self,
        cycle_id: UUID,
        db: AsyncSession,
    ) -> list[IDPVersion]:
        """List all versions for an IDP cycle."""
        result = await db.execute(
            select(IDPVersion).where(IDPVersion.cycle_id == cycle_id)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Golden Thread
    # ------------------------------------------------------------------

    async def get_golden_thread(
        self,
        cycle_id: UUID,
        db: AsyncSession,
    ) -> dict:
        """Return full IDP -> Goal -> Objective -> KPI nested structure.

        The "golden thread" represents the statutory traceability chain from
        high-level IDP strategy down to measurable SDBIP KPIs.

        Uses selectinload for eager loading to avoid N+1 queries.

        Args:
            cycle_id: UUID of the IDP cycle to fetch.
            db:       Async database session.

        Returns:
            Dict with keys: id, title, status, goals (nested with objectives and KPIs).

        Raises:
            HTTPException 404: Cycle not found.
        """
        from src.models.sdbip import SDBIPKpi  # local import to avoid circular dependency at module level
        result = await db.execute(
            select(IDPCycle)
            .where(IDPCycle.id == cycle_id)
            .options(
                selectinload(IDPCycle.goals)
                .selectinload(IDPGoal.objectives)
                .selectinload(IDPObjective.sdbip_kpis)
            )
        )
        cycle = result.scalar_one_or_none()
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IDP cycle {cycle_id} not found",
            )

        return {
            "id": str(cycle.id),
            "title": cycle.title,
            "status": cycle.status,
            "goals": [
                {
                    "id": str(goal.id),
                    "title": goal.title,
                    "national_kpa": goal.national_kpa,
                    "objectives": [
                        {
                            "id": str(obj.id),
                            "title": obj.title,
                            "kpis": [
                                {
                                    "id": str(kpi.id),
                                    "kpi_number": kpi.kpi_number,
                                    "description": kpi.description,
                                    "unit_of_measurement": kpi.unit_of_measurement,
                                    "annual_target": str(kpi.annual_target),
                                }
                                for kpi in (obj.sdbip_kpis or [])
                            ],
                        }
                        for obj in goal.objectives
                    ],
                }
                for goal in cycle.goals
            ],
        }
