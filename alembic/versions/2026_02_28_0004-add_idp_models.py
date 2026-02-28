"""add IDP (Integrated Development Plan) models

Revision ID: c1d2e3f4a5b6
Revises: b3c4d5e6f7a8
Create Date: 2026-02-28 00:04:00.000000

Adds:
- idp_cycles table: 5-year IDP cycle with draft/approved/under_review state machine
- idp_goals table: strategic goals aligned to national KPAs
- idp_objectives table: objectives under each goal (SDBIP KPI anchor points)
- idp_versions table: annual review versions within a cycle

These tables form the top of the "golden thread" hierarchy:
    IDPCycle -> IDPGoal -> IDPObjective -> (Wave 3+) SDBIPKpi
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create IDP tables with RLS policies, indexes, and constraints."""

    # ------------------------------------------------------------------
    # 1. idp_cycles
    # ------------------------------------------------------------------
    op.create_table(
        "idp_cycles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("vision", sa.Text(), nullable=True),
        sa.Column("mission", sa.Text(), nullable=True),
        sa.Column("start_year", sa.Integer(), nullable=False),
        sa.Column("end_year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint("title", "tenant_id", name="uq_idp_cycle_title_tenant"),
    )
    op.create_index("ix_idp_cycles_tenant_id", "idp_cycles", ["tenant_id"])

    # ------------------------------------------------------------------
    # 2. idp_goals
    # ------------------------------------------------------------------
    op.create_table(
        "idp_goals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "cycle_id",
            sa.Uuid(),
            sa.ForeignKey("idp_cycles.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("national_kpa", sa.String(50), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )
    op.create_index("ix_idp_goals_tenant_id", "idp_goals", ["tenant_id"])
    op.create_index("ix_idp_goals_cycle_id", "idp_goals", ["cycle_id"])

    # ------------------------------------------------------------------
    # 3. idp_objectives
    # ------------------------------------------------------------------
    op.create_table(
        "idp_objectives",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "goal_id",
            sa.Uuid(),
            sa.ForeignKey("idp_goals.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )
    op.create_index("ix_idp_objectives_tenant_id", "idp_objectives", ["tenant_id"])
    op.create_index("ix_idp_objectives_goal_id", "idp_objectives", ["goal_id"])

    # ------------------------------------------------------------------
    # 4. idp_versions
    # ------------------------------------------------------------------
    op.create_table(
        "idp_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "cycle_id",
            sa.Uuid(),
            sa.ForeignKey("idp_cycles.id"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("financial_year", sa.String(10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint("cycle_id", "version_number", name="uq_idp_version_cycle"),
    )
    op.create_index("ix_idp_versions_tenant_id", "idp_versions", ["tenant_id"])
    op.create_index("ix_idp_versions_cycle_id", "idp_versions", ["cycle_id"])

    # ------------------------------------------------------------------
    # 5. RLS policies (PostgreSQL only — skip silently in SQLite tests)
    # ------------------------------------------------------------------
    for table in ("idp_cycles", "idp_goals", "idp_objectives", "idp_versions"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            f"USING (tenant_id = current_setting('app.current_tenant', true));"
        )


def downgrade() -> None:
    """Drop IDP tables and their RLS policies."""

    for table in ("idp_versions", "idp_objectives", "idp_goals", "idp_cycles"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")

    op.drop_index("ix_idp_versions_cycle_id", table_name="idp_versions")
    op.drop_index("ix_idp_versions_tenant_id", table_name="idp_versions")
    op.drop_table("idp_versions")

    op.drop_index("ix_idp_objectives_goal_id", table_name="idp_objectives")
    op.drop_index("ix_idp_objectives_tenant_id", table_name="idp_objectives")
    op.drop_table("idp_objectives")

    op.drop_index("ix_idp_goals_cycle_id", table_name="idp_goals")
    op.drop_index("ix_idp_goals_tenant_id", table_name="idp_goals")
    op.drop_table("idp_goals")

    op.drop_index("ix_idp_cycles_tenant_id", table_name="idp_cycles")
    op.drop_table("idp_cycles")
