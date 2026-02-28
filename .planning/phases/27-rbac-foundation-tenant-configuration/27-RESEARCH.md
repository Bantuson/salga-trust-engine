# Phase 27: RBAC Foundation & Tenant Configuration - Research

**Researched:** 2026-02-28
**Domain:** Role-based access control extension, multi-tenant department modeling, Supabase Auth hooks, React wizard UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Role Hierarchy Design**
- Strict 4-tier hierarchy — senior tiers inherit ALL permissions from lower tiers, regardless of department
- Unified hierarchy merging v1 and new PMS roles into a single model:
  - **Tier 1 (Executive):** executive_mayor, municipal_manager, cfo, speaker, admin, salga_admin
  - **Tier 2 (Directors):** section56_director, ward_councillor
  - **Tier 3 (Operational):** department_manager, pms_officer, audit_committee_member, internal_auditor, mpac_member, saps_liaison, manager
  - **Tier 4 (Frontline):** field_worker, citizen
- Multiple roles per user allowed — highest tier wins for permission checks
- SAPS liaisons sit under the Community Safety department; keep `saps_liaison` as the system role name (display name can differ in UI)

**Department Configuration UX**
- Guided wizard flow for initial setup: (1) Municipality settings → (2) Create departments → (3) Assign directors → (4) Map ticket categories → (5) Review organogram
- Every department must have a director assigned (Section 56 or above) to be considered valid
- Visual tree diagram for organogram with expandable/collapsible nodes
- Municipality settings (category, province, demarcation code, SDBIP layers, scoring method) locked after initial setup — admin must explicitly "unlock" with confirmation to edit
- Teams nest inside departments (preserves v1 team structure, adds department layer above)

**Ticket-to-Department Mapping**
- Admin maps ticket categories to departments during wizard setup (also available from standalone settings page)
- One department per category (1:1 mapping) — simple routing
- Unmapped ticket categories default to admin inbox for manual routing
- Tickets become department-scoped: directors see their department's tickets, managers/field workers belong to a department

**Financial Year & Municipality Settings**
- Financial year hardcoded to July 1 - June 30 (MFMA standard) — not configurable
- Quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
- SDBIP layers and scoring method configured in Phase 27 wizard (ready for Phase 28)
- Municipality category (A/B/C) is informational metadata only — no functional differences based on category

