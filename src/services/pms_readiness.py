"""PMS readiness gate service.

Computes whether a municipality is ready to use Performance Management System (PMS)
features by checking three conditions:

1. Municipality settings are configured and locked (settings_locked=True)
2. All active departments have assigned directors (assigned_director_id is not None)
3. At least one PMS officer role assignment exists for the tenant

Used by:
- GET /api/v1/departments/pms-readiness  (status dashboard)
- require_pms_ready() dependency         (endpoint gate returning 403 + checklist)
"""
from dataclasses import asdict, dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db
from src.models.department import Department
from src.models.municipality import Municipality
from src.models.role_assignment import UserRoleAssignment
from src.models.user import User, UserRole


@dataclass
class PmsReadinessStatus:
    """Structured PMS readiness checklist.

    All three conditions must be True for is_ready to be True.
    The checklist is returned verbatim in 403 responses so the frontend
    can render actionable guidance to the admin.
    """

    is_ready: bool
    municipality_configured: bool          # settings_locked=True on Municipality
    all_departments_have_directors: bool   # every active dept has assigned_director_id
    pms_officer_assigned: bool             # at least 1 active PMS_OFFICER assignment
    department_count: int                  # total active departments in tenant
    departments_with_directors: int        # active depts with a director assigned
    missing_directors: list[str]           # names of departments with no director


async def check_pms_readiness(
    municipality_id: UUID,
    tenant_id: str,
    db: AsyncSession,
) -> PmsReadinessStatus:
    """Compute PMS readiness checklist for a municipality.

    Args:
        municipality_id: UUID of the municipality to check (from current_user.municipality_id)
        tenant_id:       Tenant ID string for scoping department/role queries
        db:              Async database session

    Returns:
        PmsReadinessStatus dataclass with all checklist fields populated.
    """
    # ------------------------------------------------------------------
    # Condition 1: Municipality settings configured and locked
    # ------------------------------------------------------------------
    municipality = await db.get(Municipality, municipality_id)
    municipality_configured = (
        municipality is not None
        and municipality.settings_locked is True
    )

    # ------------------------------------------------------------------
    # Condition 2: All active departments have assigned directors
    # ------------------------------------------------------------------
    dept_result = await db.execute(
        select(Department)
        .where(
            Department.tenant_id == tenant_id,
            Department.is_active == True,  # noqa: E712 — SQLAlchemy requires == True
        )
    )
    departments = list(dept_result.scalars().all())
    department_count = len(departments)

    missing_directors = [d.name for d in departments if d.assigned_director_id is None]
    departments_with_directors = department_count - len(missing_directors)
    # Must have at least 1 department and all must have directors
    all_departments_have_directors = (
        department_count > 0 and len(missing_directors) == 0
    )

    # ------------------------------------------------------------------
    # Condition 3: At least 1 active PMS officer assigned in this tenant
    # ------------------------------------------------------------------
    pms_result = await db.execute(
        select(func.count())
        .select_from(UserRoleAssignment)
        .where(
            UserRoleAssignment.tenant_id == tenant_id,
            UserRoleAssignment.role == UserRole.PMS_OFFICER,
            UserRoleAssignment.is_active == True,  # noqa: E712
        )
    )
    pms_officer_count = pms_result.scalar_one()
    pms_officer_assigned = pms_officer_count > 0

    is_ready = (
        municipality_configured
        and all_departments_have_directors
        and pms_officer_assigned
    )

    return PmsReadinessStatus(
        is_ready=is_ready,
        municipality_configured=municipality_configured,
        all_departments_have_directors=all_departments_have_directors,
        pms_officer_assigned=pms_officer_assigned,
        department_count=department_count,
        departments_with_directors=departments_with_directors,
        missing_directors=missing_directors,
    )


def require_pms_ready():
    """FastAPI dependency factory that gates access behind PMS readiness.

    Returns 403 with a structured checklist payload (code=PMS_NOT_READY) when
    the municipality has not completed PMS configuration.  Pass to PMS endpoints
    in the dependencies list or as a typed dependency parameter.

    Returns:
        Async dependency function that returns User when PMS is ready.

    Raises:
        HTTPException: 403 with PMS_NOT_READY detail dict when not ready.

    Example::

        @router.get("/pms/kpis", dependencies=[Depends(require_pms_ready())])
        async def list_kpis():
            ...
    """

    async def pms_gate(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        """Inner dependency: checks readiness and raises 403 if not ready."""
        readiness = await check_pms_readiness(
            current_user.municipality_id,
            current_user.tenant_id,
            db,
        )
        if not readiness.is_ready:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PMS_NOT_READY",
                    "message": "PMS configuration incomplete — complete all checklist items before accessing PMS features",
                    "checklist": asdict(readiness),
                },
            )
        return current_user

    return pms_gate
