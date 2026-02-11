"""add_supabase_storage_buckets_and_rls

Revision ID: 8b4d45d48911
Revises: cf74957db319
Create Date: 2026-02-11 08:56:42.826095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b4d45d48911'
down_revision: Union[str, None] = 'cf74957db319'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create Supabase Storage buckets and RLS policies for media uploads.

    Creates three private buckets:
    - evidence: General ticket evidence (photos, videos)
    - documents: Proof of residence and other documents
    - gbv-evidence: GBV ticket evidence (SAPS-only access per SEC-05)

    RLS policies enforce tenant isolation and role-based access.
    """
    # Note: Bucket creation and RLS policies are Supabase-specific.
    # Skip in local development or test environments.
    op.execute("""
        -- Check if running on Supabase (storage schema exists)
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
                -- Create private buckets (if they don't exist)
                INSERT INTO storage.buckets (id, name, public)
                VALUES ('evidence', 'evidence', false)
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO storage.buckets (id, name, public)
                VALUES ('documents', 'documents', false)
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO storage.buckets (id, name, public)
                VALUES ('gbv-evidence', 'gbv-evidence', false)
                ON CONFLICT (id) DO NOTHING;

                -- Evidence bucket: authenticated users can upload/read their own tenant's files
                -- Path pattern: evidence/{tenant_id}/{file_id}/{filename}
                DROP POLICY IF EXISTS "Authenticated users upload evidence" ON storage.objects;
                CREATE POLICY "Authenticated users upload evidence"
                ON storage.objects FOR INSERT TO authenticated
                WITH CHECK (
                    bucket_id = 'evidence'
                    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
                );

                DROP POLICY IF EXISTS "Authenticated users read evidence" ON storage.objects;
                CREATE POLICY "Authenticated users read evidence"
                ON storage.objects FOR SELECT TO authenticated
                USING (
                    bucket_id = 'evidence'
                    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
                );

                -- Documents bucket: same pattern
                DROP POLICY IF EXISTS "Authenticated users upload documents" ON storage.objects;
                CREATE POLICY "Authenticated users upload documents"
                ON storage.objects FOR INSERT TO authenticated
                WITH CHECK (
                    bucket_id = 'documents'
                    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
                );

                DROP POLICY IF EXISTS "Authenticated users read documents" ON storage.objects;
                CREATE POLICY "Authenticated users read documents"
                ON storage.objects FOR SELECT TO authenticated
                USING (
                    bucket_id = 'documents'
                    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
                );

                -- GBV evidence bucket: SAPS_LIAISON and ADMIN ONLY (SEC-05 firewall)
                -- Upload policy: manager, saps_liaison, admin can upload
                DROP POLICY IF EXISTS "Authorized staff upload GBV evidence" ON storage.objects;
                CREATE POLICY "Authorized staff upload GBV evidence"
                ON storage.objects FOR INSERT TO authenticated
                WITH CHECK (
                    bucket_id = 'gbv-evidence'
                    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('saps_liaison', 'admin', 'manager')
                    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
                );

                -- Read policy: SAPS_LIAISON and ADMIN ONLY (strict SEC-05 enforcement)
                DROP POLICY IF EXISTS "SAPS liaisons read GBV evidence" ON storage.objects;
                CREATE POLICY "SAPS liaisons read GBV evidence"
                ON storage.objects FOR SELECT TO authenticated
                USING (
                    bucket_id = 'gbv-evidence'
                    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('saps_liaison', 'admin')
                    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
                );

                RAISE NOTICE 'Supabase Storage buckets and RLS policies created successfully';
            ELSE
                RAISE NOTICE 'Skipping Supabase Storage setup - storage schema not found (local development)';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove Supabase Storage RLS policies and buckets."""
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
                -- Drop RLS policies
                DROP POLICY IF EXISTS "Authenticated users upload evidence" ON storage.objects;
                DROP POLICY IF EXISTS "Authenticated users read evidence" ON storage.objects;
                DROP POLICY IF EXISTS "Authenticated users upload documents" ON storage.objects;
                DROP POLICY IF EXISTS "Authenticated users read documents" ON storage.objects;
                DROP POLICY IF EXISTS "Authorized staff upload GBV evidence" ON storage.objects;
                DROP POLICY IF EXISTS "SAPS liaisons read GBV evidence" ON storage.objects;

                -- Delete buckets (only if empty)
                DELETE FROM storage.buckets WHERE id IN ('evidence', 'documents', 'gbv-evidence');

                RAISE NOTICE 'Supabase Storage buckets and RLS policies removed';
            ELSE
                RAISE NOTICE 'Skipping Supabase Storage teardown - storage schema not found';
            END IF;
        END $$;
    """)
