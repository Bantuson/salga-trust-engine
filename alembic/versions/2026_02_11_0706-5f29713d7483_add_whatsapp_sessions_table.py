"""add whatsapp_sessions table for phone to user mapping

Revision ID: 5f29713d7483
Revises: cf74957db319
Create Date: 2026-02-11 07:06:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5f29713d7483'
down_revision: Union[str, None] = ('cf74957db319', 'c7f87ba5892a')  # Merge heads
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create whatsapp_sessions table for phone-to-user mapping."""
    op.create_table(
        'whatsapp_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phone_number', sa.String(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('phone_number')
    )

    # Create indexes for efficient lookups
    op.create_index('ix_whatsapp_sessions_phone_number', 'whatsapp_sessions', ['phone_number'])
    op.create_index('ix_whatsapp_sessions_user_id', 'whatsapp_sessions', ['user_id'])
    op.create_index('ix_whatsapp_sessions_tenant_id', 'whatsapp_sessions', ['tenant_id'])
    op.create_index('ix_whatsapp_sessions_expires_at', 'whatsapp_sessions', ['expires_at'])
    op.create_index('ix_whatsapp_sessions_expires_at_user_id', 'whatsapp_sessions', ['expires_at', 'user_id'])


def downgrade() -> None:
    """Drop whatsapp_sessions table."""
    op.drop_index('ix_whatsapp_sessions_expires_at_user_id', table_name='whatsapp_sessions')
    op.drop_index('ix_whatsapp_sessions_expires_at', table_name='whatsapp_sessions')
    op.drop_index('ix_whatsapp_sessions_tenant_id', table_name='whatsapp_sessions')
    op.drop_index('ix_whatsapp_sessions_user_id', table_name='whatsapp_sessions')
    op.drop_index('ix_whatsapp_sessions_phone_number', table_name='whatsapp_sessions')
    op.drop_table('whatsapp_sessions')
