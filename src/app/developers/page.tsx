'use client';

import { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Developer Documentation — InferLane Trading API
// ---------------------------------------------------------------------------
// Public-facing docs page. No auth required.
// Covers: authentication, endpoints, rate limits, code examples.
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Authentication' },
  { id: 'indices', label: 'Indices' },
  { id: 'orders', label: 'Orders' },
  { id: 'futures', label: 'Futures' },
  { id: 'keys', label: 'API Keys' },
  { id: 'rate-limits', label: 'Rate Limits' },
  { id: 'examples', label: 'Code Examples' },
  { id: 'webhooks', label: 'Webhooks' },
] as const;

// ---------------------------------------------------------------------------
// Sidebar TOC
// ---------------------------------------------------------------------------

function Sidebar({ activeSection }: { activeSection: string }) {
  return (
    <div className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-20 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 px-3">
          Contents
        </p>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeSection === s.id
                ? 'text-white bg-[#1e1e2e]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable components
// ---------------------------------------------------------------------------

function MethodBadge({ method }: { method: 'GET' | 'POST' | 'DELETE' }) {
  const colors = {
    GET: 'text-emerald-400 bg-emerald-500/15',
    POST: 'text-blue-400 bg-blue-500/15',
    DELETE: 'text-red-400 bg-red-500/15',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[method]}`}>
      {method}
    </span>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="relative group">
      <pre className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 font-mono text-sm text-green-400 overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 bg-[#1e1e2e] rounded text-xs text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  description,
  params,
  response,
}: {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  response?: string;
}) {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <MethodBadge method={method} />
        <code className="text-white font-mono text-sm">{path}</code>
      </div>
      <p className="text-gray-400 text-sm">{description}</p>

      {params && params.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
            Parameters
          </p>
          <div className="space-y-2">
            {params.map((p) => (
              <div key={p.name} className="flex items-start gap-2 text-sm">
                <code className="text-amber-400 font-mono shrink-0">{p.name}</code>
                <span className="text-gray-600 shrink-0">{p.type}</span>
                {p.required && (
                  <span className="text-red-400 text-xs shrink-0">required</span>
                )}
                <span className="text-gray-400">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {response && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
            Response
          </p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DevelopersPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    );

    const sections = document.querySelectorAll('section[id]');
    sections.forEach((s) => observerRef.current?.observe(s));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex gap-12">
        <Sidebar activeSection={activeSection} />

        <div className="flex-1 min-w-0 space-y-16">
          {/* ── Overview ─────────────────────────────────────────── */}
          <section id="overview" className="scroll-mt-20">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              InferLane Trading API
            </h1>
            <p className="text-gray-400 leading-relaxed text-lg max-w-3xl">
              Build on top of InferLane&apos;s compute price indices and order book.
              Access real-time pricing data, place orders, trade futures, and integrate
              compute cost hedging into your platform.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              {[
                {
                  title: 'Price Indices',
                  desc: 'Real-time IL-FRONTIER, IL-STANDARD, IL-ECONOMY, IL-OPENWEIGHT, IL-DECODE, IL-MEMORY indices.',
                },
                {
                  title: 'Order Book',
                  desc: 'LIMIT and MARKET orders with price-time priority matching across quality tiers.',
                },
                {
                  title: 'Futures & Options',
                  desc: 'Forwards, calls, puts on compute pricing. Hedge your inference costs.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5"
                >
                  <h3 className="text-white font-semibold mb-1">{card.title}</h3>
                  <p className="text-gray-500 text-sm">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-400">
                <strong>Base URL:</strong>{' '}
                <code className="font-mono">https://inferlane.dev/api</code>
                {' '}&mdash; All endpoints require HTTPS.
              </p>
            </div>
          </section>

          {/* ── Authentication ───────────────────────────────────── */}
          <section id="auth" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
            <p className="text-gray-400 mb-6">
              All trading endpoints require a <code className="text-amber-400 font-mono">ilt_</code> prefixed
              API key. Create one from the{' '}
              <a href="/dashboard/trading" className="text-amber-400 hover:text-amber-300 underline">
                Trading dashboard
              </a>{' '}
              under the API Keys tab.
            </p>

            <CodeBlock
              code={`curl -H "Authorization: Bearer ilt_your_key_here" \\
  https://inferlane.dev/api/trading/indices`}
            />

            <div className="mt-6 space-y-3">
              <h3 className="text-white font-semibold">Key Permissions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { perm: 'read', desc: 'View indices, order book, contracts' },
                  { perm: 'trade', desc: 'Place and cancel orders, create futures' },
                  { perm: 'settle', desc: 'Trigger settlement operations' },
                ].map((p) => (
                  <div
                    key={p.perm}
                    className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4"
                  >
                    <code className="text-amber-400 font-mono text-sm">{p.perm}</code>
                    <p className="text-gray-500 text-sm mt-1">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Indices ──────────────────────────────────────────── */}
          <section id="indices" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Indices</h2>
            <p className="text-gray-400 mb-6">
              Compute price indices represent VWAP (Volume-Weighted Average Price) from
              order fills within each quality tier. Updated hourly via cron.
            </p>

            <div className="space-y-6">
              <EndpointCard
                method="GET"
                path="/api/trading/indices"
                description="Returns current values for all 6 compute price indices."
                response={`{
  "indices": [
    { "name": "IL-FRONTIER", "value": 0.95, "updatedAt": "..." },
    { "name": "IL-STANDARD", "value": 0.75, "updatedAt": "..." },
    { "name": "IL-ECONOMY", "value": 0.50, "updatedAt": "..." },
    { "name": "IL-OPENWEIGHT", "value": 0.35, "updatedAt": "..." },
    { "name": "IL-DECODE", "value": 0.15, "updatedAt": "..." },
    { "name": "IL-MEMORY", "value": 0.08, "updatedAt": "..." }
  ]
}`}
              />

              <EndpointCard
                method="GET"
                path="/api/trading/indices?history=IL-FRONTIER&days=30"
                description="Historical index snapshots for charting and analysis."
                params={[
                  { name: 'history', type: 'string', required: true, desc: 'Index name (e.g. IL-FRONTIER)' },
                  { name: 'days', type: 'number', required: false, desc: 'Number of days (default: 30, max: 365)' },
                ]}
              />
            </div>
          </section>

          {/* ── Orders ───────────────────────────────────────────── */}
          <section id="orders" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Orders</h2>
            <p className="text-gray-400 mb-6">
              Place LIMIT or MARKET orders on the compute order book. Orders are matched
              with price-time priority within each quality tier. Trading fee: 2.5% on fills
              (split between buyer and seller).
            </p>

            <div className="space-y-6">
              <EndpointCard
                method="GET"
                path="/api/trading/orders"
                description="View the order book and your open orders."
                params={[
                  { name: 'tier', type: 'string', required: false, desc: 'Filter by quality tier (FRONTIER, STANDARD, ECONOMY, OPEN_WEIGHT)' },
                  { name: 'mine', type: 'boolean', required: false, desc: 'Show only your orders' },
                ]}
              />

              <EndpointCard
                method="POST"
                path="/api/trading/orders"
                description="Place a new order. BUY orders require sufficient credit balance."
                params={[
                  { name: 'side', type: 'string', required: true, desc: 'BUY or SELL' },
                  { name: 'orderType', type: 'string', required: true, desc: 'LIMIT or MARKET' },
                  { name: 'qualityTier', type: 'string', required: true, desc: 'FRONTIER, STANDARD, ECONOMY, or OPEN_WEIGHT' },
                  { name: 'quantity', type: 'number', required: true, desc: 'Number of compute units (1-100,000)' },
                  { name: 'pricePerUnit', type: 'number', required: false, desc: 'Price per unit ($0.05-$2.00). Required for LIMIT orders.' },
                ]}
                response={`{
  "orderId": "clo1a2b3c...",
  "side": "BUY",
  "orderType": "LIMIT",
  "qualityTier": "FRONTIER",
  "quantity": 500,
  "pricePerUnit": 0.90,
  "status": "OPEN",
  "fills": []
}`}
              />

              <EndpointCard
                method="DELETE"
                path="/api/trading/orders?orderId=xxx"
                description="Cancel an open or partially filled order. Returns unfilled quantity to your balance."
                params={[
                  { name: 'orderId', type: 'string', required: true, desc: 'ID of the order to cancel' },
                ]}
              />
            </div>
          </section>

          {/* ── Futures ──────────────────────────────────────────── */}
          <section id="futures" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Futures & Options</h2>
            <p className="text-gray-400 mb-6">
              Create forward contracts and options on compute pricing. Contracts settle
              against IL index values at delivery date. 10% margin required.
            </p>

            <div className="space-y-6">
              <EndpointCard
                method="GET"
                path="/api/trading/futures"
                description="List your open and settled contracts."
              />

              <EndpointCard
                method="POST"
                path="/api/trading/futures"
                description="Create a new forward contract or option."
                params={[
                  { name: 'contractType', type: 'string', required: true, desc: 'FORWARD, OPTION_CALL, OPTION_PUT, DECODE_FORWARD, MEMORY_FORWARD, DECODE_OPTION_CALL, MEMORY_OPTION_PUT' },
                  { name: 'qualityTier', type: 'string', required: false, desc: 'Required for standard contracts. Not needed for memory/decode types.' },
                  { name: 'quantity', type: 'number', required: true, desc: 'Contract size (100-1,000,000)' },
                  { name: 'strikePrice', type: 'number', required: true, desc: 'Strike price per unit' },
                  { name: 'deliveryDate', type: 'string', required: true, desc: 'ISO date string (1-180 days out)' },
                ]}
                response={`{
  "contractId": "clo1a2b3c...",
  "marginRequired": 50.00,
  "message": "Contract created. Margin reserved."
}`}
              />
            </div>
          </section>

          {/* ── API Keys ─────────────────────────────────────────── */}
          <section id="keys" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">API Keys</h2>
            <p className="text-gray-400 mb-6">
              Manage trading API keys programmatically. Keys use the{' '}
              <code className="text-amber-400 font-mono">ilt_</code> prefix and support
              granular permissions. Maximum 10 keys per account.
            </p>

            <div className="space-y-6">
              <EndpointCard
                method="GET"
                path="/api/trading/keys"
                description="List your active trading API keys."
              />

              <EndpointCard
                method="POST"
                path="/api/trading/keys"
                description="Create a new trading API key."
                params={[
                  { name: 'name', type: 'string', required: true, desc: 'Descriptive name (e.g. "prod-trading-bot")' },
                  { name: 'permissions', type: 'string[]', required: true, desc: 'Array of: read, trade, settle' },
                ]}
                response={`{
  "keyId": "clo1a2b3c...",
  "key": "ilt_abc123...",
  "name": "prod-trading-bot",
  "permissions": ["read", "trade"],
  "message": "Store this key securely. It cannot be retrieved again."
}`}
              />
            </div>
          </section>

          {/* ── Rate Limits ──────────────────────────────────────── */}
          <section id="rate-limits" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Rate Limits</h2>
            <p className="text-gray-400 mb-6">
              Rate limits are per API key and enforced per minute. Exceeding limits returns
              HTTP 429.
            </p>

            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Endpoint</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Limit</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Window</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {[
                    { endpoint: 'GET /trading/indices', limit: '60 req', window: '1 min' },
                    { endpoint: 'GET /trading/orders', limit: '60 req', window: '1 min' },
                    { endpoint: 'POST /trading/orders', limit: '20 req', window: '1 min' },
                    { endpoint: 'DELETE /trading/orders', limit: '20 req', window: '1 min' },
                    { endpoint: 'GET /trading/futures', limit: '30 req', window: '1 min' },
                    { endpoint: 'POST /trading/futures', limit: '10 req', window: '1 min' },
                    { endpoint: 'GET /trading/keys', limit: '30 req', window: '1 min' },
                    { endpoint: 'POST /trading/keys', limit: '5 req', window: '1 min' },
                  ].map((r) => (
                    <tr key={r.endpoint}>
                      <td className="px-6 py-3 text-white font-mono text-xs">{r.endpoint}</td>
                      <td className="px-6 py-3 text-gray-400">{r.limit}</td>
                      <td className="px-6 py-3 text-gray-400">{r.window}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Code Examples ────────────────────────────────────── */}
          <section id="examples" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Code Examples</h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-white font-semibold mb-3">curl</h3>
                <CodeBlock
                  code={`# Get current indices
curl -s -H "Authorization: Bearer ilt_your_key" \\
  https://inferlane.dev/api/trading/indices | jq

# Place a limit buy order
curl -X POST -H "Authorization: Bearer ilt_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"side":"BUY","orderType":"LIMIT","qualityTier":"FRONTIER","quantity":100,"pricePerUnit":0.90}' \\
  https://inferlane.dev/api/trading/orders

# Cancel an order
curl -X DELETE -H "Authorization: Bearer ilt_your_key" \\
  "https://inferlane.dev/api/trading/orders?orderId=clo1a2b3c"`}
                />
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">Python</h3>
                <CodeBlock
                  language="python"
                  code={[
                    'import requests',
                    '',
                    'API_KEY = "ilt_your_key"',
                    'BASE = "https://inferlane.dev/api"',
                    'headers = {"Authorization": f"Bearer {API_KEY}"}',
                    '',
                    '# Fetch indices',
                    'indices = requests.get(f"{BASE}/trading/indices", headers=headers).json()',
                    'for idx in indices["indices"]:',
                    '    print(f"{idx[\'name\']}: ${idx[\'value\']:.4f}")',
                    '',
                    '# Place a limit order',
                    'order = requests.post(f"{BASE}/trading/orders", headers=headers, json={',
                    '    "side": "BUY",',
                    '    "orderType": "LIMIT",',
                    '    "qualityTier": "STANDARD",',
                    '    "quantity": 250,',
                    '    "pricePerUnit": 0.70,',
                    '}).json()',
                    'print(f"Order {order[\'orderId\']} placed: {order[\'status\']}")',
                  ].join('\n')}
                />
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">TypeScript</h3>
                <CodeBlock
                  language="typescript"
                  code={[
                    'const API_KEY = "ilt_your_key";',
                    'const BASE = "https://inferlane.dev/api";',
                    'const headers = { Authorization: `Bearer ${API_KEY}` };',
                    '',
                    '// Fetch indices',
                    'const res = await fetch(`${BASE}/trading/indices`, { headers });',
                    'const { indices } = await res.json();',
                    'indices.forEach((idx: { name: string; value: number }) =>',
                    '  console.log(`${idx.name}: $${idx.value.toFixed(4)}`)',
                    ');',
                    '',
                    '// Create a forward contract',
                    'const future = await fetch(`${BASE}/trading/futures`, {',
                    '  method: "POST",',
                    '  headers: { ...headers, "Content-Type": "application/json" },',
                    '  body: JSON.stringify({',
                    '    contractType: "FORWARD",',
                    '    qualityTier: "FRONTIER",',
                    '    quantity: 1000,',
                    '    strikePrice: 0.92,',
                    '    deliveryDate: "2026-06-01",',
                    '  }),',
                    '}).then((r) => r.json());',
                    'console.log(`Contract ${future.contractId}, margin: $${future.marginRequired}`);',
                  ].join('\n')}
                />
              </div>
            </div>
          </section>

          {/* ── Webhooks ─────────────────────────────────────────── */}
          <section id="webhooks" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-4">Webhooks</h2>
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold text-purple-400 bg-purple-500/15">
                  COMING SOON
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Webhook notifications for real-time events: order fills, settlement
                completions, index threshold alerts, and contract expiry warnings.
                Register a webhook URL from the Trading dashboard to receive POST
                callbacks with signed payloads.
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Planned Events
                </p>
                <div className="flex flex-wrap gap-2">
                  {['order.filled', 'order.cancelled', 'settlement.completed', 'index.alert', 'future.settled', 'future.expiring'].map((e) => (
                    <code
                      key={e}
                      className="px-2 py-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-xs text-gray-400 font-mono"
                    >
                      {e}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ───────────────────────────────────────────── */}
          <div className="pt-12 border-t border-[#1e1e2e]">
            <p className="text-gray-600 text-sm">
              Questions? Reach us at{' '}
              <a href="mailto:dev@inferlane.dev" className="text-gray-400 hover:text-white">
                dev@inferlane.dev
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
