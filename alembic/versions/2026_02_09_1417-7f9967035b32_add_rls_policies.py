"""add_rls_policies

Revision ID: 7f9967035b32
Revises: 385cc1c2d1f2
Create Date: 2026-02-09 14:17:24.092344

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f9967035b32'
down_revision: Union[str, None] = '385cc1c2d1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable Row-Level Security on tenant-aware tables."""
    # Create application role (if not exists)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
                CREATE ROLE app_user;
            END IF;
        END $$;
    """)

    # List of tenant-aware tables
    tenant_aware_tables = ['users', 'consent_records']

    for table in tenant_aware_tables:
        # Enable RLS on table
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")

        # FORCE makes RLS apply even to table owner (critical for security)
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

        # Create tenant isolation policy using current_setting
        # The 'true' parameter makes it return NULL instead of error if not set
        # NULL tenant = no rows returned = fail closed
        op.execute(f"""
            CREATE POLICY tenant_isolation_{table} ON {table}
            USING (tenant_id = current_setting('app.current_tenant', true))
        """)

        # Grant permissions to app role
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user;")


def downgrade() -> None:
    """Disable Row-Level Security on tenant-aware tables."""
    tenant_aware_tables = ['users', 'consent_records']

    for table in tenant_aware_tables:
        # Drop policy first
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table};")

        # Disable RLS
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
