"""add_tickets_table

Revision ID: 02_01_ticket
Revises: 7f9967035b32
Create Date: 2026-02-09 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '02_01_ticket'
down_revision: Union[str, None] = '7f9967035b32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Create tickets table (tenant-aware) ###
    op.create_table('tickets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('tracking_number', sa.String(length=20), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('language', sa.String(length=5), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('assigned_to', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tracking_number')
    )

    # Create indexes for performance
    op.create_index(op.f('ix_tickets_tenant_id'), 'tickets', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tickets_category'), 'tickets', ['category'], unique=False)
    op.create_index(op.f('ix_tickets_status'), 'tickets', ['status'], unique=False)
    op.create_index(op.f('ix_tickets_user_id'), 'tickets', ['user_id'], unique=False)
    op.create_index(op.f('ix_tickets_tracking_number'), 'tickets', ['tracking_number'], unique=True)


def downgrade() -> None:
    # ### Drop indexes ###
    op.drop_index(op.f('ix_tickets_tracking_number'), table_name='tickets')
    op.drop_index(op.f('ix_tickets_user_id'), table_name='tickets')
    op.drop_index(op.f('ix_tickets_status'), table_name='tickets')
    op.drop_index(op.f('ix_tickets_category'), table_name='tickets')
    op.drop_index(op.f('ix_tickets_tenant_id'), table_name='tickets')

    # ### Drop tickets table ###
    op.drop_table('tickets')
