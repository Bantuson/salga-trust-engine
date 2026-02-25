# Phase 9: OCR Supabase Bridge & Ward Filtering - Research

**Researched:** 2026-02-22
**Domain:** Supabase Auth admin API, SQLAlchemy migrations, FastAPI endpoint hardening
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-03 | User must verify proof of residence (OCR document analysis) to bind account to specific municipality | OCR endpoint already works; gap is the missing bridge from verification result to Supabase `user_metadata.residence_verified`. Research confirms `admin.update_user_by_id()` is the correct API call. |
| RPT-09 | System performs OCR analysis on uploaded documents/images for verification and evidence capture | OCR service works end-to-end; the missing piece is writing the verified flag to Supabase so the frontend gate unlocks. Same fix as PLAT-03. |
| OPS-03 | Ward councillor can view dashboard filtered to issues in their ward | `User.ward_id` field missing from model. Ward filtering currently uses `address.ilike()` workaround. Research defines the full fix: model field + Alembic migration + backend enforcement + JWT propagation. |
</phase_requirements>

---

## Summary

Phase 9 closes three specific integration gaps identified in the v1.0 milestone audit. All three gaps share a pattern: the backend infrastructure exists and works, but the connection between layers is missing.

**Gap 1 (PLAT-03 / RPT-09):** The OCR verification endpoint (`POST /api/v1/verification/proof-of-residence`) correctly performs Tesseract OCR, determines the verification result, and updates `User.verification_status` in the local PostgreSQL database. However, it never calls Supabase's admin API to update `user_metadata.residence_verified` on the Supabase Auth user object. The `ReportIssuePage.tsx` reads `user?.user_metadata?.residence_verified === true` from the Supabase session. These two values are never synchronized. Fix: one additional call to `supabase_admin.auth.admin.update_user_by_id()` at the end of the verification endpoint.

**Gap 2 (OPS-03):** The `WARD_COUNCILLOR` role exists and the dashboard endpoints accept a `ward_id` query parameter, but `User.ward_id` is never stored. The current interim implementation logs a warning and falls back to `address.ilike()` filtering (which is fragile and wrong). Fix: add `ward_id` as a nullable `String` column on the `User` model, create an Alembic migration, enforce that ward councillors are automatically filtered to their own `ward_id`, and read `ward_id` from the JWT (Supabase `app_metadata`) so the frontend does not have to supply it as a query parameter.

**Primary recommendation:** Implement in two focused plans — Plan 01 for the OCR-Supabase bridge (backend only, 2 files changed), Plan 02 for ward filtering (model + migration + backend enforcement + optional frontend pass-through).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | >=2.x | Supabase admin client for `auth.admin.update_user_by_id()` | Already installed and used in `src/core/supabase.py`, `src/api/v1/auth.py`, `src/agents/tools/auth_tool.py` |
| SQLAlchemy 2.0 | 2.0+ | ORM for adding `ward_id` column to User model | Project standard — all models use `Mapped[T]` declarative style |
| Alembic | current | Database migration for new `ward_id` column | Project standard — migrations in `alembic/versions/` with timestamp naming |
| FastAPI | current | Endpoint logic for verification and ticket filtering | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pyjwt | current | Decode JWT to extract `app_metadata.ward_id` in deps | Already used in `src/core/security.py` — read `ward_id` from token claims |
| httpx | current | Already imported in verification.py for S3 download | No new imports needed |

---

## Architecture Patterns

### Gap 1: OCR to Supabase Bridge

**What the code currently does:**
```python
# src/api/v1/verification.py lines 211-218 (current)
current_user.verification_status = verification_result["status"]
current_user.verified_address = ocr_data.address
current_user.verification_document_id = verification_request.document_file_id
if verification_result["status"] == "verified":
    current_user.verified_at = datetime.utcnow()
await db.commit()
# --- MISSING: Supabase user_metadata update ---
```

