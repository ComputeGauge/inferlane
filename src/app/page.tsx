'use client';

import React, { useState } from 'react';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useTrack, EVENTS } from '@/hooks/useTrack';

export default function Home() {
  const { isAuthenticated, setShowAuthModal } = useAuth();
  const router = useRouter();

  // Auto-navigate to dashboard after login (including demo)
  const prevAuth = React.useRef(isAuthenticated);
  React.useEffect(() => {
    if (!prevAuth.current && isAuthenticated) {
      router.push('/dashboard');
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated, router]);

  return (
    <>
      <AuthModal />
      <LandingPage
        onGetStarted={() => {
          if (!isAuthenticated) {
            setShowAuthModal(true);
          } else {
            router.push('/dashboard');
          }
        }}
        onSignIn={() => setShowAuthModal(true)}
        onDashboard={() => router.push('/dashboard')}
      />
    </>
  );
}

function WaitlistCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-xl mx-auto text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Get early access</h3>
        <p className="text-sm text-gray-400 mb-6">
          Be the first to know when new features launch. No spam, unsubscribe anytime.
        </p>
        {status === 'success' ? (
          <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-6 py-3">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-400 font-medium">You&apos;re on the list!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="flex-1 px-4 py-3 bg-[#12121a] border border-[#1e1e2e] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {status === 'loading' ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-sm mt-2">Something went wrong. Please try again.</p>
        )}
      </div>
    </section>
  );
}