**PMS Readiness Gate**
- Full checklist required: municipality settings configured + all departments have assigned directors + at least 1 PMS officer role assigned
- Blocked users see the readiness checklist with green/red progress indicators showing exactly what's missing
- Enforced at both API level (403 with checklist payload) and frontend level (PMS nav hidden/disabled)
- Once PMS is active, destructive config changes are blocked (can't delete departments or unassign directors) — admin must explicitly deactivate PMS first

**Role Change Workflow**
- Tier 2-4 role changes take effect immediately
- Tier 1 promotions (Executive Mayor, MM, CFO, Speaker) require SALGA admin approval as second step
- Pending Tier 1 promotions: user keeps old role until SALGA approves (no provisional access)
- SALGA admin gets in-app notification; request expires after 7 days if not actioned
- SALGA admin must provide a reason on rejection (visible to requesting admin)
- Force-logout via Redis on any role change — no stale permissions window
- Tenant admin is the sole role manager per municipality; SALGA admin is view-only for role management (except Tier 1 approval)
- Standard audit fields: actor, timestamp, target user, previous role(s), new role(s), IP address

**Multi-role JWT Structure**
- JWT carries only the highest-tier role in app_metadata (fast auth checks)
- Full role list stored in database, queried when needed
- Role switcher appears on login for multi-role users: "You have N roles. View as: [Role A] | [Role B]"
- In-app role switcher accessible from navbar anytime (no re-login needed) — switches dashboard view context
- Role switcher hidden for single-role users (cleaner nav)

### Claude's Discretion
- Exact Supabase custom access token hook implementation for tier resolution
- Redis session invalidation mechanism details
- Organogram tree component library choice
- Wizard step validation UX (inline vs step-level errors)
- Department code format and auto-generation
- Role switcher component design and animation

### Deferred Ideas (OUT OF SCOPE)
- Department-based ticket routing automation (auto-assign based on category → department → available team) — could enhance Phase 4 ticket management
- Role-based dashboard customization (different widgets per role) — Phase 31 handles role-specific dashboards
- Department performance comparison views — Phase 32 transparency features
- Email notifications for SALGA admin (Tier 1 approvals) — future notification system enhancement

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RBAC-01 | Platform supports 4-tier role hierarchy with 14 roles (executive_mayor, municipal_manager, cfo, speaker, councillor, section56_director, department_manager, pms_officer, audit_committee_member, internal_auditor, mpac_member, salga_admin + existing citizen, field_worker, saps_liaison, manager, admin) | UserRole enum extension + custom_access_token_hook migration + tier inheritance in `require_role` |
| RBAC-02 | Admin can configure municipal department structure (name, code, hierarchy, assigned director) per tenant | New `departments` TenantAwareModel + CRUD API + wizard frontend |
| RBAC-03 | Admin can configure municipality settings (category, province, demarcation code, SDBIP layers, scoring method) | Extend Municipality model + migration + locked-settings pattern |
| RBAC-04 | Platform enforces role hierarchy inheritance so senior roles inherit access of subordinate roles | Tier-based `require_min_tier()` dependency replacing flat `require_role()` for PMS endpoints |
| RBAC-05 | Admin can view municipal organogram showing reporting structure | react-d3-tree v3.6.5 component in frontend-dashboard + `/api/v1/departments/organogram` endpoint |
| RBAC-06 | Role changes and permission checks are fully audit-logged | Extends existing SQLAlchemy `after_flush` audit handler + ROLE_CHANGE OperationType + dedicated `role_assignments` table |

</phase_requirements>

---

## Summary

Phase 27 extends the existing flat 6-role RBAC into a hierarchical 4-tier system with 14 named roles, adds per-municipality department configuration, gates PMS features behind a readiness checklist, and preserves the audit contract. The work sits entirely within the established v1 patterns: TenantAwareModel for new tables, Alembic migrations for schema changes, the existing Supabase custom_access_token_hook for JWT claims, and the existing wizard UI pattern in OnboardingWizardPage.

The most technically precise piece is the `require_role` to `require_min_tier` migration. The current system uses exact-match role checking (`if current_user.role not in allowed_roles`). This must be replaced with a tier-ordered check so that `executive_mayor` automatically passes a check requiring `department_manager`. The project already has `redis==5.2.0` installed; adding a JWT blacklist key (format `revoked_jti:{jti}`) with a TTL equal to the token's remaining expiry is the standard pattern for force-logout after role changes.

The department wizard is a new full-page flow, modeled structurally on the existing `OnboardingWizardPage` with its 5-step pattern. The organogram view uses `react-d3-tree v3.6.5` — already the cleanest fit since `recharts` (already installed) is not designed for hierarchical trees and no D3 tree library currently exists in the project's `package.json`.

**Primary recommendation:** Extend the existing `custom_access_token_hook` PL/pgSQL migration to read from a new `user_roles` join table (storing all roles per user) and inject the highest-tier role as `app_metadata.role`. Keep the existing `User.role` column as the "active/display role" with a new `user_role_assignments` table storing the full multi-role list.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.36 | ORM for new `departments`, `user_role_assignments`, `tier1_approval_requests` models | Already in project; TenantAwareModel base class available |
| Alembic | 1.14.0 | Database migrations | Already in project; timestamp naming convention established |
| FastAPI | 0.128.0 | New RBAC and department API endpoints | Already in project |
| redis | 5.2.0 | JWT blacklist for force-logout after role changes | Already in project (`REDIS_URL` in config) |
| supabase | >=2.27.3 | Admin API for Supabase Auth user_metadata updates | Already in project |
| pyjwt | 2.10.1 | Decode JWT to extract `jti` for blacklist TTL calculation | Already in project |

### Frontend (to be installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-d3-tree | 3.6.5 | Interactive organogram tree visualization | Organogram page only — existing `recharts` does not support hierarchical trees |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-d3-tree | react-organizational-chart | react-organizational-chart is simpler but renders static HTML boxes; react-d3-tree renders SVG with pan/zoom, better for expandable organograms |
| react-d3-tree | @antv/g6 + React wrapper | g6 is heavier (full graph library), overkill for an organogram |
| Redis JWT blacklist | PostgreSQL revocation table | Redis blacklist check adds ~1ms vs PostgreSQL adds ~5-10ms at 1000 req/s; Redis already present |

**Installation:**
```bash
# Frontend only
cd frontend-dashboard && npm install react-d3-tree@3.6.5
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── models/
│   ├── department.py          # Department, DepartmentTicketCategoryMap models
│   └── role_assignment.py     # UserRoleAssignment, Tier1ApprovalRequest models
├── api/v1/
│   ├── roles.py               # Role assignment CRUD + Tier 1 approval workflow
│   └── departments.py         # Department CRUD + organogram endpoint + PMS gate
├── services/
│   ├── rbac_service.py        # Tier resolution, inheritance check, JWT blacklist
│   └── pms_readiness.py       # PMS readiness gate checklist computation

alembic/versions/
├── 2026_02_28_XXXX-add_pms_roles_and_user_role_assignments.py
├── 2026_02_28_XXXX-add_departments_and_category_mapping.py
├── 2026_02_28_XXXX-extend_municipality_settings.py
├── 2026_02_28_XXXX-add_tier1_approval_requests.py
└── 2026_02_28_XXXX-update_custom_access_token_hook_for_multi_role.py

frontend-dashboard/src/
├── pages/
│   └── DepartmentSetupWizardPage.tsx   # New 5-step wizard (municipality → departments → directors → category map → organogram)
├── components/
│   ├── rbac/
│   │   ├── RoleSwitcher.tsx            # Navbar role switcher for multi-role users
│   │   └── PmsReadinessGate.tsx        # Checklist overlay when PMS not ready
│   └── organogram/
│       └── OrganogramTree.tsx          # react-d3-tree wrapper
```

### Pattern 1: Tier-Based Permission Inheritance

The existing `require_role()` factory performs exact-match checks against a flat list. For PMS endpoints requiring hierarchy inheritance, introduce `require_min_tier()`:

```python
# Source: project pattern from src/api/deps.py

TIER_ORDER: dict[str, int] = {
    # Tier 1 (Executive) - highest
    "executive_mayor": 1,
    "municipal_manager": 1,
    "cfo": 1,
    "speaker": 1,
    "admin": 1,
    "salga_admin": 1,
    # Tier 2 (Directors)
    "section56_director": 2,
    "ward_councillor": 2,
    # Tier 3 (Operational)
    "department_manager": 3,
    "pms_officer": 3,
    "audit_committee_member": 3,
    "internal_auditor": 3,
    "mpac_member": 3,
    "saps_liaison": 3,
    "manager": 3,
    # Tier 4 (Frontline) - lowest
    "field_worker": 4,
    "citizen": 4,
}

def require_min_tier(min_tier: int) -> Callable:
    """Require user's effective tier <= min_tier (lower number = higher power)."""
    async def tier_checker(current_user: User = Depends(get_current_user)) -> User:
        # Get effective role from User.role (highest-tier role is stored here)
        effective_tier = TIER_ORDER.get(current_user.role.value, 99)
        if effective_tier > min_tier:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires tier {min_tier} or higher (Executive=1, Director=2, Operational=3)"
            )
        return current_user
    return tier_checker
```

**Critical note:** The existing `require_role()` must be KEPT for endpoints that need exact-role matching (e.g., GBV firewall uses `saps_liaison` exact match — SEC-05). Only new PMS endpoints use `require_min_tier()`.

### Pattern 2: Multi-Role Storage + JWT Claim

The existing `User.role` column stores a single role. The decision is to keep `User.role` as the "effective/display role" (highest-tier role) and add a separate `user_role_assignments` join table:

```python
# src/models/role_assignment.py (NEW)
class UserRoleAssignment(TenantAwareModel):
    __tablename__ = "user_role_assignments"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(nullable=False)
    assigned_by: Mapped[str] = mapped_column(String, nullable=False)  # user ID of assigning admin
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

The custom_access_token_hook is updated to:
1. SELECT all active roles for the user from `user_role_assignments`
2. Compute the highest-tier role (lowest tier number)
3. Inject that as `app_metadata.role` in the JWT
4. Inject `app_metadata.all_roles` as a JSONB array (for role switcher use)

```sql
-- Updated custom_access_token_hook (migration)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  effective_role text;
  all_roles jsonb;
  user_tenant_id uuid;
BEGIN
  -- Get all active roles ordered by tier (lowest tier_num = highest authority)
  SELECT
    (array_agg(ura.role ORDER BY rt.tier_num ASC))[1],
    jsonb_agg(ura.role ORDER BY rt.tier_num ASC),
    u.tenant_id
  INTO effective_role, all_roles, user_tenant_id
  FROM public.user_role_assignments ura
  JOIN public.users u ON u.id = ura.user_id
  JOIN public.role_tiers rt ON rt.role_name = ura.role
  WHERE ura.user_id = (event->>'user_id')::uuid
    AND ura.is_active = TRUE
  GROUP BY u.tenant_id;

  -- Fallback to users.role if no role assignments exist (backward compat)
  IF effective_role IS NULL THEN
    SELECT role, tenant_id INTO effective_role, user_tenant_id
    FROM public.users WHERE id = (event->>'user_id')::uuid;
    all_roles := jsonb_build_array(effective_role);
  END IF;

  IF effective_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(effective_role));
    event := jsonb_set(event, '{claims,app_metadata,tenant_id}', to_jsonb(user_tenant_id::text));
    event := jsonb_set(event, '{claims,app_metadata,all_roles}', all_roles);
  END IF;

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Pattern 3: Redis JWT Blacklist for Force-Logout

