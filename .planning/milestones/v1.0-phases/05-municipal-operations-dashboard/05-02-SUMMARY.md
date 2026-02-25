---
phase: 05-municipal-operations-dashboard
plan: 02
subsystem: municipal-operations-dashboard
tags:
  - real-time-events
  - sse
  - data-export
  - redis-pubsub
  - csv-export
  - excel-export
dependency_graph:
  requires:
    - 04-03-PLAN.md # Redis setup for Celery (reused for Pub/Sub)
    - 01-03-PLAN.md # RBAC and authentication
  provides:
    - Real-time SSE event streaming for dashboard updates
    - CSV/Excel export endpoints with RBAC and SEC-05 compliance
  affects:
    - src/api/v1/events.py
    - src/api/v1/export.py
    - src/services/event_broadcaster.py
    - src/main.py
tech_stack:
  added:
    - sse-starlette>=2.1.0 # Server-Sent Events streaming
    - openpyxl>=3.1.0 # Excel file generation
  patterns:
    - Redis Pub/Sub for event broadcasting across server instances
    - EventSourceResponse for SSE streaming
    - StreamingResponse for memory-efficient CSV/Excel download
key_files:
  created:
    - src/services/event_broadcaster.py # Redis Pub/Sub broadcaster
    - src/api/v1/events.py # SSE streaming endpoint
    - src/api/v1/export.py # CSV/Excel export endpoints
  modified:
    - src/main.py # Registered events and export routers
    - pyproject.toml # Added sse-starlette and openpyxl dependencies
decisions:
  - decision: "Use Redis Pub/Sub for event broadcasting"
    rationale: "Already have Redis for Celery, provides horizontal scaling across multiple server instances"
    alternatives: ["In-memory queue (doesn't scale)", "WebSocket (more complex than SSE for one-way streaming)"]
  - decision: "SSE over WebSocket for dashboard events"
    rationale: "One-way streaming only, browser EventSource API handles auto-reconnect, simpler than WebSocket"
    alternatives: ["WebSocket (overkill for one-way)", "Polling (inefficient)"]
  - decision: "Ward councillor filtering at SSE layer"
    rationale: "RBAC enforcement - ward councillors see only their ward events, manager/admin see all"
    alternatives: ["Filter on frontend (security risk)", "Separate endpoints per role (duplication)"]
  - decision: "Separate CSV and Excel endpoints"
    rationale: "Excel requires openpyxl (heavy dependency), CSV is always available as fallback"
    alternatives: ["Single endpoint with format parameter", "Excel only (excludes users without openpyxl)"]
metrics:
  duration_minutes: 20.1
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  commits: 2
  tests_added: 0
  tests_passing: 265
  coverage_estimate: "N/A (no new tests in this plan)"
completed_date: 2026-02-10
---

# Phase 5 Plan 02: Real-time Events & Data Export Summary

**One-liner:** SSE event streaming with Redis Pub/Sub and CSV/Excel export endpoints with RBAC and SEC-05 compliance

## What Was Built

### 1. Redis Pub/Sub Event Broadcaster
**File:** `src/services/event_broadcaster.py`

- `EventBroadcaster` class for publishing/subscribing to dashboard events
- Channel pattern: `dashboard:{municipality_id}` (one per tenant)
- Event types: `ticket_updated`, `ticket_created`, `sla_breach`, `assignment_changed`
- Async generator pattern for event subscription
- Graceful connection cleanup on disconnect

**Event structure:**
```python
{
    "type": "ticket_updated",
    "data": {"ticket_id": "...", "status": "in_progress", ...},
    "ward_id": "Ward 1"  # Optional for ward councillor filtering
}
```

### 2. SSE Streaming Endpoint
**File:** `src/api/v1/events.py`

- Endpoint: `GET /api/v1/dashboard/events`
- Streams real-time ticket events to connected dashboard clients
- RBAC enforcement: MANAGER, ADMIN, WARD_COUNCILLOR only
- Ward councillor filtering: only sees events with matching `ward_id`
- Initial heartbeat on connection
- EventSourceResponse with auto-reconnect support

**Browser usage:**
```javascript
const eventSource = new EventSource('/api/v1/dashboard/events?ward_id=Ward1', {
  headers: { 'Authorization': 'Bearer <token>' }
});

eventSource.addEventListener('ticket_updated', (e) => {
  const data = JSON.parse(e.data);
  // Update dashboard UI
});
```

### 3. CSV/Excel Export Endpoints
**File:** `src/api/v1/export.py`

- Endpoints:
  - `GET /api/v1/export/tickets/csv` - CSV format (always available)
  - `GET /api/v1/export/tickets/excel` - Excel .xlsx format (requires openpyxl)
- RBAC enforcement: MANAGER, ADMIN, WARD_COUNCILLOR only
- SEC-05 compliance: GBV/sensitive tickets always excluded via `is_sensitive == False`
- Filters: status, category, ward_id, free-text search
- Max 10,000 rows per export
- StreamingResponse for memory efficiency
- Timestamped filenames: `tickets_export_20260210_112530.csv`

**Excel features:**
- Bold headers
- Auto-sized columns
- 13 columns: tracking number, category, status, severity, description, address, language, timestamps

**Graceful degradation:**
- Excel endpoint returns 501 if openpyxl not installed
- Error message directs users to CSV export

### 4. Router Registration
**File:** `src/main.py`

- Imported `events` and `export` routers
- Registered both under `/api/v1` prefix
- Final paths:
  - `/api/v1/dashboard/events` (SSE)
  - `/api/v1/export/tickets/csv`
  - `/api/v1/export/tickets/excel`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### Module Imports
