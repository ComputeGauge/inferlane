import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addSSEListener, type SSEEvent } from '@/lib/events';

// ---------------------------------------------------------------------------
// GET /api/events — Server-Sent Events stream for real-time dashboard updates
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth: only authenticated users can subscribe to events
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', data: {}, timestamp: new Date().toISOString() })}\n\n`)
      );

      // Subscribe to SSE events
      unsubscribe = addSSEListener((event: SSEEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream closed — cleanup will happen in cancel()
        }
      });

      // Heartbeat every 30 seconds to keep connection alive
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', data: {}, timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch {
          // Stream closed
        }
      }, 30_000);
    },
    cancel() {
      // Clean up on client disconnect
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
