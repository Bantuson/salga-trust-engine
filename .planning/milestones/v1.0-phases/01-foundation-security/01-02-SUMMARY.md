---
phase: 01-foundation-security
plan: 02
subsystem: auth
tags: [authentication, authorization, jwt, argon2, popia, rbac, consent]
dependency-graph:
  requires:
    - 01-01 (User and ConsentRecord models)
  provides:
    - JWT authentication with PyJWT
    - Argon2id password hashing
    - User registration with POPIA consent
    - Login/refresh token endpoints
    - RBAC dependency injection (require_role)
    - Auth middleware (get_current_user)
  affects:
    - All API endpoints requiring authentication
    - Plans 03, 04, 05 depend on this auth system
tech-stack:
  added:
    - PyJWT 2.10.1 for JWT token generation/verification
    - Argon2-cffi 23.1.0 for password hashing
  patterns:
    - HTTPBearer security scheme for token extraction
    - Dependency injection for authentication and authorization
    - Role-based access control (RBAC) with require_role factory
    - Generic error messages to prevent user enumeration (SEC-08)
    - Trilingual POPIA consent descriptions (EN/ZU/AF)
    - Token rotation on refresh for enhanced security
key-files:
  created:
    - src/core/security.py
    - src/api/v1/auth.py
    - src/api/v1/users.py
    - tests/test_auth.py
  modified:
    - src/api/deps.py
    - src/api/v1/__init__.py
    - src/schemas/auth.py
    - tests/conftest.py
decisions:
  - Use PyJWT instead of python-jose (deprecated, security issues)
  - Use Argon2-cffi directly instead of passlib (passlib maintenance ended 2020)
  - Implement token type validation (access vs refresh) to prevent misuse
  - Use generic "Invalid credentials" message for all auth failures (SEC-08)
  - Capture POPIA consent at registration with trilingual descriptions (SEC-02)
  - Auto-login after registration by returning user data (tokens obtained via separate login)
  - Token rotation on refresh (issue new refresh token, not just access token)
  - Municipality ID serves as tenant ID for row-level data isolation
metrics:
  duration: 752 seconds (~12.5 minutes)
  tasks-completed: 2
  files-created: 4
  files-modified: 4
  commits: 2
  completed-at: 2026-02-09T11:54:15Z
---

# Phase 01 Plan 02: JWT Authentication and Authorization

JWT-based authentication with PyJWT and Argon2id password hashing, user registration with mandatory trilingual POPIA consent, login/refresh endpoints, and RBAC dependency injection for endpoint protection.

## Tasks Completed

### Task 1: Security utilities and auth dependencies
**Commit:** `b358bf2`

Implemented core security functions and authentication middleware:

**src/core/security.py:**
- `get_password_hash()`: Hash passwords using Argon2id (OWASP recommended)
- `verify_password()`: Verify passwords against Argon2 hashes
- `create_access_token()`: Generate JWT access tokens with 30-minute expiry
- `create_refresh_token()`: Generate JWT refresh tokens with 7-day expiry
- `decode_access_token()`: Decode and validate access tokens with type checking
- `decode_refresh_token()`: Decode and validate refresh tokens with type checking
- Token type validation prevents refresh tokens from being used as access tokens

**src/api/deps.py:**
- `get_current_user()`: Extract user from JWT Bearer token, set tenant context
- `get_current_active_user()`: Verify user is active and not deleted
- `require_role(*allowed_roles)`: Factory function for role-based endpoint protection
- HTTPBearer security scheme for automatic token extraction

### Task 2: Auth endpoints with POPIA consent at registration
**Commit:** `e04ac6e`

Implemented complete authentication flow with POPIA compliance:

**src/api/v1/auth.py:**
- `POST /api/v1/auth/register`: Register user with mandatory POPIA consent
  - Validates municipality exists and is active
  - Checks email uniqueness per tenant (same email allowed in different municipalities)
  - Hashes password with Argon2id
  - Creates User and ConsentRecord in single transaction
  - Captures IP address for consent audit trail
  - Trilingual consent descriptions based on user's preferred_language (EN/ZU/AF)
  - Returns UserResponse (no tokens - separate login required)

- `POST /api/v1/auth/login`: Authenticate and return JWT tokens
  - Generic "Invalid credentials" error for wrong email OR wrong password (SEC-08)
  - Checks user is active and not deleted
  - Returns access_token + refresh_token

- `POST /api/v1/auth/refresh`: Refresh tokens with rotation
  - Validates refresh token type
  - Issues new access_token + new refresh_token (token rotation)
  - Checks user still active

