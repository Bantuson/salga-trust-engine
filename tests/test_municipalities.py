"""Tests for municipality management API endpoints."""
import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.municipality import Municipality
from src.models.user import User, UserRole

pytestmark = pytest.mark.asyncio


async def test_create_municipality(
    async_client: AsyncClient,
    admin_user: User,
    admin_token: str,
    db_session: AsyncSession,
):
    """Admin can create a municipality."""
    municipality_data = {
        "name": "City of Johannesburg",
        "code": "JHB",
        "province": "Gauteng",
        "population": 5635000,
        "contact_email": "info@joburg.org.za",
    }

    response = await async_client.post(
        "/api/v1/municipalities/",
        json=municipality_data,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == municipality_data["name"]
    assert data["code"] == "JHB"  # Should be uppercase
    assert data["province"] == municipality_data["province"]
    assert data["is_active"] is True

    # Verify in database
    result = await db_session.execute(
        select(Municipality).where(Municipality.code == "JHB")
    )
    db_municipality = result.scalar_one_or_none()
    assert db_municipality is not None
    assert db_municipality.name == municipality_data["name"]


async def test_create_municipality_non_admin(
    async_client: AsyncClient,
    citizen_user: User,
    citizen_token: str,
):
    """Non-admin users cannot create municipalities."""
    municipality_data = {
        "name": "City of Cape Town",
        "code": "CPT",
        "province": "Western Cape",
    }

    response = await async_client.post(
        "/api/v1/municipalities/",
        json=municipality_data,
        headers={"Authorization": f"Bearer {citizen_token}"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


async def test_create_duplicate_code(
    async_client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    """Creating municipality with duplicate code returns 409."""
    # Create first municipality
    municipality1 = Municipality(
        name="City of Tshwane",
        code="TSH",
        province="Gauteng",
    )
    db_session.add(municipality1)
    await db_session.commit()

    # Try to create municipality with same code
    municipality_data = {
        "name": "Different Name",
        "code": "TSH",
        "province": "Gauteng",
    }

    response = await async_client.post(
        "/api/v1/municipalities/",
        json=municipality_data,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert "code" in response.json()["detail"].lower()


async def test_list_municipalities(
    async_client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    """Admin can list municipalities."""
    # Create test municipalities
    municipalities = [
        Municipality(name="City of Johannesburg", code="JHB", province="Gauteng"),
        Municipality(name="City of Cape Town", code="CPT", province="Western Cape"),
        Municipality(
            name="eThekwini", code="ETH", province="KwaZulu-Natal", is_active=False
        ),
    ]
    for municipality in municipalities:
        db_session.add(municipality)
    await db_session.commit()

    # List all municipalities
    response = await async_client.get(
        "/api/v1/municipalities/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) >= 3

    # Test filtering by is_active
    response = await async_client.get(
        "/api/v1/municipalities/?is_active=true",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert all(m["is_active"] for m in data)


async def test_get_municipality(
    async_client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    """Admin can get a single municipality by ID."""
    municipality = Municipality(
        name="Nelson Mandela Bay",
        code="NMB",
        province="Eastern Cape",
    )
    db_session.add(municipality)
    await db_session.commit()
    await db_session.refresh(municipality)

    response = await async_client.get(
        f"/api/v1/municipalities/{municipality.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Nelson Mandela Bay"
    assert data["code"] == "NMB"


async def test_update_municipality(
    async_client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    """Admin can update a municipality."""
    municipality = Municipality(
        name="Buffalo City",
        code="BUF",
        province="Eastern Cape",
    )
    db_session.add(municipality)
    await db_session.commit()
    await db_session.refresh(municipality)

    update_data = {
        "name": "Buffalo City Metropolitan Municipality",
        "population": 755200,
        "is_active": False,
    }

    response = await async_client.patch(
        f"/api/v1/municipalities/{municipality.id}",
        json=update_data,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["population"] == update_data["population"]
    assert data["is_active"] is False

    # Verify in database
    await db_session.refresh(municipality)
    assert municipality.name == update_data["name"]
    assert municipality.population == update_data["population"]


async def test_invalid_province(
    async_client: AsyncClient,
    admin_token: str,
):
    """Creating municipality with invalid province returns 422."""
    municipality_data = {
        "name": "Invalid Municipality",
        "code": "INV",
        "province": "Invalid Province",
    }

    response = await async_client.post(
        "/api/v1/municipalities/",
        json=municipality_data,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    errors = response.json()["detail"]
    assert any("province" in str(error).lower() for error in errors)


async def test_municipality_code_uppercase_conversion(
    async_client: AsyncClient,
    admin_token: str,
):
    """Municipality code is automatically converted to uppercase."""
    municipality_data = {
        "name": "Mangaung",
        "code": "man",  # lowercase
        "province": "Free State",
    }

    response = await async_client.post(
        "/api/v1/municipalities/",
        json=municipality_data,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["code"] == "MAN"  # Should be uppercase
