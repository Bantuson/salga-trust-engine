# Phase 5: Municipal Operations Dashboard - Research

**Researched:** 2026-02-10
**Domain:** React admin dashboard with real-time updates, data visualization, filtering, and export
**Confidence:** HIGH

## Summary

Phase 5 implements a comprehensive municipal operations dashboard for managers and ward councillors to view, filter, search, assign tickets, monitor real-time metrics (ticket volumes, SLA compliance, team workload), and export data to Excel/CSV. The architecture leverages React 19 with Vite (already in stack from Phase 3), FastAPI Server-Sent Events (SSE) for real-time updates without polling, TanStack Table for filtering/sorting/pagination with server-side data, Recharts for visualizations (simpler than Visx, good for metric displays), and client-side CSV/Excel export libraries.

Critical findings: (1) Server-Sent Events (SSE) provide unidirectional real-time updates from server to client with automatic reconnection, simpler than WebSockets for dashboard use cases where only the server pushes updates—FastAPI's sse-starlette library handles SSE streaming natively; (2) TanStack Table v8+ (formerly React Table) is the standard headless table library supporting server-side filtering, sorting, pagination, and 100K+ row performance with client-side virtualization; (3) Recharts is the most popular React charting library for dashboards (simple API, built on D3, responsive), preferred over Visx (too low-level) or Chart.js (not React-native); (4) Redis Pub/Sub enables broadcasting ticket updates to all connected dashboard clients across multiple FastAPI server instances—essential for horizontal scaling; (5) react-csv and xlsx libraries handle client-side export without server round-trip, but for large datasets (>10K rows) server-side generation is recommended; (6) RBAC filtering must happen at the query level (not client-side) to prevent unauthorized data access—ward councillor sees only their ward's tickets via SQL WHERE clause.

**Primary recommendation:** Use FastAPI SSE endpoints with sse-starlette for real-time dashboard updates, Redis Pub/Sub for broadcasting ticket change events across server instances, TanStack Table v8 for server-paginated ticket lists with filtering/sorting, Recharts for metric visualizations (bar charts for volumes, line charts for SLA trends, gauge charts for compliance %), react-csv for CSV export and xlsx for Excel export (client-side for <5K rows, server-side for larger datasets), React Context or Zustand for lightweight dashboard state management, and RBAC-aware API endpoints that filter tickets by user role (ward councillor gets ward_id filter automatically applied).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Table | 8.20+ | Headless table with filtering, sorting, pagination | Industry standard React table (50K+ stars), server-side data support, performance tested to 100K rows |
| Recharts | 2.15+ | React charting library built on D3 | Most popular React charts (25K+ stars), simple API, responsive, SVG-based |
| sse-starlette | 2.1+ | FastAPI Server-Sent Events support | Official Starlette SSE implementation, async streaming, auto-reconnect |
| react-csv | 2.2+ | Client-side CSV export | Lightweight (90KB), browser-native download, no server round-trip |
| xlsx | 0.18+ | Client-side Excel export | SheetJS library (38K+ stars), supports .xlsx format, works in browser |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0+ | Lightweight state management | Global dashboard state (filters, view preferences), simpler than Redux for small apps |
| date-fns | 4.1+ | Date formatting and manipulation | Format SLA deadlines, calculate time remaining, already lightweight and tree-shakable |
| @tanstack/react-virtual | 3.10+ | Virtual scrolling for large lists | If ticket lists exceed 1000 rows on client (combine with TanStack Table) |
| redis-py | 5.2+ | Redis Pub/Sub for server-side broadcasting | Already in stack (Phase 4), broadcast ticket updates to all dashboard clients |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE (Server-Sent Events) | WebSockets | WebSockets bi-directional but overkill for one-way dashboard updates; SSE simpler, auto-reconnect, HTTP-based |
| Recharts | Visx (Airbnb) | Visx more flexible but steeper learning curve, Recharts faster to implement for standard metric dashboards |
| TanStack Table | AG Grid / MUI DataGrid | AG Grid enterprise features require license, MUI DataGrid lacks headless flexibility, TanStack Table free and unopinionated |
| Client-side export | Server-side PDF/Excel | Client-side faster for <5K rows, server-side needed for >10K rows or complex formatting |
| Zustand | Redux Toolkit | Redux more boilerplate for global state, Zustand 3KB and simpler for dashboard filter state |

