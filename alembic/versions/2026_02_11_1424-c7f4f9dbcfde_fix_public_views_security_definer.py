"""fix_public_views_security_definer

Revision ID: c7f4f9dbcfde
Revises: 29fc6e5ac39c
Create Date: 2026-02-11 14:24:31.606286

Fix public views to use SECURITY DEFINER instead of default SECURITY INVOKER.

Root Cause:
- Public views (public_ticket_stats, public_municipalities, public_heatmap) were created
  with default SECURITY INVOKER behavior
- When anon role queries these views, they execute with anon's privileges
- Since tickets table explicitly revokes SELECT from anon (defense-in-depth), queries fail
  with "permission denied for table tickets" (42501)

Fix:
- Recreate all three views with SECURITY DEFINER
- Views will execute with owner's (postgres) privileges, allowing safe aggregated access
- Maintains RLS protection on underlying tables while enabling public dashboard queries
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f4f9dbcfde'
down_revision: Union[str, None] = '29fc6e5ac39c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Recreate public views with SECURITY DEFINER."""

    # Drop existing views (will be recreated with SECURITY DEFINER)
    op.execute("DROP VIEW IF EXISTS public.public_ticket_stats CASCADE;")
    op.execute("DROP VIEW IF EXISTS public.public_municipalities CASCADE;")
    op.execute("DROP VIEW IF EXISTS public.public_heatmap CASCADE;")

    # Recreate public_ticket_stats with SECURITY DEFINER
    op.execute("""
        CREATE OR REPLACE VIEW public.public_ticket_stats
        WITH (security_invoker=false)
        AS
        SELECT
            t.tenant_id as municipality_id,
            m.name as municipality_name,
            t.category,
            t.status,
            t.created_at::date as report_date,
            CASE WHEN t.first_responded_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (t.first_responded_at - t.created_at)) / 3600
            END as response_hours,
            CASE WHEN t.resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
            END as resolution_hours
        FROM tickets t
        JOIN municipalities m ON t.tenant_id = m.id::text
        WHERE t.is_sensitive = false
            AND m.is_active = true;
    """)

    op.execute("GRANT SELECT ON public.public_ticket_stats TO anon;")

    # Recreate public_municipalities with SECURITY DEFINER
    op.execute("""
        CREATE OR REPLACE VIEW public.public_municipalities
        WITH (security_invoker=false)
        AS
        SELECT id, name, code, province
        FROM municipalities
        WHERE is_active = true;
    """)

    op.execute("GRANT SELECT ON public.public_municipalities TO anon;")

    # Recreate public_heatmap with SECURITY DEFINER
    op.execute("""
        CREATE OR REPLACE VIEW public.public_heatmap
        WITH (security_invoker=false)
        AS
        SELECT
            ST_Y(ST_SnapToGrid(t.location, 0.01, 0.01)) as lat,
            ST_X(ST_SnapToGrid(t.location, 0.01, 0.01)) as lng,
            COUNT(*) as intensity,
            t.tenant_id as municipality_id
        FROM tickets t
        JOIN municipalities m ON t.tenant_id = m.id::text
        WHERE t.is_sensitive = false
            AND m.is_active = true
            AND t.location IS NOT NULL
        GROUP BY ST_SnapToGrid(t.location, 0.01, 0.01), t.tenant_id
        HAVING COUNT(*) >= 3;
    """)

    op.execute("GRANT SELECT ON public.public_heatmap TO anon;")


def downgrade() -> None:
    """Revert to SECURITY INVOKER (original broken behavior)."""

    # Drop SECURITY DEFINER views
    op.execute("DROP VIEW IF EXISTS public.public_ticket_stats CASCADE;")
    op.execute("DROP VIEW IF EXISTS public.public_municipalities CASCADE;")
    op.execute("DROP VIEW IF EXISTS public.public_heatmap CASCADE;")

    # Recreate with default SECURITY INVOKER (broken - will fail for anon)
    op.execute("""
        CREATE OR REPLACE VIEW public.public_ticket_stats AS
        SELECT
            t.tenant_id as municipality_id,
            m.name as municipality_name,
            t.category,
            t.status,
            t.created_at::date as report_date,
            CASE WHEN t.first_responded_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (t.first_responded_at - t.created_at)) / 3600
            END as response_hours,
            CASE WHEN t.resolved_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
            END as resolution_hours
        FROM tickets t
        JOIN municipalities m ON t.tenant_id = m.id::text
        WHERE t.is_sensitive = false
            AND m.is_active = true;
    """)

    op.execute("GRANT SELECT ON public.public_ticket_stats TO anon;")

    op.execute("""
        CREATE OR REPLACE VIEW public.public_municipalities AS
        SELECT id, name, code, province
        FROM municipalities
        WHERE is_active = true;
    """)

    op.execute("GRANT SELECT ON public.public_municipalities TO anon;")

    op.execute("""
        CREATE OR REPLACE VIEW public.public_heatmap AS
        SELECT
            ST_Y(ST_SnapToGrid(t.location, 0.01, 0.01)) as lat,
            ST_X(ST_SnapToGrid(t.location, 0.01, 0.01)) as lng,
            COUNT(*) as intensity,
            t.tenant_id as municipality_id
        FROM tickets t
        JOIN municipalities m ON t.tenant_id = m.id::text
        WHERE t.is_sensitive = false
            AND m.is_active = true
            AND t.location IS NOT NULL
        GROUP BY ST_SnapToGrid(t.location, 0.01, 0.01), t.tenant_id
        HAVING COUNT(*) >= 3;
    """)

    op.execute("GRANT SELECT ON public.public_heatmap TO anon;")
