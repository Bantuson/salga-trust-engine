"""add_access_requests_onboarding_invitations

Revision ID: feb9e9b8f0ff
Revises: c7f4f9dbcfde
Create Date: 2026-02-11 17:02:57.805697

Create infrastructure for Phase 6.2 frontend features:
- access_requests: Municipality application submissions (public form)
- onboarding_state: Wizard progress tracking per municipality
- team_invitations: Pending team member invites

RLS policies:
- access_requests: Public insert, admin read/update
- onboarding_state: Municipality admin manages own
- team_invitations: Tenant-scoped via tenant_id
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'feb9e9b8f0ff'
down_revision: Union[str, None] = 'c7f4f9dbcfde'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create access_requests, onboarding_state, and team_invitations tables."""

    # Create access_requests table
    op.create_table(
        'access_requests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('municipality_name', sa.String(200), nullable=False),
        sa.Column('province', sa.String(50), nullable=False),
        sa.Column('municipality_code', sa.String(20), nullable=True),
        sa.Column('contact_name', sa.String(200), nullable=False),
        sa.Column('contact_email', sa.String(200), nullable=False),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('supporting_docs', sa.Text, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewed_by', UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create onboarding_state table
    op.create_table(
        'onboarding_state',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('municipality_id', UUID(as_uuid=True), sa.ForeignKey('municipalities.id'), nullable=False),
        sa.Column('step_id', sa.String(50), nullable=False),
        sa.Column('step_data', sa.Text, nullable=True),
        sa.Column('is_completed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('municipality_id', 'step_id', name='uq_onboarding_municipality_step'),
    )

    # Create index on municipality_id for onboarding_state
    op.create_index('ix_onboarding_state_municipality_id', 'onboarding_state', ['municipality_id'])

    # Create team_invitations table
    op.create_table(
        'team_invitations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', sa.String, nullable=False),
        sa.Column('municipality_id', UUID(as_uuid=True), sa.ForeignKey('municipalities.id'), nullable=False),
        sa.Column('email', sa.String(200), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('invited_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String, nullable=True),
        sa.Column('updated_by', sa.String, nullable=True),
    )

    # Create indexes on team_invitations
    op.create_index('ix_team_invitations_tenant_id', 'team_invitations', ['tenant_id'])
    op.create_index('ix_team_invitations_municipality_id', 'team_invitations', ['municipality_id'])

    # Enable Row Level Security on all three tables
    op.execute("ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;")

    # RLS policies for access_requests table
    # Public can submit access requests (no auth required)
    op.execute("""
        CREATE POLICY "public_insert_access_requests" ON access_requests
        FOR INSERT
        WITH CHECK (true);
    """)

    # Admins/platform_admins can view all access requests
    op.execute("""
        CREATE POLICY "admins_select_access_requests" ON access_requests
        FOR SELECT TO authenticated
        USING (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'platform_admin')
        );
    """)

    # Admins/platform_admins can update access requests (for review)
    op.execute("""
        CREATE POLICY "admins_update_access_requests" ON access_requests
        FOR UPDATE TO authenticated
        USING (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'platform_admin')
        );
    """)

    # RLS policies for onboarding_state table
    # Municipality admins can manage their own onboarding state
    op.execute("""
        CREATE POLICY "municipality_admins_manage_onboarding" ON onboarding_state
        FOR ALL TO authenticated
        USING (
            municipality_id::text = (auth.jwt() -> 'app_metadata' ->> 'municipality_id')
        );
    """)

    # RLS policies for team_invitations table
    # Tenant-scoped: Users can only see invitations for their tenant
    op.execute("""
        CREATE POLICY "tenant_select_team_invitations" ON team_invitations
        FOR SELECT TO authenticated
        USING (
            tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_insert_team_invitations" ON team_invitations
        FOR INSERT TO authenticated
        WITH CHECK (
            tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_update_team_invitations" ON team_invitations
        FOR UPDATE TO authenticated
        USING (
            tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        );
    """)

    op.execute("""
        CREATE POLICY "tenant_delete_team_invitations" ON team_invitations
        FOR DELETE TO authenticated
        USING (
            tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        );
    """)


def downgrade() -> None:
    """Drop access_requests, onboarding_state, and team_invitations tables."""

    # Drop tables (RLS policies are automatically dropped with tables)
    op.drop_table('team_invitations')
    op.drop_table('onboarding_state')
    op.drop_table('access_requests')
