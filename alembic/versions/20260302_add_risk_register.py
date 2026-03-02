"""Add risk register tables (risk_items and risk_mitigations).

Creates the two tables required for the risk register feature (RISK-01, RISK-02):
- risk_items:      Risk items linked to SDBIP KPIs with ISO 31000 risk rating
- risk_mitigations: Mitigation strategies linked to risk items

Revision ID: 20260302_risk_register
Revises: 20260302_evidence_verification
Create Date: 2026-03-02 14:52:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260302_risk_register"
down_revision: Union[str, None] = "20260302_evidence_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create risk_items and risk_mitigations tables."""
    # Create risk_items table
    op.create_table(
        "risk_items",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "kpi_id",
            sa.UUID(),
            sa.ForeignKey("sdbip_kpis.id"),
            nullable=False,
        ),
        sa.Column(
            "department_id",
            sa.UUID(),
            sa.ForeignKey("departments.id"),
            nullable=True,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("likelihood", sa.Integer(), nullable=False),
        sa.Column("impact", sa.Integer(), nullable=False),
        sa.Column(
            "risk_rating",
            sa.String(20),
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "responsible_person_id",
            sa.UUID(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "is_auto_flagged",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("auto_flagged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )

    # Indexes on risk_items
    op.create_index("ix_risk_items_tenant_id", "risk_items", ["tenant_id"])
    op.create_index("ix_risk_items_kpi_id", "risk_items", ["kpi_id"])
    op.create_index("ix_risk_items_department_id", "risk_items", ["department_id"])
    op.create_index(
        "ix_risk_items_responsible_person_id",
        "risk_items",
        ["responsible_person_id"],
    )

    # Create risk_mitigations table
    op.create_table(
        "risk_mitigations",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "risk_item_id",
            sa.UUID(),
            sa.ForeignKey("risk_items.id"),
            nullable=False,
        ),
        sa.Column("strategy", sa.Text(), nullable=False),
        sa.Column(
            "responsible_person_id",
            sa.UUID(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )

    # Indexes on risk_mitigations
    op.create_index(
        "ix_risk_mitigations_risk_item_id",
        "risk_mitigations",
        ["risk_item_id"],
    )
    op.create_index(
        "ix_risk_mitigations_tenant_id",
        "risk_mitigations",
        ["tenant_id"],
    )


def downgrade() -> None:
    """Drop risk register tables."""
    op.drop_table("risk_mitigations")
    op.drop_table("risk_items")
