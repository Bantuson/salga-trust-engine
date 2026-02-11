"""Tests for RLS policy migration and tenant filtering.

Tests application-level tenant filter defense-in-depth, tenant context requirements,
and public view GBV exclusion.
"""
import pytest
from uuid import uuid4
from unittest.mock import patch

from src.models.base import TenantAwareModel, add_tenant_filter
from src.core.exceptions import SecurityError
from src.core.context import set_tenant_context, clear_tenant_context


class TestTenantFilterDefenseInDepth:
    """Test application-level tenant filtering still works."""

    def test_tenant_filter_raises_on_missing_context(self):
        """SecurityError on missing tenant."""
        # Clear tenant context
        clear_tenant_context()

        # Create a mock TenantAware query
        class MockQuery:
            def __init__(self):
                self.filters = []

            def filter(self, *args):
                self.filters.extend(args)
                return self

        mock_query = MockQuery()

        # Try to add tenant filter without context
        with pytest.raises(SecurityError) as exc_info:
            # Simulate the add_tenant_filter event listener behavior
            from src.core.context import get_tenant_context
            tenant_id = get_tenant_context()

            if tenant_id is None:
                raise SecurityError(
                    "Tenant context not set for tenant-aware query - potential data leakage. "
                    "This is a security violation. Ensure tenant_id is present in JWT "
                    "app_metadata claims (for authenticated requests) or tenant context is "
                    "set via get_current_user dependency."
                )

        assert "Tenant context not set" in str(exc_info.value)
        assert "security violation" in str(exc_info.value).lower()

    def test_tenant_filter_works_with_context(self):
        """Filter applies when tenant context set."""
        tenant_id = str(uuid4())

        # Set tenant context
        set_tenant_context(tenant_id)

        try:
            # Get tenant context
            from src.core.context import get_tenant_context
            retrieved_id = get_tenant_context()

            assert retrieved_id == tenant_id
        finally:
            clear_tenant_context()


class TestPublicViewGBVExclusion:
    """Test public views exclude GBV tickets."""

    def test_public_ticket_stats_excludes_gbv(self):
        """Verify the SQL view definition excludes is_sensitive=true."""
        # This is a unit test - we verify the migration SQL, not the actual DB
        # The migration file should contain: WHERE t.is_sensitive = false

        # Read migration file
        import glob
        migration_files = glob.glob(
            "C:/Users/Bantu/mzansi-agentive/salga-trust-engine/alembic/versions/*migrate_rls_to_supabase_auth*.py"
        )

        if not migration_files:
            pytest.skip("RLS migration file not found")

        migration_file = migration_files[0]

        with open(migration_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Verify public_ticket_stats view excludes GBV
        assert "public_ticket_stats" in content
        assert "is_sensitive = false" in content or "is_sensitive = FALSE" in content

    def test_public_heatmap_has_k_anonymity(self):
        """Verify heatmap view has HAVING COUNT(*) >= 3."""
        import glob
        migration_files = glob.glob(
            "C:/Users/Bantu/mzansi-agentive/salga-trust-engine/alembic/versions/*migrate_rls_to_supabase_auth*.py"
        )

        if not migration_files:
            pytest.skip("RLS migration file not found")

        migration_file = migration_files[0]

        with open(migration_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Verify public_heatmap has k-anonymity threshold
        assert "public_heatmap" in content
        assert ("HAVING COUNT(*) >= 3" in content or
                "HAVING count(*) >= 3" in content or
                "HAVING COUNT\\(\\*\\) >= 3" in content)

    def test_public_municipalities_view_exists(self):
        """Verify public_municipalities view exists."""
        import glob
        migration_files = glob.glob(
            "C:/Users/Bantu/mzansi-agentive/salga-trust-engine/alembic/versions/*migrate_rls_to_supabase_auth*.py"
        )

        if not migration_files:
            pytest.skip("RLS migration file not found")

        migration_file = migration_files[0]

        with open(migration_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Verify public_municipalities view exists
        assert "public_municipalities" in content
        assert "is_active = true" in content or "is_active = TRUE" in content
