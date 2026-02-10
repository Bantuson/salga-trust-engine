import { useEffect, useState, useCallback, useRef } from 'react';
import { createDashboardSSE } from '../services/sse';

interface UseSSEOptions {
  wardId?: string;
  enabled?: boolean;
  onEvent?: (type: string, data: Record<string, unknown>) => void;
}

export function useSSE({ wardId, enabled = true, onEvent }: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      onEvent?.(event.type, data);
    } catch (e) {
      console.error('[SSE] Failed to parse event:', e);
    }
  }, [onEvent]);

  const handleError = useCallback(() => {
    setIsConnected(false);
    setError('Connection lost, reconnecting...');
  }, []);

  useEffect(() => {
    if (!enabled) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      return;
    }

    const es = createDashboardSSE(wardId, handleMessage, handleError);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setIsConnected(true);
      setError(null);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [wardId, enabled, handleMessage, handleError]);

  return { isConnected, error };
}
