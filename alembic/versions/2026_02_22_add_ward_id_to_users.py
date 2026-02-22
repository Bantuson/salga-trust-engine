"""add ward_id to users

Revision ID: a1b2c3d4e5f6
Revises: feb9e9b8f0ff
Create Date: 2026-02-22

Ward councillors are assigned a specific ward_id (e.g. "Ward 5") stored on
their user profile. Ticket listing and dashboard endpoints use this stored
value to auto-filter results — preventing ward councillors from seeing tickets
outside their ward (OPS-03 requirement).
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = 'feb9e9b8f0ff'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ward_id", sa.String(100), nullable=True))
    op.create_index("ix_users_ward_id", "users", ["ward_id"])


def downgrade() -> None:
    op.drop_index("ix_users_ward_id", table_name="users")
    op.drop_column("users", "ward_id")
