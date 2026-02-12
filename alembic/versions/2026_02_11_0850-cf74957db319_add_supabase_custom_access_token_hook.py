"""add_supabase_custom_access_token_hook

This migration creates a PL/pgSQL function that Supabase Auth will call to inject
custom claims (role and tenant_id) into JWT access tokens.

After running this migration, you must enable the hook in Supabase Dashboard:
1. Go to Dashboard -> Authentication -> Hooks
2. Enable "Custom Access Token" hook
3. Select the function: public.custom_access_token_hook

This ensures RBAC and multi-tenancy work correctly with Supabase Auth.

Revision ID: cf74957db319
Revises: 04_01_postgis
Create Date: 2026-02-11 08:50:28.223132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf74957db319'
down_revision: Union[str, None] = '04_01_postgis'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create custom access token hook for Supabase Auth.

    This function reads user role and tenant_id from public.users table
    and injects them into the JWT token's app_metadata claims.
    """
    op.execute("""
        CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
        RETURNS jsonb AS $$
        DECLARE
          user_role text;
          user_tenant_id uuid;
        BEGIN
          -- Look up user's role and tenant_id from public.users table
          SELECT role, tenant_id INTO user_role, user_tenant_id
          FROM public.users
          WHERE id = (event->>'user_id')::uuid;

          -- Inject custom claims into JWT app_metadata if user found
          IF user_role IS NOT NULL THEN
            event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(user_role));
            event := jsonb_set(event, '{claims,app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));
          END IF;

          RETURN event;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # Grant execute to supabase_auth_admin (required for hook to appear in Dashboard)
    op.execute("""
        GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
        GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
        REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon;
    """)

    # Add helpful comment
    op.execute("""
        COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
        'Supabase Auth hook: Injects user role and tenant_id into JWT access tokens. Enable in Dashboard -> Auth -> Hooks.';
    """)


def downgrade() -> None:
    """Remove custom access token hook."""
    op.execute("DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);")