**Installation:**
```bash
# Frontend (React dashboard)
cd frontend
npm install @tanstack/react-table@8 recharts@2 react-csv@2 xlsx@0.18 zustand@5 date-fns@4

# Backend (FastAPI SSE)
pip install 'sse-starlette>=2.1.0' 'redis>=5.2.0'  # redis already installed in Phase 4
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── pages/
│   ├── DashboardPage.tsx           # Main dashboard container
│   ├── TicketListPage.tsx          # Paginated ticket list with filters
│   └── MetricsPage.tsx             # Real-time metrics visualizations
├── components/
│   ├── dashboard/
│   │   ├── TicketTable.tsx         # TanStack Table for ticket list
│   │   ├── FilterBar.tsx           # Filter inputs (status, category, date range)
│   │   ├── MetricsCards.tsx        # Summary cards (open tickets, SLA breaches)
│   │   ├── VolumeChart.tsx         # Bar chart for ticket volumes by category
│   │   ├── SLAComplianceChart.tsx  # Gauge chart for SLA compliance %
│   │   └── TeamWorkloadChart.tsx   # Bar chart for tickets per team
│   ├── ExportButton.tsx            # CSV/Excel export button
│   └── RealtimeIndicator.tsx       # SSE connection status indicator
├── hooks/
│   ├── useSSE.ts                   # Custom hook for SSE connection
│   ├── useTicketFilters.ts         # Filter state management hook
│   └── useDashboardMetrics.ts      # Fetch and cache metrics
├── services/
│   ├── api.ts                      # EXISTING: API client (from Phase 3)
│   └── sse.ts                      # SSE connection manager
└── stores/
    └── dashboardStore.ts           # Zustand store for filter state

src/api/v1/
├── tickets.py                      # EXISTING: Enhanced with server-side filtering
├── dashboard.py                    # NEW: Dashboard metrics endpoints
└── events.py                       # NEW: SSE event stream endpoint

src/services/
├── dashboard_service.py            # NEW: Metrics calculation service
└── event_broadcaster.py            # NEW: Redis Pub/Sub event broadcaster
```

### Pattern 1: Server-Sent Events (SSE) for Real-Time Updates
**What:** FastAPI SSE endpoint streams ticket status changes to dashboard clients without polling.

**When to use:** When dashboard must update in real-time (<5 second latency) without page refresh (OPS-04).

**Example:**
```python
# Source: sse-starlette official docs, FastAPI community patterns
from sse_starlette.sse import EventSourceResponse
from fastapi import APIRouter, Depends
from src.api.deps import get_current_user
from src.services.event_broadcaster import EventBroadcaster

router = APIRouter()

@router.get("/events/stream")
async def stream_dashboard_events(
    current_user: User = Depends(get_current_user),
):
    """SSE endpoint for real-time dashboard updates.

    Streams ticket status changes, new assignments, SLA breaches.
    Client auto-reconnects if connection drops.
    """
    broadcaster = EventBroadcaster()

    async def event_generator():
        # Subscribe to Redis Pub/Sub channel for user's municipality
        async for event in broadcaster.subscribe(
            f"dashboard:{current_user.municipality_id}"
        ):
            # Filter by role: ward councillor sees only their ward
            if current_user.role == UserRole.WARD_COUNCILLOR:
                if event.get("ward_id") != current_user.ward_id:
                    continue

            yield {
                "event": event["type"],  # "ticket_updated", "sla_breach"
                "data": event["data"],
            }

    return EventSourceResponse(event_generator())
```

