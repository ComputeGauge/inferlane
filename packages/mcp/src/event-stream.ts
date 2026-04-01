// ============================================================================
// EventStream — Optional HTTP sidecar for real-time push events
//
// SSE (Server-Sent Events) endpoint that pushes:
//   - Tachometer updates (token velocity, state changes)
//   - Traffic light status changes (agent state transitions)
//   - Budget alerts (threshold warnings, exhaustion)
//   - Rating events (new ratings ingested)
//
// Enabled via INFERLANE_EVENTS_PORT env var (e.g., 7070).
// If not set, the event stream is disabled — zero overhead.
// Falls back gracefully if port is unavailable.
//
// Endpoints:
//   GET /events              — SSE stream (all events)
//   GET /events/tachometer   — SSE stream (tachometer only)
//   GET /events/status       — SSE stream (traffic light only)
//   GET /api/tachometer      — JSON snapshot
//   GET /api/status          — JSON snapshot
//   GET /api/health          — Health check
// ============================================================================

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TachometerReading } from './tachometer.js';
import type { AgentStatus, TrafficLightSummary } from './traffic-light.js';

export type EventType = 'tachometer' | 'status_change' | 'budget_alert' | 'rating' | 'heartbeat' | 'lifecycle_transition';

export interface StreamEvent {
  type: EventType;
  data: unknown;
  timestamp: number;
}

interface SSEClient {
  id: string;
  res: ServerResponse;
  filter?: EventType;
}

export class EventStream {
  private server: Server | null = null;
  private clients: SSEClient[] = [];
  private clientCounter = 0;
  private _active = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private dashboardHtml: string | null = null;

  // Snapshot getters — set by index.ts after wiring up tachometer and traffic light
  private _getTachometer: (() => TachometerReading) | null = null;
  private _getTrafficLight: (() => TrafficLightSummary) | null = null;

  get active(): boolean {
    return this._active;
  }

  /**
   * Wire up snapshot providers.
   */
  setProviders(options: {
    getTachometer: () => TachometerReading;
    getTrafficLight: () => TrafficLightSummary;
  }): void {
    this._getTachometer = options.getTachometer;
    this._getTrafficLight = options.getTrafficLight;
  }

