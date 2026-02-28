"""add sdbip_ticket_aggregation_rules table

Revision ID: 2026_02_28_0007
Revises: 2026_02_28_0006
Create Date: 2026-02-28 22:00:00.000000

Migration for Phase 28 Plan 06 — adds configurable aggregation rules that
drive the auto-population of SDBIP actuals from resolved ticket data.

SEC-05 NOTE: The is_sensitive=FALSE GBV exclusion filter is enforced at the
application layer (AutoPopulationEngine), not in this schema. The table stores
the category and aggregation type only; the SEC-05 filter is unconditional.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "2026_02_28_0007"
down_revision = "2026_02_28_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sdbip_ticket_aggregation_rules",
        sa.Column("id", sa.UUID(), nullable=False, comment="Primary key"),
        sa.Column(
            "tenant_id",
            sa.String(length=255),
            nullable=False,
            comment="Municipality tenant identifier for RLS",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "kpi_id",
            sa.UUID(),
            nullable=False,
            comment="FK to the SDBIP KPI this rule populates",
        ),
        sa.Column(
            "ticket_category",
            sa.String(length=50),
            nullable=False,
            comment="TicketCategory value to filter tickets (e.g., 'water', 'roads')",
        ),
        sa.Column(
            "aggregation_type",
            sa.String(length=10),
            nullable=False,
            comment="Aggregation function: 'count', 'sum', or 'avg'",
        ),
        sa.Column(
            "formula_description",
            sa.Text(),
            nullable=True,
            comment="Human-readable description of what this rule measures",
        ),
        sa.Column(
            "source_query_ref",
            sa.String(length=500),
            nullable=True,
            comment="Auto-generated query reference string (set by engine at run-time)",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
            comment="Inactive rules are skipped by the auto-population engine",
        ),
        sa.ForeignKeyConstraint(
            ["kpi_id"],
            ["sdbip_kpis.id"],
            name="fk_aggr_rule_kpi_id",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "kpi_id",
            "ticket_category",
            name="uq_agg_rule_kpi_category",
        ),
        comment=(
            "Configurable rules mapping SDBIP KPIs to auto-population queries on the "
            "ticket table. SEC-05: is_sensitive=FALSE filter applied by AutoPopulationEngine."
        ),
    )
    op.create_index(
        "ix_sdbip_aggr_rules_kpi_id",
        "sdbip_ticket_aggregation_rules",
        ["kpi_id"],
    )
    op.create_index(
        "ix_sdbip_aggr_rules_tenant_id",
        "sdbip_ticket_aggregation_rules",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_sdbip_aggr_rules_tenant_id", table_name="sdbip_ticket_aggregation_rules")
    op.drop_index("ix_sdbip_aggr_rules_kpi_id", table_name="sdbip_ticket_aggregation_rules")
    op.drop_table("sdbip_ticket_aggregation_rules")
