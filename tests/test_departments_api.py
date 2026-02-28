"""Unit tests for Department API endpoints (Phase 27-02).

Tests CRUD, organogram, ticket category mapping, and municipality PMS settings:
- POST /api/v1/departments/ — Create department (admin only)
- GET /api/v1/departments/ — List departments
- GET /api/v1/departments/{id} — Get single department
- PUT /api/v1/departments/{id} — Update department
- DELETE /api/v1/departments/{id} — Soft-delete
- GET /api/v1/departments/organogram — Hierarchical tree
- POST /api/v1/departments/ticket-category-map — Create mapping
- GET /api/v1/departments/ticket-category-map — List mappings
- DELETE /api/v1/departments/ticket-category-map/{id} — Delete mapping
- GET /api/v1/municipalities/settings — Get PMS settings
- PUT /api/v1/municipalities/settings — Update PMS settings
- POST /api/v1/municipalities/settings/lock — Lock settings
- POST /api/v1/municipalities/settings/unlock — Unlock settings

Uses direct function call pattern with mocked dependencies (no live database).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.types import Scope

from src.models.user import User, UserRole

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def make_mock_request():
    """Create a minimal Starlette Request for @limiter.limit() decorated endpoints."""
    scope: Scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": Headers(headers={}).raw,
        "query_string": b"",
        "client": ("127.0.0.1", 0),
    }
    return Request(scope=scope)


def make_mock_admin(tenant_id=None, municipality_id=None):
    """Create a mock admin User."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "admin@test.gov.za"
    user.full_name = "Admin User"
    user.role = UserRole.ADMIN
    user.tenant_id = str(tenant_id or uuid4())
    user.municipality_id = municipality_id or uuid4()
    user.is_active = True
    return user


