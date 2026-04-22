import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Marketplace — InferLane',
  description: 'Build components the InferLane community runs. Security-tiered contribution ladder with revenue share on adoption.',
};

type TierKey = 'widget' | 'policy' | 'theme' | 'recipe' | 'adapter' | 'plugin';
interface Tier {
  key: TierKey;
  name: string;
  description: string;
  risk: 'low' | 'low-ish' | 'medium' | 'high';
  review: string;
  reward: string;
  launch: 'v1' | 'v2' | 'v3';
}

const TIERS: Tier[] = [
  {
    key: 'widget',
    name: 'UI Widget',
    description: 'React component rendered in a sandboxed iframe on the dashboard. postMessage-only API, no server access.',
    risk: 'low',
    review: 'Core team review + published to @inferlane-community/* npm scope',
    reward: '40% of MRR from users who activated the widget in the prior 30 days (last-touch attribution, 30-day refund clawback)',
    launch: 'v1',
  },
  {
    key: 'policy',
    name: 'Routing Policy',
    description: 'Declarative JSON rules (e.g. "route Haiku for tasks under $Y"). Data, not code.',
    risk: 'low',
    review: 'Lint + schema validation; no human review',
    reward: 'Credit bonus per 1,000 adoptions',
    launch: 'v1',
  },
  {
    key: 'theme',
    name: 'Dashboard Theme',
    description: 'CSS variables + token set. Visual only.',
    risk: 'low',
    review: 'Lint + visual review',
    reward: 'Credit bonus + theme-creator badge',
    launch: 'v1',
  },
  {
    key: 'recipe',
    name: 'Integration Recipe',
    description: 'Pre-baked config for Slack, Linear, Discord, Notion webhook alerts.',
    risk: 'low-ish',
    review: 'Core team review',
    reward: '30% of recipe-driven conversions (user installs recipe and upgrades to paid tier)',
    launch: 'v2',
  },
  {
    key: 'adapter',
    name: 'Provider Adapter',
    description: 'New LLM backend route (e.g. Cerebras, Mistral Hosted, SambaNova).',
    risk: 'medium',
    review: 'Full PR review, merged into main product',
    reward: '50,000 kT + negotiated revenue share for commercial adapters',
    launch: 'v2',
  },
  {
    key: 'plugin',
    name: 'Daemon Plugin',
    description: 'Operator-side logic: custom benchmarks, fleet coordination, regional routing.',
    risk: 'high',
    review: 'PR-only, full code audit, signed releases, security review',
    reward: '150,000 kT + negotiated revshare for commercial plugins',
    launch: 'v3',
  },
];

const RISK_COLORS: Record<Tier['risk'], string> = {
  'low':      'text-emerald-400 bg-emerald-500/5 border-emerald-500/30',
  'low-ish':  'text-sky-400 bg-sky-500/5 border-sky-500/30',
  'medium':   'text-amber-400 bg-amber-500/5 border-amber-500/30',
  'high':     'text-rose-400 bg-rose-500/5 border-rose-500/30',
};

