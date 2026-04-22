'use client';

import { useState } from 'react';

type OS = 'macos' | 'linux' | 'windows';
type Mode = 'mcp' | 'operator' | 'both';

const OS_LABEL: Record<OS, string> = { macos: 'macOS', linux: 'Linux', windows: 'Windows' };

const BASE_CMD: Record<OS, string> = {
  macos: 'curl -fsSL https://install.inferlane.dev | bash',
  linux: 'curl -fsSL https://install.inferlane.dev | bash',
  windows: 'iwr -useb https://install.inferlane.dev/win.ps1 | iex',
};

const MODE_FLAG: Record<Mode, string> = {
  mcp: '',
  operator: ' -s -- --mode operator',
  both: ' -s -- --mode both',
};

const MODES: { key: Mode; title: string; body: string; hint?: string }[] = [
  { key: 'mcp', title: 'mcp', body: 'Install the MCP plugin for Claude Code.', hint: 'Default' },
  { key: 'operator', title: 'operator', body: 'Install the node daemon. Run a node, earn credits.' },
  { key: 'both', title: 'both', body: 'Install both. For people who use AND contribute compute.' },
];

export default function InstallClient() {
  const [os, setOs] = useState<OS>('macos');
  const [mode, setMode] = useState<Mode>('mcp');
  const [copied, setCopied] = useState(false);

  // Windows has its own flag structure; other OSes use the bash -s syntax.
  const cmd = os === 'windows'
    ? BASE_CMD.windows + (mode !== 'mcp' ? ` | % { & $_ -Mode ${mode} }` : '')
    : BASE_CMD[os] + MODE_FLAG[mode];

  async function copy() {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // best-effort; some browsers block clipboard in insecure contexts
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex border-b border-zinc-800">
        {(['macos', 'linux', 'windows'] as OS[]).map((k) => (
          <button
            key={k}
            onClick={() => setOs(k)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              os === k
                ? 'bg-zinc-950 text-amber-400 border-b-2 border-amber-500'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {OS_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6">
        <div className="relative">
          <pre className="rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-4 pr-24 overflow-x-auto text-sm font-mono text-zinc-300">
            <code>
              <span className="text-zinc-500">$</span> <span className="text-amber-400">{cmd}</span>
            </code>
          </pre>
          <button
            onClick={copy}
            className="absolute top-3 right-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`text-left rounded-xl border p-4 transition ${
                mode === m.key
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <code className="font-mono text-sm text-zinc-100">{m.title}</code>
                {m.hint && <span className="text-xs text-zinc-500">{m.hint}</span>}
              </div>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{m.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