Supabase's own sign-out mechanism revokes refresh tokens but does NOT immediately invalidate existing access tokens — they remain valid until their `exp` claim. The only reliable way to enforce immediate logout on role change is a Redis blacklist checked on every request.

```python
# src/services/rbac_service.py (NEW)
import redis.asyncio as aioredis
from src.core.config import settings

async def blacklist_user_token(token: str, exp: int) -> None:
    """Add a JWT to the Redis blacklist until it expires naturally.

    Args:
        token: Raw JWT access token string
        exp: Unix timestamp of token expiry (from JWT 'exp' claim)
    """
    import time
    ttl = max(0, int(exp - time.time()))
    if ttl <= 0:
        return  # Token already expired, nothing to blacklist

    # Key: token digest (not full token, reduces memory)
    import hashlib
    token_digest = hashlib.sha256(token.encode()).hexdigest()

    r = aioredis.from_url(settings.REDIS_URL)
    await r.set(f"revoked_token:{token_digest}", "1", ex=ttl)
    await r.aclose()


async def is_token_blacklisted(token: str) -> bool:
    """Check if a JWT has been blacklisted."""
    import hashlib
    token_digest = hashlib.sha256(token.encode()).hexdigest()
    r = aioredis.from_url(settings.REDIS_URL)
    result = await r.get(f"revoked_token:{token_digest}")
    await r.aclose()
    return result is not None
```

