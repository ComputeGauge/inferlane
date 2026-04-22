import type { Metadata } from 'next';
import Link from 'next/link';
import InstallClient from './InstallClient';

export const metadata: Metadata = {
  title: 'Install — InferLane',
  description: 'One command. Cross-platform. macOS, Linux, Windows. MCP plugin, node daemon, or both.',
};

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="text-center max-w-2xl mx-auto">
        <div className="text-xs font-mono uppercase tracking-widest text-amber-400/70 mb-3">// install</div>
        <h1 className="text-5xl md:text-6xl font-bold text-zinc-100 tracking-tight">
          One command.<br/>
          <span className="text-zinc-500">Cross-platform.</span>
        </h1>
        <p className="mt-5 text-zinc-400">
          macOS, Linux, Windows. MCP plugin, node daemon, or both. Takes about 40 seconds.
        </p>
      </header>

      <section className="mt-12">
        <InstallClient />
      </section>

      <section className="mt-14 grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h4 className="font-semibold text-zinc-100">Requirements</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li><code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">Node.js ≥ 20</code> — checked automatically</li>
            <li><code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">Claude Code CLI</code> — for <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">mcp</code> mode only</li>
            <li><code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">6GB+ RAM free</code> — for <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">operator</code> mode</li>
            <li><code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">curl</code> or <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">iwr</code> — standard on supported OSes</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h4 className="font-semibold text-zinc-100">What the install does</h4>
          <ol className="mt-3 space-y-2 text-sm text-zinc-400 list-decimal list-inside">
            <li>Validates Node version (fails cleanly if &lt; 20)</li>
            <li>Fetches the signed package from releases.inferlane.dev</li>
            <li>Verifies SHA-256 against the published hash</li>
            <li>Symlinks <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">inferlane</code> to your <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">PATH</code></li>
            <li>Prompts for optional monthly budgets</li>
            <li>Starts the local fuel gauge at <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">localhost:7070</code></li>
          </ol>
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <div className="text-xs font-mono uppercase tracking-widest text-amber-400/70 mb-3">// after install</div>
        <h3 className="text-xl font-semibold text-zinc-100">Everything you need, one row.</h3>
        <div className="mt-5 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <a href="http://localhost:7070" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-amber-500/40">
            <div className="font-semibold text-zinc-100">Dashboard</div>
            <div className="mt-1 text-xs text-zinc-500 font-mono">localhost:7070</div>
          </a>
          <Link href="/developers" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-amber-500/40">
            <div className="font-semibold text-zinc-100">Docs</div>
            <div className="mt-1 text-xs text-zinc-500">Protocol + SDK</div>
          </Link>
          <Link href="/community" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-amber-500/40">
            <div className="font-semibold text-zinc-100">Discord</div>
            <div className="mt-1 text-xs text-zinc-500 font-mono">#new-operators</div>
          </Link>
          <Link href="/run-a-node" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-amber-500/40">
            <div className="font-semibold text-zinc-100">Run-a-node</div>
            <div className="mt-1 text-xs text-zinc-500">Hardware guide</div>
          </Link>
        </div>
      </section>
    </main>
  );
}
