import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Roadmap — InferLane',
  description: 'What InferLane has shipped, what we\'re building now, and what\'s next. Honest status, updated as we ship.',
};

type Status = 'shipped' | 'building' | 'next' | 'considering' | 'ruled-out';

interface Item {
  status: Status;
  title: string;
  detail: string;
}

const ITEMS: Item[] = [
  // Shipped
  { status: 'shipped', title: '@inferlane/mcp@0.7.0', detail: '49 MCP tools for model selection, spend tracking, routing, credibility scoring. Published on npm.' },
  { status: 'shipped', title: 'Local-first Compute Fuel Gauge', detail: 'http://localhost:7070/dashboard reads usage directly from Claude Code transcripts. Zero network, zero API key.' },
  { status: 'shipped', title: 'Claude Code usage auto-ingest', detail: 'Per-user spend reflected without any manual logging.' },
  { status: 'shipped', title: 'Claude Code plugin v1.1.0', detail: 'Installs MCP + prompts for budgets + starts the local dashboard automatically.' },
  { status: 'shipped', title: 'OpenAI-compatible /v1/chat/completions', detail: 'With moderation gate + Bearer-token auth. (E2EE variant is the current active route.)' },
  { status: 'shipped', title: 'DarkBloom adapter', detail: 'Inference routing target — live.' },

  // Building now
  { status: 'building', title: 'Real network crypto', detail: 'X25519 + AES-GCM replacing the base64 placeholder in the node daemon. Baseline security is non-negotiable before public operator launch.' },
  { status: 'building', title: 'Credit ledger hooks', detail: 'Earn on serve, spend on consume, dedup on request ID. Powered by the existing CreditBalance and LedgerEntry infrastructure.' },
  { status: 'building', title: 'Cross-platform one-line installer', detail: 'curl -fsSL install.inferlane.dev | bash for macOS, Linux, and Windows GPU operators.' },
  { status: 'building', title: 'Operator profiles + contribution leaderboard', detail: 'Pseudonymous, opt-in, framed as "top contributors this week" not "top earners".' },
  { status: 'building', title: 'Community Discord', detail: '#help-me-model, #new-operators, #benchmarks, #roadmap-requests.' },

  // Next
  { status: 'next', title: 'MCP Pro subscription', detail: '$10/mo team features: shared budgets, Slack alerts, historical export, SSO.' },
  { status: 'next', title: 'BYO-key routing markup', detail: 'Route Claude / OpenAI / Gemini traffic through us with a small margin; we never see your prompts.' },
  { status: 'next', title: 'Badges', detail: 'OG-100, reliable-operator-30d, multi-model-host, 10-merged-PR-club.' },
  { status: 'next', title: 'Transparency report', detail: 'Monthly auto-generated aggregates: tokens served, unique operators, unique consumers, credits in circulation, revenue, treasury.' },
  { status: 'next', title: 'Phala TEE partnership', detail: 'Outreach, then route our privacy tier through their decentralised Intel SGX/TDX network.' },
  { status: 'next', title: 'Model catalogue', detail: 'Curated open-weight models with hardware-class recommendations. Community-submitted benchmarks tied to operator hardware profiles.' },

  // Considering
  { status: 'considering', title: 'Contributor marketplace', detail: 'UI widgets, dashboard themes, routing policies, integration recipes, provider adapters. Security-tiered; UI widgets first (client-side sandboxed). Revenue share 30-50% for UI/integrations; kT bonuses for data-only. Target v1 pilot month 2-3.' },
  { status: 'considering', title: 'Operator-modded dashboards + affinity routing', detail: 'Top operators get branded public dashboards with featured widgets. Consumers on those pages get routing affinity to that operator. Inspired by Roblox experiences + Twitch affiliate programmes. Target: v2 post-marketplace (month 4-6).' },
  { status: 'considering', title: 'Gaming-rig operator class', detail: 'NVIDIA RTX + Apple Silicon gamers overlap with modding community. Two-in-one: serve inference + contribute widgets. Dedicated recruitment channel.' },
  { status: 'considering', title: 'Cash payouts', detail: 'Stripe Connect wiring is ready. Flips on when monthly recurring revenue justifies without subsidy.' },
  { status: 'considering', title: 'Frontier open-weight on DC partners', detail: 'Pilot with one data-centre partner once active-user + MRR base justifies a prepay.' },
  { status: 'considering', title: 'Enterprise tier', detail: 'SSO, audit logs, on-prem, SLA. Driven by first three inbound enterprise conversations.' },
  { status: 'considering', title: 'Community Council', detail: '5 advisory seats, quarterly rotation, top-contributor voted. Month 2+.' },
  { status: 'considering', title: 'Additional compute-utility SKUs', detail: 'iOS/macOS CI build farms, video transcoding, RAG indexing on the same peer infra. Opt-in per operator.' },
  { status: 'considering', title: 'Provider adapters for Bittensor / Akash / io.net', detail: 'If consumer demand for that privacy/pricing mix materialises.' },

  // Ruled out
  { status: 'ruled-out', title: 'Cryptocurrency / token', detail: 'Credits are internal accounting, not tradable. No ICO, no airdrop. Cash redemption when it exists is plain USD.' },
  { status: 'ruled-out', title: 'Game-server hosting', detail: 'Residential ISP conditions kill SLA economics; publishers hostile to player-run infra.' },
  { status: 'ruled-out', title: 'Competing with OpenAI/Anthropic on frontier quality', detail: 'We route to them; we don\'t try to beat their best.' },
];