The `get_current_user` dependency in `src/api/deps.py` needs a blacklist check inserted after `verify_supabase_token()`:

```python
# In get_current_user(), after verify_supabase_token():
from src.services.rbac_service import is_token_blacklisted

if await is_token_blacklisted(token):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token has been revoked",
        headers={"WWW-Authenticate": "Bearer"},
    )
```

After a role change, call `blacklist_user_token()` with the user's current token + call Supabase Admin API `auth.admin.sign_out(user_id, scope="global")` to revoke refresh tokens:

```python
# In POST /api/v1/roles/{user_id}/assign (role change endpoint)
# 1. Update user_role_assignments in DB
# 2. Update User.role to new effective role
# 3. Blacklist current access token (if provided in header)
# 4. Call supabase.auth.admin.sign_out(user_id) to kill refresh tokens
```

### Pattern 4: Department Model

```python
# src/models/department.py (NEW)
class Department(TenantAwareModel):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("code", "tenant_id", name="uq_dept_code_tenant"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "FINANCE", "INFRA"
    parent_department_id: Mapped[UUID | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    assigned_director_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class DepartmentTicketCategoryMap(TenantAwareModel):
    __tablename__ = "department_ticket_category_maps"
    __table_args__ = (
        UniqueConstraint("ticket_category", "tenant_id", name="uq_ticket_cat_tenant"),
    )

    department_id: Mapped[UUID] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    ticket_category: Mapped[str] = mapped_column(String(50), nullable=False)
```

### Pattern 5: PMS Readiness Gate

```python
# src/services/pms_readiness.py (NEW)
from dataclasses import dataclass

@dataclass
class PmsReadinessStatus:
    is_ready: bool
    municipality_configured: bool
    all_departments_have_directors: bool
    pms_officer_assigned: bool
    department_count: int
    missing_directors: list[str]  # dept names with no director

async def check_pms_readiness(municipality_id: UUID, db: AsyncSession) -> PmsReadinessStatus:
    """Compute PMS readiness checklist for a municipality.

    Returns structured status for both API gate and frontend display.
    """
    ...
```

FastAPI dependency for PMS gate:
```python
def require_pms_ready() -> Callable:
    """Dependency that returns 403 + checklist if PMS not configured."""
    async def pms_gate(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        status = await check_pms_readiness(current_user.municipality_id, db)
        if not status.is_ready:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PMS_NOT_READY",
                    "message": "PMS configuration incomplete",
                    "checklist": asdict(status),
                }
            )
        return current_user
    return pms_gate
```

