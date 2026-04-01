// ---------------------------------------------------------------------------
// SSE Event Bus — in-memory pub/sub for real-time dashboard updates
// ---------------------------------------------------------------------------

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type SSEListener = (event: SSEEvent) => void;

const listeners = new Set<SSEListener>();

/**
 * Emit an event to all connected SSE clients.
 * Fire-and-forget — errors in individual listeners are silently caught.
 */
export function emitSSE(event: SSEEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Don't let one bad listener break others
    }
  });
}

/**
 * Register a listener for SSE events.
 * Returns an unsubscribe function.
 */
export function addSSEListener(listener: SSEListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Current number of connected listeners (for diagnostics).
 */
export function getListenerCount(): number {
  return listeners.size;
}
