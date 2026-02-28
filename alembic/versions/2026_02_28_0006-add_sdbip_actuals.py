"""add sdbip_actuals table for quarterly performance actuals

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-02-28 00:06:00.000000

Adds:
- sdbip_actuals table: Quarterly actual performance values submitted by directors.
  Includes auto-computed achievement_pct and traffic_light_status (green/amber/red).
  Immutability enforced at API layer (is_validated=True -> 422 on PUT/PATCH).
  Corrections create new records with corrects_actual_id FK to the original.

Golden thread chain after this migration:
    IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi
                                                                |
                                                    SDBIPQuarterlyTarget + SDBIPActual
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create sdbip_actuals table with indexes and RLS policies."""

    # ------------------------------------------------------------------
    # sdbip_actuals
    # ------------------------------------------------------------------
    op.create_table(
        "sdbip_actuals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "kpi_id",
            sa.Uuid(),
            sa.ForeignKey("sdbip_kpis.id"),
            nullable=False,
        ),
        sa.Column("quarter", sa.String(2), nullable=False),
        sa.Column("financial_year", sa.String(10), nullable=False),
        sa.Column("actual_value", sa.Numeric(12, 4), nullable=False),
        sa.Column("achievement_pct", sa.Numeric(8, 4), nullable=True),
        sa.Column("traffic_light_status", sa.String(10), nullable=True),
        sa.Column("submitted_by", sa.String(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_validated",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("validated_by", sa.String(), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "corrects_actual_id",
            sa.Uuid(),
            sa.ForeignKey("sdbip_actuals.id"),
            nullable=True,
        ),
        sa.Column(
            "is_auto_populated",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("source_query_ref", sa.String(500), nullable=True),
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

    op.create_index("ix_sdbip_actuals_tenant_id", "sdbip_actuals", ["tenant_id"])
    op.create_index("ix_sdbip_actuals_kpi_id", "sdbip_actuals", ["kpi_id"])
    op.create_index(
        "ix_sdbip_actuals_corrects_actual_id",
        "sdbip_actuals",
        ["corrects_actual_id"],
    )

    # ------------------------------------------------------------------
    # RLS policy on sdbip_actuals (PostgreSQL only; skip on SQLite)
    # ------------------------------------------------------------------
    op.execute("ALTER TABLE sdbip_actuals ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE sdbip_actuals FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY sdbip_actuals_tenant_isolation ON sdbip_actuals "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )


def downgrade() -> None:
    """Drop sdbip_actuals table and its RLS policy."""

    op.execute("DROP POLICY IF EXISTS sdbip_actuals_tenant_isolation ON sdbip_actuals;")

    op.drop_index("ix_sdbip_actuals_corrects_actual_id", table_name="sdbip_actuals")
    op.drop_index("ix_sdbip_actuals_kpi_id", table_name="sdbip_actuals")
    op.drop_index("ix_sdbip_actuals_tenant_id", table_name="sdbip_actuals")

    op.drop_table("sdbip_actuals")