### Pattern 6: Organogram Tree (Frontend)

```tsx
// Source: react-d3-tree v3 docs (bkrem.github.io/react-d3-tree)
import Tree from 'react-d3-tree';

interface OrgNode {
  name: string;
  role?: string;
  children?: OrgNode[];
}

export function OrganogramTree({ data }: { data: OrgNode }) {
  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Tree
        data={data}
        orientation="vertical"
        pathFunc="step"
        collapsible={true}
        initialDepth={2}
        renderCustomNodeElement={({ nodeDatum }) => (
          <g>
            <circle r={20} fill="var(--color-teal)" />
            <text dy=".35em" textAnchor="middle" fill="white" fontSize={10}>
              {(nodeDatum.name as string).slice(0, 3)}
            </text>
            <text dy="2em" textAnchor="middle" fill="var(--text-primary)" fontSize={11}>
              {nodeDatum.name}
            </text>
          </g>
        )}
      />
    </div>
  );
}
```

### Pattern 7: Tier 1 Approval Request Model

```python
# src/models/role_assignment.py (continued)
class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"

class Tier1ApprovalRequest(TenantAwareModel):
    __tablename__ = "tier1_approval_requests"

    requesting_admin_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    target_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    requested_role: Mapped[UserRole] = mapped_column(nullable=False)
    current_role: Mapped[UserRole] = mapped_column(nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(default=ApprovalStatus.PENDING, nullable=False)
    salga_admin_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Pattern 8: Municipality Settings Extension

Extend the existing `Municipality` model (NonTenantModel) with new PMS metadata columns:

```python
# New columns to add via migration to municipalities table:
# category: str | None  — "A", "B", "C" (informational only)
# demarcation_code: str | None  — e.g. "WC011"
# sdbip_layers: int — default 2 (top-layer + departmental)
# scoring_method: str — "percentage" (only valid value for v2.0)
# settings_locked: bool — False until initial PMS wizard completes
```

### Anti-Patterns to Avoid

- **Replacing `require_role()` everywhere:** Keep existing exact-match `require_role()` for all v1 endpoints. The GBV firewall (SEC-05) depends on exact `saps_liaison` check — do NOT swap to tier-based checks there.
- **Storing all roles in JWT claims array only:** Always maintain the canonical role list in `user_role_assignments` table. JWT claims are read-only snapshots valid until expiry.
- **Deleting `User.role` column:** Other parts of the system (audit logs, existing tests) depend on `User.role`. Add `user_role_assignments` as an additive layer; sync `User.role` to the effective role on every role change.
- **Running role changes without Redis blacklist:** Supabase's `admin.sign_out()` kills refresh tokens but NOT the current access token. Without Redis blacklist, the user retains their old permissions for up to 30 minutes (ACCESS_TOKEN_EXPIRE_MINUTES).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Organogram SVG tree | Custom D3 + React code | react-d3-tree v3.6.5 | D3 tree layouts involve complex collision detection, zoom/pan, and node positioning — react-d3-tree wraps all of this |
| JWT revocation list | Custom expiry check table in PostgreSQL | Redis with `SET key "1" EX {ttl}` | Redis TTL auto-expires blacklisted tokens; PostgreSQL requires a cleanup job |
| Tier comparison logic | String comparison or custom ordering | Integer tier map (`TIER_ORDER: dict[str, int]`) | Simple, testable, zero dependencies |
| Wizard progress state | Zustand or complex state management | Local `useState` + existing `useOnboarding` hook pattern | Existing `OnboardingWizardPage` establishes the exact pattern to replicate |

**Key insight:** The organogram and force-logout are the only two problems that require external library decisions; everything else is extension of existing project patterns.

---

## Common Pitfalls

### Pitfall 1: custom_access_token_hook not re-triggered on role change
**What goes wrong:** After updating `user_role_assignments`, the user's JWT still contains the old role. The hook only fires at token issuance (login/refresh), not on every request.
**Why it happens:** Supabase's JWT is stateless — the hook is called once when the token is minted, not on every API call.
**How to avoid:** Force token refresh by blacklisting the current access token (Redis) AND revoking refresh tokens via `supabase.auth.admin.sign_out(user_id, scope="global")`. The next login will trigger a fresh hook execution.
**Warning signs:** User's `Authorization: Bearer {token}` still shows old role after role update in DB.

### Pitfall 2: `FORCE ROW LEVEL SECURITY` failing for new PMS tables
**What goes wrong:** New `departments` and `user_role_assignments` tables missing RLS policies, silently returning all-tenant data.
**Why it happens:** Alembic creates the table but RLS requires explicit `ENABLE ROW LEVEL SECURITY` + policy creation — not automatic.
**How to avoid:** Include RLS DDL in the same migration file that creates each table. Follow the pattern in `2026_02_09_1417-7f9967035b32_add_rls_policies.py`.
**Warning signs:** Unit test cross-tenant isolation tests (`test_multitenancy.py`) pass but integration tests against PostgreSQL leak rows.

### Pitfall 3: Backward compatibility breaking existing `require_role()` tests
**What goes wrong:** 43+ existing tests in `test_rbac_coverage.py` use `UserRole.MANAGER`, `UserRole.ADMIN` etc. Adding new `UserRole` enum values can silently invalidate those tests or break enum serialization.
**Why it happens:** SQLAlchemy PostgreSQL Enum type requires an ALTER TYPE migration. Adding values to the Python `UserRole` enum without migrating the DB enum will cause integrity errors on insert.
**How to avoid:** Migration must `ALTER TYPE userrole ADD VALUE 'executive_mayor'` etc. (one per new role) before any model changes. Use `op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'executive_mayor'")` in the Alembic migration.
**Warning signs:** `LookupError: 'executive_mayor' is not among the valid values for this Enum`.

