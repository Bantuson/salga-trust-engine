"""Pure unit tests for tenant context management.

These tests require NO database connection.
"""
from src.core.tenant import clear_tenant_context, get_tenant_context, set_tenant_context


class TestTenantContext:
    """Test tenant context variables."""

    def test_set_and_get_tenant_context(self):
        """set_tenant_context should store and get_tenant_context should retrieve."""
        tenant_id = "test-tenant-123"
        set_tenant_context(tenant_id)
        result = get_tenant_context()
        assert result == tenant_id

    def test_clear_tenant_context(self):
        """clear_tenant_context should set context to None."""
        set_tenant_context("test-tenant-456")
        clear_tenant_context()
        result = get_tenant_context()
        assert result is None

    def test_default_tenant_context_is_none(self):
        """get_tenant_context should return None in fresh state."""
        # Clear any existing context
        clear_tenant_context()
        result = get_tenant_context()
        assert result is None
