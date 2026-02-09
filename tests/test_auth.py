"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.main import app
from src.models.municipality import Municipality
from src.models.user import User


@pytest.fixture
async def test_municipality(db_session: AsyncSession) -> Municipality:
    """Create a test municipality."""
    municipality = Municipality(
        name="Test Municipality",
        code="TEST001",
        province="Gauteng",
        population=100000,
        is_active=True,
        contact_email="test@municipality.gov.za"
    )
    db_session.add(municipality)
    await db_session.commit()
    await db_session.refresh(municipality)
    return municipality


@pytest.fixture
def valid_registration_data(test_municipality: Municipality) -> dict:
    """Valid registration data."""
    return {
        "email": "testuser@example.com",
        "password": "securepass123",
        "full_name": "Test User",
        "phone": "+27123456789",
        "preferred_language": "en",
        "municipality_code": test_municipality.code,
        "consent": {
            "purpose": "platform_registration",
            "purpose_description": "I consent to data processing",
            "language": "en",
            "consented": True
        }
    }


@pytest.mark.asyncio
async def test_register_success(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test successful user registration."""
    response = await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == valid_registration_data["email"]
    assert data["full_name"] == valid_registration_data["full_name"]
    assert data["role"] == "citizen"
    assert data["is_active"] is True
    assert "id" in data

    # Verify user was created in database
    result = await db_session.execute(
        select(User).where(User.email == valid_registration_data["email"])
    )
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.email == valid_registration_data["email"]


@pytest.mark.asyncio
async def test_register_requires_consent(
    async_client: AsyncClient,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test that registration requires consent."""
    # Remove consent from registration data
    invalid_data = valid_registration_data.copy()
    invalid_data["consent"]["consented"] = False

    response = await async_client.post("/api/v1/auth/register", json=invalid_data)

    assert response.status_code == 422
    assert "consent" in response.text.lower()


@pytest.mark.asyncio
async def test_register_duplicate_email(
    async_client: AsyncClient,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test that duplicate email registration returns 409."""
    # Register first user
    await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    # Try to register with same email
    response = await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    assert response.status_code == 409
    assert "already registered" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_success(
    async_client: AsyncClient,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test successful login with valid credentials."""
    # Register user first
    await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    # Login
    login_data = {
        "email": valid_registration_data["email"],
        "password": valid_registration_data["password"]
    }
    response = await async_client.post("/api/v1/auth/login", json=login_data)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(
    async_client: AsyncClient,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test login with wrong password returns generic error."""
    # Register user first
    await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    # Try to login with wrong password
    login_data = {
        "email": valid_registration_data["email"],
        "password": "wrongpassword123"
    }
    response = await async_client.post("/api/v1/auth/login", json=login_data)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_nonexistent_user(async_client: AsyncClient):
    """Test login with non-existent email returns generic error."""
    login_data = {
        "email": "nonexistent@example.com",
        "password": "somepassword123"
    }
    response = await async_client.post("/api/v1/auth/login", json=login_data)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_protected_endpoint_no_token(async_client: AsyncClient):
    """Test accessing protected endpoint without token."""
    response = await async_client.get("/api/v1/users/me")

    assert response.status_code == 403  # HTTPBearer returns 403 when no token


@pytest.mark.asyncio
async def test_protected_endpoint_with_token(
    async_client: AsyncClient,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test accessing protected endpoint with valid token."""
    # Register and login
    await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    login_data = {
        "email": valid_registration_data["email"],
        "password": valid_registration_data["password"]
    }
    login_response = await async_client.post("/api/v1/auth/login", json=login_data)
    tokens = login_response.json()

    # Access protected endpoint
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    response = await async_client.get("/api/v1/users/me", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == valid_registration_data["email"]


@pytest.mark.asyncio
async def test_refresh_token(
    async_client: AsyncClient,
    test_municipality: Municipality,
    valid_registration_data: dict
):
    """Test token refresh endpoint."""
    # Register and login
    await async_client.post("/api/v1/auth/register", json=valid_registration_data)

    login_data = {
        "email": valid_registration_data["email"],
        "password": valid_registration_data["password"]
    }
    login_response = await async_client.post("/api/v1/auth/login", json=login_data)
    tokens = login_response.json()

    # Refresh token
    refresh_data = {"refresh_token": tokens["refresh_token"]}
    response = await async_client.post("/api/v1/auth/refresh", json=refresh_data)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    # New tokens should be different from old ones
    assert data["access_token"] != tokens["access_token"]
    assert data["refresh_token"] != tokens["refresh_token"]
