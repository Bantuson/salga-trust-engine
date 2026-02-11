"""migrate_rls_to_supabase_auth

Revision ID: 29fc6e5ac39c
Revises: 5f29713d7483
Create Date: 2026-02-11 09:15:59.256297

Migrate Row Level Security policies from SET LOCAL app.current_tenant pattern
to Supabase auth.jwt() pattern. This is the critical security migration for
Supabase Auth integration.

Changes:
- Drop old RLS policies that used current_setting('app.current_tenant')
- Create new RLS policies using auth.jwt() -> 'app_metadata' ->> 'tenant_id'
- Add role-specific policies for tickets (manager, ward_councillor, citizen, saps_liaison)
- Create public views for anon role (public_ticket_stats, public_municipalities, public_heatmap)
- Ensure GBV tickets excluded from all public views via is_sensitive filter
- Add indexes on all RLS policy columns for performance
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29fc6e5ac39c'
down_revision: Union[str, None] = '5f29713d7483'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate RLS policies to Supabase auth.jwt() pattern."""

    # List of tenant-aware tables (from grep results)
    tenant_tables = [
        'users',
        'tickets',
        'consent_records',
        'media_attachments',
        'teams',
        'ticket_assignments',
    ]

    # Step 1: Drop old RLS policies that used SET LOCAL app.current_tenant
    for table in tenant_tables:
        # Drop old tenant isolation policies (may not exist on first install, use IF EXISTS)
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_select_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_insert_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_update_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_delete_{table} ON {table};")

    # Also drop any role-specific policies that might exist
    op.execute("DROP POLICY IF EXISTS managers_all_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS ward_councillor_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS citizen_own_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS saps_gbv_tickets ON tickets;")

    # Step 2: Create new RLS policies using auth.jwt() for ALL tenant-aware tables
    # For each table, create standard CRUD policies

    # USERS table
    op.execute("""
        CREATE POLICY "tenant_select_users" ON users
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_insert_users" ON users
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_users" ON users
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_users" ON users
        FOR DELETE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    # CONSENT_RECORDS table
    op.execute("""
        CREATE POLICY "tenant_select_consent_records" ON consent_records
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_insert_consent_records" ON consent_records
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_consent_records" ON consent_records
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_consent_records" ON consent_records
        FOR DELETE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    # MEDIA_ATTACHMENTS table
    op.execute("""
        CREATE POLICY "tenant_select_media_attachments" ON media_attachments
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_insert_media_attachments" ON media_attachments
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_media_attachments" ON media_attachments
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_media_attachments" ON media_attachments
        FOR DELETE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    # TEAMS table
    op.execute("""
        CREATE POLICY "tenant_select_teams" ON teams
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_insert_teams" ON teams
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_teams" ON teams
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_teams" ON teams
        FOR DELETE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    # TICKET_ASSIGNMENTS table
    op.execute("""
        CREATE POLICY "tenant_select_ticket_assignments" ON ticket_assignments
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_insert_ticket_assignments" ON ticket_assignments
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_ticket_assignments" ON ticket_assignments
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_ticket_assignments" ON ticket_assignments
        FOR DELETE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    # Step 3: Create role-specific policies for TICKETS table
    # TICKETS table has special role-based access control

    # Base INSERT/UPDATE/DELETE policies for tickets (tenant-scoped)
    op.execute("""
        CREATE POLICY "tenant_insert_tickets" ON tickets
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_tickets" ON tickets
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_tickets" ON tickets
        FOR DELETE TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
        );
    """)

    # SELECT policies are role-specific

    # Managers and admins see all tickets in their tenant (except GBV if not SAPS)
    op.execute("""
        CREATE POLICY "managers_all_tickets" ON tickets
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
            AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('manager', 'admin')
            AND (
                is_sensitive = false
                OR (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
            )
        );
    """)

    # Ward councillors see only their ward's tickets (ward filtering to be added when ward_id in JWT)
    op.execute("""
        CREATE POLICY "ward_councillor_tickets" ON tickets
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
            AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'ward_councillor'
            AND is_sensitive = false
        );
    """)

    # Citizens see only their own tickets (non-GBV)
    op.execute("""
        CREATE POLICY "citizen_own_tickets" ON tickets
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
            AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'citizen'
            AND created_by = (SELECT auth.uid()::text)
            AND is_sensitive = false
        );
    """)

    # Field workers see tickets assigned to them
    op.execute("""
        CREATE POLICY "field_worker_assigned_tickets" ON tickets
        FOR SELECT TO authenticated
        USING (
            tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
            AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'field_worker'
            AND is_sensitive = false
            AND id IN (
                SELECT ticket_id FROM ticket_assignments
                WHERE user_id = (SELECT auth.uid()::text)
                AND is_current = true
            )
        );
    """)

    # GBV tickets: SAPS_LIAISON and ADMIN only (SEC-05 firewall at DB level)
    op.execute("""
        CREATE POLICY "saps_gbv_tickets" ON tickets
        FOR SELECT TO authenticated
        USING (
            is_sensitive = true
            AND tenant_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
            AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('saps_liaison', 'admin')
        );
    """)

    # Step 4: Create public views for anon role (public dashboard)

    # REVOKE direct access to tickets from anon (defense-in-depth)
    op.execute("REVOKE SELECT ON tickets FROM anon;")

    # Create public aggregation view (no PII, no GBV)
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

    # Grant anon read access to view only
    op.execute("GRANT SELECT ON public.public_ticket_stats TO anon;")

    # Municipality list view for public dashboard
    op.execute("""
        CREATE OR REPLACE VIEW public.public_municipalities AS
        SELECT id, name, code, province
        FROM municipalities
        WHERE is_active = true;
    """)

    op.execute("GRANT SELECT ON public.public_municipalities TO anon;")

    # Heatmap view (aggregated, k-anonymity >= 3)
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

    # Step 5: Ensure ALL RLS policy columns are indexed
    # (Most already exist from previous migrations, but use IF NOT EXISTS for safety)

    op.execute("CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tickets_is_sensitive ON tickets(is_sensitive);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON teams(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_consent_records_tenant_id ON consent_records(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_media_attachments_tenant_id ON media_attachments(tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ticket_assignments_tenant_id ON ticket_assignments(tenant_id);")


def downgrade() -> None:
    """Revert to SET LOCAL app.current_tenant pattern."""

    tenant_tables = [
        'users',
        'tickets',
        'consent_records',
        'media_attachments',
        'teams',
        'ticket_assignments',
    ]

    # Drop Supabase auth.jwt() policies
    for table in tenant_tables:
        op.execute(f"DROP POLICY IF EXISTS tenant_select_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_insert_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_update_{table} ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_delete_{table} ON {table};")

    # Drop role-specific ticket policies
    op.execute("DROP POLICY IF EXISTS managers_all_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS ward_councillor_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS citizen_own_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS field_worker_assigned_tickets ON tickets;")
    op.execute("DROP POLICY IF EXISTS saps_gbv_tickets ON tickets;")

    # Drop public views
    op.execute("DROP VIEW IF EXISTS public.public_heatmap;")
    op.execute("DROP VIEW IF EXISTS public.public_municipalities;")
    op.execute("DROP VIEW IF EXISTS public.public_ticket_stats;")

    # Restore old RLS policies using current_setting('app.current_tenant')
    for table in tenant_tables:
        op.execute(f"""
            CREATE POLICY tenant_isolation_{table} ON {table}
            USING (tenant_id = current_setting('app.current_tenant', TRUE));
        """)
