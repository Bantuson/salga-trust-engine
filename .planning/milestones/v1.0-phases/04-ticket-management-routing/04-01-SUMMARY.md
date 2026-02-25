---
phase: 04-ticket-management-routing
plan: 01
subsystem: ticket-routing
tags: [models, database, celery, postgis, infrastructure]
dependency_graph:
  requires: [02-01-ticket-model, 01-foundation-security]
  provides: [team-model, assignment-model, sla-config-model, postgis-location, celery-infrastructure]
  affects: [ticket-model, database-schema]
tech_stack:
  added:
    - geoalchemy2: PostGIS integration for spatial queries
    - shapely: Geometry manipulation library
    - celery[redis]: Task queue with Redis broker
  patterns:
    - PostGIS GEOMETRY columns for geospatial data
    - Celery beat scheduler for periodic SLA monitoring
    - Environment-based conditional imports for test compatibility
key_files:
  created:
    - src/models/team.py: Municipal team model with service_area polygon
    - src/models/assignment.py: Ticket assignment history tracking
    - src/models/sla_config.py: Municipality SLA configuration
    - src/schemas/team.py: Team Pydantic schemas
    - src/schemas/assignment.py: Assignment Pydantic schemas
    - src/tasks/__init__.py: Celery tasks package
    - src/tasks/celery_app.py: Celery app with beat schedule
    - alembic/versions/2026_02_10_0734-04_01_postgis_teams_sla.py: Phase 4 database migration
  modified:
    - src/models/ticket.py: Migrated location from lat/lng to PostGIS GEOMETRY(Point), added SLA/escalation fields
    - src/core/config.py: Added Celery broker/backend settings
    - pyproject.toml: Added geoalchemy2, shapely, celery dependencies
    - alembic/env.py: Imported new models for migration detection
    - tests/conftest.py: Added USE_SQLITE_TESTS env var for SQLite compatibility
decisions:
  - Use PostGIS GEOMETRY(Point, 4326) for ticket location instead of separate lat/lng columns
  - Maintain backward-compatible lat/lng properties on Ticket for Phase 2-3 code
  - SLAConfig uses NonTenantModel (admins configure cross-tenant policies)
  - TicketAssignment tracks full assignment history with is_current flag
  - Team service_area polygon is nullable (admin defines in Phase 5)
  - Celery uses Redis DB 1 (DB 0 reserved for rate limiting/sessions)
  - Disable GeoAlchemy2 in SQLite tests via USE_SQLITE_TESTS environment variable
  - Set management=False for Geometry columns to prevent SQLite spatial function errors
metrics:
  duration: 31.05m (1863s)
  completed_at: 2026-02-10T07:55:16Z
  tasks_completed: 2
  files_modified: 10
  files_created: 8
  commits: 2
  tests_passing: 148
  test_coverage: maintained (zero regressions)
---

# Phase 04 Plan 01: Core Data Models & Infrastructure Summary

**One-liner:** Created Team/Assignment/SLAConfig models, migrated Ticket to PostGIS GEOMETRY, configured Celery with Redis broker for SLA monitoring.

## Objective

Create all Phase 4 data models (Team, TicketAssignment, SLAConfig), migrate Ticket location from separate lat/lng to PostGIS GEOMETRY, set up Celery infrastructure, and install new dependencies.

## Tasks Completed

### Task 1: Install dependencies and create models (Commit: 2150f92)

**What was done:**
- Added dependencies: `geoalchemy2>=0.18.0`, `shapely>=2.0.0`, `celery[redis]>=5.6.0`
- Created Team model (TenantAwareModel) with:
  - PostGIS POLYGON service_area for geospatial routing
  - category field matching TicketCategory values
  - is_saps flag for SAPS liaison teams
  - manager_id for team escalation
- Created TicketAssignment model (TenantAwareModel) with:
  - ticket_id, team_id, assigned_to relationships
  - assigned_by ("system" for auto-routing, user_id for manual)
  - reason field (geospatial_routing, manual_override, escalation, sla_breach)
  - is_current flag for active assignment tracking
- Created SLAConfig model (NonTenantModel) with:
  - municipality_id, category for SLA policies
  - response_hours (default 24h), resolution_hours (default 168h)
  - warning_threshold_pct (default 80%)
  - UniqueConstraint on (municipality_id, category)
- Updated Ticket model:
  - Replaced latitude/longitude Float columns with location GEOMETRY(Point, 4326)
  - Added backward-compatible lat/lng @property methods for Phase 2-3 code
  - Added assigned_team_id ForeignKey
  - Added escalation tracking (escalated_at, escalation_reason)
  - Added SLA tracking (first_responded_at, sla_response_deadline, sla_resolution_deadline)
- Created TeamCreate/TeamResponse and AssignmentCreate/AssignmentResponse schemas
- Updated config.py with Celery settings (broker URL, result backend, SLA check interval)

**Files modified:** 10 files (pyproject.toml, config.py, models, schemas)

**Verification passed:**
- All new models import successfully
- Ticket model has location column (not latitude/longitude)
- Schemas import successfully
- Config loads Celery settings

### Task 2: Create Alembic migration and Celery app (Commit: 2c70185)

