"""Unit tests for PMS readiness gate (Phase 27-03).

Tests check_pms_readiness(), require_pms_ready(), and the
GET /api/v1/departments/pms-readiness endpoint.

Follows the mock-based pattern established in test_departments_api.py:
- No live database needed (AsyncMock for db session)
- Direct function call pattern (not HTTP client)
- Starlette Request helper for @limiter.limit() decorated endpoints
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


def make_mock_admin(tenant_id: str | None = None, municipality_id=None):
    """Create a mock admin User."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "admin@test.gov.za"
    user.full_name = "Admin User"
    user.role = UserRole.ADMIN
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = municipality_id or uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def make_mock_municipality(locked: bool = False, municipality_id=None):
    """Create a mock Municipality object."""
    muni = MagicMock()
    muni.id = municipality_id or uuid4()
    muni.name = "Test Municipality"
    muni.code = "TEST001"
    muni.settings_locked = locked
    return muni


def make_mock_department(name: str, director_id=None, tenant_id: str | None = None):
    """Create a mock Department object."""
    dept = MagicMock()
    dept.id = uuid4()
    dept.name = name
    dept.code = name[:3].upper()
    dept.tenant_id = tenant_id or str(uuid4())
    dept.assigned_director_id = director_id
    dept.is_active = True
    dept.display_order = 0
    return dept


def make_mock_db(
    municipality=None,
    departments: list | None = None,
    pms_officer_count: int = 0,
) -> AsyncMock:
    """Build a mock db session with preconfigured query results.

    Uses get() for Municipality (direct PK lookup) and execute() for
    Department list and UserRoleAssignment count queries.

    Args:
        municipality: Mock Municipality object returned by db.get()
        departments:  List of mock Department objects (default: empty list)
        pms_officer_count: int returned by COUNT query for PMS officers
    """
    if departments is None:
        departments = []

    mock_db = AsyncMock()

    # Municipality fetched via db.get(Municipality, municipality_id)
    mock_db.get = AsyncMock(return_value=municipality)

    # Department scalars().all() query
    dept_result = MagicMock()
    dept_result.scalars.return_value.all.return_value = departments

    # PMS officer COUNT query
    count_result = MagicMock()
    count_result.scalar_one.return_value = pms_officer_count

    mock_db.execute = AsyncMock(side_effect=[dept_result, count_result])

    return mock_db


# ---------------------------------------------------------------------------
# Test: check_pms_readiness function
# ---------------------------------------------------------------------------