function LandingPage({ onGetStarted, onSignIn, onDashboard }: { onGetStarted: () => void; onSignIn?: () => void; onDashboard?: () => void }) {
  const { isAuthenticated } = useAuth();
  const [annual, setAnnual] = useState(false);
  const track = useTrack();
  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Hero nav */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg">InferLane</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
          <a href="/developers" className="text-sm text-gray-400 hover:text-white transition-colors">Developers</a>
          <a href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
          {isAuthenticated ? (
            <button
              onClick={onDashboard}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={onSignIn}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => { track(EVENTS.CTA_CLICK, { source: 'hero', plan: 'free' }); onGetStarted(); }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Get Started Free
              </button>
            </>
          )}
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 text-center relative">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 text-xs font-medium px-3 py-1 rounded-full mb-6 border border-amber-500/20">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
            Cost intelligence for AI agents · Claude Code · Goose · Cursor
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            The hidden $0.08/hr
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              in every agent run.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            Anthropic bills Managed Agents for active runtime (<span className="text-white font-semibold">$0.08/session-hour</span>) and web searches (<span className="text-white font-semibold">$10/1000</span>) — fees invisible on every other cost dashboard. InferLane tracks token cost + runtime + searches per fleet session for the real number that matches your invoice. Routes routine tasks to local Gemma&nbsp;4 for free. <a href="/transparency" className="underline text-amber-400 hover:text-amber-300">How we make money &rarr;</a>
          </p>
          <p className="text-sm text-gray-500 max-w-2xl mx-auto mb-8">
            Our own 90-day Claude Code bill went from $18,136 to $4,163 using just the routing layer. {' '}
            <a href="/blog/benchmark-20-tasks-5-models" className="underline text-gray-400 hover:text-amber-400">
              Read the 20-task, 5-model benchmark &rarr;
            </a>
          </p>

          {/* The video hero */}
          <div className="max-w-3xl mx-auto mb-10 rounded-2xl overflow-hidden border border-[#1e1e2e] shadow-2xl shadow-amber-500/10">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/hero-comparison.png"
              className="w-full block"
              aria-label="InferLane benchmark animation: my Claude Code bill was $18,136, benchmark-backed routing cut it to $4,163"
            >
              <source src="/inferlane-benchmark.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Install snippet — one-command local setup */}
          <div className="max-w-2xl mx-auto mb-10">
            <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 font-mono text-sm text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs">One command — installs Ollama + Gemma&nbsp;4, auto-sized to your hardware:</span>
                <button
                  onClick={() => navigator.clipboard.writeText('curl -fsSL https://inferlane.dev/install.sh | bash')}
                  className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-green-400 whitespace-pre overflow-x-auto"><code>curl -fsSL https://inferlane.dev/install.sh | bash</code></pre>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Prefer the plugin path? <code className="text-gray-500">/plugin marketplace add ComputeGauge/inferlane</code> in Claude Code.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.npmjs.com/package/@inferlane/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
            >
              Install from npm
            </a>
            <a
              href="https://github.com/ComputeGauge/inferlane"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-[#12121a] border border-[#1e1e2e] text-white font-medium rounded-xl text-lg hover:border-[#3a3a4a] transition-all"
            >
              View on GitHub
            </a>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
            {['Works with Claude Code, Desktop, Goose, Cursor', 'Free local routing via Ollama', 'No vendor lock-in \u2014 26 providers'].map((text) => (
              <span key={text} className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Three things nobody else does
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Most cost trackers show you yesterday&apos;s bill. We show you tomorrow&apos;s — before you pay it.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: 'M13 10V3L4 14h7v7l9-11h-7z',
              title: 'Fleet-session cost, not per-request',
              description: 'Every other tool tracks individual API calls. We aggregate tokens, active runtime, and web-search fees into fleet sessions — the unit Anthropic actually bills you on for Managed Agents. The number that matches your invoice, not your log.',
              color: '#f59e0b',
            },
            {
              icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              title: 'The $0.08/hr you didn\u2019t know you were paying',
              description: 'Anthropic charges Managed Agents for active compute runtime ($0.08/session-hour) and web searches ($10/1000). InferLane is the only tool that captures both alongside token cost for true total cost of ownership.',
              color: '#ef4444',
            },
            {
              icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
              title: 'Savings ledger, not savings claims',
              description: 'Every request logs what you actually paid vs what you would have paid at rack rates. See $ saved per request, per model, per provider — with a double-entry ledger that reconciles nightly. Counterfactual accounting means the savings number on your dashboard is auditable, not aspirational.',
              color: '#8b5cf6',
            },
            {
              icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
              title: 'Local-to-cloud routing that works',
              description: 'One command installs Ollama, pulls Gemma auto-sized to your hardware, and configures routing. Simple extraction and classification tasks run free on your laptop. Reasoning-heavy work routes to cloud. No VPN, no account, no credit card.',
              color: '#10a37f',
            },
            {
              icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              title: 'Side-by-side model comparisons, live',
              description: 'il_compare_models returns current pricing, quality scores, latency, and context window for every equivalent model at once — Sonnet, Haiku, Gemini, DeepSeek, Groq Llama, Gemma\u00a04 local. No more \u201ccheck 5 docs pages to compare providers\u201d.',
              color: '#06b6d4',
            },
            {
              icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
              title: 'Prompt content never leaves your machine',
              description: 'The MCP server runs locally as a stdio subprocess spawned by your agent. Offline tools (il_estimate_cost, il_compare_models, il_suggest_model) never touch the network. Online tools only send model names and token counts — never prompt content. API keys live in your OS keychain, not a config file.',
              color: '#3b82f6',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 hover:border-[#2a2a3a] transition-all"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Open source core. Pro dashboard.</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            The MCP server is free forever. Upgrade for team dashboards and advanced analytics.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`text-sm font-medium ${!annual ? 'text-white' : 'text-gray-500'}`}>Monthly</span>
          <button
            onClick={() => { const next = !annual; setAnnual(next); track(EVENTS.PRICING_TOGGLE, { annual: next }); }}
            className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-amber-500' : 'bg-[#1e1e2e]'}`}
            aria-label="Toggle annual pricing"
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'left-8' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-white' : 'text-gray-500'}`}>
            Annual <span className="text-green-400 text-xs font-semibold ml-1">Save 20%</span>
          </span>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: 'MCP Server',
              price: '$0',
              period: '/forever',
              description: 'Open source — Apache 2.0',
              features: ['41 agent tools via MCP', 'Compute exchange spot pricing', 'pick_model optimization', 'Side-by-side model compare', 'List & sell idle capacity', 'Works offline without an API key', 'Works with any MCP client'],
              cta: 'Install Free',
              highlighted: false,
            },
            {
              name: 'Pro Dashboard',
              price: annual ? '$7' : '$9',
              period: annual ? '/mo' : '/month',
              description: 'For power users and teams',
              features: ['Everything in MCP Server', 'Web dashboard with analytics', 'Cross-session spend history', 'Team cost breakdowns', 'Provider comparison tools', 'Export & reporting', 'Priority support'],
              cta: 'Start Pro Trial',
              highlighted: true,
            },
            {
              name: 'Enterprise',
              price: 'Custom',
              period: '',
              description: 'For organizations at scale',
              features: ['Everything in Pro', 'SSO & SAML', 'On-prem deployment', 'Custom routing policies', 'SLA & dedicated support', 'Audit logs', 'Volume discounts'],
              cta: 'Contact Sales',
              highlighted: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-amber-500/10 to-[#12121a] border-amber-500/30 relative'
                  : 'bg-[#12121a] border-[#1e1e2e]'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="font-semibold text-white text-lg">{plan.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
                {annual && plan.name === 'Pro Dashboard' && <div className="text-xs text-green-400 mt-1">Billed $86/year</div>}
              </div>
              <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { track(EVENTS.CTA_CLICK, { source: 'pricing', plan: plan.name }); onGetStarted(); }}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110'
                    : 'bg-[#1e1e2e] text-white hover:bg-[#2a2a3a]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* OpenAI-compatible proxy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Change the base URL. Everything else works.
              </h2>
              <p className="text-gray-400 mb-4">
                InferLane exposes an OpenAI-compatible proxy. Swap the URL, keep your existing code. We route to the cheapest provider automatically.
              </p>
              <p className="text-sm text-gray-500">
                Works with any OpenAI SDK, LangChain, LlamaIndex, or raw HTTP. Supports streaming, function calling, and all message formats.
              </p>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-5 font-mono text-sm">
              <p className="text-gray-500 text-xs mb-3"># Before (direct to Anthropic)</p>
              <p className="text-gray-500"><span className="text-red-400 line-through">base_url = &quot;https://api.anthropic.com&quot;</span></p>
              <p className="text-gray-500 text-xs mt-4 mb-3"># After (through InferLane)</p>
              <p className="text-green-400">base_url = &quot;https://inferlane.dev/api/v1&quot;</p>
              <p className="text-gray-600 text-xs mt-4"># Same SDK, same code, cheaper inference</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sovereignty / No lock-in section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              No single provider controls your AI stack
            </h2>
            <p className="text-gray-400 text-lg">
              InferLane routes across 26 providers. If one raises prices, goes down, or changes terms &mdash; your workloads shift automatically. No vendor lock-in. No single point of failure.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Multi-provider by default</h3>
              <p className="text-sm text-gray-400">Route through Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq, or community nodes. Switch providers without changing a line of code.</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Privacy tiers you can trust</h3>
              <p className="text-sm text-gray-400">Cloud TEE for regulated data. Standard cloud for business. Best-effort for public workloads. We tell you exactly what each tier guarantees.</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">GDPR-compliant by architecture</h3>
              <p className="text-sm text-gray-400">Data export, deletion, and retention are built in &mdash; not bolted on. Route within your jurisdiction with geo-routing constraints.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-3xl border border-amber-500/20 p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 pulse-glow" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              One install. Every agent is cost-aware.
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-8">
              Add InferLane MCP to your config. Your agents call il_suggest_model before every non-trivial API request — and the savings ledger records every decision with counterfactual accounting.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.npmjs.com/package/@inferlane/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
              >
                npm install @inferlane/mcp
              </a>
              <a
                href="https://github.com/ComputeGauge/inferlane"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-[#12121a] border border-[#1e1e2e] text-white font-medium rounded-xl text-lg hover:border-[#3a3a4a] transition-all"
              >
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <WaitlistCapture />

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm text-gray-500">InferLane</span>
            </div>
            <p className="text-xs text-gray-600">Compute infrastructure intelligence &middot; No vendor lock-in</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