**React Client:**
```typescript
// Source: MDN EventSource API, React SSE patterns 2026
import { useEffect, useState } from 'react';

export function useSSE(url: string, onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(url, {
      withCredentials: true, // Send auth cookies
    });

    eventSource.onopen = () => setIsConnected(true);

    eventSource.addEventListener('ticket_updated', (e) => {
      onMessage(JSON.parse(e.data));
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      // Browser auto-reconnects after 3 seconds
    };

    return () => eventSource.close();
  }, [url, onMessage]);

  return { isConnected };
}
```

### Pattern 2: TanStack Table with Server-Side Filtering
**What:** TanStack Table manages table state (sorting, filters, pagination), sends parameters to backend, renders server-returned data.

**When to use:** Ticket list with thousands of rows requiring server-side filtering for performance (OPS-01).

**Example:**
```typescript
// Source: TanStack Table v8 official docs, server-side pagination guide
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
} from '@tanstack/react-table';

interface TicketTableProps {
  municipalityId: string;
  wardId?: string; // For ward councillors
}

export function TicketTable({ municipalityId, wardId }: TicketTableProps) {
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: '',
  });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [sorting, setSorting] = useState([{ id: 'created_at', desc: true }]);

  // Fetch tickets from server with filters
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', municipalityId, wardId, filters, pagination, sorting],
    queryFn: () => fetchTickets({
      municipality_id: municipalityId,
      ward_id: wardId, // RBAC: ward councillor filter
      ...filters,
      page: pagination.pageIndex,
      limit: pagination.pageSize,
      sort_by: sorting[0]?.id,
      sort_order: sorting[0]?.desc ? 'desc' : 'asc',
    }),
  });

  const table = useReactTable({
    data: data?.tickets ?? [],
    columns: ticketColumns,
    pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Server-side pagination
    manualSorting: true,    // Server-side sorting
  });

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: 'pointer' }}
                >
                  {header.column.columnDef.header}
                  {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {cell.renderValue()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination table={table} />
    </div>
  );
}
```

### Pattern 3: Recharts Metric Visualizations
**What:** Recharts components for ticket volume bar charts, SLA compliance gauges, trend line charts.

**When to use:** Dashboard metrics display (OPS-04) for at-a-glance monitoring.

**Example:**
```typescript
// Source: Recharts official docs (recharts.org)
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface VolumeChartProps {
  data: Array<{ category: string; open: number; resolved: number }>;
}

export function TicketVolumeChart({ data }: VolumeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="open" fill="#f59e0b" name="Open" />
        <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// SLA Compliance Gauge
import { PieChart, Pie, Cell } from 'recharts';

export function SLAComplianceGauge({ percent }: { percent: number }) {
  const data = [
    { name: 'Compliant', value: percent },
    { name: 'Remaining', value: 100 - percent },
  ];
  const COLORS = percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          startAngle={180}
          endAngle={0}
          innerRadius={60}
          outerRadius={80}
          dataKey="value"
        >
          <Cell fill={COLORS} />
          <Cell fill="#e5e7eb" />
        </Pie>
      </PieChart>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={24}>
        {percent}%
      </text>
    </ResponsiveContainer>
  );
}
```

### Pattern 4: Client-Side CSV/Excel Export
**What:** Generate CSV/Excel files in browser from filtered ticket data without server round-trip.

**When to use:** Export current view (<5K rows) to CSV/Excel (OPS-02).

**Example:**
```typescript
// Source: react-csv and xlsx library docs
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';

interface ExportButtonProps {
  data: Ticket[];
  filename: string;
}

export function ExportButton({ data, filename }: ExportButtonProps) {
  // CSV export (simple, lightweight)
  const csvData = data.map(ticket => ({
    'Tracking Number': ticket.tracking_number,
    'Category': ticket.category,
    'Status': ticket.status,
    'Priority': ticket.severity,
    'Created': new Date(ticket.created_at).toLocaleDateString(),
    'SLA Deadline': ticket.sla_resolution_deadline
      ? new Date(ticket.sla_resolution_deadline).toLocaleDateString()
      : 'N/A',
    'Assigned Team': ticket.assigned_team?.name ?? 'Unassigned',
  }));

  // Excel export (more features)
  const handleExcelExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

    // Auto-size columns
    const maxWidth = csvData.reduce((acc, row) => {
      Object.keys(row).forEach((key) => {
        const cellWidth = String(row[key]).length + 2;
        acc[key] = Math.max(acc[key] || 0, cellWidth);
      });
      return acc;
    }, {});
    worksheet['!cols'] = Object.values(maxWidth).map(w => ({ wch: w }));

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  return (
    <div>
      <CSVLink
        data={csvData}
        filename={`${filename}.csv`}
        className="btn btn-secondary"
      >
        Export CSV
      </CSVLink>
      <button onClick={handleExcelExport} className="btn btn-primary">
        Export Excel
      </button>
    </div>
  );
}
```

