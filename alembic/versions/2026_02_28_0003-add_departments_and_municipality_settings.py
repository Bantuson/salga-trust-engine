"""add departments and municipality settings

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-02-28 00:03:00.000000

Adds:
- departments table with hierarchical structure and RLS
- department_ticket_category_maps table with RLS
- PMS configuration columns to municipalities table
- department_id FK column to teams table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add departments, municipality PMS settings, and team-department link."""

    # 1. Add PMS configuration columns to municipalities table
    op.add_column("municipalities", sa.Column("category", sa.String(1), nullable=True))
    op.add_column("municipalities", sa.Column("demarcation_code", sa.String(20), nullable=True))
    op.add_column(
        "municipalities",
        sa.Column("sdbip_layers", sa.Integer(), nullable=False, server_default="2")
    )
    op.add_column(
        "municipalities",
        sa.Column("scoring_method", sa.String(20), nullable=False, server_default="percentage")
    )
    op.add_column(
        "municipalities",
        sa.Column("settings_locked", sa.Boolean(), nullable=False, server_default="false")
    )
    op.add_column(
        "municipalities",
        sa.Column("financial_year_start_month", sa.Integer(), nullable=False, server_default="7")
    )

    # 2. Create departments table
    op.create_table(
        "departments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False, index=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column(
            "parent_department_id",
            sa.Uuid(),
            sa.ForeignKey("departments.id"),
            nullable=True
        ),
        sa.Column(
            "assigned_director_id",
            sa.Uuid(),
            sa.ForeignKey("users.id"),
            nullable=True
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint("code", "tenant_id", name="uq_dept_code_tenant"),
    )
    op.create_index("ix_departments_tenant_id", "departments", ["tenant_id"])

    # 3. Create department_ticket_category_maps table
    op.create_table(
        "department_ticket_category_maps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False, index=True),
        sa.Column(
            "department_id",
            sa.Uuid(),
            sa.ForeignKey("departments.id"),
            nullable=False,
            index=True
        ),
        sa.Column("ticket_category", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.UniqueConstraint("ticket_category", "tenant_id", name="uq_ticket_cat_tenant"),
    )
    op.create_index(
        "ix_dept_ticket_cat_maps_tenant_id",
        "department_ticket_category_maps",
        ["tenant_id"]
    )
    op.create_index(
        "ix_dept_ticket_cat_maps_dept_id",
        "department_ticket_category_maps",
        ["department_id"]
    )

    # 4. Add department_id FK to teams (teams nest inside departments)
    op.add_column(
        "teams",
        sa.Column(
            "department_id",
            sa.Uuid(),
            sa.ForeignKey("departments.id"),
            nullable=True
        )
    )

    # 5. Enable RLS on both new tables
    op.execute("ALTER TABLE departments ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE departments FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY departments_tenant_isolation ON departments "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )

    op.execute(
        "ALTER TABLE department_ticket_category_maps ENABLE ROW LEVEL SECURITY;"
    )
    op.execute(
        "ALTER TABLE department_ticket_category_maps FORCE ROW LEVEL SECURITY;"
    )
    op.execute(
        "CREATE POLICY dept_ticket_maps_tenant_isolation ON department_ticket_category_maps "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )


def downgrade() -> None:
    """Remove departments, municipality PMS settings, and team-department link."""

    # Drop RLS policies
    op.execute(
        "DROP POLICY IF EXISTS dept_ticket_maps_tenant_isolation "
        "ON department_ticket_category_maps;"
    )
    op.execute(
        "DROP POLICY IF EXISTS departments_tenant_isolation ON departments;"
    )

    # Remove department_id from teams
    op.drop_column("teams", "department_id")

    # Drop department_ticket_category_maps
    op.drop_index("ix_dept_ticket_cat_maps_dept_id", table_name="department_ticket_category_maps")
    op.drop_index(
        "ix_dept_ticket_cat_maps_tenant_id",
        table_name="department_ticket_category_maps"
    )
    op.drop_table("department_ticket_category_maps")

    # Drop departments
    op.drop_index("ix_departments_tenant_id", table_name="departments")
    op.drop_table("departments")

    # Remove PMS columns from municipalities
    op.drop_column("municipalities", "financial_year_start_month")
    op.drop_column("municipalities", "settings_locked")
    op.drop_column("municipalities", "scoring_method")
    op.drop_column("municipalities", "sdbip_layers")
    op.drop_column("municipalities", "demarcation_code")
    op.drop_column("municipalities", "category")
