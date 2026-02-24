/**
 * Supabase Realtime hook for live ticket updates.
 *
 * Subscribes to ticket_updates channel and postgres_changes for the tickets table.
 * Replaces SSE with Supabase Realtime WebSocket.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeTicketsOptions {
  municipalityId: string;
  enabled?: boolean;
  onUpdate: () => void;
}

export function useRealtimeTickets({ municipalityId, enabled = true, onUpdate }: UseRealtimeTicketsOptions) {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !municipalityId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnected(false);
      return;
    }

    const channel = supabase
      .channel(`municipality:${municipalityId}`)
      // Listen for broadcast events from pg_notify
      .on('broadcast', { event: 'ticket_event' }, (payload) => {
        onUpdate();
      })
      // Listen for direct postgres changes to tickets table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `tenant_id=eq.${municipalityId}`,
        },
        (payload) => {
          onUpdate();
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [municipalityId, enabled, onUpdate]);

  return { connected };
}
