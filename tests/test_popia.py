"""Tests for POPIA compliance endpoints (data rights and consent management)."""
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from src.core.security import create_access_token
from src.models.audit_log import AuditLog
from src.models.consent import ConsentRecord
from src.models.user import User


@pytest.mark.integration
async def test_data_access_returns_all_user_data(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test that /my-data returns comprehensive user data export."""
    # Create a consent record for the user
    consent = ConsentRecord(
        user_id=test_user.id,
        tenant_id=test_user.tenant_id,
        purpose="test_purpose",
        purpose_description="Test consent",
        language="en",
        consented=True,
        ip_address="127.0.0.1"
    )
    db_session.add(consent)
    await db_session.commit()

    # Create access token
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    # Request data export
    response = await async_client.get(
        "/api/v1/data-rights/my-data",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify profile data is present
    assert "profile" in data
    assert data["profile"]["email"] == test_user.email
    assert data["profile"]["full_name"] == test_user.full_name
    assert data["profile"]["phone"] == test_user.phone

    # Verify consent records are present
    assert "consent_records" in data
    assert len(data["consent_records"]) >= 1
    assert data["consent_records"][0]["purpose"] == "test_purpose"

    # Verify activity log is present
    assert "activity_log" in data
    assert isinstance(data["activity_log"], list)

    # Verify export timestamp
    assert "export_timestamp" in data


@pytest.mark.integration
async def test_data_access_requires_auth(async_client: AsyncClient):
    """Test that /my-data requires authentication."""
    response = await async_client.get("/api/v1/data-rights/my-data")
    assert response.status_code == 401


@pytest.mark.integration
async def test_delete_account_anonymizes_pii(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test that DELETE /delete-account anonymizes PII and soft-deletes user."""
    original_email = test_user.email
    original_name = test_user.full_name
    original_phone = test_user.phone
    user_id = test_user.id

    # Create access token
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    # Delete account
    response = await async_client.delete(
        "/api/v1/data-rights/delete-account",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "account_deleted"
    assert "deleted_at" in data

    # Verify user data is anonymized in database
    result = await db_session.execute(select(User).where(User.id == user_id))
    deleted_user = result.scalar_one()

    assert deleted_user.is_deleted is True
    assert deleted_user.deleted_at is not None
    assert deleted_user.email != original_email
    assert deleted_user.email == f"deleted_{user_id}@anonymized.local"
    assert deleted_user.full_name == "Deleted User"
    assert deleted_user.phone is None
    assert deleted_user.hashed_password == ""  # Invalidated


@pytest.mark.integration
async def test_deleted_user_cannot_login(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test that after account deletion, user cannot log in."""
    original_email = test_user.email

    # Create access token and delete account
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    await async_client.delete(
        "/api/v1/data-rights/delete-account",
        headers={"Authorization": f"Bearer {token}"}
    )

    # Attempt to login with old credentials
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": original_email,
            "password": "testpassword123"
        },
        headers={"X-Tenant-ID": test_user.tenant_id}
    )

    # Login should fail (user not found or invalid credentials)
    assert login_response.status_code in [401, 404]


@pytest.mark.integration
async def test_consent_list(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test that user can list their consent records."""
    # Create consent records
    consent1 = ConsentRecord(
        user_id=test_user.id,
        tenant_id=test_user.tenant_id,
        purpose="marketing",
        purpose_description="Marketing communications",
        language="en",
        consented=True,
        ip_address="127.0.0.1"
    )
    consent2 = ConsentRecord(
        user_id=test_user.id,
        tenant_id=test_user.tenant_id,
        purpose="analytics",
        purpose_description="Usage analytics",
        language="en",
        consented=True,
        ip_address="127.0.0.1"
    )
    db_session.add_all([consent1, consent2])
    await db_session.commit()

    # Create access token
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    # List consents
    response = await async_client.get(
        "/api/v1/consent/",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    consents = response.json()
    assert len(consents) >= 2
    purposes = [c["purpose"] for c in consents]
    assert "marketing" in purposes
    assert "analytics" in purposes


@pytest.mark.integration
async def test_consent_withdraw(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test that user can withdraw consent."""
    # Create consent record
    consent = ConsentRecord(
        user_id=test_user.id,
        tenant_id=test_user.tenant_id,
        purpose="data_sharing",
        purpose_description="Share data with partners",
        language="en",
        consented=True,
        ip_address="127.0.0.1",
        withdrawn=False
    )
    db_session.add(consent)
    await db_session.commit()
    consent_id = consent.id

    # Create access token
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    # Withdraw consent
    response = await async_client.post(
        f"/api/v1/consent/{consent_id}/withdraw",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["withdrawn"] is True
    assert data["withdrawn_at"] is not None

    # Verify in database
    result = await db_session.execute(
        select(ConsentRecord).where(ConsentRecord.id == consent_id)
    )
    updated_consent = result.scalar_one()
    assert updated_consent.withdrawn is True
    assert updated_consent.withdrawn_at is not None


@pytest.mark.integration
async def test_consent_belongs_to_user(
    async_client: AsyncClient,
    test_user: User,
    db_session,
    test_municipality
):
    """Test that user cannot withdraw another user's consent."""
    # Create another user
    from src.core.security import get_password_hash
    other_user = User(
        email="otheruser@example.com",
        hashed_password=get_password_hash("password"),
        full_name="Other User",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        is_active=True
    )
    db_session.add(other_user)
    await db_session.commit()

    # Create consent for other user
    consent = ConsentRecord(
        user_id=other_user.id,
        tenant_id=other_user.tenant_id,
        purpose="test",
        purpose_description="Test",
        language="en",
        consented=True,
        ip_address="127.0.0.1"
    )
    db_session.add(consent)
    await db_session.commit()
    consent_id = consent.id

    # Create access token for test_user
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    # Try to withdraw other user's consent
    response = await async_client.post(
        f"/api/v1/consent/{consent_id}/withdraw",
        headers={"Authorization": f"Bearer {token}"}
    )

    # Should return 404 (consent not found for this user)
    assert response.status_code == 404


@pytest.mark.integration
async def test_audit_logs_preserved_after_deletion(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test that audit logs are NOT deleted when user account is deleted."""
    user_id = str(test_user.id)

    # Create some audit logs for the user (simulate activity)
    audit_log = AuditLog(
        tenant_id=test_user.tenant_id,
        user_id=user_id,
        operation="CREATE",
        table_name="test_table",
        record_id=str(uuid4()),
        ip_address="127.0.0.1"
    )
    db_session.add(audit_log)
    await db_session.commit()

    # Create access token and delete account
    token = create_access_token({
        "sub": user_id,
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    await async_client.delete(
        "/api/v1/data-rights/delete-account",
        headers={"Authorization": f"Bearer {token}"}
    )

    # Verify audit logs still exist
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.user_id == user_id)
    )
    remaining_logs = result.scalars().all()

    # Audit logs should NOT be deleted (legal requirement)
    assert len(remaining_logs) > 0


@pytest.mark.integration
async def test_consent_create(
    async_client: AsyncClient,
    test_user: User,
    db_session
):
    """Test creating a new consent record."""
    # Create access token
    token = create_access_token({
        "sub": str(test_user.id),
        "tenant_id": test_user.tenant_id,
        "role": test_user.role.value
    })

    # Create consent
    response = await async_client.post(
        "/api/v1/consent/",
        json={
            "purpose": "email_notifications",
            "purpose_description": "Receive email notifications about service updates",
            "language": "en",
            "consented": True
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["purpose"] == "email_notifications"
    assert data["consented"] is True
    assert data["withdrawn"] is False
    assert data["user_id"] == str(test_user.id)

    # Verify in database
    result = await db_session.execute(
        select(ConsentRecord).where(
            ConsentRecord.user_id == test_user.id,
            ConsentRecord.purpose == "email_notifications"
        )
    )
    consent = result.scalar_one_or_none()
    assert consent is not None
    assert consent.consented is True
