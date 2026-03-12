'use client';

import React, { useState } from 'react';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
          <span className="font-bold text-white text-lg">ComputeGauge</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
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
                onClick={onGetStarted}
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
            The cost intelligence layer for AI agents
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Make every AI agent
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              cost-aware.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            ComputeGauge MCP gives any AI agent instant cost intelligence. Model selection, spend tracking, credibility scoring, and local-to-cloud routing. Install once, save 40-70%.
          </p>

          {/* Install snippet */}
          <div className="max-w-lg mx-auto mb-10">
            <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 font-mono text-sm text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs">Add to your MCP config:</span>
                <button
                  onClick={() => navigator.clipboard.writeText('{\n  "mcpServers": {\n    "computegauge": {\n      "command": "npx",\n      "args": ["-y", "@computegauge/mcp"]\n    }\n  }\n}')}
                  className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-green-400 whitespace-pre overflow-x-auto"><code>{`{
  "mcpServers": {
    "computegauge": {
      "command": "npx",
      "args": ["-y", "@computegauge/mcp"]
    }
  }
}`}</code></pre>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.npmjs.com/package/@computegauge/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
            >
              Install from npm
            </a>
            <a
              href="https://github.com/ComputeGauge/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-[#12121a] border border-[#1e1e2e] text-white font-medium rounded-xl text-lg hover:border-[#3a3a4a] transition-all"
            >
              View on GitHub
            </a>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
            {['Works with Claude, Cursor & Windsurf', '18 tools, zero config', 'Apache-2.0 open source'].map((text) => (
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
            18 tools your agent gets automatically
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Install once. Every session is cost-aware and credibility-building.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: 'M13 10V3L4 14h7v7l9-11h-7z',
              title: 'pick_model',
              description: 'Scores every model on quality, cost, and speed for 14 task types. Returns the optimal model for any request. Saves 40-70% on average.',
              color: '#f59e0b',
            },
            {
              icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              title: 'log_request + session_cost',
              description: 'Real-time spend tracking per session. Know exactly what every API call costs. Budget alerts before you overshoot.',
              color: '#3b82f6',
            },
            {
              icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
              title: 'Agent Credibility',
              description: 'Build a 0-1000 reputation score. Earn points for smart routing, honest reporting, and task success. Compete on a leaderboard.',
              color: '#8b5cf6',
            },
            {
              icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
              title: 'Local-to-Cloud Routing',
              description: 'Auto-detect Ollama, vLLM, and 5 other local endpoints. Route to cloud only when local quality falls short. Earn credibility for smart decisions.',
              color: '#10a37f',
            },
            {
              icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
              title: 'Model Ratings & Integrity',
              description: 'Rate model performance. Anti-spam filters ensure honest data. Community-driven quality scores improve recommendations for everyone.',
              color: '#ef4444',
            },
            {
              icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              title: 'Cost Intelligence',
              description: 'Spend summaries, budget alerts, usage trends, and savings recommendations. Real pricing across 8 providers and 20+ models.',
              color: '#06b6d4',
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
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: 'MCP Server',
              price: '$0',
              period: '/forever',
              description: 'Open source — Apache 2.0',
              features: ['18 agent tools via MCP', 'pick_model optimization', 'Session cost tracking', 'Agent credibility scoring', 'Local cluster detection', 'Budget guardrails', 'Works with any MCP client'],
              cta: 'Install Free',
              highlighted: false,
            },
            {
              name: 'Pro Dashboard',
              price: '$9',
              period: '/month',
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
                onClick={onGetStarted}
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

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-3xl border border-amber-500/20 p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 pulse-glow" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              One install. Every agent is cost-aware.
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-8">
              Add ComputeGauge MCP to your config. Your agents start saving 40-70% immediately — and build visible credibility while doing it.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.npmjs.com/package/@computegauge/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
              >
                npm install @computegauge/mcp
              </a>
              <a
                href="https://github.com/ComputeGauge/mcp"
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
              <span className="text-sm text-gray-500">ComputeGauge</span>
            </div>
            <p className="text-xs text-gray-600">The cost intelligence layer for AI agents</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