class TestCheckPmsReadiness:
    """Tests for check_pms_readiness() function."""

    async def test_pms_not_ready_no_settings(self):
        """Municipality not locked returns is_ready=False, municipality_configured=False."""
        from src.services.pms_readiness import check_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()

        # Municipality exists but settings NOT locked
        municipality = make_mock_municipality(locked=False, municipality_id=municipality_id)
        dept1 = make_mock_department("Finance", director_id=uuid4(), tenant_id=tenant_id)
        dept2 = make_mock_department("Infrastructure", director_id=uuid4(), tenant_id=tenant_id)

        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept1, dept2],
            pms_officer_count=1,
        )

        result = await check_pms_readiness(municipality_id, tenant_id, mock_db)

        assert result.is_ready is False
        assert result.municipality_configured is False
        # Other conditions may be True but overall is_ready is False
        assert result.department_count == 2
        assert result.departments_with_directors == 2
        assert result.missing_directors == []

    async def test_pms_not_ready_missing_directors(self):
        """Municipality locked, 2 departments, 1 missing director: is_ready=False."""
        from src.services.pms_readiness import check_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()

        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)
        dept1 = make_mock_department("Finance", director_id=uuid4(), tenant_id=tenant_id)
        dept2 = make_mock_department("Infrastructure", director_id=None, tenant_id=tenant_id)  # No director!

        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept1, dept2],
            pms_officer_count=1,
        )

        result = await check_pms_readiness(municipality_id, tenant_id, mock_db)

        assert result.is_ready is False
        assert result.municipality_configured is True
        assert result.all_departments_have_directors is False
        assert result.department_count == 2
        assert result.departments_with_directors == 1
        assert "Infrastructure" in result.missing_directors
        assert len(result.missing_directors) == 1

    async def test_pms_not_ready_no_pms_officer(self):
        """Municipality locked, all departments have directors, but no PMS officer."""
        from src.services.pms_readiness import check_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()

        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)
        dept1 = make_mock_department("Finance", director_id=uuid4(), tenant_id=tenant_id)
        dept2 = make_mock_department("Infrastructure", director_id=uuid4(), tenant_id=tenant_id)

        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept1, dept2],
            pms_officer_count=0,  # No PMS officer assigned!
        )

        result = await check_pms_readiness(municipality_id, tenant_id, mock_db)

        assert result.is_ready is False
        assert result.municipality_configured is True
        assert result.all_departments_have_directors is True
        assert result.pms_officer_assigned is False
        assert result.missing_directors == []

    async def test_pms_ready_all_conditions_met(self):
        """Municipality locked, all depts have directors, PMS officer assigned: is_ready=True."""
        from src.services.pms_readiness import check_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()

        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)
        dept1 = make_mock_department("Finance", director_id=uuid4(), tenant_id=tenant_id)
        dept2 = make_mock_department("Infrastructure", director_id=uuid4(), tenant_id=tenant_id)
        dept3 = make_mock_department("Community Safety", director_id=uuid4(), tenant_id=tenant_id)

        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept1, dept2, dept3],
            pms_officer_count=2,  # 2 PMS officers
        )

        result = await check_pms_readiness(municipality_id, tenant_id, mock_db)

        assert result.is_ready is True
        assert result.municipality_configured is True
        assert result.all_departments_have_directors is True
        assert result.pms_officer_assigned is True
        assert result.department_count == 3
        assert result.departments_with_directors == 3
        assert result.missing_directors == []

    async def test_pms_not_ready_no_departments(self):
        """Municipality locked, PMS officer exists, but no departments: not ready."""
        from src.services.pms_readiness import check_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()

        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)

        mock_db = make_mock_db(
            municipality=municipality,
            departments=[],  # No departments!
            pms_officer_count=1,
        )

        result = await check_pms_readiness(municipality_id, tenant_id, mock_db)

        assert result.is_ready is False
        # all_departments_have_directors is False when there are no departments
        assert result.all_departments_have_directors is False
        assert result.department_count == 0
        assert result.departments_with_directors == 0

    async def test_pms_not_ready_municipality_missing(self):
        """Municipality not found in DB: municipality_configured=False."""
        from src.services.pms_readiness import check_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()

        # db.get() returns None (municipality not found)
        mock_db = make_mock_db(
            municipality=None,
            departments=[],
            pms_officer_count=0,
        )

        result = await check_pms_readiness(municipality_id, tenant_id, mock_db)

        assert result.is_ready is False
        assert result.municipality_configured is False


# ---------------------------------------------------------------------------
# Test: require_pms_ready() dependency gate
# ---------------------------------------------------------------------------