**What it must do:**
```python
# After db.commit(), call Supabase admin to sync the flag
if verification_result["status"] == "verified":
    supabase_admin = get_supabase_admin()
    if supabase_admin:
        supabase_admin.auth.admin.update_user_by_id(
            str(current_user.id),
            {"user_metadata": {"residence_verified": True}}
        )
```

**Key facts from official docs (HIGH confidence):**
- Method: `supabase.auth.admin.update_user_by_id(uid, attributes)` where `attributes` is a dict
- `user_metadata` key in attributes dict performs a shallow merge with existing metadata (does NOT overwrite other keys)
- Returns a `UserResponse` — check `response.user` for success confirmation
- Must use service_role client (`get_supabase_admin()`), not anon client
- The call is synchronous (supabase-py uses sync HTTP under the hood), so no `await` needed

**Where to add it:**
- File: `src/api/v1/verification.py`
- Function: `verify_proof_of_residence()`
- Location: after `await db.commit()`, before building the response
- Wrap in `try/except` — Supabase failure must not roll back an already-committed DB update

**Frontend gate (already correct, no change needed):**
```typescript
// frontend-public/src/pages/ReportIssuePage.tsx line 81
const isResidenceVerified = user?.user_metadata?.residence_verified === true;
```
The Supabase JS client refreshes `user.user_metadata` on next `getSession()` call. After the backend sets this flag, the next page load or token refresh will unlock the gate automatically.

**User session refresh consideration:** After the backend sets `residence_verified`, the citizen's active Supabase session won't reflect the change until the JWT is refreshed. The frontend should call `supabase.auth.refreshSession()` after receiving a "verified" response from the OCR endpoint, or the profile page can trigger a reload. This is a frontend concern the planner should address.

### Gap 2: Ward ID Field and Enforcement

**Current state (interim):**
```python
# src/api/v1/tickets.py lines 133-144
if current_user.role == UserRole.WARD_COUNCILLOR:
    if ward_id:
        logger.warning("Ward enforcement will be added when User.ward_id field is implemented.")
    else:
        logger.warning("Ward enforcement will be added when User.ward_id field is implemented.")
```

**Target state:**
Ward councillors must be automatically scoped to their ward. The ward_id must come from the user's stored profile (not a query parameter they supply, which would allow spoofing).

**Pattern 1: User model change**
```python
# src/models/user.py — add nullable ward_id column
ward_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
```
- `String(100)` — ward names/codes in SA are short (e.g., "Ward 1", "Ward 23", "JHB-W01")
- Nullable: most users (citizens, managers, admins) have no ward assignment
- Only `ward_councillor` role users need this populated

**Pattern 2: Alembic migration**
```python
# alembic/versions/{timestamp}_add_ward_id_to_users.py
def upgrade() -> None:
    op.add_column("users", sa.Column("ward_id", sa.String(100), nullable=True))
    op.create_index("ix_users_ward_id", "users", ["ward_id"])  # Index for filtering queries

def downgrade() -> None:
    op.drop_index("ix_users_ward_id", table_name="users")
    op.drop_column("users", "ward_id")
```
- Add index: ward filtering queries will be frequent for ward councillors
- Downgrade must be present (project standard)

**Pattern 3: Backend enforcement in tickets.py and dashboard.py**
```python
# Replace warning with real enforcement
if current_user.role == UserRole.WARD_COUNCILLOR:
    # Always enforce ward filter from user's stored ward_id
    effective_ward_id = current_user.ward_id
    if effective_ward_id:
        query = query.where(Ticket.address.ilike(f"%{effective_ward_id}%"))
    # If ward councillor has no ward_id set, show empty result (fail-safe, not fail-open)
```

**Pattern 4: JWT propagation (optional, LOW priority)**
The Supabase custom access token hook (`app_metadata`) can carry `ward_id`. However, reading it from the JWT in `get_current_user` dep requires knowing it at token-issue time. Since `ward_id` is set by admin after account creation, it's simpler to read `current_user.ward_id` from the DB (already loaded by `get_current_user`). No JWT changes needed.

