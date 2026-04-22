import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community — InferLane',
  description: 'Build, share, and earn with the InferLane community. Discord, roadmap, contributor marketplace, and transparency.',
};

const PILLARS = [
  {
    title: 'Share what you&apos;ve got.',
    body: 'Run a node on your Mac mini, gaming rig, or spare GPU server. Earn credits when others use your compute. Redeem them for inference from the network, or cash out once cash payouts are live.',
    cta: 'Run a node →',
    href: '/run-a-node',
  },
  {
    title: 'Use what others share.',
    body: 'Route bulk inference through the peer network at a fraction of the cost of hosted providers. Keep your frontier workloads on Claude / OpenAI / Gemini; let the network handle the rest.',
    cta: 'Install the plugin →',
    href: '/install',
  },
  {
    title: 'Build on the platform.',
    body: 'Widgets, dashboards, routing policies, provider adapters — contribute components that earn you revenue share or credit bonuses. Security-tiered, launching in phases.',
    cta: 'See contribution tiers →',
    href: '/marketplace',
  },
];

const TENETS = [
  { k: 'Honest', v: 'We publish what we have and what we don&apos;t. No aspirational metrics dressed up as production.' },
  { k: 'Credit-first', v: 'You earn and spend in credits before cash payouts turn on. The network bootstraps without burning capital.' },
  { k: 'Community-owned', v: 'Top contributors advise the roadmap. Decisions are public. No private cabals.' },
  { k: 'Safe by default', v: 'Moderation at the edge. Every operator signs a code of conduct. Bad actors get kicked; good actors stay.' },
  { k: 'Cross-platform', v: 'Mac. Linux. Windows. GPU rigs. No artificial hardware lock-in.' },
  { k: 'Privacy-respecting', v: 'We don&apos;t train on your prompts. Your local fuel-gauge data stays on your machine unless you opt in to cloud sync.' },
];

export default function CommunityPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-400/70 mb-3">// community</div>
        <h1 className="text-4xl md:text-5xl font-bold text-zinc-100 tracking-tight">
          Share what you&apos;ve got.<br />
          <span className="text-zinc-500">Use what others share.</span>
        </h1>
        <p className="mt-5 text-zinc-400 max-w-2xl">
          InferLane is community-owned AI inference. Three ways to participate —
          pick any, or all three.
        </p>
      </header>

      <section className="mt-14 grid md:grid-cols-3 gap-5">
        {PILLARS.map((p, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col">
            <div className="font-semibold text-zinc-100 text-lg" dangerouslySetInnerHTML={{ __html: p.title }} />
            <div className="mt-3 text-sm text-zinc-400 flex-grow" dangerouslySetInnerHTML={{ __html: p.body }} />
            <Link href={p.href} className="mt-5 text-sm text-amber-400 hover:text-amber-300 self-start">
              {p.cta}
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Where we talk</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Discord is the fastest way to reach us or another contributor.
            </p>
          </div>
          <a
            href="https://discord.gg/inferlane"
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 shrink-0"
          >
            Join Discord →
          </a>
        </div>
        <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {['#help-me-model', '#new-operators', '#benchmarks', '#roadmap-requests', '#contributing', '#report-abuse', '#announcements', '#off-topic'].map((c) => (
            <div key={c} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-400">{c}</div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-zinc-100">How we work</h2>
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {TENETS.map((t, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-amber-400 font-mono text-xs uppercase tracking-wide">{t.k}</div>
              <div className="mt-2 text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: t.v }} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid md:grid-cols-3 gap-4">
        <Link href="/roadmap" className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40">
          <div className="text-xs font-mono uppercase tracking-wide text-amber-400/70">Roadmap</div>
          <div className="mt-2 text-zinc-100 font-semibold">What we&apos;re building</div>
          <div className="mt-2 text-sm text-zinc-400 group-hover:text-zinc-300">Shipped, in-progress, next, considering — honest status.</div>
          <div className="mt-4 text-sm text-amber-400 group-hover:text-amber-300">Open roadmap →</div>
        </Link>

        <Link href="/marketplace" className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40">
          <div className="text-xs font-mono uppercase tracking-wide text-amber-400/70">Marketplace</div>
          <div className="mt-2 text-zinc-100 font-semibold">Contributor components</div>
          <div className="mt-2 text-sm text-zinc-400 group-hover:text-zinc-300">Widgets, themes, routing policies. Revenue share on adoption.</div>
          <div className="mt-4 text-sm text-amber-400 group-hover:text-amber-300">See the ladder →</div>
        </Link>

        <Link href="/transparency" className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/40">
          <div className="text-xs font-mono uppercase tracking-wide text-amber-400/70">Transparency</div>
          <div className="mt-2 text-zinc-100 font-semibold">Monthly report</div>
          <div className="mt-2 text-sm text-zinc-400 group-hover:text-zinc-300">Tokens served, active operators, credits circulating, takedowns, revenue.</div>
          <div className="mt-4 text-sm text-amber-400 group-hover:text-amber-300">See the numbers →</div>
        </Link>
      </section>

      <section className="mt-16 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 md:p-8">
        <h2 className="text-xl font-semibold text-amber-200">Code of Conduct</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          Be the kind of person others want to build with. Disagree with ideas,
          not people. Assume good faith. Credit people&apos;s work.
        </p>
        <Link href="/code-of-conduct" className="mt-4 inline-block text-sm text-amber-400 hover:text-amber-300">
          Read the full Code of Conduct →
        </Link>
      </section>
    </main>
  );
}