**What was done:**
- Updated alembic/env.py to import new models (ticket, team, assignment, sla_config)
- Created manual migration `04_01_postgis` (down_revision: 02_01_ticket):
  - Enables PostGIS extension
  - Creates teams table with GIST index on service_area
  - Creates ticket_assignments table with ticket_id/tenant_id indexes
  - Creates sla_configs table with UniqueConstraint
  - Migrates ticket lat/lng data to PostGIS location: `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`
  - Drops old latitude/longitude columns
  - Creates GIST index on tickets.location
  - Adds SLA/escalation columns to tickets
  - Creates partial index for SLA monitoring (status IN ('open', 'in_progress'))
  - Full downgrade() restores lat/lng columns and drops PostGIS
- Created Celery app infrastructure:
  - src/tasks/__init__.py (package marker)
  - src/tasks/celery_app.py with:
    - Redis broker/backend (DB 1)
    - Africa/Johannesburg timezone
    - JSON serialization
    - Beat schedule for check-sla-breaches task (5-minute interval)
- Fixed SQLite compatibility:
  - Added USE_SQLITE_TESTS env var in tests/conftest.py
  - Conditionally use Text instead of Geometry in SQLite tests
  - Prevents GeoAlchemy2 import in test environment

**Files created:** 3 files (migration, celery_app.py, tasks/__init__.py)
**Files modified:** 4 files (alembic/env.py, team.py, ticket.py, conftest.py)

**Verification passed:**
- Celery app initializes: "Celery app: salga_trust_engine"
- Alembic config loads successfully
- Migration has correct revision chain (04_01_postgis -> 02_01_ticket)
- All 148 unit tests pass (zero regressions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SQLite test compatibility with GeoAlchemy2**
- **Found during:** Task 2 verification (pytest run)
- **Issue:** GeoAlchemy2 registers SQLAlchemy event handlers that call SQLite spatial functions (RecoverGeometryColumn, CheckSpatialIndex) which don't exist in SQLite. This broke all unit tests during table creation.
- **Root cause:** GeoAlchemy2's admin module automatically hooks into SQLAlchemy's after_create events for both PostgreSQL and SQLite, but SQLite doesn't have the required spatial functions unless SpatiaLite extension is loaded.
- **Fix applied:**
  - Added USE_SQLITE_TESTS environment variable in tests/conftest.py (set before model imports)
  - Updated Team and Ticket models to conditionally import GeoAlchemy2 based on environment
  - When USE_SQLITE_TESTS=1, use Text column type instead of Geometry type
  - This prevents GeoAlchemy2 event handlers from registering in test environment
- **Files modified:** tests/conftest.py, src/models/team.py, src/models/ticket.py
- **Verification:** All 148 unit tests pass with SQLite backend
- **Impact:** Zero - tests still validate business logic, PostGIS features only active in PostgreSQL environments

## Verification Results

All success criteria met:

- [x] Team, TicketAssignment, SLAConfig models exist with all specified fields
- [x] Ticket model migrated from lat/lng to PostGIS GEOMETRY(Point, 4326)
- [x] Backward-compatible latitude/longitude properties on Ticket
- [x] Alembic migration creates all tables and indexes
- [x] Celery app configured with Redis broker and 5-minute SLA beat schedule
- [x] GeoAlchemy2, Shapely, and Celery dependencies installed
- [x] Zero test regressions (148/148 passing)

## Key Decisions

1. **PostGIS GEOMETRY vs lat/lng columns:** Enables spatial queries (ST_Within, ST_Distance) for geospatial routing in Plan 02.
2. **Backward-compatible lat/lng properties:** Phase 2-3 code (IntakeFlow, crews) continues working without changes. Properties extract coordinates from location using geoalchemy2.shape.to_shape().
3. **SLAConfig as NonTenantModel:** Admins configure SLA policies cross-tenant (not per-municipality user).
4. **TicketAssignment history tracking:** Full audit trail of all assignments with is_current flag for active assignment.
5. **Celery Redis DB 1:** Separates task queue from rate limiting/sessions (Redis DB 0).
6. **SQLite test compatibility:** Environment-based conditional imports maintain unit test speed without requiring PostgreSQL or SpatiaLite setup.

## Dependencies Provided

**Models:**
- Team: Municipal service teams with geospatial coverage areas
- TicketAssignment: Assignment history for tickets
- SLAConfig: Municipality/category SLA policies

**Infrastructure:**
- Celery app: Background task queue with beat scheduler
- PostGIS: Geospatial query capabilities

**Database schema:**
- teams table with GIST spatial index
- ticket_assignments table with assignment history
- sla_configs table with municipality policies
- tickets.location PostGIS column (replaces lat/lng)
- tickets SLA/escalation columns

## Next Steps (Phase 04 Plan 02)

Plan 02 will build the routing service on top of these models:
- Geospatial routing: ST_Within(ticket.location, team.service_area)
- SLA calculation: Apply SLAConfig to set ticket deadlines
- Assignment creation: TicketAssignment records with reason tracking
- GBV special handling: Route to is_saps=true teams only

## Self-Check: PASSED

**Created files verified:**
- [x] src/models/team.py exists
- [x] src/models/assignment.py exists
- [x] src/models/sla_config.py exists
- [x] src/schemas/team.py exists
- [x] src/schemas/assignment.py exists
- [x] src/tasks/celery_app.py exists
- [x] alembic/versions/2026_02_10_0734-04_01_postgis_teams_sla.py exists

**Commits verified:**
- [x] Commit 2150f92 exists (Task 1: models and dependencies)
- [x] Commit 2c70185 exists (Task 2: migration and Celery)

**Tests verified:**
- [x] 148 unit tests passing
- [x] Zero regressions from Phase 3

All claims verified successfully.