**Dashboard service (dashboard_service.py):**
The `ward_id` parameter passed to `DashboardService.get_metrics()` is currently passed in from the API layer. The API layer should do the enforcement, and the service layer continues to receive and apply the ward_id. No changes needed to `dashboard_service.py`.

**Frontend (dashboard) — AnalyticsPage.tsx:**
Currently uses a placeholder: `const wardId = isWardCouncillor ? (getTenantId() ?? undefined) : undefined;`
This is a bug — it passes the tenant/municipality ID as the ward ID. Once the backend enforces from `current_user.ward_id`, the frontend no longer needs to supply it. The API endpoints should ignore the ward_id query param for ward councillors (use their stored ward_id instead). OR: the frontend can stop sending it, and the backend auto-applies. Both work; auto-apply is more secure.

### Anti-Patterns to Avoid

- **Do NOT treat ward_id as UUID:** South African ward identifiers are human-readable strings (e.g., "Ward 1", "Ward 23"). Use `String(100)`, not `UUID`. UUID would require an additional `wards` table that does not exist.
- **Do NOT fail-open on missing ward_id:** If a `ward_councillor` has no `ward_id` set, return empty results rather than returning all municipality tickets. Fail-safe over fail-open.
- **Do NOT update Supabase user_metadata before committing to DB:** The DB commit is the source of truth. Update Supabase only after the DB transaction succeeds. Supabase update failure must not roll back the already-committed DB change.
- **Do NOT synchronously block on Supabase failure:** Wrap Supabase metadata sync in try/except. Log the failure but return success to the user — the DB is updated and the flag can be retried.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User metadata sync | Custom webhook or background task | Direct `admin.update_user_by_id()` call inline in the endpoint | Simple, reliable, synchronous — no queue needed |
| Ward boundary management | PostGIS ward polygon table | String-based ward_id on User + address ILIKE | Full ward boundary GIS is v2 scope; string match is sufficient for v1 |
| JWT ward_id propagation | Custom token hook changes | Read ward_id from local DB User object | Already loaded in `get_current_user`; no additional JWT infrastructure needed |
| Schema migration | Manual SQL | Alembic `op.add_column()` | Project standard; maintains migration history |

---

## Common Pitfalls

### Pitfall 1: Supabase user_metadata shallow merge vs overwrite
**What goes wrong:** Calling `update_user_by_id(uid, {"user_metadata": {"residence_verified": True}})` only sets that one key and merges with existing metadata. This is correct behavior. But if you need to set multiple keys, pass them all in one call rather than multiple sequential calls (each call is a round-trip).
**How to avoid:** Pass all required keys in a single update: `{"residence_verified": True, "residence_verified_at": datetime.utcnow().isoformat()}` if you want to record the timestamp in metadata as well.
**Warning signs:** Frontend shows partial metadata update (some keys gone).

### Pitfall 2: Supabase admin client None in dev mode
**What goes wrong:** `get_supabase_admin()` returns `None` when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is not configured (local dev without Supabase). The OCR endpoint will succeed at the DB level but silently skip the metadata sync.
**How to avoid:** Log a clear warning when the admin client is None and the sync is skipped. This is the existing pattern in `src/api/v1/auth.py` line 97.
**Warning signs:** Frontend gate never unlocks despite successful OCR verification.

### Pitfall 3: Ward councillor sees all tickets (fail-open)
**What goes wrong:** The current code only logs a warning when `UserRole.WARD_COUNCILLOR` accesses tickets without a ward_id. If the enforcement is not changed, a ward councillor can still see all municipality tickets.
**How to avoid:** The enforcement in tickets.py MUST use `current_user.ward_id` from the DB and apply it unconditionally for ward councillors. If `ward_id` is None (not yet assigned), return empty results.
**Warning signs:** Ward councillor user returns non-empty ticket list when they have no `ward_id` set.

