import type { Metadata } from 'next';
import Link from 'next/link';
import RunANodeCalculator from './RunANodeCalculator';

export const metadata: Metadata = {
  title: 'Run a node — InferLane',
  description: 'Turn your idle Mac mini or GPU rig into a node on the InferLane network. Install a signed daemon, earn credits, leave whenever you want.',
};

export default function RunANodePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-400/70 mb-3">// run a node</div>
        <h1 className="text-5xl md:text-6xl font-bold text-zinc-100 tracking-tight">
          Your idle Mac mini <em className="font-serif font-normal italic text-zinc-400">is</em> a contribution waiting to happen.
        </h1>
        <p className="mt-5 text-zinc-400 max-w-2xl">
          Install a signed daemon. Serve requests the coordinator routes to
          you. Earn kT credits you can spend on inference from the network.
          Leave with one command whenever you want.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-amber-100/90 leading-relaxed space-y-2">
        <p>
          <strong className="text-amber-300">Credits only. No cash.</strong>{' '}
          The Service operates in a credits-only mode. kT credits are
          redeemable for inference on our network and <strong>do not convert
          to cash, currency, or any other asset</strong>. No cash-payout
          pathway is offered.
        </p>
        <p>
          <strong className="text-amber-300">Not a financial product.</strong>{' '}
          kT credits are internal service-redemption units, not securities,
          currency, cryptocurrency, deposits, or investment contracts.
          Running a node is independent-contractor work — it is not an
          investment in InferLane and earns no dividend, yield, or revenue
          share. Figures shown below are <em>anticipated at estimated
          network demand</em> — not guaranteed credits, not a forecast, and
          may be zero.
        </p>
        <p>
          If InferLane ever introduces a cash-payout pathway, participation
          will require separate affirmative opt-in, new terms, and identity
          verification. Existing kT balances will not be converted.
        </p>
      </div>

      <section className="mt-12">
        <RunANodeCalculator />
      </section>

      <section className="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <div className="text-xs font-mono uppercase tracking-widest text-amber-400/70 mb-2">// one-page summary</div>
        <h2 className="text-2xl font-bold text-zinc-100">Operator Agreement, in plain English.</h2>
        <ol className="mt-6 space-y-4 text-sm text-zinc-400">
          <li className="flex gap-3">
            <span className="text-amber-400 font-mono shrink-0">01</span>
            <span><strong className="text-zinc-100">You are an independent contractor.</strong> You run a daemon on your hardware. You pay your own taxes. You comply with your own local law.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-mono shrink-0">02</span>
            <span><strong className="text-zinc-100">You run only the signed daemon.</strong> Hashes are public at <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">releases.inferlane.dev</code>. Modified binaries void the agreement and forfeit pending credits.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-mono shrink-0">03</span>
            <span><strong className="text-zinc-100">You do not log prompts or responses</strong> beyond RAM lifetime. No sampling, no disk writes, no model-context retention across requests.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-mono shrink-0">04</span>
            <span><strong className="text-zinc-100">You do not veto requests.</strong> The coordinator&apos;s moderation gate is the single content-policy surface. If we routed it to you, it passed the gate.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-mono shrink-0">05</span>
            <span><strong className="text-zinc-100">You indemnify InferLane</strong> for your conduct, your modifications, and your local-law violations. InferLane does <em>not</em> indemnify operators — but we run the moderation gate, publish the AUP, and handle abuse reports.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-mono shrink-0">06</span>
            <span><strong className="text-zinc-100">You can leave any time.</strong> Run <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">inferlane daemon stop</code> and you&apos;re out. Credits within the last 30 days settle on the normal schedule.</span>
          </li>
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/operator-agreement" className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50">
            Read the full Operator Agreement →
          </Link>
          <Link href="/aup" className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50">
            Read the AUP →
          </Link>
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-100">Ready when you are.</h3>
          <p className="mt-2 text-sm text-amber-100/80 max-w-xl">
            One command gets the daemon on your machine. Takes about 40
            seconds. You can uninstall with one more.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/install" className="inline-flex items-center gap-2 rounded-full bg-amber-500 text-zinc-950 px-5 py-2.5 text-sm font-semibold hover:bg-amber-400">
            Install the daemon
          </Link>
          <Link href="/community" className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-5 py-2.5 text-sm text-amber-300 hover:bg-amber-500/20">
            Join #new-operators
          </Link>
        </div>
      </section>
    </main>
  );
}
