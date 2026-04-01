'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * React hook for subscribing to Server-Sent Events from /api/events.
 *
 * @param eventTypes - Optional array of event types to filter.
 *                     If omitted, all events are received.
 * @returns { lastEvent, events, connected }
 */
export function useSSE(eventTypes?: string[]) {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);

  // Stabilize the eventTypes reference to avoid re-creating the EventSource
  const filterRef = useRef(eventTypes);
  filterRef.current = eventTypes;

  // Stable key for the dependency array
  const filterKey = useMemo(
    () => (eventTypes ? eventTypes.sort().join(',') : '__all__'),
    [eventTypes]
  );

  useEffect(() => {
    const source = new EventSource('/api/events');

    source.onopen = () => setConnected(true);

    source.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects by default
    };

    source.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);

        // Skip heartbeats and connection events from the UI
        if (event.type === 'heartbeat' || event.type === 'connected') return;

        // Apply filter if specified
        const filters = filterRef.current;
        if (filters && filters.length > 0 && !filters.includes(event.type)) {
          return;
        }

        setLastEvent(event);
        setEvents((prev) => [...prev.slice(-99), event]); // Keep last 100
      } catch {
        // Ignore malformed messages
      }
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [filterKey]);

  return { lastEvent, events, connected };
}