### Pattern 5: Redis Pub/Sub for Multi-Server Broadcasting
**What:** Backend publishes ticket events to Redis channel, all FastAPI instances receive and broadcast to their SSE clients.

**When to use:** Horizontally scaled FastAPI deployment (multiple workers/containers) where ticket update must reach all dashboard clients (OPS-04).

**Example:**
```python
# Source: Redis Pub/Sub patterns, FastAPI scaling guides 2026
import redis.asyncio as redis
from typing import AsyncGenerator
import json

class EventBroadcaster:
    """Redis Pub/Sub broadcaster for dashboard events."""

    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL)
        self.pubsub = self.redis_client.pubsub()

    async def publish(self, channel: str, event: dict):
        """Publish event to Redis channel (all servers receive)."""
        await self.redis_client.publish(
            channel,
            json.dumps(event)
        )

    async def subscribe(self, channel: str) -> AsyncGenerator[dict, None]:
        """Subscribe to Redis channel and yield events."""
        await self.pubsub.subscribe(channel)

        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    yield json.loads(message["data"])
        finally:
            await self.pubsub.unsubscribe(channel)

# Usage in ticket status update endpoint
@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: UUID,
    status_update: TicketStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Update ticket in database
    ticket = await update_ticket(ticket_id, status_update, db)

    # Broadcast event to all dashboard clients
    broadcaster = EventBroadcaster()
    await broadcaster.publish(
        f"dashboard:{ticket.municipality_id}",
        {
            "type": "ticket_updated",
            "data": {
                "ticket_id": str(ticket.id),
                "tracking_number": ticket.tracking_number,
                "status": ticket.status,
                "ward_id": ticket.ward_id,
            }
        }
    )

    return ticket
```

### Anti-Patterns to Avoid
- **Client-side RBAC filtering:** Don't fetch all tickets and filter by ward_id on client—SQL injection risk and data leakage. Filter at query level with WHERE clause.
- **Polling for updates:** Don't setInterval fetch every 5 seconds—SSE provides real-time updates with less overhead and auto-reconnect.
- **Exporting large datasets client-side:** Don't try to export 50K rows in browser—memory limits and freezing. Use server-side generation with streaming response for >10K rows.
- **Embedding real-time data in charts directly:** Don't connect SSE events directly to Recharts—causes excessive re-renders. Buffer updates and refresh charts every 30-60 seconds.
- **Custom table implementation:** Don't build table sorting/filtering from scratch—TanStack Table handles edge cases (null values, date sorting, multi-column sorts).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time updates | setInterval polling | Server-Sent Events (SSE) with sse-starlette | SSE has auto-reconnect, lower latency, less server load. Polling wastes 95% of requests when no updates. |
| Table filtering/sorting | Custom filter state + sort logic | TanStack Table | Handles null values, multi-column sorts, type-aware comparisons, pagination state sync. 50K+ stars, battle-tested. |
| CSV generation | String concatenation with commas | react-csv library | Handles escaping (commas in values), UTF-8 BOM for Excel, special characters. CSV format has edge cases. |
| Excel generation | XML manipulation | xlsx (SheetJS) | .xlsx is a zipped XML format with relationships, styles, formulas. Library handles spec correctly. |
| Chart responsiveness | window.resize listeners | Recharts ResponsiveContainer | Handles parent container changes, debounces resize events, works with CSS grid/flexbox. |
| Date formatting | new Date().toString() | date-fns format() | Locale support, timezone handling, relative time ("2 hours ago"), consistent formats. |

