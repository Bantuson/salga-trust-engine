# Deferred Items — Phase 06.9

## Pre-existing Test Failures (Out of Scope)

These failures existed before Phase 06.9 work began. They are unrelated to the
06.9-01 plan changes and are NOT caused by this phase's modifications.

### test_municipal_crew.py pre-existing failures

**1. test_ticket_tool_validates_category**
- Expects `ValueError` when invalid category passed but ticket_tool.py returns an error dict instead
- Root cause: ticket_tool.py returns `{"error": "Invalid category..."}` — no ValueError raised
- Tests were written expecting different behavior from a prior implementation

**2. test_ticket_tool_validates_severity**
- Same pattern — expects `ValueError` but gets error dict

**3. test_ticket_tool_tracking_number_format** (ERROR)
- Tries to patch `src.agents.tools.ticket_tool._get_sync_engine` which no longer exists
- Root cause: ticket_tool.py was refactored to use Supabase admin client (not SQLAlchemy sync engine)
- Tests were not updated after the refactor

**4. test_ticket_tool_returns_correct_structure** (ERROR)
- Same `_get_sync_engine` patch issue

**5. test_ticket_tool_accepts_valid_categories** (FAILURE)
- Same `_get_sync_engine` patch issue

**6. test_ticket_tool_accepts_valid_severities** (FAILURE)
- Same `_get_sync_engine` patch issue

### Recommendation
These tests need updating to:
- Mock `src.core.supabase.get_supabase_admin` instead of `_get_sync_engine`
- Use return-dict based assertions instead of `pytest.raises(ValueError)`
Consider addressing in a dedicated test maintenance plan after Phase 06.9 completes.
