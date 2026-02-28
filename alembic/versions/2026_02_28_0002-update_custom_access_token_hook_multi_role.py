"""update_custom_access_token_hook_multi_role

Replaces the existing custom_access_token_hook with a multi-role-aware version.

The new hook:
1. Reads from user_role_assignments (multi-role table) ordered by tier_num ASC
2. Selects the highest-authority (lowest tier number) role as the "effective" role
3. Injects all active roles as `app_metadata.all_roles` array in the JWT
4. Falls back to users.role if no role assignments exist (backward compat)

After running this migration you must re-enable the hook in Supabase Dashboard:
  Authentication -> Hooks -> Custom Access Token -> public.custom_access_token_hook

Revision ID: 27_0002_rbac_hook
Revises: 27_0001_rbac_roles
Create Date: 2026-02-28 00:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27_0002_rbac_hook'
down_revision: Union[str, None] = '27_0001_rbac_roles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Replace custom_access_token_hook with multi-role aware version."""

    op.execute("""
        CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
        RETURNS jsonb AS $$
        DECLARE
          effective_role text;
          all_roles jsonb;
          user_tenant_id uuid;
        BEGIN
          -- Select the highest-authority active role (lowest tier_num) plus
          -- the full ordered array of all active roles for the user.
          SELECT
            (array_agg(ura.role ORDER BY rt.tier_num ASC))[1],
            jsonb_agg(ura.role ORDER BY rt.tier_num ASC),
            u.tenant_id
          INTO effective_role, all_roles, user_tenant_id
          FROM public.user_role_assignments ura
          JOIN public.users u ON u.id = ura.user_id
          JOIN public.role_tiers rt ON rt.role_name = ura.role::text
          WHERE ura.user_id = (event->>'user_id')::uuid
            AND ura.is_active = TRUE
          GROUP BY u.tenant_id;

          -- Fallback: read from users.role when no role assignments exist.
          -- This preserves backward compatibility for users who were created
          -- before the multi-role system was introduced (Phase 27).
          IF effective_role IS NULL THEN
            SELECT role::text, tenant_id
              INTO effective_role, user_tenant_id
              FROM public.users
             WHERE id = (event->>'user_id')::uuid;
            all_roles := jsonb_build_array(effective_role);
          END IF;

          -- Inject claims into the JWT
          IF effective_role IS NOT NULL THEN
            event := jsonb_set(event, '{claims,app_metadata,role}',    to_jsonb(effective_role));
            event := jsonb_set(event, '{claims,app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));
            event := jsonb_set(event, '{claims,app_metadata,all_roles}', all_roles);
          END IF;

          RETURN event;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # Grant / revoke permissions (same as original hook)
    op.execute("""
        GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
        GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
        REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon;
    """)

    op.execute("""
        COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
        'Supabase Auth hook (Phase 27): Reads from user_role_assignments + role_tiers to inject '
        'effective_role, all_roles array, and tenant_id into JWT app_metadata. '
        'Falls back to users.role for backward compatibility. '
        'Enable in Dashboard -> Auth -> Hooks -> Custom Access Token.';
    """)


def downgrade() -> None:
    """Restore original single-role custom_access_token_hook."""

    op.execute("""
        CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
        RETURNS jsonb AS $$
        DECLARE
          user_role text;
          user_tenant_id uuid;
        BEGIN
          SELECT role, tenant_id INTO user_role, user_tenant_id
          FROM public.users WHERE id = (event->>'user_id')::uuid;
          IF user_role IS NOT NULL THEN
            event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(user_role));
            event := jsonb_set(event, '{claims,app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));
          END IF;
          RETURN event;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    op.execute("""
        GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
        GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
        REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon;
    """)

    op.execute("""
        COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
        'Supabase Auth hook: Injects user role and tenant_id into JWT access tokens. Enable in Dashboard -> Auth -> Hooks.';
    """)
