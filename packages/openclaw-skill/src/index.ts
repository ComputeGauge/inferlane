#!/usr/bin/env node
// ============================================================================
// InferLane OpenClaw Skill — Node operator management & network visibility
// Standalone MCP server for monitoring and managing InferLane compute nodes
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ── Config ──────────────────────────────────────────────────────────────

const API_URL = process.env.INFERLANE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.INFERLANE_API_KEY || '';

// ── HTTP helpers ────────────────────────────────────────────────────────

async function apiGet<T = unknown>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`InferLane API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`InferLane API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Formatting helpers ──────────────────────────────────────────────────

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
  );
  const sep = widths.map((w) => '-'.repeat(w)).join('-+-');
  const headerLine = headers.map((h, i) => padRight(h, widths[i])).join(' | ');
  const dataLines = rows.map((r) =>
    r.map((c, i) => padRight(c || '', widths[i])).join(' | ')
  );
  return [headerLine, sep, ...dataLines].join('\n');
}

// ── Type definitions ────────────────────────────────────────────────────

interface NodeStatus {
  id: string;
  displayName: string | null;
  isOnline: boolean;
  reputationScore: number;
  avgLatencyMs: number;
  regions: string[];
  capabilities: Record<string, unknown>;
  lastSeenAt: string | null;
}

interface NodeEarnings {
  summary: {
    pendingBalance: number;
    lifetimeEarned: number;
    earningsToday: number;
    earnings7d: number;
    reputationScore: number;
    totalRequests: number;
    failedRequests: number;
    successRate: string;
  };
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

interface KvCacheData {
  entries: Array<{
    id: string;
    modelId: string;
    status: string;
    cacheSizeGB: number;
    totalEarnedUsd: number;
    lastAccessedAt: string;
    tokenRangeStart: number;
    tokenRangeEnd: number;
  }>;
  totals: {
    totalEntries: number;
    totalSizeGB: number;
    totalEarned: number;
    warmCount: number;
    coldCount: number;
  };
}

interface RegisterResponse {
  nodeId: string;
  displayName: string;
  heartbeatUrl: string;
  heartbeatIntervalMs: number;
  message: string;
}

interface NetworkHealth {
  totalNodes: number;
  onlineNodes: number;
  avgReputation: number;
  totalCapacityTFLOPS: number;
  regionDistribution: Record<string, number>;
}

// ── MCP Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'inferlane-openclaw',
  version: '2.0.0',
});

// ── Tool 1: node_status ─────────────────────────────────────────────────