**src/api/v1/users.py:**
- `GET /api/v1/users/me`: Get current authenticated user profile
  - Requires valid JWT token (via get_current_active_user dependency)

**src/schemas/auth.py:**
- `RegisterRequest`: Extends UserCreate with mandatory consent field
- `RefreshRequest`: Schema for refresh token requests
- Consent validation: ensures `consented=True` or raises ValidationError

**tests/test_auth.py:**
- `test_register_success`: Verify registration creates user
- `test_register_requires_consent`: Verify consent validation
- `test_register_duplicate_email`: Verify email uniqueness per tenant
- `test_login_success`: Verify login returns tokens
- `test_login_invalid_password`: Verify generic error message
- `test_login_nonexistent_user`: Verify generic error message
- `test_protected_endpoint_no_token`: Verify auth required
- `test_protected_endpoint_with_token`: Verify token grants access
- `test_refresh_token`: Verify token rotation

## Deviations from Plan

### Parallel Execution Integration

**[Integration] Middleware created in parallel by plan 01-03**
- **Found during:** Task 2 execution
- **Context:** While executing this plan, plan 01-03 (middleware) was running in parallel per GSD parallelization config
- **Integration:** src/main.py already included middleware imports and setup by the time auth endpoints were added
- **Impact:** No conflict - auth endpoints integrated seamlessly with existing middleware (rate limiting, security headers, tenant context, error handlers)
- **Files affected:** src/main.py (already had middleware and routers included)
- **Outcome:** Positive - demonstrates successful parallel plan execution

No auto-fixes were required. Plan executed exactly as written with smooth integration of parallel work.

## Verification Results

All plan verification criteria passed:

1. ✅ Registration captures POPIA consent with trilingual purpose descriptions (EN/ZU/AF)
2. ✅ Login returns JWT access + refresh tokens
3. ✅ Protected endpoints reject unauthenticated requests (HTTPBearer returns 403)
4. ✅ Role-based deps (require_role) reject unauthorized roles with 403
5. ✅ Error messages don't leak whether user exists (generic "Invalid credentials")
6. ✅ Argon2 used for password hashing (not bcrypt)
7. ✅ PyJWT used for JWT tokens (not python-jose)

## Success Criteria Met

- [x] POST /api/v1/auth/register creates user + consent record, returns user data
- [x] POST /api/v1/auth/login authenticates and returns tokens
- [x] POST /api/v1/auth/refresh rotates tokens (issues new access + refresh)
- [x] GET /api/v1/users/me requires auth, returns user data
- [x] require_role dependency factory works for all 5 roles (CITIZEN, FIELD_WORKER, MANAGER, ADMIN, SAPS_LIAISON)
- [x] Auth test suite created with 9 comprehensive tests

## Security Features Implemented

**POPIA Compliance (SEC-02):**
- Mandatory consent at registration with trilingual descriptions
- Consent purpose: "platform_registration"
- IP address captured for audit trail
- Language-specific consent text (EN/ZU/AF)

**User Enumeration Prevention (SEC-08):**
- Generic "Invalid credentials" for all auth failures
- Same error for wrong email and wrong password
- Same error for inactive/deleted users

**Token Security:**
- Token type validation (access vs refresh)
- Refresh token rotation (new tokens on every refresh)
- Short-lived access tokens (30 minutes)
- Longer-lived refresh tokens (7 days)

**Password Security:**
- Argon2id algorithm (OWASP recommended, better than bcrypt)
- Default safe parameters (memory cost, time cost, parallelism)
- Minimum 8-character password requirement

**Multi-tenant Security:**
- Tenant context set from JWT claims
- Email uniqueness per tenant (same email can exist in different municipalities)
- Municipality ID serves as tenant ID for row-level isolation

## Next Steps

Plans 03, 04, and 05 can now use:
- `Depends(get_current_user)` for authenticated endpoints
- `Depends(get_current_active_user)` for active user verification
- `Depends(require_role(UserRole.ADMIN))` for role-based protection
- JWT tokens from login/refresh endpoints
- POPIA-compliant user registration flow

## Self-Check: PASSED

**Created files verified:**
- ✅ src/core/security.py
- ✅ src/api/v1/auth.py
- ✅ src/api/v1/users.py
- ✅ tests/test_auth.py

**Modified files verified:**
- ✅ src/api/deps.py
- ✅ src/api/v1/__init__.py
- ✅ src/schemas/auth.py
- ✅ tests/conftest.py

**Commits verified:**
- ✅ b358bf2: feat(01-02): security utilities and auth dependencies
- ✅ e04ac6e: feat(01-02): auth endpoints with POPIA consent at registration

All artifacts exist and all commits are in git history.
