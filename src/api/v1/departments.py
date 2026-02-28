"""Department CRUD API for municipal organizational structure management.

Provides endpoints for:
- Department CRUD (create, list, get, update, soft-delete)
- Organogram (hierarchical department tree with director names)
- Ticket category to department mapping (1:1 per tenant)
- Municipality PMS settings (view, update, lock, unlock)
- PMS readiness checklist (GET /departments/pms-readiness)

Security:
- All endpoints require authentication
- RBAC: ADMIN role for mutations; any authenticated user for reads
- Tenant isolation: all queries scoped to current_user.tenant_id
- Municipality settings locked flag prevents edits without explicit unlock
"""
import logging
from dataclasses import asdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_active_user, get_current_user, get_db, require_role
from src.middleware.rate_limit import (
    SENSITIVE_READ_RATE_LIMIT,
    SENSITIVE_WRITE_RATE_LIMIT,
    limiter,
)
from src.models.department import Department, DepartmentTicketCategoryMap
from src.models.municipality import Municipality
from src.models.user import User, UserRole
from src.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    MunicipalitySettingsResponse,
    MunicipalitySettingsUpdate,
    OrganogramNode,
    TicketCategoryMappingCreate,
    TicketCategoryMappingResponse,
    UnlockConfirm,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/departments", tags=["departments"])
municipality_router = APIRouter(prefix="/api/v1/municipalities", tags=["municipality-settings"])


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

async def _build_department_response(
    dept: Department,
    db: AsyncSession,
) -> DepartmentResponse:
    """Build a DepartmentResponse, joining the director's name from users table.

    Args:
        dept: Department ORM object
        db: Database session

    Returns:
        DepartmentResponse with assigned_director_name and is_valid populated
    """
    director_name: str | None = None
    if dept.assigned_director_id:
        result = await db.execute(
            select(User.full_name).where(User.id == dept.assigned_director_id)
        )
        director_name = result.scalar_one_or_none()

    return DepartmentResponse(
        id=dept.id,
        tenant_id=dept.tenant_id,
        name=dept.name,
        code=dept.code,
        parent_department_id=dept.parent_department_id,
        assigned_director_id=dept.assigned_director_id,
        assigned_director_name=director_name,
        is_active=dept.is_active,
        display_order=dept.display_order,
        is_valid=dept.assigned_director_id is not None,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
    )


def _build_organogram(
    departments: list[Department],
    director_map: dict[UUID, tuple[str, str]],
) -> list[OrganogramNode]:
    """Build a recursive organogram tree from a flat list of departments.

    Args:
        departments: All active departments for the tenant
        director_map: Maps assigned_director_id -> (full_name, role_value)

    Returns:
        List of root OrganogramNode objects with nested children
    """
    node_map: dict[UUID, OrganogramNode] = {}
    for dept in departments:
        dir_info = director_map.get(dept.assigned_director_id) if dept.assigned_director_id else None
        node_map[dept.id] = OrganogramNode(
            id=dept.id,
            name=dept.name,
            code=dept.code,
            director_name=dir_info[0] if dir_info else None,
            director_role=dir_info[1] if dir_info else None,
            children=[],
        )

    roots: list[OrganogramNode] = []
    for dept in departments:
        node = node_map[dept.id]
        if dept.parent_department_id and dept.parent_department_id in node_map:
            node_map[dept.parent_department_id].children.append(node)
        else:
            roots.append(node)

    return roots


# ---------------------------------------------------------------------------
# Department CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("/organogram", response_model=list[OrganogramNode])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_organogram(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OrganogramNode]:
    """Return hierarchical organogram tree for current municipality.

    Root departments (no parent) are top-level nodes. Each node includes
    children departments and the assigned director's name and role.

    Args:
        current_user: Authenticated user (any role)
        db: Database session

    Returns:
        List of root OrganogramNode objects with nested children
    """
    result = await db.execute(
        select(Department).where(
            Department.tenant_id == current_user.tenant_id,
            Department.is_active == True,
        ).order_by(Department.display_order, Department.name)
    )
    departments = list(result.scalars().all())

    # Gather unique director IDs
    director_ids = {
        dept.assigned_director_id
        for dept in departments
        if dept.assigned_director_id
    }

    director_map: dict[UUID, tuple[str, str]] = {}
    if director_ids:
        user_result = await db.execute(
            select(User.id, User.full_name, User.role).where(User.id.in_(director_ids))
        )
        for row in user_result.all():
            role_value = row.role.value if hasattr(row.role, "value") else str(row.role)
            director_map[row.id] = (row.full_name, role_value)

    return _build_organogram(departments, director_map)