class TestRequirePmsReadyGate:
    """Tests for require_pms_ready() dependency factory."""

    async def test_require_pms_ready_gate_blocks(self):
        """Gate raises HTTP 403 with PMS_NOT_READY code when not ready."""
        from src.services.pms_readiness import require_pms_ready

        tenant_id = str(uuid4())
        municipality_id = uuid4()
        admin = make_mock_admin(tenant_id=tenant_id, municipality_id=municipality_id)

        # Municipality not locked = not ready
        municipality = make_mock_municipality(locked=False, municipality_id=municipality_id)
        mock_db = make_mock_db(
            municipality=municipality,
            departments=[],
            pms_officer_count=0,
        )

        gate_fn = require_pms_ready()

        with pytest.raises(HTTPException) as exc_info:
            await gate_fn(current_user=admin, db=mock_db)

        assert exc_info.value.status_code == 403
        detail = exc_info.value.detail
        assert detail["code"] == "PMS_NOT_READY"
        assert "checklist" in detail
        assert detail["checklist"]["is_ready"] is False

    async def test_require_pms_ready_gate_passes(self):
        """Gate returns user when PMS is fully configured."""
        from src.services.pms_readiness import require_pms_ready

        tenant_id = str(uuid4())
        municipality_id = uuid4()
        admin = make_mock_admin(tenant_id=tenant_id, municipality_id=municipality_id)

        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)
        dept1 = make_mock_department("Finance", director_id=uuid4(), tenant_id=tenant_id)
        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept1],
            pms_officer_count=1,
        )

        gate_fn = require_pms_ready()
        result = await gate_fn(current_user=admin, db=mock_db)

        assert result is admin  # Gate passes through the user object

    async def test_require_pms_ready_checklist_structure(self):
        """403 response includes complete structured checklist with all fields."""
        from src.services.pms_readiness import require_pms_ready

        tenant_id = str(uuid4())
        municipality_id = uuid4()
        admin = make_mock_admin(tenant_id=tenant_id, municipality_id=municipality_id)

        # Settings locked, 1 dept with no director, no PMS officer
        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)
        dept = make_mock_department("Infrastructure", director_id=None, tenant_id=tenant_id)
        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept],
            pms_officer_count=0,
        )

        gate_fn = require_pms_ready()
        with pytest.raises(HTTPException) as exc_info:
            await gate_fn(current_user=admin, db=mock_db)

        checklist = exc_info.value.detail["checklist"]
        expected_keys = {
            "is_ready", "municipality_configured", "all_departments_have_directors",
            "pms_officer_assigned", "department_count", "departments_with_directors",
            "missing_directors",
        }
        assert set(checklist.keys()) == expected_keys
        assert checklist["municipality_configured"] is True
        assert checklist["all_departments_have_directors"] is False
        assert checklist["pms_officer_assigned"] is False
        assert checklist["department_count"] == 1
        assert checklist["departments_with_directors"] == 0
        assert "Infrastructure" in checklist["missing_directors"]


# ---------------------------------------------------------------------------
# Test: GET /api/v1/departments/pms-readiness endpoint
# ---------------------------------------------------------------------------

class TestPmsReadinessEndpoint:
    """Tests for GET /api/v1/departments/pms-readiness HTTP endpoint."""

    async def test_pms_readiness_endpoint_returns_checklist(self):
        """Endpoint returns full readiness checklist as JSON dict."""
        from src.api.v1.departments import get_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()
        admin = make_mock_admin(tenant_id=tenant_id, municipality_id=municipality_id)

        municipality = make_mock_municipality(locked=False, municipality_id=municipality_id)
        mock_db = make_mock_db(
            municipality=municipality,
            departments=[],
            pms_officer_count=0,
        )

        result = await get_pms_readiness(
            make_mock_request(),
            current_user=admin,
            db=mock_db,
        )

        # Endpoint returns a plain dict (asdict() output)
        assert isinstance(result, dict)
        assert "is_ready" in result
        assert "municipality_configured" in result
        assert "all_departments_have_directors" in result
        assert "pms_officer_assigned" in result
        assert "missing_directors" in result
        assert result["is_ready"] is False

    async def test_pms_readiness_endpoint_ready_true(self):
        """Endpoint returns is_ready=True when all conditions met."""
        from src.api.v1.departments import get_pms_readiness

        tenant_id = str(uuid4())
        municipality_id = uuid4()
        admin = make_mock_admin(tenant_id=tenant_id, municipality_id=municipality_id)

        municipality = make_mock_municipality(locked=True, municipality_id=municipality_id)
        dept = make_mock_department("Finance", director_id=uuid4(), tenant_id=tenant_id)
        mock_db = make_mock_db(
            municipality=municipality,
            departments=[dept],
            pms_officer_count=1,
        )

        result = await get_pms_readiness(
            make_mock_request(),
            current_user=admin,
            db=mock_db,
        )

        assert result["is_ready"] is True
        assert result["municipality_configured"] is True
        assert result["all_departments_have_directors"] is True
        assert result["pms_officer_assigned"] is True
        assert result["department_count"] == 1
        assert result["departments_with_directors"] == 1
        assert result["missing_directors"] == []
