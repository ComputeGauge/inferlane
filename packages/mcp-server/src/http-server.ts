#!/usr/bin/env node

/**
 * InferLane MCP HTTP Server
 *
 * Exposes the InferLane MCP over HTTP (Streamable HTTP transport) so that
 * cloud-hosted agents — Anthropic Managed Agents, remote IDEs, hosted Claude
 * Code instances — can connect without needing local stdio.
 *
 * Usage:
 *   PORT=3030 INFERLANE_API_KEY=sk-... node dist/http-server.js
 *
 * Endpoints:
 *   POST /mcp       — MCP JSON-RPC over Streamable HTTP (session-scoped)
 *   GET  /mcp       — SSE stream for session (legacy SSE clients)
 *   GET  /health    — liveness probe
 *
 * Authentication:
 *   Bearer token in Authorization header. The token becomes the per-session
 *   InferLane API key, so one HTTP server can multiplex across many tenants
 *   without restart. If no token is provided, the session falls back to the
 *   process-level INFERLANE_API_KEY (or offline mode if that is unset).
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createInferLaneServer } from './index.js';

const PORT = Number(process.env.PORT ?? 3030);
// Default to loopback for safety. Users running in containers/production should
// explicitly set HOST=0.0.0.0 so they opt in to exposing the server on all
// interfaces. Binding to 0.0.0.0 by default on a workstation would expose any
// process-level INFERLANE_API_KEY to anyone on the LAN.
const HOST = process.env.HOST ?? '127.0.0.1';
const PATH_PREFIX = process.env.MCP_PATH ?? '/mcp';
// When ALLOW_ANONYMOUS_FALLBACK is unset, requests without a Bearer token are
// rejected. Set to "1" to opt-in to using the process-level INFERLANE_API_KEY
// as a fallback — only safe in trusted single-tenant deployments.
const ALLOW_ANONYMOUS_FALLBACK = process.env.INFERLANE_ALLOW_ENV_FALLBACK === '1';

// Session-scoped transports: one StreamableHTTPServerTransport per MCP session
// (Managed agents send a Mcp-Session-Id header on follow-up requests.)
const sessions = new Map<string, {
  transport: StreamableHTTPServerTransport;
  apiKey: string | undefined;
  createdAt: number;
  lastSeenAt: number;
}>();

const SESSION_TTL_MS = 1000 * 60 * 30; // 30 min idle timeout

function extractBearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers['authorization'];
  if (!auth) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(auth) ? auth[0] : auth);
  return match?.[1];
}

function extractSessionId(req: IncomingMessage): string | undefined {
  const h = req.headers['mcp-session-id'];
  return Array.isArray(h) ? h[0] : h;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: { code: status, message } });
}

// Periodic cleanup of idle sessions so long-running HTTP servers do not leak
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastSeenAt > SESSION_TTL_MS) {
      try {
        void session.transport.close();
      } catch {
        // Transport may already be closed — ignore
      }
      sessions.delete(id);
    }
  }
}, 1000 * 60 * 5).unref();

const httpServer = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Health check — no auth
  if (req.url === '/health' || req.url === '/healthz') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'inferlane-mcp',
      transport: 'streamable-http',
      activeSessions: sessions.size,
      uptime: process.uptime(),
    });
    return;
  }

  // Only /mcp path is served
  if (!req.url?.startsWith(PATH_PREFIX)) {
    sendError(res, 404, 'Not found. MCP endpoint is POST/GET ' + PATH_PREFIX);
    return;
  }

  try {
    const sessionId = extractSessionId(req);
    let session = sessionId ? sessions.get(sessionId) : undefined;

    // For new sessions (POST without Mcp-Session-Id), create a fresh transport+server pair
    if (!session) {
      if (req.method !== 'POST') {
        sendError(res, 400, 'Mcp-Session-Id required for GET requests. Initialize first via POST.');
        return;
      }

      const bearer = extractBearerToken(req);
      // Only fall back to the process env key if the operator explicitly opted
      // in via INFERLANE_ALLOW_ENV_FALLBACK=1. This prevents a browser origin
      // or LAN peer from silently hijacking a server's configured credentials
      // just because they can reach the port.
      const apiKey = bearer ?? (ALLOW_ANONYMOUS_FALLBACK ? process.env.INFERLANE_API_KEY : undefined);

      if (!apiKey && !ALLOW_ANONYMOUS_FALLBACK) {
        sendError(
          res,
          401,
          'Bearer token required. Send Authorization: Bearer <INFERLANE_API_KEY>, or set INFERLANE_ALLOW_ENV_FALLBACK=1 to use the server env key.',
        );
        return;
      }

      // Fresh MCP server with this session's credentials
      const mcpServer = createInferLaneServer({ apiKey });

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newId: string) => {
          sessions.set(newId, {
            transport,
            apiKey,
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
          });
        },
      });

      // Clean up when the client disconnects
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      await mcpServer.connect(transport);
      session = {
        transport,
        apiKey,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      // Note: onsessioninitialized fires asynchronously after handleRequest,
      // so we let the transport manage its own session registration.
    } else {
      session.lastSeenAt = Date.now();
    }

    // Delegate to the MCP transport — it handles JSON-RPC parsing, SSE streaming, etc.
    await session.transport.handleRequest(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[inferlane-http] request error:', message);
    if (!res.headersSent) {
      sendError(res, 500, `Internal error: ${message}`);
    } else {
      res.end();
    }
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`InferLane MCP HTTP server listening on http://${HOST}:${PORT}`);
  console.log(`  MCP endpoint:  POST ${PATH_PREFIX}`);
  console.log(`  Health check:  GET  /health`);
  if (ALLOW_ANONYMOUS_FALLBACK) {
    console.log(`  Auth:          Bearer token (per-session), or process env key fallback (INFERLANE_ALLOW_ENV_FALLBACK=1)`);
    console.log(`                 WARNING: env fallback is enabled. Any request without a Bearer token`);
    console.log(`                          will use the server's INFERLANE_API_KEY. Only safe for trusted single-tenant deployments.`);
  } else {
    console.log(`  Auth:          Bearer token required on every session-init request.`);
  }
  if (HOST === '0.0.0.0') {
    console.log(`  WARNING:       Bound to all interfaces (0.0.0.0). Ensure firewall rules are in place.`);
  }
});

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[inferlane-http] Received ${signal}, closing ${sessions.size} session(s)...`);
    for (const [, session] of sessions) {
      try {
        void session.transport.close();
      } catch {
        // Ignore — transport may already be closed
      }
    }
    httpServer.close(() => process.exit(0));
    // Hard exit after 5s if close hangs
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
