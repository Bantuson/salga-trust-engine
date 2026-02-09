"""Tests for audit logging functionality."""
import json
from uuid import uuid4

import pytest
from sqlalchemy import select

from src.core.audit import (
    clear_audit_context,
    current_ip_address,
    current_user_id,
    set_audit_context,
)
from src.models.audit_log import AuditLog, OperationType
from src.models.municipality import Municipality
from src.models.user import User, UserRole

# No module-level markers - individual tests are marked as needed


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_on_user_create(db_session, test_municipality):
    """Test that creating a user generates an audit log entry."""
    # Set audit context
    set_audit_context(user_id="test-admin", ip_address="127.0.0.1")

    # Create a user
    user = User(
        email="newuser@example.com",
        hashed_password="hashed_password",
        full_name="New User",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        role=UserRole.CITIZEN
    )
    db_session.add(user)
    await db_session.commit()

    # Query audit logs
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "users",
            AuditLog.operation == OperationType.CREATE,
            AuditLog.record_id == str(user.id)
        )
    )
    audit_log = result.scalar_one_or_none()

    # Verify audit log was created
    assert audit_log is not None
    assert audit_log.operation == OperationType.CREATE
    assert audit_log.table_name == "users"
    assert audit_log.record_id == str(user.id)
    assert audit_log.user_id == "test-admin"
    assert audit_log.ip_address == "127.0.0.1"
    assert audit_log.tenant_id == str(test_municipality.id)
    assert audit_log.changes is None  # No changes for CREATE

    # Clean up
    clear_audit_context()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_on_user_update(db_session, test_user):
    """Test that updating a user generates an audit log with changes."""
    # Set audit context
    set_audit_context(user_id=str(test_user.id), ip_address="192.168.1.1")

    # Get original values
    original_name = test_user.full_name
    original_phone = test_user.phone

    # Update user
    test_user.full_name = "Updated Name"
    test_user.phone = "+27123456789"
    await db_session.commit()

    # Query audit logs for UPDATE operation
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "users",
            AuditLog.operation == OperationType.UPDATE,
            AuditLog.record_id == str(test_user.id)
        )
    )
    audit_log = result.scalar_one_or_none()

    # Verify audit log was created
    assert audit_log is not None
    assert audit_log.operation == OperationType.UPDATE
    assert audit_log.table_name == "users"
    assert audit_log.record_id == str(test_user.id)
    assert audit_log.user_id == str(test_user.id)
    assert audit_log.ip_address == "192.168.1.1"

    # Verify changes are captured
    assert audit_log.changes is not None
    changes = json.loads(audit_log.changes)
    assert "full_name" in changes
    assert changes["full_name"]["old"] == original_name
    assert changes["full_name"]["new"] == "Updated Name"
    assert "phone" in changes
    assert changes["phone"]["old"] == original_phone
    assert changes["phone"]["new"] == "+27123456789"

    # Clean up
    clear_audit_context()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_on_user_delete(db_session, test_municipality):
    """Test that deleting a user generates an audit log entry."""
    # Set audit context
    set_audit_context(user_id="test-admin", ip_address="10.0.0.1")

    # Create a user to delete
    user = User(
        email="todelete@example.com",
        hashed_password="hashed_password",
        full_name="To Delete",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        role=UserRole.CITIZEN
    )
    db_session.add(user)
    await db_session.commit()
    user_id = user.id

    # Delete user
    await db_session.delete(user)
    await db_session.commit()

    # Query audit logs for DELETE operation
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "users",
            AuditLog.operation == OperationType.DELETE,
            AuditLog.record_id == str(user_id)
        )
    )
    audit_log = result.scalar_one_or_none()

    # Verify audit log was created
    assert audit_log is not None
    assert audit_log.operation == OperationType.DELETE
    assert audit_log.table_name == "users"
    assert audit_log.record_id == str(user_id)
    assert audit_log.user_id == "test-admin"
    assert audit_log.ip_address == "10.0.0.1"
    assert audit_log.changes is None  # No changes for DELETE

    # Clean up
    clear_audit_context()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_captures_tenant(db_session, test_user):
    """Test that audit log captures correct tenant_id."""
    # Set audit context
    set_audit_context(user_id=str(test_user.id))

    # Update user (any operation will do)
    test_user.phone = "+27987654321"
    await db_session.commit()

    # Query audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "users",
            AuditLog.record_id == str(test_user.id)
        ).order_by(AuditLog.timestamp.desc())
    )
    audit_log = result.first()

    # Verify tenant_id is captured
    assert audit_log is not None
    assert audit_log[0].tenant_id == test_user.tenant_id

    # Clean up
    clear_audit_context()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_no_recursion(db_session, test_municipality):
    """Test that creating an audit log doesn't trigger another audit log (no infinite loop)."""
    # Set audit context
    set_audit_context(user_id="test-admin")

    # Create an audit log entry directly
    audit_log = AuditLog(
        tenant_id=str(test_municipality.id),
        user_id="test-admin",
        operation=OperationType.CREATE,
        table_name="test_table",
        record_id=str(uuid4()),
        ip_address="127.0.0.1"
    )
    db_session.add(audit_log)
    await db_session.commit()

    # Query audit logs for audit_logs table (should NOT exist)
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "audit_logs"
        )
    )
    recursive_logs = result.scalars().all()

    # Verify no recursive audit logs were created
    assert len(recursive_logs) == 0

    # Clean up
    clear_audit_context()


def test_audit_context_vars():
    """Test that audit context variables work correctly (pure unit test, sync)."""
    # Set audit context
    set_audit_context(
        user_id="test-user-123",
        ip_address="192.168.0.1",
        user_agent="TestAgent/1.0"
    )

    # Verify context variables are set
    assert current_user_id.get() == "test-user-123"
    assert current_ip_address.get() == "192.168.0.1"

    # Clear context
    clear_audit_context()

    # Verify context variables are cleared
    assert current_user_id.get() is None
    assert current_ip_address.get() is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_without_context(db_session, test_municipality):
    """Test that audit logging works even without audit context set."""
    # Clear any existing context
    clear_audit_context()

    # Create a user without setting audit context
    user = User(
        email="nocontext@example.com",
        hashed_password="hashed_password",
        full_name="No Context User",
        tenant_id=str(test_municipality.id),
        municipality_id=test_municipality.id,
        role=UserRole.CITIZEN
    )
    db_session.add(user)
    await db_session.commit()

    # Query audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "users",
            AuditLog.record_id == str(user.id)
        )
    )
    audit_log = result.scalar_one_or_none()

    # Verify audit log was created with null user_id and ip_address
    assert audit_log is not None
    assert audit_log.operation == OperationType.CREATE
    assert audit_log.user_id is None
    assert audit_log.ip_address is None
    assert audit_log.tenant_id == str(test_municipality.id)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_log_non_tenant_model(db_session):
    """Test that non-tenant models are also audited."""
    # Set audit context
    set_audit_context(user_id="test-admin", ip_address="127.0.0.1")

    # Create a municipality (non-tenant model)
    municipality = Municipality(
        name="Test Municipality Audit",
        municipality_code="TST-AUDIT",
        province="Test Province"
    )
    db_session.add(municipality)
    await db_session.commit()

    # Query audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.table_name == "municipalities",
            AuditLog.record_id == str(municipality.id)
        )
    )
    audit_log = result.scalar_one_or_none()

    # Verify audit log was created
    assert audit_log is not None
    assert audit_log.operation == OperationType.CREATE
    assert audit_log.table_name == "municipalities"
    assert audit_log.tenant_id == "system"  # Non-tenant models use "system"

    # Clean up
    clear_audit_context()