  /**
   * Start the HTTP server for SSE events.
   * Returns true if started, false if disabled or failed.
   */
  start(port?: number): boolean {
    const eventPort = port || parseInt(process.env.INFERLANE_EVENTS_PORT || '', 10);
    if (!eventPort || isNaN(eventPort)) {
      return false;
    }

    // Try to load dashboard HTML
    try {
      // Works both in src/ (dev) and dist/ (published)
      const thisDir = dirname(fileURLToPath(import.meta.url));
      const dashPath = join(thisDir, '..', 'dashboard.html');
      if (existsSync(dashPath)) {
        this.dashboardHtml = readFileSync(dashPath, 'utf-8');
      }
    } catch { /* dashboard file optional */ }

    try {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[InferLane Events] Port ${eventPort} already in use — event stream disabled`);
        } else {
          console.error(`[InferLane Events] Server error:`, err.message);
        }
        this._active = false;
      });

      this.server.listen(eventPort, () => {
        this._active = true;
        console.error(`[InferLane Events] SSE server started on port ${eventPort}`);
        console.error(`[InferLane Events] Endpoints: /events, /api/tachometer, /api/status, /api/health`);
      });

      // Heartbeat every 30 seconds to keep connections alive
      this.heartbeatInterval = setInterval(() => {
        this.broadcast({ type: 'heartbeat', data: { time: Date.now() }, timestamp: Date.now() });
      }, 30_000);

      return true;
    } catch (err) {
      console.error(`[InferLane Events] Failed to start:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * Broadcast an event to all connected SSE clients.
   */
  broadcast(event: StreamEvent): void {
    if (this.clients.length === 0) return;

    const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

    const deadClients: string[] = [];
    for (const client of this.clients) {
      // Filter check
      if (client.filter && client.filter !== event.type && event.type !== 'heartbeat') {
        continue;
      }
      try {
        client.res.write(sseData);
      } catch {
        deadClients.push(client.id);
      }
    }

    // Clean up dead clients
    if (deadClients.length > 0) {
      this.clients = this.clients.filter(c => !deadClients.includes(c.id));
    }
  }

  /**
   * Emit a tachometer update event.
   */
  emitTachometer(reading: TachometerReading): void {
    this.broadcast({
      type: 'tachometer',
      data: reading,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a status change event.
   */
  emitStatusChange(agentId: string, status: AgentStatus): void {
    this.broadcast({
      type: 'status_change',
      data: { ...status, agentId },
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a budget alert.
   */
  emitBudgetAlert(alert: { level: 'warning' | 'critical' | 'exhausted'; spend: number; budget: number; remaining: number }): void {
    this.broadcast({
      type: 'budget_alert',
      data: alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a lifecycle transition event.
   */
  emitLifecycleTransition(transition: { agentId: string; from: string; to: string; tokensDuringPhase: number; costDuringPhase: number; durationMs: number }): void {
    this.broadcast({
      type: 'lifecycle_transition',
      data: transition,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a rating event.
   */
  emitRating(data: { model: string; taskType: string; rating: number; accepted: boolean }): void {
    this.broadcast({
      type: 'rating',
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get number of connected clients.
   */
  get clientCount(): number {
    return this.clients.length;
  }

  /**
   * Stop the server.
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all SSE connections
    for (const client of this.clients) {
      try { client.res.end(); } catch { /* ignore */ }
    }
    this.clients = [];

    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this._active = false;
  }

  // ============================================================================
  // HTTP Request Handler
  // ============================================================================

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';

    if (url === '/' || url === '/dashboard') {
      this.handleDashboard(res);
    } else if (url === '/api/health') {
      this.handleHealth(res);
    } else if (url === '/api/tachometer') {
      this.handleTachometerSnapshot(res);
    } else if (url === '/api/status') {
      this.handleStatusSnapshot(res);
    } else if (url === '/events') {
      this.handleSSE(req, res);
    } else if (url === '/events/tachometer') {
      this.handleSSE(req, res, 'tachometer');
    } else if (url === '/events/status') {
      this.handleSSE(req, res, 'status_change');
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/events', '/events/tachometer', '/events/status', '/api/tachometer', '/api/status', '/api/health'] }));
    }
  }

  private handleDashboard(res: ServerResponse): void {
    if (this.dashboardHtml) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Auto-connect: inject the port so the dashboard connects immediately
      const html = this.dashboardHtml.replace(
        'value="http://localhost:7070"',
        `value="http://localhost:${(this.server?.address() as any)?.port || 7070}"`
      );
      res.end(html.replace(
        '// Auto-connect if URL param provided',
        `// Auto-connect on load\nconnect();\n// Auto-connect if URL param provided`
      ));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="background:#0a0e17;color:#e5e7eb;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh"><div><h1>InferLane Dashboard</h1><p>dashboard.html not found. Ensure it is in the package root.</p></div></body></html>');
    }
  }

  private handleHealth(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      version: '0.5.0',
      clients: this.clients.length,
      uptime: process.uptime(),
    }));
  }

  private handleTachometerSnapshot(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = this._getTachometer ? this._getTachometer() : { error: 'Tachometer not initialized' };
    res.end(JSON.stringify(data));
  }

  private handleStatusSnapshot(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = this._getTrafficLight ? this._getTrafficLight() : { error: 'Traffic light not initialized' };
    res.end(JSON.stringify(data));
  }

  private handleSSE(req: IncomingMessage, res: ServerResponse, filter?: EventType): void {
    const clientId = `client_${++this.clientCounter}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial state
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, filter: filter || 'all' })}\n\n`);

    // Send current snapshots
    if (!filter || filter === 'tachometer') {
      if (this._getTachometer) {
        res.write(`event: tachometer\ndata: ${JSON.stringify(this._getTachometer())}\n\n`);
      }
    }
    if (!filter || filter === 'status_change') {
      if (this._getTrafficLight) {
        res.write(`event: status_change\ndata: ${JSON.stringify(this._getTrafficLight())}\n\n`);
      }
    }

    this.clients.push({ id: clientId, res, filter });

    // Clean up on close
    req.on('close', () => {
      this.clients = this.clients.filter(c => c.id !== clientId);
    });
  }
}
