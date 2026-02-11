"""add_ticket_update_trigger_for_realtime

Revision ID: c7f87ba5892a
Revises: 8b4d45d48911
Create Date: 2026-02-11 09:01:51.151984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f87ba5892a'
down_revision: Union[str, None] = '8b4d45d48911'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create PostgreSQL trigger for ticket updates to enable Supabase Realtime.

    Creates a trigger function that broadcasts ticket changes via pg_notify.
    Supabase Realtime automatically listens to pg_notify and forwards to WebSocket clients.
    """
    op.execute("""
        -- Create trigger function to notify on ticket changes
        CREATE OR REPLACE FUNCTION notify_ticket_update() RETURNS TRIGGER AS $$
        DECLARE
            payload json;
        BEGIN
            -- Build notification payload with relevant ticket data
            payload := json_build_object(
                'type', TG_OP,
                'ticket_id', NEW.id::text,
                'tracking_number', NEW.tracking_number,
                'status', NEW.status,
                'category', NEW.category,
                'municipality_id', NEW.tenant_id::text,
                'ward_id', NEW.ward_id,
                'is_sensitive', NEW.is_sensitive,
                'updated_at', EXTRACT(EPOCH FROM NEW.updated_at)
            );

            -- Broadcast to municipality channel via pg_notify
            -- Channel name: ticket_updates:{municipality_id}
            PERFORM pg_notify(
                'ticket_updates:' || NEW.tenant_id::text,
                payload::text
            );

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger on tickets table
        DROP TRIGGER IF EXISTS ticket_update_notify ON tickets;
        CREATE TRIGGER ticket_update_notify
        AFTER INSERT OR UPDATE ON tickets
        FOR EACH ROW
        EXECUTE FUNCTION notify_ticket_update();
    """)


def downgrade() -> None:
    """Remove ticket update trigger and function."""
    op.execute("""
        DROP TRIGGER IF EXISTS ticket_update_notify ON tickets;
        DROP FUNCTION IF EXISTS notify_ticket_update();
    """)
