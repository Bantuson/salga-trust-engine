"""add performance_agreements, pa_kpis, pa_quarterly_scores tables

Revision ID: 2026_03_01_0001
Revises: f4g5h6i7j8k9
Create Date: 2026-03-01 00:01:00.000000

Adds:
- performance_agreements: Individual Performance Agreements for Section 57 managers.
  One PA per (section57_manager_id, financial_year, tenant_id). 4-state lifecycle:
  draft -> signed -> under_review -> assessed.
  POPIA: popia_retention_flag set on assess; popia_departure_date triggers retention.

- pa_kpis: Individual KPIs within a PA, linked to organisational SDBIP KPIs.
  One PAKpi per (agreement_id, sdbip_kpi_id). Weight sum <= 100 enforced at service layer.

- pa_quarterly_scores: Quarterly scores for PA KPIs.
  One score per (pa_kpi_id, quarter).

Golden thread chain after this migration:
    IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi
                                                                |
                                               PerformanceAgreement -> PAKpi -> PAQuarterlyScore
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "2026_03_01_0001"
down_revision: Union[str, None] = "f4g5h6i7j8k9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create performance_agreements, pa_kpis, and pa_quarterly_scores tables."""

    # ------------------------------------------------------------------
    # performance_agreements
    # ------------------------------------------------------------------
    op.create_table(
        "performance_agreements",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "section57_manager_id",
            sa.Uuid(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("financial_year", sa.String(10), nullable=False),
        sa.Column("manager_role", sa.String(30), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("annual_score", sa.Numeric(8, 4), nullable=True),
        sa.Column(
            "popia_retention_flag",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("popia_departure_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.UniqueConstraint(
            "section57_manager_id",
            "financial_year",
            "tenant_id",
            name="uq_pa_manager_fy_tenant",
        ),
    )

    op.create_index(
        "ix_performance_agreements_tenant_id",
        "performance_agreements",
        ["tenant_id"],
    )
    op.create_index(
        "ix_performance_agreements_section57_manager_id",
        "performance_agreements",
        ["section57_manager_id"],
    )

    # RLS policy (PostgreSQL only; skip on SQLite)
    op.execute("ALTER TABLE performance_agreements ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE performance_agreements FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY pa_tenant_isolation ON performance_agreements "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )

    # ------------------------------------------------------------------
    # pa_kpis
    # ------------------------------------------------------------------
    op.create_table(
        "pa_kpis",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "agreement_id",
            sa.Uuid(),
            sa.ForeignKey("performance_agreements.id"),
            nullable=False,
        ),
        sa.Column(
            "sdbip_kpi_id",
            sa.Uuid(),
            sa.ForeignKey("sdbip_kpis.id"),
            nullable=False,
        ),
        sa.Column("individual_target", sa.Numeric(12, 4), nullable=False),
        sa.Column("weight", sa.Numeric(5, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.UniqueConstraint(
            "agreement_id",
            "sdbip_kpi_id",
            name="uq_pa_kpi_agreement_sdbip",
        ),
    )

    op.create_index("ix_pa_kpis_tenant_id", "pa_kpis", ["tenant_id"])
    op.create_index("ix_pa_kpis_agreement_id", "pa_kpis", ["agreement_id"])
    op.create_index("ix_pa_kpis_sdbip_kpi_id", "pa_kpis", ["sdbip_kpi_id"])

    # RLS policy
    op.execute("ALTER TABLE pa_kpis ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE pa_kpis FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY pa_kpis_tenant_isolation ON pa_kpis "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )

    # ------------------------------------------------------------------
    # pa_quarterly_scores
    # ------------------------------------------------------------------
    op.create_table(
        "pa_quarterly_scores",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "pa_kpi_id",
            sa.Uuid(),
            sa.ForeignKey("pa_kpis.id"),
            nullable=False,
        ),
        sa.Column("quarter", sa.String(2), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("scored_by", sa.String(), nullable=True),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.UniqueConstraint(
            "pa_kpi_id",
            "quarter",
            name="uq_pa_score_kpi_quarter",
        ),
    )

    op.create_index(
        "ix_pa_quarterly_scores_tenant_id",
        "pa_quarterly_scores",
        ["tenant_id"],
    )
    op.create_index(
        "ix_pa_quarterly_scores_pa_kpi_id",
        "pa_quarterly_scores",
        ["pa_kpi_id"],
    )

    # RLS policy
    op.execute("ALTER TABLE pa_quarterly_scores ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE pa_quarterly_scores FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY pa_scores_tenant_isolation ON pa_quarterly_scores "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )


def downgrade() -> None:
    """Drop pa_quarterly_scores, pa_kpis, performance_agreements tables (reverse order)."""

    # Drop pa_quarterly_scores first (depends on pa_kpis)
    op.execute(
        "DROP POLICY IF EXISTS pa_scores_tenant_isolation ON pa_quarterly_scores;"
    )
    op.drop_index("ix_pa_quarterly_scores_pa_kpi_id", table_name="pa_quarterly_scores")
    op.drop_index("ix_pa_quarterly_scores_tenant_id", table_name="pa_quarterly_scores")
    op.drop_table("pa_quarterly_scores")

    # Drop pa_kpis (depends on performance_agreements and sdbip_kpis)
    op.execute("DROP POLICY IF EXISTS pa_kpis_tenant_isolation ON pa_kpis;")
    op.drop_index("ix_pa_kpis_sdbip_kpi_id", table_name="pa_kpis")
    op.drop_index("ix_pa_kpis_agreement_id", table_name="pa_kpis")
    op.drop_index("ix_pa_kpis_tenant_id", table_name="pa_kpis")
    op.drop_table("pa_kpis")

    # Drop performance_agreements last
    op.execute("DROP POLICY IF EXISTS pa_tenant_isolation ON performance_agreements;")
    op.drop_index(
        "ix_performance_agreements_section57_manager_id",
        table_name="performance_agreements",
    )
    op.drop_index(
        "ix_performance_agreements_tenant_id",
        table_name="performance_agreements",
    )
    op.drop_table("performance_agreements")