server.tool(
  'node_status',
  'Show online InferLane nodes with capabilities, reputation, regions, and latency',
  {},
  async () => {
    try {
      const nodes = await apiGet<NodeStatus[]>('/api/nodes/status');

      if (!nodes || nodes.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No nodes currently online.' }],
        };
      }

      const headers = ['Name', 'Status', 'Rep', 'Latency', 'Regions', 'Last Seen'];
      const rows = nodes.map((n) => [
        n.displayName || n.id.slice(0, 8),
        n.isOnline ? 'ONLINE' : 'OFFLINE',
        `${n.reputationScore}/100`,
        `${n.avgLatencyMs}ms`,
        n.regions.join(', ') || '-',
        n.lastSeenAt ? new Date(n.lastSeenAt).toLocaleString() : 'never',
      ]);

      const table = formatTable(headers, rows);
      const text = `InferLane Network Nodes (${nodes.length} online)\n${'='.repeat(50)}\n\n${table}`;

      return { content: [{ type: 'text' as const, text }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to fetch node status: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool 2: node_earnings ───────────────────────────────────────────────

server.tool(
  'node_earnings',
  'Show pending balance, lifetime earnings, and recent payouts for your node',
  {},
  async () => {
    try {
      const data = await apiGet<NodeEarnings>('/api/nodes/stats');

      const s = data.summary;
      const lines = [
        'Node Operator Earnings',
        '='.repeat(40),
        '',
        `Pending Balance:   $${s.pendingBalance.toFixed(6)}`,
        `Lifetime Earned:   $${s.lifetimeEarned.toFixed(6)}`,
        `Today:             $${s.earningsToday.toFixed(6)}`,
        `Last 7 Days:       $${s.earnings7d.toFixed(6)}`,
        '',
        `Reputation:        ${s.reputationScore}/100`,
        `Total Requests:    ${s.totalRequests}`,
        `Success Rate:      ${s.successRate}`,
      ];

      if (data.payouts && data.payouts.length > 0) {
        lines.push('', 'Recent Payouts', '-'.repeat(30));
        for (const p of data.payouts.slice(0, 5)) {
          lines.push(`  $${p.amount.toFixed(4)} — ${p.status} — ${new Date(p.createdAt).toLocaleDateString()}`);
        }
      } else {
        lines.push('', 'No payouts yet.');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to fetch earnings: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool 3: kv_cache_status ─────────────────────────────────────────────

server.tool(
  'kv_cache_status',
  'Show active KV cache entries, sizes, hit rates, and earnings',
  {},
  async () => {
    try {
      const data = await apiGet<KvCacheData>('/api/nodes/kv-cache');

      if (!data.entries || data.entries.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No KV cache entries. Serve requests to start caching.' }],
        };
      }

      const t = data.totals;
      const summary = [
        'KV Cache Status',
        '='.repeat(40),
        `Total Entries:  ${t.totalEntries}  (${t.warmCount} WARM, ${t.coldCount} COLD)`,
        `Total Size:     ${t.totalSizeGB.toFixed(2)} GB`,
        `Total Earned:   $${t.totalEarned.toFixed(4)}`,
        '',
      ];

      const headers = ['Model', 'Status', 'Size (GB)', 'Tokens', 'Earned', 'Last Access'];
      const rows = data.entries.map((e) => [
        e.modelId.length > 20 ? e.modelId.slice(0, 20) + '...' : e.modelId,
        e.status,
        e.cacheSizeGB.toFixed(3),
        `${e.tokenRangeStart}-${e.tokenRangeEnd}`,
        `$${e.totalEarnedUsd.toFixed(4)}`,
        new Date(e.lastAccessedAt).toLocaleString(),
      ]);

      const table = formatTable(headers, rows);
      return { content: [{ type: 'text' as const, text: summary.join('\n') + table }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to fetch KV cache status: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool 4: register_node ───────────────────────────────────────────────

server.tool(
  'register_node',
  'Register this machine as an InferLane node operator',
  {
    displayName: z.string().min(2).describe('Display name for this node'),
    apiEndpoint: z.string().url().describe('Your node inference API endpoint (e.g. https://my-node.example.com/v1)'),
    capabilities: z.string().optional().describe('JSON string of capabilities (models supported, hardware specs)'),
    regions: z.array(z.string()).min(1).describe('ISO 3166-1 alpha-2 region codes (e.g. ["US", "EU"])'),
    privacyTier: z.enum(['TRANSPORT_ONLY', 'BLIND_ROUTING', 'TEE_PREFERRED', 'CONFIDENTIAL']).optional()
      .describe('Privacy tier (default: TRANSPORT_ONLY)'),
  },
  async (params) => {
    try {
      let capabilities: Record<string, unknown> = {};
      if (params.capabilities) {
        try {
          capabilities = JSON.parse(params.capabilities);
        } catch {
          return {
            content: [{ type: 'text' as const, text: 'Error: capabilities must be valid JSON' }],
            isError: true,
          };
        }
      }

      const result = await apiPost<RegisterResponse>('/api/nodes/register', {
        displayName: params.displayName,
        apiEndpoint: params.apiEndpoint,
        capabilities,
        regions: params.regions,
        privacyTier: params.privacyTier || 'TRANSPORT_ONLY',
      });

      const lines = [
        'Node Registered Successfully',
        '='.repeat(40),
        '',
        `Node ID:            ${result.nodeId}`,
        `Display Name:       ${result.displayName}`,
        `Heartbeat URL:      ${API_URL}${result.heartbeatUrl}`,
        `Heartbeat Interval: ${result.heartbeatIntervalMs}ms`,
        '',
        'Next steps:',
        '1. Start sending heartbeats to stay online',
        '2. Configure your inference endpoint',
        '3. Submit a memory benchmark via PATCH /api/nodes/onboard',
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to register node: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool 5: network_health ──────────────────────────────────────────────

server.tool(
  'network_health',
  'Aggregate InferLane network statistics: total nodes, capacity, reputation, geographic distribution',
  {},
  async () => {
    try {
      const data = await apiGet<NetworkHealth>('/api/nodes/network');

      const lines = [
        'InferLane Network Health',
        '='.repeat(40),
        '',
        `Total Nodes:       ${data.totalNodes}`,
        `Online Nodes:      ${data.onlineNodes}`,
        `Avg Reputation:    ${data.avgReputation.toFixed(1)}/100`,
        `Total Capacity:    ${data.totalCapacityTFLOPS.toFixed(1)} TFLOPS`,
        '',
        'Geographic Distribution',
        '-'.repeat(30),
      ];

      const regionEntries = Object.entries(data.regionDistribution);
      if (regionEntries.length > 0) {
        for (const [region, count] of regionEntries.sort(([, a], [, b]) => b - a)) {
          const bar = '#'.repeat(Math.min(20, Math.round((count / data.onlineNodes) * 20)));
          lines.push(`  ${padRight(region, 6)} ${bar} (${count})`);
        }
      } else {
        lines.push('  No nodes online yet.');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to fetch network health: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Start ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('InferLane OpenClaw MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
