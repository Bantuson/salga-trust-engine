/**
 * SSE connection manager for dashboard real-time updates.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export function createDashboardSSE(
  wardId?: string,
  onMessage?: (event: MessageEvent) => void,
  onError?: (error: Event) => void,
): EventSource {
  const token = localStorage.getItem('access_token');
  const params = new URLSearchParams();
  if (wardId) params.set('ward_id', wardId);
  if (token) params.set('token', token);

  // Note: EventSource doesn't support custom headers.
  // Token passed as query param (backend must accept both header and query param auth).
  // For production, use cookie-based auth or a polyfill that supports headers.
  const url = `${API_BASE_URL}/dashboard/events?${params}`;

  const eventSource = new EventSource(url);

  if (onMessage) {
    eventSource.addEventListener('ticket_updated', onMessage);
    eventSource.addEventListener('ticket_created', onMessage);
    eventSource.addEventListener('sla_breach', onMessage);
    eventSource.addEventListener('assignment_changed', onMessage);
  }

  if (onError) {
    eventSource.onerror = onError;
  }

  return eventSource;
}