### Pitfall 4: Alembic migration breaks SQLite unit tests
**What goes wrong:** Adding `ward_id` column via Alembic migration is production-only. Unit tests use SQLite in-memory DB via `Base.metadata.create_all()` — they pick up the column automatically from the model. But if the column is added to the model before running tests, old SQLite test DBs may not have the column.
**How to avoid:** Unit tests always recreate the schema from scratch (`Base.metadata.create_all()`) so the new column appears automatically. No test changes needed for the model addition — only verify existing tests still pass.
**Warning signs:** `OperationalError: table users has no column named ward_id` in unit tests.

### Pitfall 5: Session refresh after verification
**What goes wrong:** After the backend sets `user_metadata.residence_verified = True` in Supabase, the citizen's active browser session still has the old JWT. The `ReportIssuePage.tsx` gate check reads from the cached session and stays locked until the JWT refreshes.
**How to avoid:** The `ProfilePage.tsx` should call `supabase.auth.refreshSession()` after receiving a "verified" response from the OCR endpoint. The frontend already has `supabase` imported. Alternatively, the `ProfilePage` can force a page reload. The backend cannot push the updated session to the browser.
**Warning signs:** Citizen verifies successfully (API returns "verified"), navigates to ReportIssuePage, but gate stays locked.

---

## Code Examples

### Example 1: Supabase Admin Update User Metadata
```python
# Source: https://supabase.com/docs/reference/python/auth-admin-updateuserbyid
# In src/api/v1/verification.py, after db.commit()
from src.core.supabase import get_supabase_admin

supabase_admin = get_supabase_admin()
if supabase_admin:
    try:
        supabase_admin.auth.admin.update_user_by_id(
            str(current_user.id),
            {
                "user_metadata": {
                    "residence_verified": True,
                    "residence_verified_at": datetime.utcnow().isoformat(),
                }
            }
        )
    except Exception as e:
        logger.error(
            f"Failed to sync residence_verified to Supabase for user {current_user.id}: {e}",
            exc_info=True
        )
        # Do NOT raise — DB is already committed, user is verified locally
else:
    logger.warning(
        f"Supabase admin client not configured. residence_verified not synced to Supabase "
        f"for user {current_user.id}. Frontend gate will not unlock until Supabase is configured."
    )
```

### Example 2: User Model — Adding ward_id
```python
# Source: project pattern in src/models/user.py
# Add to User class after municipality_id field:
ward_id: Mapped[str | None] = mapped_column(
    String(100),
    nullable=True,
    index=True,  # Added separately in migration for production; model-level for SQLite tests
)
```

### Example 3: Alembic Migration
```python
# Source: project convention — see alembic/versions/ timestamp naming
"""add ward_id to users

Revision ID: {auto-generated}
Revises: {previous revision}
Create Date: {auto-generated}
"""
from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column("users", sa.Column("ward_id", sa.String(100), nullable=True))
    op.create_index("ix_users_ward_id", "users", ["ward_id"])


def downgrade() -> None:
    op.drop_index("ix_users_ward_id", table_name="users")
    op.drop_column("users", "ward_id")
```

### Example 4: Ward Enforcement in tickets.py
```python
# Source: project pattern in src/api/v1/tickets.py — replace warning block
# RBAC check passes, now enforce ward for ward councillors
if current_user.role == UserRole.WARD_COUNCILLOR:
    # Auto-apply ward filter from user's stored ward_id (not from query param)
    # This prevents ward councillors from spoofing a different ward_id
    effective_ward_id = current_user.ward_id
    if effective_ward_id is None:
        # No ward assigned — return empty results (fail-safe)
        return PaginatedTicketResponse(
            tickets=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0,
        )
    # Override the ward_id query param with the stored value
    ward_id = effective_ward_id
```

