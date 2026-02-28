"""extend_userrole_enum_and_role_assignments

Extends the UserRole enum from 6 flat roles to 18 roles across 4 tiers.
Creates user_role_assignments and tier1_approval_requests tables.
Adds ROLE_CHANGE to OperationType enum.
Creates role_tiers reference table for tier lookups in SQL.

Revision ID: 27_0001_rbac_roles
Revises: a1b2c3d4e5f6
Create Date: 2026-02-28 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = '27_0001_rbac_roles'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Extend enums, create role tier reference table, and add new tables."""

    # -----------------------------------------------------------------------
    # 1. Extend UserRole enum with 12 new values
    #    IMPORTANT: Each ADD VALUE must be a separate op.execute() call.
    #    PostgreSQL does not allow multiple ADD VALUE in one ALTER TYPE.
    # -----------------------------------------------------------------------
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'executive_mayor'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'municipal_manager'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'cfo'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'speaker'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'salga_admin'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'section56_director'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'department_manager'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'pms_officer'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'audit_committee_member'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'internal_auditor'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'mpac_member'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'chief_whip'")

    # -----------------------------------------------------------------------
    # 2. Add ROLE_CHANGE to OperationType enum
    # -----------------------------------------------------------------------
    op.execute("ALTER TYPE operationtype ADD VALUE IF NOT EXISTS 'ROLE_CHANGE'")

    # -----------------------------------------------------------------------
    # 3. Create role_tiers reference table
    #    Maps each of the 18 roles to their tier number (1=Executive, 4=Frontline)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS role_tiers (
            role_name TEXT PRIMARY KEY,
            tier_num  INTEGER NOT NULL
        )
    """)

    role_tier_data = [
        # Tier 1 — Executive
        ("executive_mayor", 1),
        ("municipal_manager", 1),
        ("cfo", 1),
        ("speaker", 1),
        ("admin", 1),
        ("salga_admin", 1),
        # Tier 2 — Directors
        ("section56_director", 2),
        ("ward_councillor", 2),
        ("chief_whip", 2),
        # Tier 3 — Operational
        ("department_manager", 3),
        ("pms_officer", 3),
        ("audit_committee_member", 3),
        ("internal_auditor", 3),
        ("mpac_member", 3),
        ("saps_liaison", 3),
        ("manager", 3),
        # Tier 4 — Frontline
        ("field_worker", 4),
        ("citizen", 4),
    ]

    for role_name, tier_num in role_tier_data:
        op.execute(
            f"INSERT INTO role_tiers (role_name, tier_num) "
            f"VALUES ('{role_name}', {tier_num}) ON CONFLICT DO NOTHING"
        )

    # -----------------------------------------------------------------------
    # 4. Create user_role_assignments table
    # -----------------------------------------------------------------------
    op.create_table(
        "user_role_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.String(), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("assigned_by", sa.String(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.text("NOW()"), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint("user_id", "role", "tenant_id", name="uq_user_role_tenant"),
    )

    # RLS on user_role_assignments
    op.execute("ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE user_role_assignments FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_user_role_assignments ON user_role_assignments
        USING (tenant_id = current_setting('app.tenant_id', true))
    """)

    # -----------------------------------------------------------------------
    # 5. Create tier1_approval_requests table
    # -----------------------------------------------------------------------
    op.create_table(
        "tier1_approval_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.String(), nullable=False, index=True),
        sa.Column("requesting_admin_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=False),
        sa.Column("target_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("requested_role", sa.Text(), nullable=False),
        sa.Column("current_role", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("salga_admin_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.text("NOW()"), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )

    # RLS on tier1_approval_requests
    op.execute("ALTER TABLE tier1_approval_requests ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tier1_approval_requests FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_tier1_approval_requests ON tier1_approval_requests
        USING (tenant_id = current_setting('app.tenant_id', true))
    """)


def downgrade() -> None:
    """Drop role assignment tables and reference data.

    Note: PostgreSQL does not support removing enum values, so the added roles
    in userrole and operationtype enums CANNOT be removed by downgrade.
    """
    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tier1_approval_requests ON tier1_approval_requests")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_user_role_assignments ON user_role_assignments")

    # Drop tables
    op.drop_table("tier1_approval_requests")
    op.drop_table("user_role_assignments")
    op.drop_table("role_tiers")

    # Note: enum value removal is intentionally skipped — PostgreSQL limitation.
