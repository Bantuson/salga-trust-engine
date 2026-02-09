"""initial_schema_municipalities_users_consent_audit

Revision ID: 385cc1c2d1f2
Revises:
Create Date: 2026-02-09 13:33:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '385cc1c2d1f2'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Create municipalities table (non-tenant) ###
    op.create_table('municipalities',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('code', sa.String(), nullable=False),
    sa.Column('province', sa.String(), nullable=False),
    sa.Column('population', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('contact_email', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    sa.UniqueConstraint('name')
    )

    # ### Create users table (tenant-aware) ###
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(), nullable=True),
    sa.Column('updated_by', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('full_name', sa.String(), nullable=False),
    sa.Column('phone', sa.String(), nullable=True),
    sa.Column('preferred_language', sa.String(), nullable=False),
    sa.Column('role', sa.Enum('CITIZEN', 'FIELD_WORKER', 'MANAGER', 'ADMIN', 'SAPS_LIAISON', name='userrole'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('municipality_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['municipality_id'], ['municipalities.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email', 'tenant_id', name='uq_user_email_tenant')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    op.create_index(op.f('ix_users_municipality_id'), 'users', ['municipality_id'], unique=False)
    op.create_index(op.f('ix_users_tenant_id'), 'users', ['tenant_id'], unique=False)

    # ### Create consent_records table (tenant-aware) ###
    op.create_table('consent_records',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(), nullable=True),
    sa.Column('updated_by', sa.String(), nullable=True),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('purpose', sa.String(), nullable=False),
    sa.Column('purpose_description', sa.Text(), nullable=False),
    sa.Column('language', sa.String(), nullable=False),
    sa.Column('consented', sa.Boolean(), nullable=False),
    sa.Column('consented_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('ip_address', sa.String(), nullable=True),
    sa.Column('withdrawn', sa.Boolean(), nullable=False),
    sa.Column('withdrawn_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_consent_records_tenant_id'), 'consent_records', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_consent_records_user_id'), 'consent_records', ['user_id'], unique=False)

    # ### Create audit_logs table (non-tenant but has tenant_id) ###
    op.create_table('audit_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=True),
    sa.Column('operation', sa.Enum('CREATE', 'READ', 'UPDATE', 'DELETE', name='operationtype'), nullable=False),
    sa.Column('table_name', sa.String(), nullable=False),
    sa.Column('record_id', sa.String(), nullable=False),
    sa.Column('changes', sa.Text(), nullable=True),
    sa.Column('ip_address', sa.String(), nullable=True),
    sa.Column('user_agent', sa.String(), nullable=True),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_table_name'), 'audit_logs', ['table_name'], unique=False)
    op.create_index(op.f('ix_audit_logs_tenant_id'), 'audit_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)


def downgrade() -> None:
    # ### Drop tables in reverse order ###
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_timestamp'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_tenant_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_table_name'), table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index(op.f('ix_consent_records_user_id'), table_name='consent_records')
    op.drop_index(op.f('ix_consent_records_tenant_id'), table_name='consent_records')
    op.drop_table('consent_records')

    op.drop_index(op.f('ix_users_tenant_id'), table_name='users')
    op.drop_index(op.f('ix_users_municipality_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    op.drop_table('municipalities')