**Key insight:** Dashboards have complex state management (filters, pagination, real-time updates, RBAC) and performance requirements (large datasets, chart rendering). Using proven libraries prevents edge case bugs and performance regressions. TanStack Table + Recharts + SSE is the modern standard stack for React admin dashboards in 2026.

## Common Pitfalls

### Pitfall 1: SSE Connection Limits on Client
**What goes wrong:** Browsers limit SSE connections to 6 per domain. Opening dashboard in multiple tabs exhausts connections, causing "pending" requests.

**Why it happens:** EventSource uses HTTP/1.1 connection pooling, shares limit with other requests (images, API calls).

**How to avoid:** Use HTTP/2 (most browsers allow 100+ concurrent streams), or implement SharedWorker to share single SSE connection across tabs. Fallback: close SSE when tab inactive (visibilitychange event).

**Warning signs:** Dashboard stops updating after opening 6+ tabs. Network tab shows pending SSE requests.

### Pitfall 2: Memory Leaks with Unsubscribed SSE
**What goes wrong:** SSE connections stay open after component unmount, causing memory leaks and phantom dashboard updates.

**Why it happens:** EventSource.close() not called in useEffect cleanup, or async generator not properly cancelled.

**How to avoid:** Always return cleanup function in useEffect: `return () => eventSource.close()`. On backend, use try/finally to unsubscribe from Redis Pub/Sub when client disconnects.

**Warning signs:** Memory usage grows over time. Server logs show orphaned Redis subscriptions.

### Pitfall 3: Infinite Re-Renders with Real-Time Chart Updates
**What goes wrong:** SSE event triggers state update → chart re-renders → triggers metric recalculation → triggers re-render loop.

**Why it happens:** Chart data derived from state without memoization, or onMessage callback not wrapped in useCallback.

**How to avoid:** Use React.memo() on chart components, useMemo() for data transformations, debounce chart updates (update every 30 seconds even if events arrive every second). Separate metric state from chart render state.

**Warning signs:** Dashboard becomes unresponsive. DevTools shows hundreds of renders per second.

### Pitfall 4: Excel Export OOM on Large Datasets
**What goes wrong:** Exporting 50K rows crashes browser tab with "Out of Memory" error.

**Why it happens:** xlsx library loads entire dataset into memory, creates ZIP archive in memory (2-3x data size), then triggers download.

**How to avoid:** Limit client-side export to <5K rows. For larger exports, add server-side endpoint that streams Excel file (openpyxl in Python) with pagination. Show warning: "Large export (10K+ rows) will be emailed when ready."

**Warning signs:** Browser tab crashes on export. Users report incomplete exports.

### Pitfall 5: RBAC Bypass via Client-Side Filtering
**What goes wrong:** Ward councillor modifies React DevTools state to see other wards' tickets, bypassing UI filtering.

**Why it happens:** API returns all tickets, React filters by ward_id on client. Any client-side filter can be bypassed.

**How to avoid:** Filter tickets at SQL query level based on current_user.role and current_user.ward_id. API endpoint MUST enforce RBAC with WHERE clause. Client-side filtering is UX only, not security.

**Warning signs:** Security audit finds exposed data. Penetration test bypasses ward filtering.

### Pitfall 6: Stale Metrics After Real-Time Update
**What goes wrong:** Ticket status changes via SSE, but dashboard metrics cards (open count, SLA compliance %) don't update.

**Why it happens:** Metrics fetched once on mount, not refetched when SSE event arrives. Event contains ticket data but not aggregated metrics.

**How to avoid:** On SSE ticket event, invalidate metrics query cache (React Query: queryClient.invalidateQueries(['dashboard-metrics'])). Or include delta in SSE event: `{"open_count_delta": -1, "resolved_count_delta": +1}` and update metrics locally.

**Warning signs:** Ticket list updates in real-time but summary cards lag. Requires page refresh to see correct counts.

## Code Examples

Verified patterns from official sources:

### FastAPI SSE Endpoint with RBAC Filtering
```python
# Source: sse-starlette official examples, FastAPI async patterns
from sse_starlette.sse import EventSourceResponse
from fastapi import APIRouter, Depends, HTTPException
from src.api.deps import get_current_user, require_roles
from src.models.user import User, UserRole
from src.services.event_broadcaster import EventBroadcaster

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/events")
async def stream_dashboard_events(
    current_user: User = Depends(get_current_user),
):
    """Real-time dashboard event stream with RBAC filtering.

    Streams:
    - ticket_updated: Status/assignment changes
    - sla_breach: Ticket exceeded SLA deadline
    - metrics_updated: Aggregate metric changes

    Auto-reconnects on disconnect (browser EventSource API).
    """
    # Require manager or ward councillor role
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]:
        raise HTTPException(status_code=403, detail="Dashboard access requires manager role")

    broadcaster = EventBroadcaster()

    async def event_generator():
        # Subscribe to municipality-level events
        channel = f"dashboard:{current_user.municipality_id}"

        try:
            async for event in broadcaster.subscribe(channel):
                # RBAC: Filter by ward for ward councillors
                if current_user.role == UserRole.WARD_COUNCILLOR:
                    if event.get("ward_id") != current_user.ward_id:
                        continue  # Skip events for other wards

                # Yield event to client
                yield {
                    "event": event["type"],
                    "data": json.dumps(event["data"]),
                    "id": str(uuid4()),  # Event ID for resumption
                }
        except asyncio.CancelledError:
            # Client disconnected, cleanup handled in finally
            pass

    return EventSourceResponse(event_generator())

@router.get("/metrics")
async def get_dashboard_metrics(
    current_user: User = Depends(require_roles([UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR])),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard metrics with RBAC filtering."""
    from src.services.dashboard_service import DashboardService

    service = DashboardService()

    # RBAC: Filter by ward for ward councillors
    ward_id = current_user.ward_id if current_user.role == UserRole.WARD_COUNCILLOR else None

    metrics = await service.get_metrics(
        municipality_id=current_user.municipality_id,
        ward_id=ward_id,
        db=db,
    )

    return metrics
```

### React useSSE Hook with Auto-Reconnect
```typescript
// Source: MDN EventSource API, React SSE patterns 2026
import { useEffect, useState, useCallback, useRef } from 'react';

interface UseSSEOptions {
  url: string;
  onMessage: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  enabled?: boolean; // Disable when tab inactive
}

export function useSSE({ url, onMessage, onError, enabled = true }: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Memoize callback to prevent EventSource recreation
  const handleMessage = useCallback((event: MessageEvent) => {
    onMessage(event);
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      // Close connection when disabled (e.g., tab inactive)
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      return;
    }

    // Create EventSource with auth headers via credentials
    const eventSource = new EventSource(url, {
      withCredentials: true, // Send JWT cookies
    });
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('[SSE] Connected to', url);
    };

    // Listen to custom event types
    eventSource.addEventListener('ticket_updated', handleMessage);
    eventSource.addEventListener('sla_breach', handleMessage);
    eventSource.addEventListener('metrics_updated', handleMessage);

    eventSource.onerror = (e) => {
      setIsConnected(false);
      setError('Connection lost, reconnecting...');
      onError?.(e);
      // Browser auto-reconnects after 3 seconds
    };

    // Cleanup on unmount
    return () => {
      console.log('[SSE] Closing connection');
      eventSource.close();
    };
  }, [url, handleMessage, onError, enabled]);

  return { isConnected, error };
}

// Usage in Dashboard component
export function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // Disable SSE when tab is inactive (save connections)
  const [tabActive, setTabActive] = useState(true);
  useEffect(() => {
    const handleVisibilityChange = () => setTabActive(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSSEMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);

    if (event.type === 'ticket_updated') {
      // Update ticket in list
      setTickets(prev => prev.map(t =>
        t.id === data.ticket_id ? { ...t, ...data } : t
      ));
    } else if (event.type === 'metrics_updated') {
      setMetrics(data);
    }
  }, []);

  const { isConnected } = useSSE({
    url: '/api/v1/dashboard/events',
    onMessage: handleSSEMessage,
    enabled: tabActive,
  });

  return (
    <div>
      <RealtimeIndicator connected={isConnected} />
      {/* Dashboard content */}
    </div>
  );
}
```

