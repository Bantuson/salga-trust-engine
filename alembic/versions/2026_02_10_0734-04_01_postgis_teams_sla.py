"""add_postgis_teams_sla

Revision ID: 04_01_postgis
Revises: 02_01_ticket
Create Date: 2026-02-10 07:34:00.000000

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy import func

# revision identifiers, used by Alembic.
revision: str = '04_01_postgis'
down_revision: Union[str, None] = '02_01_ticket'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # Create teams table
    op.create_table(
        "teams",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid4),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("service_area", Geometry("POLYGON", srid=4326), nullable=True),
        sa.Column("manager_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_saps", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_teams_tenant_id", "teams", ["tenant_id"])
    op.create_index("ix_teams_category", "teams", ["category"])
    # GIST index for spatial queries
    op.execute("CREATE INDEX ix_teams_service_area ON teams USING gist (service_area)")

    # Create ticket_assignments table
    op.create_table(
        "ticket_assignments",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid4),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("team_id", sa.Uuid(), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("assigned_to", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("assigned_by", sa.String(), nullable=True),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ticket_assignments_ticket_id", "ticket_assignments", ["ticket_id"])
    op.create_index("ix_ticket_assignments_tenant_id", "ticket_assignments", ["tenant_id"])

    # Create sla_configs table (NonTenantModel - no tenant_id)
    op.create_table(
        "sla_configs",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid4),
        sa.Column("municipality_id", sa.Uuid(), sa.ForeignKey("municipalities.id"), nullable=False),
        sa.Column("category", sa.String(20), nullable=True),
        sa.Column("response_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("resolution_hours", sa.Integer(), nullable=False, server_default="168"),
        sa.Column("warning_threshold_pct", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint(
        "uq_sla_config_municipality_category",
        "sla_configs",
        ["municipality_id", "category"]
    )

    # Modify tickets table: migrate lat/lng to PostGIS geometry
    # Add new location geometry column
    op.add_column("tickets", sa.Column("location", Geometry("POINT", srid=4326), nullable=True))

    # Migrate existing lat/lng data to location geometry
    op.execute("""
        UPDATE tickets SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    """)

    # Drop old lat/lng columns
    op.drop_column("tickets", "latitude")
    op.drop_column("tickets", "longitude")

    # Create GIST index on location
    op.execute("CREATE INDEX ix_tickets_location ON tickets USING gist (location)")

    # Add new ticket columns for SLA and escalation
    op.add_column("tickets", sa.Column("assigned_team_id", sa.Uuid(), sa.ForeignKey("teams.id"), nullable=True))
    op.add_column("tickets", sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("escalation_reason", sa.String(200), nullable=True))
    op.add_column("tickets", sa.Column("first_responded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("sla_response_deadline", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("sla_resolution_deadline", sa.DateTime(timezone=True), nullable=True))

    # Add partial index for SLA monitoring (only open/in_progress tickets)
    op.execute("""
        CREATE INDEX ix_tickets_sla_monitoring
        ON tickets (status, sla_response_deadline)
        WHERE status IN ('open', 'in_progress')
    """)


def downgrade() -> None:
    # Drop SLA monitoring index
    op.drop_index("ix_tickets_sla_monitoring", table_name="tickets")

    # Remove ticket SLA/escalation columns
    op.drop_column("tickets", "sla_resolution_deadline")
    op.drop_column("tickets", "sla_response_deadline")
    op.drop_column("tickets", "first_responded_at")
    op.drop_column("tickets", "escalation_reason")
    op.drop_column("tickets", "escalated_at")
    op.drop_column("tickets", "assigned_team_id")

    # Restore latitude and longitude columns
    op.add_column("tickets", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("tickets", sa.Column("longitude", sa.Float(), nullable=True))

    # Migrate location data back to lat/lng
    op.execute("""
        UPDATE tickets SET latitude = ST_Y(location), longitude = ST_X(location)
        WHERE location IS NOT NULL
    """)

    # Drop location column and index
    op.drop_index("ix_tickets_location", table_name="tickets")
    op.drop_column("tickets", "location")

    # Drop sla_configs table
    op.drop_constraint("uq_sla_config_municipality_category", "sla_configs", type_="unique")
    op.drop_table("sla_configs")

    # Drop ticket_assignments table
    op.drop_index("ix_ticket_assignments_tenant_id", table_name="ticket_assignments")
    op.drop_index("ix_ticket_assignments_ticket_id", table_name="ticket_assignments")
    op.drop_table("ticket_assignments")

    # Drop teams table
    op.drop_index("ix_teams_service_area", table_name="teams")
    op.drop_index("ix_teams_category", table_name="teams")
    op.drop_index("ix_teams_tenant_id", table_name="teams")
    op.drop_table("teams")

    # Drop PostGIS extension
    op.execute("DROP EXTENSION IF EXISTS postgis CASCADE")