### Pitfall 4: Department wizard collides with existing OnboardingWizardPage
**What goes wrong:** A new admin who has completed v1 onboarding is redirected to the original `/onboarding` wizard instead of the new PMS department setup wizard.
**Why it happens:** App.tsx routing sends all unauthenticated-adjacent flows to `/onboarding`.
**How to avoid:** Route the new wizard to `/pms-setup` (separate page). Check `onboarding_state.is_completed` before routing. If v1 onboarding is done but PMS is not configured, show a banner/redirect to `/pms-setup`.
**Warning signs:** Admin completes `/onboarding` wizard and expects to see PMS features but gets 403 from PMS gate.

### Pitfall 5: SQLite test compatibility for new Enum values
**What goes wrong:** `test_multitenancy.py` and others use SQLite in-memory DB. SQLite doesn't have native Enum types — new UserRole values may work silently or fail depending on how SQLAlchemy handles the enum in SQLite.
**Why it happens:** SQLAlchemy stores enums as VARCHAR in SQLite. New enum values will work in SQLite tests but existing tests that check `role == UserRole.MANAGER` may unexpectedly pass even for new roles.
**How to avoid:** Run `pytest -m integration` after adding new roles to verify PostgreSQL Enum behavior. The conftest `USE_SQLITE_TESTS=1` flag already separates the environments.

### Pitfall 6: role_tiers reference table in custom_access_token_hook
**What goes wrong:** The updated hook JOINs to a `role_tiers` table that must be seeded at migration time. If the table is missing or empty, the hook returns NULL effective_role and falls back to `users.role`, silently breaking the new hierarchy.
**Why it happens:** Hook runs in the PostgreSQL context where application-level seed data may not yet exist.
**How to avoid:** Create and seed `role_tiers` table in the same migration that updates the hook. Use `INSERT ... ON CONFLICT DO NOTHING` for idempotency.

---

## Code Examples

### UserRole Enum Extension
```python
# src/models/user.py — extend UserRole enum
class UserRole(str, Enum):
    # Tier 1 (Executive)
    EXECUTIVE_MAYOR = "executive_mayor"
    MUNICIPAL_MANAGER = "municipal_manager"
    CFO = "cfo"
    SPEAKER = "speaker"
    ADMIN = "admin"                          # existing
    SALGA_ADMIN = "salga_admin"
    # Tier 2 (Directors)
    SECTION56_DIRECTOR = "section56_director"
    WARD_COUNCILLOR = "ward_councillor"       # existing
    # Tier 3 (Operational)
    DEPARTMENT_MANAGER = "department_manager"
    PMS_OFFICER = "pms_officer"
    AUDIT_COMMITTEE_MEMBER = "audit_committee_member"
    INTERNAL_AUDITOR = "internal_auditor"
    MPAC_MEMBER = "mpac_member"
    SAPS_LIAISON = "saps_liaison"             # existing
    MANAGER = "manager"                       # existing
    # Tier 4 (Frontline)
    FIELD_WORKER = "field_worker"             # existing
    CITIZEN = "citizen"                       # existing
```