const LAUNCH_BADGES: Record<Tier['launch'], { label: string; color: string }> = {
  'v1': { label: 'V1 · Month 2-3',    color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  'v2': { label: 'V2 · Month 4-6',    color: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  'v3': { label: 'V3 · Month 6+',     color: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
};

export default function MarketplacePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200 mb-10">
        <div className="font-semibold text-amber-300 mb-1">Coming soon</div>
        <div className="text-amber-200/90">
          The marketplace launches in phases starting month 2-3.
          This page describes what you&apos;ll be able to build and how you&apos;ll
          be rewarded. Want to be notified when each tier opens?{' '}
          <Link href="/community" className="underline decoration-amber-500/50">Join the Discord</Link>.
        </div>
      </div>

      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-400/70 mb-3">// marketplace</div>
        <h1 className="text-4xl md:text-5xl font-bold text-zinc-100 tracking-tight">
          Build what the network runs.<br />
          <span className="text-zinc-500">Earn when people use it.</span>
        </h1>
        <p className="mt-5 text-zinc-400 max-w-2xl">
          The InferLane marketplace is a contribution ladder for community
          builders. Six tiers, each with its own security review, review
          cadence, and reward. Security-graded: widgets and themes (pure
          client-side) launch first. Server-side adapters and daemon plugins
          come later with deeper review.
        </p>
      </header>

      <section className="mt-14 space-y-5">
        {TIERS.map((t) => (
          <div key={t.key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-100">{t.name}</h2>
                  <span className={`text-xs font-mono uppercase tracking-wide rounded-full border px-2 py-0.5 ${RISK_COLORS[t.risk]}`}>
                    {t.risk} risk
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400 max-w-2xl">{t.description}</p>
              </div>
              <span className={`text-xs font-mono uppercase tracking-wide rounded-full border px-3 py-1 shrink-0 ${LAUNCH_BADGES[t.launch].color}`}>
                {LAUNCH_BADGES[t.launch].label}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-4">
                <div className="text-xs font-mono uppercase tracking-wide text-zinc-500 mb-1.5">Review gate</div>
                <div className="text-zinc-300">{t.review}</div>
              </div>
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-4">
                <div className="text-xs font-mono uppercase tracking-wide text-zinc-500 mb-1.5">Reward</div>
                <div className="text-zinc-300">{t.reward}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <h2 className="text-xl font-semibold text-zinc-100">Attribution rules (anti-gaming)</h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
          <li>• Install events logged server-side, not trusted from client</li>
          <li>• 30-day last-touch attribution window</li>
          <li>• Refund clawback: churn within 30 days refunds attribution</li>
          <li>• Single creator capped at 15% of total platform revenue (prevents concentration)</li>
          <li>• Verified identity via GitHub OAuth or licensed-processor onboarding before any cash payout</li>
        </ul>
      </section>

      <section className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 text-xs text-amber-100/90 leading-relaxed">
        <strong className="text-amber-300">Not a financial product.</strong>{' '}
        Marketplace revenue share is a commercial commission paid for the
        sale of your component — the same structure used by app stores,
        creator platforms, and affiliate programmes. It is not an investment
        contract, profit-sharing security, or claim on InferLane revenue
        beyond payment for your specific component&apos;s attributed sales.
        kT credit bonuses are service-redemption units, not currency or
        securities. See the{' '}
        <a href="/terms" className="underline decoration-amber-500/50 hover:text-amber-200">Terms of Service</a>
        {' '}for the full &quot;What kT credits are NOT&quot; disclosure.
      </section>

      <section className="mt-16 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 md:p-8">
        <h2 className="text-xl font-semibold text-violet-200">Operator-modded dashboards (v2+)</h2>
        <p className="mt-2 text-sm text-violet-100/80 max-w-3xl">
          Top-performing operators get a customisable public dashboard — logo,
          theme, featured widgets, bio, benchmarks. Consumers visiting an
          operator&apos;s branded dashboard get routing affinity to that
          operator&apos;s node when hardware and model requirements match.
          Operators can strike independent sponsorship deals with widget
          creators through the marketplace; the platform facilitates
          attribution + payment splits.
        </p>
        <p className="mt-3 text-xs text-violet-300/70">
          Security boundary: operator dashboards render only from the approved
          marketplace component set. No arbitrary HTML or JavaScript.
        </p>
      </section>

      <section className="mt-16 grid md:grid-cols-2 gap-4">
        <Link href="/community" className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40">
          <div className="text-xs font-mono uppercase tracking-wide text-amber-400/70">Community</div>
          <div className="mt-2 text-zinc-100 font-semibold">Join the Discord</div>
          <div className="mt-2 text-sm text-zinc-400 group-hover:text-zinc-300">#contributing channel has the latest on widget SDK, schema docs, and beta invites.</div>
          <div className="mt-4 text-sm text-amber-400 group-hover:text-amber-300">Open community →</div>
        </Link>

        <Link href="/roadmap" className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40">
          <div className="text-xs font-mono uppercase tracking-wide text-amber-400/70">Roadmap</div>
          <div className="mt-2 text-zinc-100 font-semibold">See what&apos;s shipping</div>
          <div className="mt-2 text-sm text-zinc-400 group-hover:text-zinc-300">Each marketplace tier launches in order. Watch the roadmap to know when your tier opens.</div>
          <div className="mt-4 text-sm text-amber-400 group-hover:text-amber-300">Open roadmap →</div>
        </Link>
      </section>
    </main>
  );
}
