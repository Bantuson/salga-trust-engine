"""Tests for Supabase Realtime integration.

Tests pg_notify trigger and event broadcasting.
"""
import pytest
from unittest.mock import patch, AsyncMock, Mock
from uuid import uuid4


class TestSupabaseRealtime:
    """Test Supabase Realtime pg_notify integration."""

    @pytest.mark.asyncio
    async def test_event_broadcaster_uses_pg_notify(self, db_session):
        """Verify EventBroadcaster uses pg_notify."""
        from src.services.event_broadcaster import EventBroadcaster

        broadcaster = EventBroadcaster()
        municipality_id = str(uuid4())
        event = {
            "type": "ticket_created",
            "ticket_id": str(uuid4()),
            "tracking_number": "TKT-20260211-ABC123"
        }

        # Mock the database execute call
        with patch.object(db_session, 'execute', new_callable=AsyncMock) as mock_execute:
            with patch.object(db_session, 'commit', new_callable=AsyncMock):
                await broadcaster.publish(municipality_id, event, db_session)

                # Verify pg_notify was called
                mock_execute.assert_called_once()
                call_args = mock_execute.call_args[0][0]

                # Check SQL contains pg_notify
                assert "pg_notify" in str(call_args).lower()

    @pytest.mark.asyncio
    async def test_ticket_update_trigger_exists(self):
        """Verify ticket update trigger migration exists."""
        import glob
        migration_files = glob.glob(
            "C:/Users/Bantu/mzansi-agentive/salga-trust-engine/alembic/versions/*add_ticket_update_trigger*.py"
        )

        assert len(migration_files) > 0, "Ticket update trigger migration not found"

        migration_file = migration_files[0]

        with open(migration_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Verify trigger function exists
        assert "notify_ticket_update" in content
        assert "pg_notify" in content
        assert "ticket_updates:" in content

    def test_event_broadcaster_no_redis(self):
        """Verify no Redis imports in event_broadcaster.py."""
        import ast
        import inspect
        from src.services.event_broadcaster import EventBroadcaster

        # Read source file
        source_file = inspect.getfile(EventBroadcaster)

        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse AST to find imports
        tree = ast.parse(content)

        redis_imported = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if 'redis' in alias.name.lower():
                        redis_imported = True
            elif isinstance(node, ast.ImportFrom):
                if node.module and 'redis' in node.module.lower():
                    redis_imported = True

        assert not redis_imported, "Redis should not be imported in event_broadcaster.py"
