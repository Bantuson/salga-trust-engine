"""Risk register service layer.

Provides business logic for:
- CRUD operations on RiskItem and RiskMitigation (RISK-01, RISK-02)
- Auto-flagging risk items when a KPI's actual turns red (RISK-03)
- Department-filtered risk register views for CFO/MM (RISK-04)

Key patterns:
- ID-before-commit: capture risk_item.id via flush() before commit() to avoid
  MissingGreenlet errors in SQLAlchemy async context
- Selectinload for mitigations to avoid lazy-load in async context
- AuditLog entries for auto-flagging events
"""
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Integer, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.audit_log import AuditLog, OperationType
from src.models.risk import RiskItem, RiskMitigation, RiskRating, compute_risk_rating
from src.models.user import User
from src.schemas.risk import RiskItemCreate, RiskItemUpdate, RiskMitigationCreate

logger = logging.getLogger(__name__)


class RiskService:
    """Service for risk register CRUD and auto-flagging operations."""

    async def create_risk_item(
        self, data: RiskItemCreate, user: User, db: AsyncSession
    ) -> RiskItem:
        """Create a risk item with auto-computed risk_rating from likelihood and impact.

        If data.mitigations is non-empty, creates child RiskMitigation records
        in the same transaction.

        Args:
            data: RiskItemCreate payload
            user: Authenticated user creating the risk item
            db: Async database session

        Returns:
            Created RiskItem with mitigations eagerly loaded
        """
        # Compute risk rating from ISO 31000 matrix
        rating = compute_risk_rating(data.likelihood, data.impact)

        risk_item = RiskItem(
            tenant_id=user.tenant_id,
            kpi_id=data.kpi_id,
            department_id=data.department_id,
            title=data.title,
            description=data.description,
            likelihood=data.likelihood,
            impact=data.impact,
            risk_rating=rating,
            responsible_person_id=data.responsible_person_id,
            is_auto_flagged=False,
            created_by=str(user.id),
        )
        db.add(risk_item)

        # Flush to get the PK before creating children
        # (MissingGreenlet pattern: capture id before commit)
        await db.flush()
        risk_item_id = risk_item.id

        # Create child mitigations in same transaction
        if data.mitigations:
            for mitigation_data in data.mitigations:
                mitigation = RiskMitigation(
                    tenant_id=user.tenant_id,
                    risk_item_id=risk_item_id,
                    strategy=mitigation_data.strategy,
                    responsible_person_id=mitigation_data.responsible_person_id,
                    target_date=mitigation_data.target_date,
                    status="open",
                    created_by=str(user.id),
                )
                db.add(mitigation)

        await db.commit()

        # Re-fetch with mitigations eagerly loaded (ORM expires after commit)
        result = await db.execute(
            select(RiskItem)
            .where(RiskItem.id == risk_item_id)
            .options(selectinload(RiskItem.mitigations))
        )
        return result.scalar_one()

    async def add_mitigation(
        self,
        risk_item_id: UUID,
        data: RiskMitigationCreate,
        user: User,
        db: AsyncSession,
    ) -> RiskMitigation:
        """Add a mitigation strategy to an existing risk item.

        Args:
            risk_item_id: UUID of the parent risk item
            data: RiskMitigationCreate payload
            user: Authenticated user
            db: Async database session

        Returns:
            Created RiskMitigation

        Raises:
            ValueError: If risk item not found
        """
        # Load risk item to get tenant_id
        result = await db.execute(
            select(RiskItem).where(RiskItem.id == risk_item_id)
        )
        risk_item = result.scalar_one_or_none()
        if risk_item is None:
            raise ValueError(f"RiskItem {risk_item_id} not found")

        mitigation = RiskMitigation(
            tenant_id=risk_item.tenant_id,
            risk_item_id=risk_item_id,
            strategy=data.strategy,
            responsible_person_id=data.responsible_person_id,
            target_date=data.target_date,
            status="open",
            created_by=str(user.id),
        )
        db.add(mitigation)
        await db.commit()
        await db.refresh(mitigation)
        return mitigation

    async def list_risk_items(
        self,
        tenant_id: str,
        db: AsyncSession,
        department_id: UUID | None = None,
    ) -> list[RiskItem]:
        """List risk items for a tenant, optionally filtered by department.

        Results are ordered by risk_rating severity (critical first), then
        by created_at descending.

        Args:
            tenant_id: Tenant context (municipality ID)
            db: Async database session
            department_id: Optional department filter (RISK-04)

        Returns:
            List of RiskItem with mitigations eagerly loaded
        """
        # Define ordering: critical > high > medium > low
        rating_order = case(
            (RiskItem.risk_rating == RiskRating.CRITICAL, 1),
            (RiskItem.risk_rating == RiskRating.HIGH, 2),
            (RiskItem.risk_rating == RiskRating.MEDIUM, 3),
            (RiskItem.risk_rating == RiskRating.LOW, 4),
            else_=5,
        )

        query = (
            select(RiskItem)
            .where(RiskItem.is_deleted == False)  # noqa: E712
            .options(selectinload(RiskItem.mitigations))
            .order_by(rating_order, RiskItem.created_at.desc())
        )

        if department_id is not None:
            query = query.where(RiskItem.department_id == department_id)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_risk_item(
        self, risk_item_id: UUID, db: AsyncSession
    ) -> RiskItem | None:
        """Get a single risk item with mitigations eagerly loaded.

        Args:
            risk_item_id: UUID of the risk item
            db: Async database session

        Returns:
            RiskItem with mitigations, or None if not found
        """
        result = await db.execute(
            select(RiskItem)
            .where(RiskItem.id == risk_item_id, RiskItem.is_deleted == False)  # noqa: E712
            .options(selectinload(RiskItem.mitigations))
        )
        return result.scalar_one_or_none()

    async def update_risk_item(
        self,
        risk_item_id: UUID,
        data: RiskItemUpdate,
        user: User,
        db: AsyncSession,
    ) -> RiskItem:
        """Update a risk item, recomputing risk_rating if likelihood/impact changed.

        Manual edit clears is_auto_flagged (CFO override of auto-flag).

        Args:
            risk_item_id: UUID of the risk item to update
            data: RiskItemUpdate payload (partial)
            user: Authenticated user
            db: Async database session

        Returns:
            Updated RiskItem with mitigations eagerly loaded

        Raises:
            ValueError: If risk item not found
        """
        result = await db.execute(
            select(RiskItem)
            .where(RiskItem.id == risk_item_id, RiskItem.is_deleted == False)  # noqa: E712
            .options(selectinload(RiskItem.mitigations))
        )
        risk_item = result.scalar_one_or_none()
        if risk_item is None:
            raise ValueError(f"RiskItem {risk_item_id} not found")

        # Apply non-None fields
        if data.title is not None:
            risk_item.title = data.title
        if data.description is not None:
            risk_item.description = data.description
        if data.responsible_person_id is not None:
            risk_item.responsible_person_id = data.responsible_person_id

        # Recompute risk_rating if likelihood or impact changed
        likelihood_changed = data.likelihood is not None
        impact_changed = data.impact is not None
        if likelihood_changed:
            risk_item.likelihood = data.likelihood
        if impact_changed:
            risk_item.impact = data.impact
        if likelihood_changed or impact_changed:
            risk_item.risk_rating = compute_risk_rating(risk_item.likelihood, risk_item.impact)

        # Manual edit clears auto-flag (CFO override)
        risk_item.is_auto_flagged = False
        risk_item.updated_by = str(user.id)

        await db.commit()

        # Re-fetch with mitigations (ORM expires after commit)
        result = await db.execute(
            select(RiskItem)
            .where(RiskItem.id == risk_item_id)
            .options(selectinload(RiskItem.mitigations))
        )
        return result.scalar_one()

    async def delete_risk_item(
        self, risk_item_id: UUID, db: AsyncSession
    ) -> None:
        """Soft-delete a risk item by setting is_deleted=True.

        Args:
            risk_item_id: UUID of the risk item to delete
            db: Async database session

        Raises:
            ValueError: If risk item not found
        """
        result = await db.execute(
            select(RiskItem).where(RiskItem.id == risk_item_id)
        )
        risk_item = result.scalar_one_or_none()
        if risk_item is None:
            raise ValueError(f"RiskItem {risk_item_id} not found")

        risk_item.is_deleted = True
        await db.commit()

    async def auto_flag_for_kpi(
        self, kpi_id: UUID, tenant_id: str, db: AsyncSession
    ) -> int:
        """Auto-flag risk items linked to a KPI that has turned red (RISK-03).

        Sets risk_rating="high" and is_auto_flagged=True on all linked risk items
        unless they are already rated "critical" (critical items are not downgraded
        by auto-flagging).

        Creates an AuditLog entry for each flagged item.

        Args:
            kpi_id: UUID of the SDBIP KPI that produced a red actual
            tenant_id: Tenant context
            db: Async database session

        Returns:
            Count of risk items that were flagged (0 if none or all are critical)
        """
        # Query all non-deleted, non-critical risk items for this KPI
        result = await db.execute(
            select(RiskItem).where(
                RiskItem.kpi_id == kpi_id,
                RiskItem.is_deleted == False,  # noqa: E712
                RiskItem.risk_rating != RiskRating.CRITICAL,  # Do not overwrite critical
            )
        )
        items = list(result.scalars().all())

        if not items:
            return 0

        now = datetime.now(timezone.utc)
        flagged_count = 0

        for item in items:
            item.risk_rating = RiskRating.HIGH
            item.is_auto_flagged = True
            item.auto_flagged_at = now
            flagged_count += 1

            # Create audit log entry for each auto-flagged item
            audit_entry = AuditLog(
                tenant_id=tenant_id,
                user_id=None,  # System action
                operation=OperationType.UPDATE,
                table_name="risk_items",
                record_id=str(item.id),
                changes=json.dumps(
                    {
                        "action": "auto_flagged_red_kpi",
                        "kpi_id": str(kpi_id),
                        "previous_rating": str(item.risk_rating),
                        "new_rating": RiskRating.HIGH,
                    }
                ),
            )
            db.add(audit_entry)

        await db.commit()
        logger.info(
            "Auto-flagged %d risk items for KPI %s (tenant=%s)",
            flagged_count,
            kpi_id,
            tenant_id,
        )
        return flagged_count

    async def get_risk_register_summary(
        self,
        tenant_id: str,
        db: AsyncSession,
        department_id: UUID | None = None,
    ) -> dict:
        """Aggregate risk register counts by rating and auto-flag status.

        Args:
            tenant_id: Tenant context
            db: Async database session
            department_id: Optional department filter

        Returns:
            Dict matching RiskRegisterSummary schema keys
        """
        query = select(
            func.count(RiskItem.id).label("total"),
            func.sum(
                func.cast(RiskItem.risk_rating == RiskRating.CRITICAL, Integer)
            ).label("critical"),
            func.sum(
                func.cast(RiskItem.risk_rating == RiskRating.HIGH, Integer)
            ).label("high"),
            func.sum(
                func.cast(RiskItem.risk_rating == RiskRating.MEDIUM, Integer)
            ).label("medium"),
            func.sum(
                func.cast(RiskItem.risk_rating == RiskRating.LOW, Integer)
            ).label("low"),
            func.sum(
                func.cast(RiskItem.is_auto_flagged == True, Integer)  # noqa: E712
            ).label("auto_flagged"),
        ).where(RiskItem.is_deleted == False)  # noqa: E712

        if department_id is not None:
            query = query.where(RiskItem.department_id == department_id)

        result = await db.execute(query)
        row = result.one()

        return {
            "total": row.total or 0,
            "critical": row.critical or 0,
            "high": row.high or 0,
            "medium": row.medium or 0,
            "low": row.low or 0,
            "auto_flagged": row.auto_flagged or 0,
        }