### Alembic Migration: ALTER TYPE for new roles
```python
# In upgrade():
new_roles = [
    "executive_mayor", "municipal_manager", "cfo", "speaker", "salga_admin",
    "section56_director", "department_manager", "pms_officer",
    "audit_committee_member", "internal_auditor", "mpac_member"
]
for role in new_roles:
    op.execute(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{role}'")
```

### PMS Readiness Gate Response Structure
```json
{
  "code": "PMS_NOT_READY",
  "message": "PMS configuration incomplete",
  "checklist": {
    "is_ready": false,
    "municipality_configured": true,
    "all_departments_have_directors": false,
    "pms_officer_assigned": false,
    "department_count": 3,
    "missing_directors": ["Infrastructure", "Finance"]
  }
}
```

### Role Switcher (Frontend)
```tsx
// Reads app_metadata.all_roles from JWT (injected by hook)
export function RoleSwitcher() {
  const { user } = useAuth();
  const allRoles: string[] = user?.app_metadata?.all_roles ?? [];
  const [activeRole, setActiveRole] = useState<string>(
    user?.app_metadata?.role ?? 'citizen'
  );

  if (allRoles.length <= 1) return null;  // Hidden for single-role users

  return (
    <select
      value={activeRole}
      onChange={(e) => {
        setActiveRole(e.target.value);
        // Does NOT re-login — only switches dashboard view context
        // Actual permissions still governed by JWT's `role` claim
      }}
    >
      {allRoles.map(role => (
        <option key={role} value={role}>{formatRoleLabel(role)}</option>
      ))}
    </select>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `require_role(UserRole.MANAGER, UserRole.ADMIN)` exact match for all endpoints | `require_min_tier(3)` for PMS operational endpoints; `require_role()` retained for SEC-05 GBV endpoints | Phase 27 | Senior roles automatically inherit lower-tier access without endpoint sprawl |
| Single `User.role` column | `User.role` = effective role + `user_role_assignments` for full list | Phase 27 | Enables multi-role users and Tier 1 approval workflow |
| `custom_access_token_hook` reads single `users.role` | Hook reads `user_role_assignments` + computes effective role | Phase 27 | JWT reflects true hierarchy; role switcher enabled |

**Deprecated/outdated:**
- `Ward councillor` noted in context as Tier 2 but existing code treats it as v1 role. Must be unified. The existing `useRoleBasedNav.ts` hardcodes `ward_councillor` — this must be updated to include the new role enum values in nav logic.

---

## Open Questions

1. **`councillor` vs `ward_councillor`**
   - What we know: REQUIREMENTS.md RBAC-01 lists `councillor` but CONTEXT.md decisions list `ward_councillor` as Tier 2 and states to "keep `saps_liaison` as system role name". The existing `UserRole` enum uses `WARD_COUNCILLOR = "ward_councillor"`.
   - What's unclear: Does "councillor" in RBAC-01 refer to `ward_councillor` or is it a different councillor role?
   - Recommendation: Treat as `ward_councillor` (existing system name) — consistent with CONTEXT.md and existing enum. Log this as a naming note in the implementation.

2. **Redis connection management in `is_token_blacklisted()`**
   - What we know: The rate limiter uses `REDIS_URL` from config. `redis==5.2.0` is installed with both sync and async API. Current Redis usage (rate limiter, Celery) uses connection pooling.
   - What's unclear: Whether to use a singleton async Redis client or create/close per call.
   - Recommendation: Create a singleton `aioredis.ConnectionPool` in `src/core/redis.py` (new file), reuse across services, consistent with how the existing Celery connection is managed.

3. **Department wizard vs PMS gate ordering**
   - What we know: Wizard creates departments, then gates PMS. But what if an admin visits a PMS endpoint URL directly before completing wizard?
   - What's unclear: The gate returns 403 with checklist — but does the frontend catch this 403 specifically and redirect to wizard?
   - Recommendation: Frontend `PmsReadinessGate` component catches `PMS_NOT_READY` error code in API responses and renders the checklist overlay with a "Configure Now" button linking to `/pms-setup`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| Config file | `pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `pytest tests/test_rbac_phase27.py -x` |