```bash
✓ EventBroadcaster imports successfully
✓ Events router has /dashboard/events endpoint
✓ Export router has /export/tickets/csv and /export/tickets/excel
✓ Main app registers all routes correctly
```

### Dependencies Installed
```bash
✓ sse-starlette 3.0.3 installed
✓ openpyxl 3.1.5 installed
✓ Both added to pyproject.toml dependencies
```

### Test Suite
```bash
✓ 265 tests passed, 102 skipped (integration tests)
✓ Zero regressions
✓ Duration: 76.91 seconds
```

## Technical Highlights

### Redis Pub/Sub Architecture
- **Horizontal scaling:** Multiple FastAPI instances can publish/subscribe to same channel
- **Channel isolation:** Each municipality has dedicated channel for tenant isolation
- **Decode responses:** `decode_responses=True` returns strings instead of bytes
- **Connection pooling:** Redis client reused across publish calls

### SSE vs WebSocket Trade-offs
**Why SSE:**
- One-way streaming (server → client only)
- Browser EventSource API handles auto-reconnect automatically
- Simpler protocol than WebSocket (HTTP-based, no handshake)
- Works through most proxies/firewalls

**When WebSocket would be better:**
- Need bidirectional communication
- Binary data streaming
- Lower latency required

### Export Security
1. **SEC-05 enforcement:** `where(Ticket.is_sensitive == False)` in `_fetch_export_tickets`
2. **Tenant isolation:** `where(Ticket.tenant_id == current_user.tenant_id)`
3. **RBAC:** Only MANAGER/ADMIN/WARD_COUNCILLOR roles
4. **Rate limiting:** Inherited from global rate limiter (export counts as API call)

### Memory Efficiency
- CSV: Uses `io.StringIO` buffer, single `iter([output.getvalue()])` for StreamingResponse
- Excel: Uses `io.BytesIO` buffer, streams bytes to client
- Max 10,000 rows prevents memory exhaustion

## Integration Points

### With Plan 01 (Dashboard Metrics)
- Plan 01 added `/api/v1/dashboard/metrics/*` endpoints
- Plan 02 adds `/api/v1/dashboard/events` (SSE)
- Both use same `/dashboard` prefix but different sub-paths
- Both require MANAGER/ADMIN/WARD_COUNCILLOR roles

### With Phase 4 (Ticket Management)
- Event broadcaster will be called from:
  - `TicketRoutingService.route_ticket` → publish `ticket_created`
  - `TicketAssignmentService.assign_ticket` → publish `assignment_changed`
  - Ticket status update endpoint → publish `ticket_updated`
  - SLA escalation task → publish `sla_breach`
- Export fetches from same `Ticket` table as Phase 4 APIs

### Future Integration (Plan 03/04)
- Plan 03: Dashboard UI will consume SSE endpoint and display events
- Plan 04: Dashboard UI will use export endpoints for download buttons

## Implementation Notes

### SSE Client Disconnection
- `asyncio.CancelledError` caught when client disconnects
- `broadcaster.close()` in finally block ensures Redis cleanup
- No memory leaks from abandoned subscriptions

### Ward Councillor Filtering
**Current implementation (interim):**
- Ward filter uses `Ticket.address.ilike(f"%{ward_id}%")` (substring match)
- SSE events filtered by `event.get("ward_id")`

**Future enhancement (when User.ward_id added):**
- Enforce ward_id from `current_user.ward_id` (not query param)
- Prevent ward councillors from viewing other wards

### Excel Column Width Calculation
```python
ws.column_dimensions[chr(64 + col_idx)].width = max(len(header) + 2, 15)
```
- Works for columns A-Z (first 26 columns)
- Export has 13 columns, so no issue
- Would need adjustment if >26 columns added

## Self-Check

### Files Created
```bash
✓ FOUND: src/services/event_broadcaster.py
✓ FOUND: src/api/v1/events.py
✓ FOUND: src/api/v1/export.py
```

### Files Modified
```bash
✓ FOUND: src/main.py (events and export routers registered)
✓ FOUND: pyproject.toml (sse-starlette and openpyxl added)
```

### Commits
```bash
✓ FOUND: 6961596 - feat(05-02): create Redis Pub/Sub event broadcaster and SSE endpoint
✓ FOUND: e766671 - feat(05-02): add CSV/Excel export endpoints with RBAC
```

### Router Registration
```bash
$ python -c "from src.main import app; routes = [r.path for r in app.routes]; print([r for r in routes if 'export' in r or 'events' in r])"
['/api/v1/dashboard/events', '/api/v1/export/tickets/csv', '/api/v1/export/tickets/excel']
✓ All routes registered correctly
```

## Self-Check: PASSED

All files created, commits exist, routers registered, tests passing.

## Next Steps

**For Plan 03 (Dashboard Frontend):**
- Consume SSE endpoint using EventSource API
- Add "Export CSV" and "Export Excel" buttons
- Display real-time event notifications (toasts/badges)
- Show ward filter for WARD_COUNCILLOR role

**For Plan 04 (Role Configuration):**
- Add `User.ward_id` field
- Enforce ward filtering from user record (not query param)
- Add WARD_COUNCILLOR role assignment UI

**For Production:**
- Monitor Redis Pub/Sub subscriber count (metrics)
- Add event retention policy (TTL on channels)
- Add rate limiting on export endpoints (currently inherits global limit)
- Add export job queue for >10k row exports

---

**Plan completed:** 2026-02-10
**Duration:** 20.1 minutes
**Commits:** 2 (6961596, e766671)
**Tests:** 265 passing, 0 failures, 0 regressions
