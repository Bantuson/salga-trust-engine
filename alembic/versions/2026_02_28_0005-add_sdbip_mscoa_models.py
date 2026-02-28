"""add SDBIP and mSCOA reference models

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-02-28 00:05:00.000000

Adds:
- mscoa_reference table: National Treasury mSCOA v5.5 budget code reference
  (NonTenantModel — no tenant_id; global reference data shared by all municipalities)
- sdbip_scorecards table: Top-layer and departmental SDBIP scorecards per financial year
- sdbip_kpis table: KPIs linking IDP objectives, departments, mSCOA codes, and directors
- sdbip_quarterly_targets table: Q1-Q4 breakdown targets per KPI

Seed data: 30 mSCOA reference codes across IE (15), FX (10), and IA (5) segments.

Golden thread chain after this migration:
    IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi -> SDBIPQuarterlyTarget
"""
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create SDBIP and mSCOA tables with indexes, constraints, and seed data."""

    # ------------------------------------------------------------------
    # 1. mscoa_reference (NonTenantModel — no tenant_id, no RLS)
    # ------------------------------------------------------------------
    op.create_table(
        "mscoa_reference",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("segment", sa.String(5), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("segment", "code", name="uq_mscoa_segment_code"),
    )
    op.create_index("ix_mscoa_reference_segment", "mscoa_reference", ["segment"])

    # ------------------------------------------------------------------
    # 2. sdbip_scorecards
    # ------------------------------------------------------------------
    op.create_table(
        "sdbip_scorecards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("financial_year", sa.String(10), nullable=False),
        sa.Column("layer", sa.String(20), nullable=False),
        sa.Column(
            "department_id",
            sa.Uuid(),
            sa.ForeignKey("departments.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint(
            "financial_year",
            "layer",
            "department_id",
            "tenant_id",
            name="uq_sdbip_scorecard_fy_layer_dept",
        ),
    )
    op.create_index("ix_sdbip_scorecards_tenant_id", "sdbip_scorecards", ["tenant_id"])
    op.create_index("ix_sdbip_scorecards_department_id", "sdbip_scorecards", ["department_id"])

    # ------------------------------------------------------------------
    # 3. sdbip_kpis
    # ------------------------------------------------------------------
    op.create_table(
        "sdbip_kpis",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "scorecard_id",
            sa.Uuid(),
            sa.ForeignKey("sdbip_scorecards.id"),
            nullable=False,
        ),
        sa.Column(
            "idp_objective_id",
            sa.Uuid(),
            sa.ForeignKey("idp_objectives.id"),
            nullable=True,
        ),
        sa.Column(
            "department_id",
            sa.Uuid(),
            sa.ForeignKey("departments.id"),
            nullable=True,
        ),
        sa.Column(
            "mscoa_code_id",
            sa.Uuid(),
            sa.ForeignKey("mscoa_reference.id"),
            nullable=True,
        ),
        sa.Column(
            "responsible_director_id",
            sa.Uuid(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("kpi_number", sa.String(20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("unit_of_measurement", sa.String(50), nullable=False),
        sa.Column("baseline", sa.Numeric(12, 4), nullable=False),
        sa.Column("annual_target", sa.Numeric(12, 4), nullable=False),
        sa.Column("weight", sa.Numeric(5, 2), nullable=False),
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
    op.create_index("ix_sdbip_kpis_tenant_id", "sdbip_kpis", ["tenant_id"])
    op.create_index("ix_sdbip_kpis_scorecard_id", "sdbip_kpis", ["scorecard_id"])
    op.create_index("ix_sdbip_kpis_idp_objective_id", "sdbip_kpis", ["idp_objective_id"])
    op.create_index("ix_sdbip_kpis_department_id", "sdbip_kpis", ["department_id"])
    op.create_index("ix_sdbip_kpis_mscoa_code_id", "sdbip_kpis", ["mscoa_code_id"])
    op.create_index("ix_sdbip_kpis_responsible_director_id", "sdbip_kpis", ["responsible_director_id"])

    # ------------------------------------------------------------------
    # 4. sdbip_quarterly_targets
    # ------------------------------------------------------------------
    op.create_table(
        "sdbip_quarterly_targets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "kpi_id",
            sa.Uuid(),
            sa.ForeignKey("sdbip_kpis.id"),
            nullable=False,
        ),
        sa.Column("quarter", sa.String(2), nullable=False),
        sa.Column("target_value", sa.Numeric(12, 4), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint("kpi_id", "quarter", name="uq_sdbip_qt_kpi_quarter"),
    )
    op.create_index("ix_sdbip_quarterly_targets_tenant_id", "sdbip_quarterly_targets", ["tenant_id"])
    op.create_index("ix_sdbip_quarterly_targets_kpi_id", "sdbip_quarterly_targets", ["kpi_id"])

    # ------------------------------------------------------------------
    # 5. RLS policies on SDBIP tables (PostgreSQL only; skip on SQLite)
    # ------------------------------------------------------------------
    for table in ("sdbip_scorecards", "sdbip_kpis", "sdbip_quarterly_targets"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            f"USING (tenant_id = current_setting('app.current_tenant', true));"
        )
    # mscoa_reference is NonTenantModel — no RLS policy needed

    # ------------------------------------------------------------------
    # 6. Seed mSCOA reference data: 30 stub codes (IE x15, FX x10, IA x5)
    # ------------------------------------------------------------------
    mscoa_table = sa.table(
        "mscoa_reference",
        sa.column("id", sa.Uuid()),
        sa.column("segment", sa.String()),
        sa.column("code", sa.String()),
        sa.column("description", sa.String()),
        sa.column("is_active", sa.Boolean()),
    )

    # IE segment — Expenditure (15 rows)
    ie_codes = [
        ("0100", "Employee Related Costs"),
        ("0200", "Remuneration of Councillors"),
        ("0300", "Depreciation and Asset Impairment"),
        ("0400", "Finance Charges"),
        ("0500", "Bulk Purchases"),
        ("0600", "Contracted Services"),
        ("0700", "Transfers and Subsidies"),
        ("0800", "Other Materials"),
        ("0900", "Other Expenditure"),
        ("1000", "Loss on Disposal of PPE"),
        ("1100", "Fair Value Adjustments"),
        ("1200", "Repairs and Maintenance"),
        ("1300", "General Expenses"),
        ("1400", "Inventory Consumed"),
        ("1500", "Operational Cost"),
    ]

    # FX segment — Function/Service area (10 rows)
    fx_codes = [
        ("0210", "Executive and Council"),
        ("0300", "Community and Social Services"),
        ("0400", "Sport and Recreation"),
        ("0500", "Public Safety"),
        ("0600", "Housing"),
        ("0700", "Health"),
        ("0800", "Road Transport"),
        ("0900", "Planning and Development"),
        ("1000", "Environmental Protection"),
        ("1100", "Water"),
    ]

    # IA segment — Assets (5 rows)
    ia_codes = [
        ("0100", "Land"),
        ("0200", "Buildings"),
        ("0300", "Infrastructure"),
        ("0400", "Community Assets"),
        ("0500", "Other Assets"),
    ]

    seed_rows = []
    for code, description in ie_codes:
        seed_rows.append({"id": uuid4(), "segment": "IE", "code": code, "description": description, "is_active": True})
    for code, description in fx_codes:
        seed_rows.append({"id": uuid4(), "segment": "FX", "code": code, "description": description, "is_active": True})
    for code, description in ia_codes:
        seed_rows.append({"id": uuid4(), "segment": "IA", "code": code, "description": description, "is_active": True})

    op.bulk_insert(mscoa_table, seed_rows)


def downgrade() -> None:
    """Drop SDBIP and mSCOA tables (in dependency order)."""

    # Drop RLS policies on SDBIP tenant-aware tables
    for table in ("sdbip_quarterly_targets", "sdbip_kpis", "sdbip_scorecards"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")

    op.drop_index("ix_sdbip_quarterly_targets_kpi_id", table_name="sdbip_quarterly_targets")
    op.drop_index("ix_sdbip_quarterly_targets_tenant_id", table_name="sdbip_quarterly_targets")
    op.drop_table("sdbip_quarterly_targets")

    op.drop_index("ix_sdbip_kpis_responsible_director_id", table_name="sdbip_kpis")
    op.drop_index("ix_sdbip_kpis_mscoa_code_id", table_name="sdbip_kpis")
    op.drop_index("ix_sdbip_kpis_department_id", table_name="sdbip_kpis")
    op.drop_index("ix_sdbip_kpis_idp_objective_id", table_name="sdbip_kpis")
    op.drop_index("ix_sdbip_kpis_scorecard_id", table_name="sdbip_kpis")
    op.drop_index("ix_sdbip_kpis_tenant_id", table_name="sdbip_kpis")
    op.drop_table("sdbip_kpis")

    op.drop_index("ix_sdbip_scorecards_department_id", table_name="sdbip_scorecards")
    op.drop_index("ix_sdbip_scorecards_tenant_id", table_name="sdbip_scorecards")
    op.drop_table("sdbip_scorecards")

    op.drop_index("ix_mscoa_reference_segment", table_name="mscoa_reference")
    op.drop_table("mscoa_reference")