| Full suite command | `pytest --cov=src --cov-report=term-missing` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RBAC-01 | 14 new roles in UserRole enum; existing 6 roles still present | unit | `pytest tests/test_rbac_phase27.py::test_userrole_enum_has_all_14_new_roles -x` | Wave 0 |
| RBAC-01 | Tier 1 user passes `require_min_tier(1)`, Tier 4 user fails `require_min_tier(1)` | unit | `pytest tests/test_rbac_phase27.py::test_tier_inheritance -x` | Wave 0 |
| RBAC-01 | `executive_mayor` role passes endpoints that allow `department_manager` | unit | `pytest tests/test_rbac_phase27.py::test_executive_inherits_operational_access -x` | Wave 0 |
| RBAC-02 | Admin can create department; non-admin gets 403 | unit | `pytest tests/test_departments_api.py::test_create_department_admin_only -x` | Wave 0 |
| RBAC-02 | Department requires assigned director (Section 56 or above) to be valid | unit | `pytest tests/test_departments_api.py::test_department_validity_requires_director -x` | Wave 0 |
| RBAC-03 | Municipality settings can be configured by admin; locked after initial setup | unit | `pytest tests/test_departments_api.py::test_municipality_settings_lock -x` | Wave 0 |
| RBAC-04 | `require_min_tier(2)` allows `section56_director` but blocks `department_manager` | unit | `pytest tests/test_rbac_phase27.py::test_require_min_tier_boundary -x` | Wave 0 |
| RBAC-05 | `/departments/organogram` returns hierarchy tree for municipality | unit | `pytest tests/test_departments_api.py::test_organogram_endpoint -x` | Wave 0 |
| RBAC-06 | Role assignment creates audit log entry with old+new role | unit | `pytest tests/test_rbac_phase27.py::test_role_change_audited -x` | Wave 0 |
| RBAC-06 | JWT blacklisting prevents stale token use after role change | unit | `pytest tests/test_rbac_phase27.py::test_token_blacklisted_after_role_change -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_rbac_phase27.py tests/test_departments_api.py -x`
- **Per wave merge:** `pytest --cov=src --cov-report=term-missing`
- **Phase gate:** Full suite green + coverage >= 80% before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_rbac_phase27.py` — covers RBAC-01, RBAC-04, RBAC-06 (role hierarchy, JWT blacklist)
- [ ] `tests/test_departments_api.py` — covers RBAC-02, RBAC-03, RBAC-05 (department CRUD, organogram, municipality lock)
- [ ] `tests/conftest.py` — add fixtures for new roles: `pms_officer_user`, `section56_director_user`, `executive_mayor_user`

*(Existing test infrastructure covers the broader RBAC pattern; only new test files targeting Phase 27 behavior are gaps)*

---

## Sources

### Primary (HIGH confidence)
- `/supabase/supabase` (Context7) — custom_access_token_hook PL/pgSQL signature, JWT claims structure, app_metadata pattern
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/core/security.py` — existing JWT verification using HS256 + "authenticated" audience
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/api/deps.py` — existing `require_role()` factory pattern to extend
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/alembic/versions/2026_02_11_0850-cf74957db319_add_supabase_custom_access_token_hook.py` — exact hook structure to update
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/alembic/versions/2026_02_09_1417-7f9967035b32_add_rls_policies.py` — RLS pattern to replicate for new tables
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/models/base.py` — TenantAwareModel / NonTenantModel / tenant filter event
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/pyproject.toml` — `redis==5.2.0` confirmed installed

### Secondary (MEDIUM confidence)
- [Supabase Custom Access Token Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — hook signature, grant requirements, verified against existing migration
- [Supabase signOut scope documentation](https://supabase.com/docs/guides/auth/signout) — global scope kills refresh tokens; access token remains valid until exp
- [react-d3-tree v3.6.5 docs](https://bkrem.github.io/react-d3-tree/docs/) — current version, orientation/collapsible props
- Redis JWT blacklist pattern — multiple consistent sources (fastapi/fastapi discussions, DEV Community) all describe SHA-256 digest + TTL approach

### Tertiary (LOW confidence)
- Supabase `UPDATE auth.sessions SET revoked = true WHERE user_id = ...` — mentioned in community discussions but not in official API docs; Redis blacklist approach is more reliable and doesn't require direct `auth` schema access

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; only `react-d3-tree` is new
- Architecture: HIGH — all patterns are extensions of existing project conventions
- Pitfalls: HIGH — PostgreSQL Enum ALTER TYPE and RLS gaps are verified against existing migrations; SQLite test behavior is from conftest.py study

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable libraries; Supabase hook API is unlikely to change)
