---
phase: 04-ticket-management-routing
plan: 02
subsystem: routing
tags: [postgis, geoalchemy2, spatial-queries, routing, assignment, security]

# Dependency graph
requires:
  - phase: 04-01
    provides: Team, TicketAssignment, Ticket models with PostGIS support
provides:
  - RoutingService with geospatial proximity routing via PostGIS ST_DWithin/ST_Distance
  - AssignmentService with assignment history tracking and is_current flag
  - GBV security firewall (SEC-05) - GBV tickets route exclusively to SAPS teams
  - Fallback routing when no spatial match (category-based)
  - Assignment audit trail with first_responded_at for SLA tracking
affects: [04-03, 04-04, 05-municipal-operations-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostGIS ST_DWithin for radius-based proximity search (10km default)"
    - "PostGIS ST_Distance for distance ordering (nearest first)"
    - "GBV firewall pattern: assert + explicit is_saps filter at routing boundary"
    - "Assignment history with is_current flag (deactivate previous, create new)"
    - "first_responded_at tracking when ticket assigned to user"

key-files:
  created:
    - src/services/routing_service.py
    - src/services/assignment_service.py
  modified: []

key-decisions:
  - "GBV routing uses explicit assert + is_saps==True filter (security boundary)"
  - "Municipal routing explicitly filters is_saps==False to prevent SAPS teams receiving municipal tickets"
  - "10km radius for geospatial proximity search (ST_DWithin)"
  - "Fallback to category-based routing when no spatial match or location is None"
  - "first_responded_at set when ticket assigned to user AND status is open"
  - "Assignment deactivation uses UPDATE with is_current=False before creating new assignment"
  - "reassign_ticket enforces GBV-to-SAPS constraint at assignment layer (defense in depth)"

patterns-established:
  - "Security firewall: GBV routing has assert + explicit filter, separate from municipal routing"
  - "Assignment history: deactivate previous (is_current=False) before creating new (is_current=True)"
  - "SLA tracking: first_responded_at set on first user assignment, status changed to in_progress"
  - "Convenience methods: auto_route_and_assign combines routing + assignment for common use case"

# Metrics
duration: 9.6min
completed: 2026-02-10
---

# Phase 04 Plan 02: Geospatial Routing & Assignment Services Summary

**PostGIS-powered geospatial routing matches tickets to nearest teams within 10km, GBV security firewall ensures SAPS-only routing, assignment service tracks full history with is_current flag**

## Performance

- **Duration:** 9 min 36 sec (576s)
- **Started:** 2026-02-10T08:13:03Z
- **Completed:** 2026-02-10T08:22:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- RoutingService routes municipal tickets by location+category using PostGIS ST_DWithin (10km radius) and ST_Distance (nearest first)
- GBV security firewall (SEC-05) enforced at routing layer: _route_gbv_ticket exclusively queries is_saps=True teams
- Municipal routing explicitly excludes SAPS teams (is_saps=False) to prevent cross-contamination
- AssignmentService creates TicketAssignment records with full history tracking (is_current flag)
- Assignment deactivation logic: UPDATE previous assignments to is_current=False before creating new one
- first_responded_at tracking for SLA compliance when ticket assigned to user
- Fallback routing when no geospatial match: category-based within tenant
- GBV reassignment guard: reassign_ticket validates new team is SAPS (defense in depth)
- find_teams_near_location utility method for Phase 5 manual re-routing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create geospatial routing service with GBV firewall** - `11e8727` (feat)
   - RoutingService with route_ticket entry point
   - _route_municipal_ticket with PostGIS proximity queries
   - _route_gbv_ticket with SAPS-only security boundary
   - find_teams_near_location utility for API/dashboard use
   - Graceful degradation when USE_SQLITE_TESTS=1

2. **Task 2: Create ticket assignment service with history tracking** - `4b12115` (feat)
   - AssignmentService with assign_ticket, reassign_ticket, get_assignment_history
   - Deactivates previous assignments (is_current=False) before creating new
   - Updates ticket.assigned_team_id, ticket.assigned_to, ticket.status
   - Tracks first_responded_at when assigned to user (SLA requirement)
   - auto_route_and_assign convenience method combines RoutingService + assignment
   - GBV guard in reassign_ticket validates is_saps=True

## Files Created/Modified

- `src/services/routing_service.py` - Geospatial ticket routing with PostGIS proximity queries and GBV firewall
- `src/services/assignment_service.py` - Ticket assignment with history tracking and first response time

## Decisions Made

1. **GBV Security Firewall (SEC-05):**
   - Explicit `assert ticket.is_sensitive or ticket.category == "gbv"` in _route_gbv_ticket
   - Hard-coded `Team.is_saps == True` filter in GBV routing (no conditional logic that could be bypassed)
   - Municipal routing uses `Team.is_saps == False` to prevent SAPS teams receiving municipal tickets
   - reassign_ticket validates new team is SAPS for GBV tickets (defense in depth)

2. **Geospatial Routing Strategy:**
   - ST_DWithin with 10km radius for proximity search (balances coverage vs precision)
   - ST_Distance ordering for nearest-first matching
   - Fallback to category-based routing when no spatial match (ensures tickets don't stay unassigned)
   - Utility method find_teams_near_location returns all teams in radius for manual re-routing

3. **Assignment History Architecture:**
   - is_current flag ensures only one active assignment per ticket
   - Deactivation via UPDATE (not DELETE) preserves full audit trail
   - assigned_by can be "system" (auto-routing) or user_id (manual override)
   - reason field captures assignment context (e.g., "geospatial_routing", "manual_override", "escalation")

4. **SLA Tracking:**
   - first_responded_at set when ticket assigned to user AND ticket.status == "open"
   - Status changed to "in_progress" on first user assignment
   - Only sets first_responded_at if None (prevents overwriting on reassignment)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - PostGIS functions, models, and database configuration from Plan 04-01 worked as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 04-03 (Celery Background Tasks):**
- RoutingService.route_ticket() ready to be called from Celery tasks
- AssignmentService.auto_route_and_assign() provides single-call convenience method
- GBV security firewall prevents SAPS routing bypass

**Ready for Plan 04-04 (Routing API Endpoints):**
- find_teams_near_location() utility for manual re-routing endpoints
- reassign_ticket() enforces GBV-to-SAPS constraint at API layer
- get_assignment_history() provides audit trail for dashboard

**Blockers:** None

## Self-Check: PASSED

All claimed files verified to exist:
- FOUND: src/services/routing_service.py
- FOUND: src/services/assignment_service.py

All claimed commits verified to exist:
- FOUND: 11e8727 (Task 1: RoutingService)
- FOUND: 4b12115 (Task 2: AssignmentService)

---
*Phase: 04-ticket-management-routing*
*Completed: 2026-02-10*