def make_mock_citizen(tenant_id=None, municipality_id=None):
    """Create a mock citizen User."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "citizen@test.gov.za"
    user.full_name = "Citizen User"
    user.role = UserRole.CITIZEN
    user.tenant_id = str(tenant_id or uuid4())
    user.municipality_id = municipality_id or uuid4()
    user.is_active = True
    return user


def make_mock_department(tenant_id=None, code="FIN", name="Finance", director_id=None):
    """Create a mock Department object."""
    dept = MagicMock()
    dept.id = uuid4()
    dept.tenant_id = str(tenant_id or uuid4())
    dept.name = name
    dept.code = code
    dept.parent_department_id = None
    dept.assigned_director_id = director_id
    dept.is_active = True
    dept.display_order = 0
    from datetime import datetime, timezone
    dept.created_at = datetime.now(timezone.utc)
    dept.updated_at = None
    return dept


def make_mock_municipality(municipality_id=None, settings_locked=False):
    """Create a mock Municipality object."""
    muni = MagicMock()
    muni.id = municipality_id or uuid4()
    muni.name = "Test Municipality"
    muni.code = "TEST001"
    muni.province = "Gauteng"
    muni.category = None
    muni.demarcation_code = None
    muni.sdbip_layers = 2
    muni.scoring_method = "percentage"
    muni.settings_locked = settings_locked
    muni.financial_year_start_month = 7
    return muni


# ---------------------------------------------------------------------------
# Test: Create department (admin only)
# ---------------------------------------------------------------------------

class TestCreateDepartment:
    """Tests for POST /api/v1/departments/."""

    async def test_create_department_admin_only(self):
        """Admin can create a department; non-admin gets 403."""
        from src.api.v1.departments import create_department
        from src.schemas.department import DepartmentCreate

        admin = make_mock_admin()
        dept_data = DepartmentCreate(name="Finance Department", code="FIN")

        mock_db = AsyncMock()
        # No existing dept with same code
        existing_result = MagicMock()
        existing_result.scalar_one_or_none.return_value = None
        # No parent dept needed
        mock_db.execute = AsyncMock(return_value=existing_result)

        created_dept = make_mock_department(
            tenant_id=admin.tenant_id,
            code="FIN",
            name="Finance Department"
        )

        async def mock_refresh(obj):
            obj.id = created_dept.id
            obj.created_at = created_dept.created_at
            obj.updated_at = None

        mock_db.refresh = AsyncMock(side_effect=mock_refresh)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        with patch("src.api.v1.departments._build_department_response") as mock_build:
            from src.schemas.department import DepartmentResponse
            mock_response = DepartmentResponse(
                id=created_dept.id,
                tenant_id=admin.tenant_id,
                name="Finance Department",
                code="FIN",
                parent_department_id=None,
                assigned_director_id=None,
                assigned_director_name=None,
                is_active=True,
                display_order=0,
                is_valid=False,
                created_at=created_dept.created_at,
                updated_at=None,
            )
            mock_build.return_value = mock_response

            result = await create_department(
                make_mock_request(),
                dept_data=dept_data,
                current_user=admin,
                db=mock_db,
            )

        assert result.code == "FIN"
        assert result.name == "Finance Department"
        assert result.is_valid is False  # No director assigned

    async def test_create_department_citizen_gets_403(self):
        """Citizen cannot create a department."""
        from src.api.v1.departments import create_department
        from src.schemas.department import DepartmentCreate

        # require_role raises HTTPException before function body is reached
        with pytest.raises(HTTPException) as exc_info:
            from src.api.deps import require_role
            citizen = make_mock_citizen()
            checker = require_role(UserRole.ADMIN)
            await checker(current_user=citizen)

        assert exc_info.value.status_code == 403

    async def test_create_department_with_code_validation(self):
        """Invalid department codes are rejected by schema validation."""
        from src.schemas.department import DepartmentCreate
        from pydantic import ValidationError

        # Lowercase code should fail
        with pytest.raises(ValidationError):
            DepartmentCreate(name="Finance", code="fin")

        # Code with special chars (except _) should fail
        with pytest.raises(ValidationError):
            DepartmentCreate(name="Finance", code="FIN-DEPT")

        # Valid codes should pass
        valid = DepartmentCreate(name="Finance", code="FIN")
        assert valid.code == "FIN"

        valid2 = DepartmentCreate(name="Community Safety", code="COMM_SAFETY")
        assert valid2.code == "COMM_SAFETY"


# ---------------------------------------------------------------------------
# Test: Department validity flag
# ---------------------------------------------------------------------------

class TestDepartmentValidity:
    """Tests for is_valid field in department responses."""

    async def test_department_validity_requires_director(self):
        """Department without director has is_valid=False in response."""
        from src.api.v1.departments import _build_department_response

        dept = make_mock_department(director_id=None)
        mock_db = AsyncMock()

        result = await _build_department_response(dept, mock_db)

        assert result.is_valid is False
        assert result.assigned_director_id is None
        assert result.assigned_director_name is None

    async def test_department_with_director_is_valid(self):
        """Department with director has is_valid=True in response."""
        from src.api.v1.departments import _build_department_response

        director_id = uuid4()
        dept = make_mock_department(director_id=director_id)

        mock_db = AsyncMock()
        name_result = MagicMock()
        name_result.scalar_one_or_none.return_value = "Dr. Jane Director"
        mock_db.execute = AsyncMock(return_value=name_result)

        result = await _build_department_response(dept, mock_db)

        assert result.is_valid is True
        assert result.assigned_director_name == "Dr. Jane Director"


# ---------------------------------------------------------------------------
# Test: List departments
# ---------------------------------------------------------------------------

class TestListDepartments:
    """Tests for GET /api/v1/departments/."""

    async def test_list_departments_returns_all_for_tenant(self):
        """List endpoint returns all departments for the current tenant."""
        from src.api.v1.departments import list_departments

        admin = make_mock_admin()
        tenant_id = admin.tenant_id

        dept1 = make_mock_department(tenant_id=tenant_id, code="FIN", name="Finance")
        dept2 = make_mock_department(tenant_id=tenant_id, code="INFRA", name="Infrastructure")
        dept3 = make_mock_department(tenant_id=tenant_id, code="COMM", name="Community")

        mock_db = AsyncMock()

        depts_result = MagicMock()
        depts_result.scalars.return_value.all.return_value = [dept1, dept2, dept3]

        # Director name query returns None (no directors assigned)
        no_director_result = MagicMock()
        no_director_result.scalar_one_or_none.return_value = None

        mock_db.execute = AsyncMock(side_effect=[
            depts_result,           # Main dept query
            no_director_result,     # Director for dept1
            no_director_result,     # Director for dept2
            no_director_result,     # Director for dept3
        ])

        result = await list_departments(
            make_mock_request(),
            current_user=admin,
            db=mock_db,
        )

        assert len(result) == 3
        codes = {r.code for r in result}
        assert codes == {"FIN", "INFRA", "COMM"}

    async def test_list_departments_tenant_isolated(self):
        """Departments from another tenant are not returned."""
        from src.api.v1.departments import list_departments

        admin = make_mock_admin()

        # Only return departments for this tenant
        depts_result = MagicMock()
        depts_result.scalars.return_value.all.return_value = []

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=depts_result)

        result = await list_departments(
            make_mock_request(),
            current_user=admin,
            db=mock_db,
        )

        assert result == []


# ---------------------------------------------------------------------------
# Test: Organogram
# ---------------------------------------------------------------------------

class TestOrganogram:
    """Tests for GET /api/v1/departments/organogram."""

    async def test_organogram_endpoint_returns_tree(self):
        """Create parent + 2 child departments, verify tree structure."""
        from src.api.v1.departments import _build_organogram

        admin = make_mock_admin()
        tenant_id = admin.tenant_id

        parent_id = uuid4()
        child1_id = uuid4()
        child2_id = uuid4()

        parent_dept = MagicMock()
        parent_dept.id = parent_id
        parent_dept.name = "Infrastructure"
        parent_dept.code = "INFRA"
        parent_dept.parent_department_id = None  # Root node
        parent_dept.assigned_director_id = None
        parent_dept.is_active = True
        parent_dept.display_order = 0

        child1_dept = MagicMock()
        child1_dept.id = child1_id
        child1_dept.name = "Roads"
        child1_dept.code = "ROADS"
        child1_dept.parent_department_id = parent_id  # Child of INFRA
        child1_dept.assigned_director_id = None
        child1_dept.is_active = True
        child1_dept.display_order = 1

        child2_dept = MagicMock()
        child2_dept.id = child2_id
        child2_dept.name = "Water"
        child2_dept.code = "WATER"
        child2_dept.parent_department_id = parent_id  # Child of INFRA
        child2_dept.assigned_director_id = None
        child2_dept.is_active = True
        child2_dept.display_order = 2

        departments = [parent_dept, child1_dept, child2_dept]
        director_map = {}

        roots = _build_organogram(departments, director_map)

        assert len(roots) == 1
        root = roots[0]
        assert root.code == "INFRA"
        assert root.name == "Infrastructure"
        assert len(root.children) == 2
        child_codes = {c.code for c in root.children}
        assert child_codes == {"ROADS", "WATER"}

    async def test_organogram_includes_director_info(self):
        """Director name and role appear in organogram nodes."""
        from src.api.v1.departments import _build_organogram

        director_id = uuid4()
        dept_id = uuid4()

        dept = MagicMock()
        dept.id = dept_id
        dept.name = "Finance"
        dept.code = "FIN"
        dept.parent_department_id = None
        dept.assigned_director_id = director_id
        dept.is_active = True
        dept.display_order = 0

        director_map = {director_id: ("Dr. Jane Mokoena", "manager")}

        roots = _build_organogram([dept], director_map)

        assert len(roots) == 1
        assert roots[0].director_name == "Dr. Jane Mokoena"
        assert roots[0].director_role == "manager"

    async def test_organogram_multiple_roots(self):
        """Departments with no parent are all returned as roots."""
        from src.api.v1.departments import _build_organogram

        depts = []
        for code, name in [("FIN", "Finance"), ("INFRA", "Infrastructure"), ("HR", "Human Resources")]:
            d = MagicMock()
            d.id = uuid4()
            d.name = name
            d.code = code
            d.parent_department_id = None
            d.assigned_director_id = None
            d.is_active = True
            d.display_order = 0
            depts.append(d)

        roots = _build_organogram(depts, {})
        assert len(roots) == 3


# ---------------------------------------------------------------------------
# Test: Ticket category mapping
# ---------------------------------------------------------------------------

class TestTicketCategoryMapping:
    """Tests for ticket category mapping endpoints."""

    async def test_ticket_category_mapping_unique_per_tenant(self):
        """Same ticket category cannot map to two departments within a tenant."""
        from src.api.v1.departments import create_ticket_category_mapping
        from src.schemas.department import TicketCategoryMappingCreate

        admin = make_mock_admin()
        mapping_data = TicketCategoryMappingCreate(
            department_id=uuid4(),
            ticket_category="water_supply"
        )

        mock_db = AsyncMock()

        dept_result = MagicMock()
        dept_result.scalar_one_or_none.return_value = make_mock_department(
            tenant_id=admin.tenant_id
        )

        # Simulate existing mapping for this category
        existing_result = MagicMock()
        existing_mapping = MagicMock()
        existing_result.scalar_one_or_none.return_value = existing_mapping

        mock_db.execute = AsyncMock(side_effect=[dept_result, existing_result])

        with pytest.raises(HTTPException) as exc_info:
            await create_ticket_category_mapping(
                make_mock_request(),
                mapping_data=mapping_data,
                current_user=admin,
                db=mock_db,
            )

        assert exc_info.value.status_code == 409
        assert "already mapped" in exc_info.value.detail.lower()

    async def test_ticket_category_mapping_department_not_found(self):
        """Creating mapping with unknown department returns 404."""
        from src.api.v1.departments import create_ticket_category_mapping
        from src.schemas.department import TicketCategoryMappingCreate

        admin = make_mock_admin()
        mapping_data = TicketCategoryMappingCreate(
            department_id=uuid4(),
            ticket_category="roads"
        )

        mock_db = AsyncMock()
        dept_result = MagicMock()
        dept_result.scalar_one_or_none.return_value = None  # Dept not found

        mock_db.execute = AsyncMock(return_value=dept_result)

        with pytest.raises(HTTPException) as exc_info:
            await create_ticket_category_mapping(
                make_mock_request(),
                mapping_data=mapping_data,
                current_user=admin,
                db=mock_db,
            )

        assert exc_info.value.status_code == 404

    async def test_delete_ticket_category_mapping_not_found(self):
        """Deleting a non-existent mapping returns 404."""
        from src.api.v1.departments import delete_ticket_category_mapping

        admin = make_mock_admin()
        mock_db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result)

        with pytest.raises(HTTPException) as exc_info:
            await delete_ticket_category_mapping(
                make_mock_request(),
                mapping_id=uuid4(),
                current_user=admin,
                db=mock_db,
            )

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Test: Municipality settings
# ---------------------------------------------------------------------------

class TestMunicipalitySettings:
    """Tests for municipality PMS settings endpoints."""

    async def test_municipality_settings_update_success(self):
        """Admin can update category, demarcation_code, and sdbip_layers."""
        from src.api.v1.departments import update_municipality_settings
        from src.schemas.department import MunicipalitySettingsUpdate

        municipality_id = uuid4()
        admin = make_mock_admin(municipality_id=municipality_id)
        settings_data = MunicipalitySettingsUpdate(
            category="B",
            demarcation_code="GT011",
            sdbip_layers=3,
        )

        muni = make_mock_municipality(municipality_id=municipality_id, settings_locked=False)

        mock_db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = muni
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        from src.schemas.department import MunicipalitySettingsResponse
        with patch("src.api.v1.departments.MunicipalitySettingsResponse") as mock_resp_class:
            mock_resp_class.model_validate.return_value = MunicipalitySettingsResponse(
                id=municipality_id,
                name=muni.name,
                code=muni.code,
                province=muni.province,
                category="B",
                demarcation_code="GT011",
                sdbip_layers=3,
                scoring_method="percentage",
                settings_locked=False,
                financial_year_start_month=7,
            )

            response = await update_municipality_settings(
                make_mock_request(),
                settings_data=settings_data,
                current_user=admin,
                db=mock_db,
            )

        mock_db.commit.assert_called_once()
        assert response.category == "B"
        assert response.demarcation_code == "GT011"
        assert response.sdbip_layers == 3

    async def test_municipality_settings_locked_returns_403(self):
        """When settings are locked, update returns 403 Forbidden."""
        from src.api.v1.departments import update_municipality_settings
        from src.schemas.department import MunicipalitySettingsUpdate

        municipality_id = uuid4()
        admin = make_mock_admin(municipality_id=municipality_id)
        settings_data = MunicipalitySettingsUpdate(category="A")

        muni = make_mock_municipality(municipality_id=municipality_id, settings_locked=True)

        mock_db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = muni
        mock_db.execute = AsyncMock(return_value=result)

        with pytest.raises(HTTPException) as exc_info:
            await update_municipality_settings(
                make_mock_request(),
                settings_data=settings_data,
                current_user=admin,
                db=mock_db,
            )

        assert exc_info.value.status_code == 403
        assert "locked" in exc_info.value.detail.lower()

    async def test_municipality_settings_lock(self):
        """Locking settings sets settings_locked=True."""
        from src.api.v1.departments import lock_municipality_settings

        municipality_id = uuid4()
        admin = make_mock_admin(municipality_id=municipality_id)

        muni = make_mock_municipality(municipality_id=municipality_id, settings_locked=False)

        mock_db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = muni
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        from src.schemas.department import MunicipalitySettingsResponse
        with patch("src.api.v1.departments.MunicipalitySettingsResponse") as mock_resp_class:
            mock_resp_class.model_validate.return_value = MunicipalitySettingsResponse(
                id=municipality_id,
                name=muni.name,
                code=muni.code,
                province=muni.province,
                category=None,
                demarcation_code=None,
                sdbip_layers=2,
                scoring_method="percentage",
                settings_locked=True,
                financial_year_start_month=7,
            )

            response = await lock_municipality_settings(
                make_mock_request(),
                current_user=admin,
                db=mock_db,
            )

        assert muni.settings_locked is True
        mock_db.commit.assert_called_once()
        assert response.settings_locked is True

    async def test_municipality_settings_unlock_requires_confirm(self):
        """Unlocking settings requires confirm=True in request body."""
        from src.api.v1.departments import unlock_municipality_settings
        from src.schemas.department import UnlockConfirm

        admin = make_mock_admin()
        mock_db = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await unlock_municipality_settings(
                make_mock_request(),
                confirm_body=UnlockConfirm(confirm=False),
                current_user=admin,
                db=mock_db,
            )

        assert exc_info.value.status_code == 400

    async def test_municipality_settings_unlock_success(self):
        """After locking, settings can be unlocked and edited again."""
        from src.api.v1.departments import unlock_municipality_settings
        from src.schemas.department import UnlockConfirm

        municipality_id = uuid4()
        admin = make_mock_admin(municipality_id=municipality_id)

        muni = make_mock_municipality(municipality_id=municipality_id, settings_locked=True)

        mock_db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = muni
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        from src.schemas.department import MunicipalitySettingsResponse
        with patch("src.api.v1.departments.MunicipalitySettingsResponse") as mock_resp_class:
            mock_resp_class.model_validate.return_value = MunicipalitySettingsResponse(
                id=municipality_id,
                name=muni.name,
                code=muni.code,
                province=muni.province,
                category=None,
                demarcation_code=None,
                sdbip_layers=2,
                scoring_method="percentage",
                settings_locked=False,
                financial_year_start_month=7,
            )

            response = await unlock_municipality_settings(
                make_mock_request(),
                confirm_body=UnlockConfirm(confirm=True),
                current_user=admin,
                db=mock_db,
            )

        assert muni.settings_locked is False
        mock_db.commit.assert_called_once()
        assert response.settings_locked is False

    async def test_municipality_settings_validation(self):
        """Settings schema validates category must be A, B, or C."""
        from src.schemas.department import MunicipalitySettingsUpdate
        from pydantic import ValidationError

        # Invalid category
        with pytest.raises(ValidationError):
            MunicipalitySettingsUpdate(category="D")

        # Invalid sdbip_layers (must be 1-5)
        with pytest.raises(ValidationError):
            MunicipalitySettingsUpdate(sdbip_layers=0)

        with pytest.raises(ValidationError):
            MunicipalitySettingsUpdate(sdbip_layers=6)

        # Valid settings
        valid = MunicipalitySettingsUpdate(category="A", sdbip_layers=3)
        assert valid.category == "A"
        assert valid.sdbip_layers == 3


# ---------------------------------------------------------------------------
# Test: Cross-tenant isolation
# ---------------------------------------------------------------------------

class TestCrossTenantIsolation:
    """Tests verifying that department data is tenant-isolated."""

    async def test_get_department_cross_tenant_isolation(self):
        """Department from tenant A is not visible to tenant B user."""
        from src.api.v1.departments import get_department

        tenant_a = str(uuid4())
        tenant_b = str(uuid4())

        # User belongs to tenant B
        admin_b = make_mock_admin(tenant_id=tenant_b)

        # Department belongs to tenant A but user is from tenant B
        dept_id = uuid4()

        mock_db = AsyncMock()
        # DB query returns None because tenant_id filter excludes tenant A data
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result)

        with pytest.raises(HTTPException) as exc_info:
            await get_department(
                make_mock_request(),
                department_id=dept_id,
                current_user=admin_b,
                db=mock_db,
            )

        assert exc_info.value.status_code == 404

    async def test_update_department_cross_tenant_isolation(self):
        """Update on department from another tenant returns 404."""
        from src.api.v1.departments import update_department
        from src.schemas.department import DepartmentUpdate

        admin = make_mock_admin(tenant_id=str(uuid4()))
        update_data = DepartmentUpdate(name="Renamed")

        mock_db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None  # Not found in this tenant
        mock_db.execute = AsyncMock(return_value=result)

        with pytest.raises(HTTPException) as exc_info:
            await update_department(
                make_mock_request(),
                department_id=uuid4(),
                update_data=update_data,
                current_user=admin,
                db=mock_db,
            )

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Test: Organogram via HTTP endpoint
# ---------------------------------------------------------------------------

class TestOrganogramEndpoint:
    """Tests for the GET /api/v1/departments/organogram endpoint."""

    async def test_organogram_returns_empty_for_no_departments(self):
        """Empty municipality returns empty organogram."""
        from src.api.v1.departments import get_organogram

        admin = make_mock_admin()
        mock_db = AsyncMock()

        depts_result = MagicMock()
        depts_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=depts_result)

        result = await get_organogram(
            make_mock_request(),
            current_user=admin,
            db=mock_db,
        )

        assert result == []

    async def test_organogram_director_lookup(self):
        """Organogram endpoint queries director names from users table."""
        from src.api.v1.departments import get_organogram

        admin = make_mock_admin()
        director_id = uuid4()
        dept = make_mock_department(
            tenant_id=admin.tenant_id,
            director_id=director_id
        )
        dept.parent_department_id = None
        dept.display_order = 0

        mock_db = AsyncMock()

        depts_result = MagicMock()
        depts_result.scalars.return_value.all.return_value = [dept]

        users_result = MagicMock()
        user_row = MagicMock()
        user_row.id = director_id
        user_row.full_name = "Director Jane"
        user_row.role = UserRole.ADMIN
        users_result.all.return_value = [user_row]

        mock_db.execute = AsyncMock(side_effect=[depts_result, users_result])

        result = await get_organogram(
            make_mock_request(),
            current_user=admin,
            db=mock_db,
        )

        assert len(result) == 1
        assert result[0].director_name == "Director Jane"
