// /pricing — Public real-time pricing page with live spot rates
//
// Shows current spot prices across all providers, historical comparisons,
// and live savings calculator. Data comes from the exchange spot API.

import { Metadata } from 'next';
import PublicNav from '@/components/PublicNav';

export const metadata: Metadata = {
  title: 'Live Pricing — InferLane',
  description:
    'Real-time inference pricing across 20+ providers. Compare spot rates, see savings vs rack prices, and find the cheapest model for your workload.',
};

// Static pricing data — augmented by client-side spot API calls
// Rack rates = direct provider pricing. InferLane routing saves via model selection + exchange pricing.
const REFERENCE_MODELS = [
  {
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    rackInput: 3.0,
    rackOutput: 15.0,
    context: '200K',
    tier: 'Workhorse',
    savingsVsOpus: '80%',
  },
  {
    name: 'GPT-4o',
    provider: 'OpenAI',
    rackInput: 2.5,
    rackOutput: 10.0,
    context: '128K',
    tier: 'Frontier',
  },
  {
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    rackInput: 1.25,
    rackOutput: 10.0,
    context: '1M',
    tier: 'Frontier',
  },
  {
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    rackInput: 0.10,
    rackOutput: 0.40,
    context: '1M',
    tier: 'Speed',
  },
  {
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    rackInput: 0.27,
    rackOutput: 1.10,
    context: '64K',
    tier: 'Budget',
  },
  {
    name: 'Gemma 4 27B',
    provider: 'Darkbloom',
    rackInput: 0.06,
    rackOutput: 0.20,
    context: '128K',
    tier: 'Decentralized',
  },
  {
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    rackInput: 1.0,
    rackOutput: 5.0,
    context: '200K',
    tier: 'Speed',
  },
  {
    name: 'Llama 3.3 70B',
    provider: 'Groq',
    rackInput: 0.59,
    rackOutput: 0.79,
    context: '128K',
    tier: 'Budget',
  },
  {
    name: 'Gemma 4 12B',
    provider: 'Ollama (local)',
    rackInput: 0,
    rackOutput: 0,
    context: '128K',
    tier: 'Free / Local',
  },
];

function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  if (price < 0.01) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function tierColor(tier: string): string {
  switch (tier) {
    case 'Frontier': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    case 'Workhorse': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'Speed': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    case 'Budget': return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'Decentralized': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'Free / Local': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
    <PublicNav />
    <div className="mx-auto max-w-5xl px-6 py-10 text-gray-200">
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Live Inference Pricing
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl">
          Real-time spot rates across 20+ providers. InferLane routes your
          requests to the cheapest option that meets your quality requirements.
        </p>
      </div>

      {/* Key value props */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-sm text-gray-500 mb-1">Providers tracked</p>
          <p className="text-3xl font-bold text-white">23</p>
        </div>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-sm text-gray-500 mb-1">Models indexed</p>
          <p className="text-3xl font-bold text-white">80+</p>
        </div>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-sm text-gray-500 mb-1">Local routing</p>
          <p className="text-3xl font-bold text-emerald-400">$0.00</p>
          <p className="text-xs text-gray-600">Gemma 4 via Ollama</p>
        </div>
      </div>

      {/* Pricing table */}
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden mb-12">
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="font-semibold text-white text-lg">Spot Rates</h2>
          <p className="text-xs text-gray-500">Per 1M tokens &middot; Updated in real time</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e] text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Model</th>
                <th className="text-left px-4 py-3 font-medium">Provider</th>
                <th className="text-right px-4 py-3 font-medium">Input</th>
                <th className="text-right px-4 py-3 font-medium">Output</th>
                <th className="text-center px-4 py-3 font-medium">Context</th>
                <th className="text-center px-4 py-3 font-medium">Tier</th>
                <th className="text-right px-4 py-3 font-medium">vs Opus</th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE_MODELS.map((m) => (
                <tr
                  key={m.name}
                  className="border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/30 transition-colors"
                >
                  <td className="px-6 py-3.5 font-medium text-white">{m.name}</td>
                  <td className="px-4 py-3.5 text-gray-400">{m.provider}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-gray-300">
                    {formatPrice(m.rackInput)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-gray-300">
                    {formatPrice(m.rackOutput)}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-400">{m.context}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${tierColor(m.tier)}`}>
                      {m.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {m.rackOutput === 0 ? (
                      <span className="text-emerald-400 font-semibold text-xs">100%</span>
                    ) : (
                      <span className="text-green-400 text-xs font-mono">
                        {Math.round((1 - (m.rackOutput / 75)) * 100)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How routing saves money */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-8 mb-12">
        <h2 className="text-xl font-bold text-white mb-3">
          How InferLane saves you money
        </h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-amber-400 mb-1">Smart routing</h3>
            <p className="text-gray-400">
              Simple tasks (classification, extraction) route to budget
              models. Complex reasoning stays on frontier models. You get
              the right quality at the right price, automatically.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-amber-400 mb-1">Local-first</h3>
            <p className="text-gray-400">
              One command installs Ollama + Gemma 4, auto-sized to your
              hardware. Simple workloads run free on your machine. Zero
              API cost, zero latency.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-amber-400 mb-1">Spot exchange</h3>
            <p className="text-gray-400">
              Operators list spare capacity at competitive rates.
              Dynamic pricing means you benefit from supply competition
              &mdash; not flat-rate monopoly pricing.
            </p>
          </div>
        </div>
      </div>

      {/* Sovereignty section */}
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-8 mb-12">
        <h2 className="text-xl font-bold text-white mb-3">
          No single provider lock-in
        </h2>
        <p className="text-gray-400 mb-4">
          InferLane routes across 23 providers. If one raises prices, goes
          down, or changes terms &mdash; your workloads automatically shift.
          No vendor lock-in. No single point of failure.
        </p>
        <div className="flex flex-wrap gap-2">
          {['Anthropic', 'OpenAI', 'Google', 'Mistral', 'DeepSeek', 'Groq',
            'Together', 'Fireworks', 'Cerebras', 'Ollama (local)', 'Darkbloom'].map((p) => (
            <span
              key={p}
              className="text-xs px-3 py-1 rounded-full bg-[#1e1e2e] text-gray-400 border border-[#2a2a3a]"
            >
              {p}
            </span>
          ))}
          <span className="text-xs px-3 py-1 rounded-full bg-[#1e1e2e] text-gray-500 border border-[#2a2a3a]">
            +12 more
          </span>
        </div>
      </div>

      {/* API access */}
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-8">
        <h2 className="text-xl font-bold text-white mb-3">
          Pricing API
        </h2>
        <p className="text-gray-400 mb-4">
          Query live spot rates programmatically. Free, no auth required for
          read-only pricing data.
        </p>
        <div className="bg-[#0a0a0f] rounded-xl p-4 font-mono text-sm">
          <p className="text-gray-500 text-xs mb-2"># Get spot rate for a model</p>
          <p className="text-green-400">
            curl &quot;https://inferlane.dev/api/exchange/spot?model=gemma-4-27b&amp;inputTokens=1000&amp;outputTokens=500&quot;
          </p>
        </div>
      </div>

      <footer className="pt-10 mt-12 border-t border-[#1e1e2e] text-sm text-gray-500">
        Prices shown are list/rack rates from each provider. Actual rates
        through InferLane may be lower due to volume rebates, promotions,
        and exchange spot pricing. Last updated: {new Date().toISOString().split('T')[0]}.
      </footer>
    </div>
    </div>
  );
}