### Example 5: Dashboard Enforcement (dashboard.py)
```python
# Source: project pattern in src/api/v1/dashboard.py
# Ward councillor enforcement — read from stored profile, not query param
if current_user.role == UserRole.WARD_COUNCILLOR:
    # Use stored ward_id (not client-supplied ward_id parameter)
    ward_id = current_user.ward_id
    # If no ward_id set, return zeroed-out metrics (not all-municipality data)
    if ward_id is None:
        return {
            "total_open": 0,
            "total_resolved": 0,
            "sla_compliance_percent": 0.0,
            "avg_response_hours": 0.0,
            "sla_breaches": 0,
        }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DB-only verification update | DB update + Supabase user_metadata sync | Phase 9 (now) | Frontend gate unlocks |
| Ward filtering by query param (client-supplied) | Ward filtering from User.ward_id (stored) | Phase 9 (now) | Prevents ward spoofing |
| `address.ilike()` fallback | `address.ilike()` still used as the filter mechanism | Phase 9 (now) | Same mechanism, but value comes from stored profile not client |
| Warning log for ward councillor access | Hard enforcement with fail-safe empty result | Phase 9 (now) | OPS-03 is actually satisfied |

**Not addressed in Phase 9 (deferred):**
- Full PostGIS ward boundary polygons (v2) — `ST_Within` spatial query replacing `address.ilike()`
- Ward management UI (create, edit, assign ward councillors)
- Tesseract replacement with cloud OCR (Google Vision, AWS Textract) for higher accuracy on South African documents

---

## Open Questions

1. **Session refresh UX after OCR verification**
   - What we know: Backend sets `residence_verified` in Supabase; frontend reads it from cached session
   - What's unclear: Should `ProfilePage.tsx` automatically call `refreshSession()` on OCR success, or should the user be prompted to reload?
   - Recommendation: Call `supabase.auth.refreshSession()` after the OCR endpoint returns "verified" status. This is a 1-line change in `ProfilePage.tsx` `handleUpload()` function.

2. **Ward ID assignment workflow**
   - What we know: `User.ward_id` will be added as a nullable string column; ward councillors need it populated
   - What's unclear: How does admin assign a ward_id to a ward councillor? There is no admin UI for this yet.
   - Recommendation: For Phase 9, add the field and the enforcement. Ward assignment can be done by direct DB update or through a future admin endpoint. This is acceptable for a pilot with 3-5 municipalities.

3. **Ward ID format for South African wards**
   - What we know: South African wards use numeric codes (Ward 1 through ~100+ per municipality), not UUIDs
   - What's unclear: Whether to store as "Ward 1" (display name) or "1" (bare number) or "JHB-W001" (composite)
   - Recommendation: Store human-readable string like "Ward 1" for simplicity; the `address.ilike()` filter works with any substring. No normalization needed for v1.

---

## Sources

### Primary (HIGH confidence)
- Supabase Python admin API docs: `https://supabase.com/docs/reference/python/auth-admin-updateuserbyid` — `update_user_by_id(uid, attrs)` signature with `user_metadata` key confirmed
- Project source: `src/api/v1/verification.py` — exact gap location identified at lines 211-218
- Project source: `src/api/v1/tickets.py` lines 133-178 — ward enforcement gap with warning logs confirmed
- Project source: `src/models/user.py` — User model has no `ward_id` field confirmed
- Project source: `frontend-public/src/pages/ReportIssuePage.tsx` line 81 — gate reads `user_metadata.residence_verified`
- Project source: `frontend-public/src/pages/ProfilePage.tsx` lines 140-145 — uploads set `residence_verified: false`, never true
- Project source: `.planning/v1.0-MILESTONE-AUDIT.md` — gap analysis for PLAT-03, RPT-09, OPS-03 with exact file/line evidence

### Secondary (MEDIUM confidence)
- Project decision log (STATE.md Phase 06.1-02): "Supabase Auth replaces custom JWT + Argon2 with app_metadata for RBAC" — confirms admin client pattern is the right approach
- Project decision log (STATE.md Phase 05-01): "Added WARD_COUNCILLOR role for municipal councillor access with interim ward filtering" — confirms interim solution is intentional placeholder

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in project
- Architecture: HIGH — exact files, lines, and patterns identified from codebase inspection
- Pitfalls: HIGH — gaps are precisely documented in v1.0 milestone audit
- Ward ID format: MEDIUM — "Ward N" string recommended but no official SA data standard verified

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (stable domain — Supabase Python SDK API is stable)
