"""Tests for WhatsApp session model and service methods.

Tests session creation, lookup, expiry, and upsert behavior.
"""
import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from src.models.whatsapp_session import WhatsAppSession
from src.services.whatsapp_service import WhatsAppService


class TestWhatsAppSessionModel:
    """Test WhatsAppSession model."""

    @pytest.mark.asyncio
    async def test_create_whatsapp_session(self, db_session):
        """Creates session with 24hr expiry."""
        phone = "+27123456789"
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        session = WhatsAppSession(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )

        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        assert session.id is not None
        assert session.phone_number == phone
        assert session.user_id == user_id
        assert session.tenant_id == tenant_id
        assert session.expires_at > datetime.now(timezone.utc)
        assert session.is_expired is False

    @pytest.mark.asyncio
    async def test_lookup_valid_session(self, db_session):
        """Returns session when not expired."""
        phone = "+27111222333"
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        # Create session that expires in 24 hours
        session = WhatsAppSession(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )

        db_session.add(session)
        await db_session.commit()

        # Lookup session
        from sqlalchemy import select
        result = await db_session.execute(
            select(WhatsAppSession)
            .where(WhatsAppSession.phone_number == phone)
            .where(WhatsAppSession.expires_at > datetime.now(timezone.utc))
        )
        found_session = result.scalar_one_or_none()

        assert found_session is not None
        assert found_session.phone_number == phone
        assert found_session.is_expired is False

    @pytest.mark.asyncio
    async def test_lookup_expired_session(self, db_session):
        """Returns None when expired."""
        phone = "+27444555666"
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        # Create session that expired 1 hour ago
        session = WhatsAppSession(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )

        db_session.add(session)
        await db_session.commit()

        # Lookup session
        from sqlalchemy import select
        result = await db_session.execute(
            select(WhatsAppSession)
            .where(WhatsAppSession.phone_number == phone)
            .where(WhatsAppSession.expires_at > datetime.now(timezone.utc))
        )
        found_session = result.scalar_one_or_none()

        # Should not find expired session
        assert found_session is None

    @pytest.mark.asyncio
    async def test_session_is_expired_property(self, db_session):
        """is_expired property works correctly."""
        # Future expiry
        future_session = WhatsAppSession(
            phone_number="+27111111111",
            user_id=str(uuid4()),
            tenant_id=str(uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        assert future_session.is_expired is False

        # Past expiry
        past_session = WhatsAppSession(
            phone_number="+27222222222",
            user_id=str(uuid4()),
            tenant_id=str(uuid4()),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        assert past_session.is_expired is True


class TestWhatsAppServiceSessions:
    """Test WhatsAppService session methods."""

    @pytest.mark.asyncio
    async def test_lookup_or_create_session_existing(self, db_session):
        """Returns existing valid session."""
        phone = "+27777888999"
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        # Create existing session
        existing_session = WhatsAppSession(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        db_session.add(existing_session)
        await db_session.commit()

        # Lookup
        service = WhatsAppService()
        result = await service.lookup_or_create_session(phone, db_session)

        assert result is not None
        assert result.phone_number == phone
        assert result.user_id == user_id
        assert result.tenant_id == tenant_id

    @pytest.mark.asyncio
    async def test_lookup_or_create_session_expired(self, db_session):
        """Returns None for expired session."""
        phone = "+27666777888"
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        # Create expired session
        expired_session = WhatsAppSession(
            phone_number=phone,
            user_id=user_id,
            tenant_id=tenant_id,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db_session.add(expired_session)
        await db_session.commit()

        # Lookup
        service = WhatsAppService()
        result = await service.lookup_or_create_session(phone, db_session)

        # Should return None (expired)
        assert result is None

    @pytest.mark.asyncio
    async def test_create_session(self, db_session):
        """Creates new session with 24hr expiry."""
        phone = "+27555666777"
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        service = WhatsAppService()
        session = await service.create_session(phone, user_id, tenant_id, db_session)

        assert session is not None
        assert session.phone_number == phone
        assert session.user_id == user_id
        assert session.tenant_id == tenant_id
        assert session.expires_at > datetime.now(timezone.utc)
        assert session.is_expired is False

    @pytest.mark.asyncio
    async def test_upsert_session(self, db_session):
        """Updates existing session on conflict."""
        phone = "+27999888777"
        old_user_id = str(uuid4())
        new_user_id = str(uuid4())
        old_tenant_id = str(uuid4())
        new_tenant_id = str(uuid4())

        # Create initial session
        service = WhatsAppService()
        session1 = await service.create_session(phone, old_user_id, old_tenant_id, db_session)

        assert session1.user_id == old_user_id
        assert session1.tenant_id == old_tenant_id

        # Create again with different user_id and tenant_id (should update)
        session2 = await service.create_session(phone, new_user_id, new_tenant_id, db_session)

        assert session2.phone_number == phone
        assert session2.user_id == new_user_id
        assert session2.tenant_id == new_tenant_id

        # Verify only one session exists in DB
        from sqlalchemy import select, func
        result = await db_session.execute(
            select(func.count())
            .select_from(WhatsAppSession)
            .where(WhatsAppSession.phone_number == phone)
        )
        count = result.scalar()

        assert count == 1