@router.post("/", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def create_department(
    request: Request,
    dept_data: DepartmentCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    """Create a new department within the current municipality.

    Validates:
    - parent_department_id belongs to the same tenant (if provided)
    - Code uniqueness within tenant (enforced by DB constraint)

    Args:
        dept_data: Department creation data
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Created DepartmentResponse

    Raises:
        HTTPException: 403 if user not admin
        HTTPException: 404 if parent_department_id not found in this tenant
        HTTPException: 409 if department code already exists in this tenant
    """
    # Validate parent department exists in same tenant
    if dept_data.parent_department_id:
        parent_result = await db.execute(
            select(Department).where(
                Department.id == dept_data.parent_department_id,
                Department.tenant_id == current_user.tenant_id,
            )
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent department not found in this municipality"
            )

    # Check code uniqueness within tenant
    existing = await db.execute(
        select(Department).where(
            Department.code == dept_data.code,
            Department.tenant_id == current_user.tenant_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department code '{dept_data.code}' already exists in this municipality"
        )

    dept = Department(
        tenant_id=current_user.tenant_id,
        name=dept_data.name,
        code=dept_data.code,
        parent_department_id=dept_data.parent_department_id,
        assigned_director_id=dept_data.assigned_director_id,
        display_order=dept_data.display_order,
        is_active=True,
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)

    logger.info(
        f"Department created: {dept.code} ({dept.name}) "
        f"by {current_user.full_name} in tenant {current_user.tenant_id}"
    )

    return await _build_department_response(dept, db)


@router.get("/", response_model=list[DepartmentResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def list_departments(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DepartmentResponse]:
    """List all departments for the current tenant.

    Includes assigned_director_name (joined from users) and is_valid flag.

    Args:
        current_user: Authenticated user (any role)
        db: Database session

    Returns:
        List of DepartmentResponse objects
    """
    result = await db.execute(
        select(Department).where(
            Department.tenant_id == current_user.tenant_id,
        ).order_by(Department.display_order, Department.name)
    )
    departments = result.scalars().all()

    responses = []
    for dept in departments:
        responses.append(await _build_department_response(dept, db))
    return responses


@router.get("/{department_id}", response_model=DepartmentResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_department(
    request: Request,
    department_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    """Get a single department by ID.

    Args:
        department_id: Department UUID
        current_user: Authenticated user (any role)
        db: Database session

    Returns:
        DepartmentResponse

    Raises:
        HTTPException: 404 if department not found or not in user's municipality
    """
    result = await db.execute(
        select(Department).where(
            Department.id == department_id,
            Department.tenant_id == current_user.tenant_id,
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )

    return await _build_department_response(dept, db)


@router.put("/{department_id}", response_model=DepartmentResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def update_department(
    request: Request,
    department_id: UUID,
    update_data: DepartmentUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    """Update a department. Requires ADMIN role.

    Args:
        department_id: Department UUID
        update_data: Fields to update (all optional)
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Updated DepartmentResponse

    Raises:
        HTTPException: 403 if user not admin
        HTTPException: 404 if department not found
        HTTPException: 409 if new code conflicts with existing department
    """
    result = await db.execute(
        select(Department).where(
            Department.id == department_id,
            Department.tenant_id == current_user.tenant_id,
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )

    update_fields = update_data.model_dump(exclude_unset=True)

    # Check code uniqueness if code is being changed
    if "code" in update_fields and update_fields["code"] != dept.code:
        existing = await db.execute(
            select(Department).where(
                Department.code == update_fields["code"],
                Department.tenant_id == current_user.tenant_id,
                Department.id != department_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Department code '{update_fields['code']}' already exists in this municipality"
            )

    for field, value in update_fields.items():
        setattr(dept, field, value)

    await db.commit()
    await db.refresh(dept)

    logger.info(
        f"Department {department_id} updated by {current_user.full_name}: "
        f"{list(update_fields.keys())}"
    )

    return await _build_department_response(dept, db)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def delete_department(
    request: Request,
    department_id: UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a department (set is_active=False). Requires ADMIN role.

    Args:
        department_id: Department UUID
        current_user: Authenticated ADMIN
        db: Database session

    Raises:
        HTTPException: 403 if user not admin
        HTTPException: 404 if department not found
    """
    result = await db.execute(
        select(Department).where(
            Department.id == department_id,
            Department.tenant_id == current_user.tenant_id,
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )

    dept.is_active = False
    await db.commit()

    logger.info(
        f"Department {department_id} soft-deleted by {current_user.full_name}"
    )


# ---------------------------------------------------------------------------
# Ticket category mapping endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/ticket-category-map",
    response_model=TicketCategoryMappingResponse,
    status_code=status.HTTP_201_CREATED
)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def create_ticket_category_mapping(
    request: Request,
    mapping_data: TicketCategoryMappingCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TicketCategoryMappingResponse:
    """Create a ticket category to department mapping (1:1 per tenant).

    Enforces that each ticket category maps to exactly one department within a tenant.

    Args:
        mapping_data: department_id and ticket_category
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        TicketCategoryMappingResponse

    Raises:
        HTTPException: 403 if user not admin
        HTTPException: 404 if department not found in this tenant
        HTTPException: 409 if ticket_category already mapped in this tenant
    """
    # Verify department belongs to this tenant
    dept_result = await db.execute(
        select(Department).where(
            Department.id == mapping_data.department_id,
            Department.tenant_id == current_user.tenant_id,
        )
    )
    dept = dept_result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found in this municipality"
        )

    # Check 1:1 uniqueness
    existing = await db.execute(
        select(DepartmentTicketCategoryMap).where(
            DepartmentTicketCategoryMap.ticket_category == mapping_data.ticket_category,
            DepartmentTicketCategoryMap.tenant_id == current_user.tenant_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ticket category '{mapping_data.ticket_category}' is already mapped in this municipality"
        )

    mapping = DepartmentTicketCategoryMap(
        tenant_id=current_user.tenant_id,
        department_id=mapping_data.department_id,
        ticket_category=mapping_data.ticket_category,
    )
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)

    logger.info(
        f"Ticket category '{mapping_data.ticket_category}' mapped to "
        f"department {mapping_data.department_id} by {current_user.full_name}"
    )

    return TicketCategoryMappingResponse(
        id=mapping.id,
        department_id=mapping.department_id,
        department_name=dept.name,
        ticket_category=mapping.ticket_category,
    )


@router.get("/ticket-category-map", response_model=list[TicketCategoryMappingResponse])
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def list_ticket_category_mappings(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketCategoryMappingResponse]:
    """List all ticket category to department mappings for the current tenant.

    Args:
        current_user: Authenticated user (any role)
        db: Database session

    Returns:
        List of TicketCategoryMappingResponse objects
    """
    result = await db.execute(
        select(DepartmentTicketCategoryMap).where(
            DepartmentTicketCategoryMap.tenant_id == current_user.tenant_id,
        ).order_by(DepartmentTicketCategoryMap.ticket_category)
    )
    mappings = result.scalars().all()

    responses = []
    for m in mappings:
        # Join department name
        dept_result = await db.execute(
            select(Department.name).where(Department.id == m.department_id)
        )
        dept_name = dept_result.scalar_one_or_none()
        responses.append(
            TicketCategoryMappingResponse(
                id=m.id,
                department_id=m.department_id,
                department_name=dept_name,
                ticket_category=m.ticket_category,
            )
        )
    return responses


@router.delete(
    "/ticket-category-map/{mapping_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def delete_ticket_category_mapping(
    request: Request,
    mapping_id: UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a ticket category mapping. Requires ADMIN role.

    Args:
        mapping_id: DepartmentTicketCategoryMap UUID
        current_user: Authenticated ADMIN
        db: Database session

    Raises:
        HTTPException: 403 if user not admin
        HTTPException: 404 if mapping not found
    """
    result = await db.execute(
        select(DepartmentTicketCategoryMap).where(
            DepartmentTicketCategoryMap.id == mapping_id,
            DepartmentTicketCategoryMap.tenant_id == current_user.tenant_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket category mapping not found"
        )

    await db.delete(mapping)
    await db.commit()

    logger.info(
        f"Ticket category mapping {mapping_id} deleted by {current_user.full_name}"
    )


# ---------------------------------------------------------------------------
# PMS readiness endpoint
# ---------------------------------------------------------------------------

@router.get("/pms-readiness")
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_pms_readiness(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check PMS readiness status for the current user's municipality.

    Returns the full readiness checklist so the frontend can display
    actionable guidance. All three conditions must be True for is_ready=True:
    - Municipality settings configured and locked
    - All active departments have assigned directors
    - At least one PMS officer assigned

    Args:
        current_user: Authenticated active user (any role)
        db: Database session

    Returns:
        PmsReadinessStatus as dict with is_ready + checklist fields
    """
    from src.services.pms_readiness import check_pms_readiness  # noqa: PLC0415
    readiness = await check_pms_readiness(
        current_user.municipality_id, current_user.tenant_id, db
    )
    return asdict(readiness)


# ---------------------------------------------------------------------------
# Municipality PMS settings endpoints (on municipality_router)
# ---------------------------------------------------------------------------

@municipality_router.get("/settings", response_model=MunicipalitySettingsResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_municipality_settings(
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MunicipalitySettingsResponse:
    """Get PMS settings for the current municipality. Requires ADMIN.

    Args:
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        MunicipalitySettingsResponse

    Raises:
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(Municipality.id == current_user.municipality_id)
    )
    municipality = result.scalar_one_or_none()
    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found"
        )

    return MunicipalitySettingsResponse.model_validate(municipality)


@municipality_router.put("/settings", response_model=MunicipalitySettingsResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def update_municipality_settings(
    request: Request,
    settings_data: MunicipalitySettingsUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MunicipalitySettingsResponse:
    """Update PMS settings for the current municipality. Requires ADMIN.

    Returns 403 if settings are locked.

    Args:
        settings_data: Fields to update (all optional)
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Updated MunicipalitySettingsResponse

    Raises:
        HTTPException: 403 if settings are locked or user not admin
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(Municipality.id == current_user.municipality_id)
    )
    municipality = result.scalar_one_or_none()
    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found"
        )

    if municipality.settings_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Municipality settings are locked. Unlock first to make changes."
        )

    update_fields = settings_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(municipality, field, value)

    await db.commit()
    await db.refresh(municipality)

    logger.info(
        f"Municipality settings updated for {municipality.code} "
        f"by {current_user.full_name}: {list(update_fields.keys())}"
    )

    return MunicipalitySettingsResponse.model_validate(municipality)


@municipality_router.post("/settings/lock", response_model=MunicipalitySettingsResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def lock_municipality_settings(
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MunicipalitySettingsResponse:
    """Lock municipality PMS settings to prevent accidental changes. Requires ADMIN.

    Args:
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Updated MunicipalitySettingsResponse with settings_locked=True

    Raises:
        HTTPException: 404 if municipality not found
    """
    result = await db.execute(
        select(Municipality).where(Municipality.id == current_user.municipality_id)
    )
    municipality = result.scalar_one_or_none()
    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found"
        )

    municipality.settings_locked = True
    await db.commit()
    await db.refresh(municipality)

    logger.info(
        f"Municipality settings locked for {municipality.code} by {current_user.full_name}"
    )

    return MunicipalitySettingsResponse.model_validate(municipality)


@municipality_router.post("/settings/unlock", response_model=MunicipalitySettingsResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def unlock_municipality_settings(
    request: Request,
    confirm_body: UnlockConfirm,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MunicipalitySettingsResponse:
    """Unlock municipality PMS settings. Requires ADMIN and explicit confirmation.

    Args:
        confirm_body: Must contain {"confirm": true} to proceed
        current_user: Authenticated ADMIN
        db: Database session

    Returns:
        Updated MunicipalitySettingsResponse with settings_locked=False

    Raises:
        HTTPException: 400 if confirm is False
        HTTPException: 404 if municipality not found
    """
    if not confirm_body.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must confirm unlock by sending {\"confirm\": true}"
        )

    result = await db.execute(
        select(Municipality).where(Municipality.id == current_user.municipality_id)
    )
    municipality = result.scalar_one_or_none()
    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipality not found"
        )

    municipality.settings_locked = False
    await db.commit()
    await db.refresh(municipality)

    logger.info(
        f"Municipality settings unlocked for {municipality.code} by {current_user.full_name}"
    )

    return MunicipalitySettingsResponse.model_validate(municipality)