### TanStack Table with Server-Side Filtering
```typescript
// Source: TanStack Table v8 docs - server-side filtering example
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  PaginationState,
  SortingState,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';

interface TicketFilters {
  status?: string;
  category?: string;
  search?: string;
  ward_id?: string; // RBAC filter
}

export function TicketTable({ wardId }: { wardId?: string }) {
  const [filters, setFilters] = useState<TicketFilters>({
    ward_id: wardId, // Auto-set for ward councillors
  });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ]);

  // Fetch tickets from server
  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', filters, pagination, sorting],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex),
        limit: String(pagination.pageSize),
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.ward_id && { ward_id: filters.ward_id }),
        ...(sorting[0] && {
          sort_by: sorting[0].id,
          sort_order: sorting[0].desc ? 'desc' : 'asc',
        }),
      });

      const response = await fetch(`/api/v1/tickets?${params}`, {
        credentials: 'include', // Send auth cookies
      });

      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    },
    keepPreviousData: true, // Keep old data while loading new page
  });

  const columns: ColumnDef<Ticket>[] = [
    {
      accessorKey: 'tracking_number',
      header: 'Tracking #',
      enableSorting: false,
    },
    {
      accessorKey: 'category',
      header: 'Category',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() as string} />
      ),
    },
    {
      accessorKey: 'severity',
      header: 'Priority',
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => format(new Date(getValue() as string), 'PPp'),
    },
    {
      accessorKey: 'sla_resolution_deadline',
      header: 'SLA Deadline',
      cell: ({ getValue }) => {
        const deadline = getValue() as string | null;
        if (!deadline) return 'N/A';
        return <SLADeadlineCell deadline={deadline} />;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TicketActions ticket={row.original} />
      ),
    },
  ];

  const table = useReactTable({
    data: data?.tickets ?? [],
    columns,
    pageCount: data?.page_count ?? 0,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {header.column.columnDef.header}
                      {header.column.getIsSorted() && (
                        <span>{header.column.getIsSorted() === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-gray-500">
                  No tickets found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                      {cell.renderValue()}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        pageIndex={pagination.pageIndex}
        pageCount={table.getPageCount()}
        canPreviousPage={table.getCanPreviousPage()}
        canNextPage={table.getCanNextPage()}
        previousPage={() => table.previousPage()}
        nextPage={() => table.nextPage()}
        gotoPage={(page) => table.setPageIndex(page)}
      />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Table v7 | TanStack Table v8 | 2023 | Renamed, headless by default, better TypeScript support, server-side patterns |
| Polling (setInterval) | Server-Sent Events (SSE) | 2020+ | SSE standard for one-way real-time, lower latency, auto-reconnect |
| Redux for all state | Zustand/Jotai for local state | 2021+ | Lightweight alternatives for non-global state, less boilerplate |
| Victory/Nivo charts | Recharts | 2019+ | Recharts simpler API, better docs, more active maintenance |
| FileSaver.js | Browser native download | 2022+ | Modern browsers support Blob URLs natively, no extra library |
| Custom CSV parsing | react-csv library | 2020+ | Handles edge cases (escaping, BOM), tested with Excel/Google Sheets |

**Deprecated/outdated:**
- **React Table v7:** Renamed to TanStack Table v8, v7 in maintenance mode only
- **WebSockets for dashboard updates:** Overkill for one-way streaming, SSE simpler and HTTP-based
- **Context API for complex state:** Zustand/Jotai more performant for frequent updates (dashboard metrics)
- **Long polling:** Replaced by SSE, inefficient for real-time updates
- **Chart.js with React wrappers:** Not React-native, Recharts built for React from ground up

## Open Questions

1. **Large Dataset Export Strategy**
   - What we know: Client-side export limited to ~5K rows before memory issues
   - What's unclear: Should Phase 5 include server-side export for >5K rows, or defer to Phase 6?
   - Recommendation: Include server-side export endpoint in Phase 5 (OPS-02 doesn't specify limit). Use FastAPI StreamingResponse with openpyxl to stream Excel file. Add UI warning: "Export >5K rows will download in background."

2. **SSE Connection Pooling in Production**
   - What we know: SSE uses long-lived HTTP connections, may hit server limits
   - What's unclear: nginx/uvicorn default timeout settings for SSE (60s? 300s?)
   - Recommendation: Configure nginx proxy_read_timeout 300s for SSE endpoints, uvicorn --timeout-keep-alive 300. Monitor connection count with Prometheus. Document in deployment guide.

3. **Chart Update Frequency**
   - What we know: SSE sends ticket events in real-time (seconds), but charts shouldn't re-render every second
   - What's unclear: Optimal chart refresh rate for UX (30s? 60s?)
   - Recommendation: Buffer SSE events and refresh charts every 60 seconds. Use visual indicator "Updated X seconds ago" to show freshness. Make refresh interval configurable in settings.

4. **Ward Councillor Permissions**
   - What we know: Ward councillor sees only their ward's tickets
   - What's unclear: Can ward councillor assign tickets to teams, or only view?
   - Recommendation: Ward councillor role is read-only in Phase 5 (OPS-03 says "view dashboard filtered to their ward"). Assignment requires MANAGER role. If user wants ward councillor assignment, add to Phase 6.

## Sources

### Primary (HIGH confidence)
- [TanStack Table v8 Official Docs](https://tanstack.com/table/latest/docs) - Server-side filtering, pagination, sorting patterns
- [Recharts Documentation](https://recharts.org/en-US/) - React charts API, responsive containers, composition patterns
- [sse-starlette PyPI](https://pypi.org/project/sse-starlette/) - FastAPI SSE implementation, streaming response examples
- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - Browser SSE API, auto-reconnect behavior
- [Redis Pub/Sub Docs](https://redis.io/docs/latest/develop/interact/pubsub/) - Pub/Sub patterns, channel subscriptions
- [SheetJS xlsx Library](https://docs.sheetjs.com/) - Excel .xlsx generation in browser, streaming

### Secondary (MEDIUM confidence)
- [React Admin Dashboard Best Practices 2026 | Refine](https://refine.dev/blog/react-admin-dashboard/) - State management, code splitting, pagination patterns
- [Server-Sent Events for Push Notifications on FastAPI](https://plainenglish.io/blog/server-sent-events-for-push-notifications-on-fastapi) - FastAPI SSE implementation guide
- [How to Build WebSocket Servers with FastAPI and Redis](https://oneuptime.com/blog/post/2026-01-25-websocket-servers-fastapi-redis/view) - Redis Pub/Sub for broadcasting across servers
- [TanStack Table Server-Side Pagination Guide](https://www.contentful.com/blog/tanstack-table-react-table/) - Implementation patterns for large datasets
- [React Dashboard Performance Optimization](https://www.zigpoll.com/content/how-can-i-optimize-the-rendering-performance-of-large-datasets-in-a-react-dashboard-using-virtualization-techniques) - Virtual scrolling, memoization techniques
- [React-admin RBAC Documentation](https://marmelab.com/react-admin/AuthRBAC.html) - Role-based filtering patterns

### Tertiary (LOW confidence)
- WebSearch results on React chart libraries 2026 - Recharts vs Visx comparison
- WebSearch results on React export libraries - react-csv and xlsx usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Table, Recharts, sse-starlette are documented industry standards with official docs
- Architecture: HIGH - SSE patterns verified with official Starlette docs, Redis Pub/Sub patterns from Redis docs
- Pitfalls: MEDIUM - Based on community patterns and known issues (SSE connection limits, memory leaks), not all verified in official docs
- RBAC patterns: HIGH - Based on FastAPI dependency injection patterns and existing Phase 1 RBAC implementation

**Research date:** 2026-02-10
**Valid until:** 60 days (stable technologies, React 19 just released, TanStack Table v8 stable)