const STATUS_LABELS: Record<Status, { icon: string; label: string; color: string }> = {
  'shipped':     { icon: '✓', label: 'Shipped',       color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' },
  'building':    { icon: '⚙', label: 'Building now',   color: 'text-amber-400 border-amber-500/30 bg-amber-500/5' },
  'next':        { icon: '→', label: 'Next',           color: 'text-sky-400 border-sky-500/30 bg-sky-500/5' },
  'considering': { icon: '?', label: 'Considering',    color: 'text-violet-400 border-violet-500/30 bg-violet-500/5' },
  'ruled-out':   { icon: '✕', label: 'Ruled out',      color: 'text-zinc-500 border-zinc-600/30 bg-zinc-600/5' },
};

function Section({ status }: { status: Status }) {
  const items = ITEMS.filter(i => i.status === status);
  if (items.length === 0) return null;
  const meta = STATUS_LABELS[status];
  return (
    <section className="mb-12">
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wide mb-5 ${meta.color}`}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        <span className="opacity-50">({items.length})</span>
      </div>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="font-semibold text-zinc-100">{item.title}</div>
            <div className="mt-1.5 text-sm text-zinc-400">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RoadmapPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold text-zinc-100">Roadmap</h1>
      <p className="mt-3 text-zinc-400 max-w-2xl">
        Public, honest, and updated as we ship. Nothing here is a promise —
        it&apos;s what we&apos;re working on and in what order. If something
        matters to you,{' '}
        <Link href="/community" className="text-amber-400 hover:underline">join the community</Link>
        {' '}and we&apos;ll move it or mark it <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">help-wanted</code>.
      </p>

      <div className="mt-12 space-y-2">
        <Section status="shipped" />
        <Section status="building" />
        <Section status="next" />
        <Section status="considering" />
        <Section status="ruled-out" />
      </div>

      <section className="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-xl font-semibold text-zinc-100">How to influence this roadmap</h2>
        <ol className="mt-3 space-y-2 text-sm text-zinc-400 list-decimal list-inside">
          <li>Open a discussion in <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">#roadmap-requests</code> on Discord or as a GitHub issue.</li>
          <li>Vote on existing items. We review top-voted items in the monthly community call.</li>
          <li>Contribute code — pick a <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">help-wanted</code> issue, submit a PR.</li>
          <li>Join the Community Council (month 2+) — top contributors rotate in for a quarter.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-amber-300 hover:bg-amber-500/20">
            Join the community →
          </Link>
          <a href="https://github.com/ComputeGauge/inferlane" className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-zinc-300 hover:bg-zinc-700/50">
            View on GitHub →
          </a>
        </div>
      </section>
    </main>
  );
}
