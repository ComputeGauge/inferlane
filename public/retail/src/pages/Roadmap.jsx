/* Roadmap page — faithful to ROADMAP.md with pill-bucket visual treatment + voting */

const ROADMAP_DATA = [
  {
    bucket: 'shipped',
    label: 'Shipped',
    glyph: '✓',
    color: '#10b981',
    description: 'Live and boring. Use it today.',
    items: [
      { title: '@inferlane/mcp @ 0.7.0', body: '49 MCP tools for model selection, spend tracking, routing, credibility scoring. Published on npm.' },
      { title: 'Local Compute Fuel Gauge', body: 'http://localhost:7070/dashboard. Reads usage directly from ~/.claude/projects/*.jsonl. Zero network, zero API key.' },
      { title: 'Claude Code usage auto-ingest', body: 'Per-user spend reflected without any manual logging.' },
      { title: 'Claude Code plugin v1.1.0', body: 'Installs MCP, prompts for budgets, starts the local dashboard automatically.' },
      { title: 'OpenAI-compatible /v1/chat/completions', body: 'With moderation gate and Bearer-token auth.' },
      { title: 'DarkBloom routing adapter', body: 'First inference routing target — live.' },
    ],
  },
  {
    bucket: 'building',
    label: 'Building now',
    glyph: '⚙',
    color: '#f59e0b',
    description: 'In flight this sprint (~2 weeks).',
    items: [
      { title: 'Real network crypto', body: 'Replace the base64 placeholder in packages/daemon with X25519 + AES-GCM. Baseline security is non-negotiable before anyone onboards.' },
      { title: 'kT credit ledger', body: 'The "solar-battery" bootstrap model. Earn credits by serving inference; spend them on inference from others. Closed internal economy; credits do not convert to cash.' },
      { title: 'Cross-platform one-line installer', body: 'curl -fsSL install.inferlane.dev | bash — macOS, Linux, Windows (WSL GPU operators).' },
      { title: 'Operator profiles + contribution leaderboard', body: 'Pseudonymous, opt-in, framed as "top contributors this week" not "top earners".' },
      { title: 'Community Discord', body: '#help-me-model, #new-operators, #benchmarks, #roadmap-requests.' },
    ],
  },
  {
    bucket: 'next',
    label: 'Next',
    glyph: '→',
    color: '#38bdf8',
    description: 'Weeks 3–6. Scoped, not started.',
    items: [
      { title: 'MCP Pro subscription', body: '$10/mo team features: shared budgets, Slack alerts, historical export, SSO.' },
      { title: 'BYO-key routing markup', body: 'Route your Claude / OpenAI / Gemini traffic through us with a 5% margin. Passthrough only — we never see your prompts.' },
      { title: 'Badges', body: 'OG-100, reliable-operator-30d, multi-model-host, 10-merged-PR-club.' },
      { title: 'Monthly transparency report', body: 'Auto-generated aggregates: tokens served, unique operators, unique consumers, credits in circulation, revenue, treasury.' },
      { title: 'Phala TEE partnership', body: 'Outreach, then route our privacy tier through their decentralised Intel SGX/TDX network.' },
      { title: 'Model catalogue', body: 'Curated open-weight models with hardware-class recommendations and community-submitted benchmarks tied to operator hardware profiles.' },
    ],
  },
  {
    bucket: 'considering',
    label: 'Considering',
    glyph: '?',
    color: '#a78bfa',
    description: 'Open questions. Vote or chime in on Discord.',
    items: [
      { title: 'Contributor marketplace', body: 'UI widgets, dashboard themes, routing policies, integration recipes, provider adapters. Security-tiered; client-side + JSON policies launch first. Target: V1 pilot month 2-3.' },
      { title: 'Public /roadmap and /community pages', body: 'This file rendered live with 👍 voting per item, contributor wall, Discord CTA, upcoming community-call schedule.' },
      { title: 'Gaming-rig operator class', body: 'NVIDIA 40/50-series + Apple Silicon overlap heavily with the modding community (FiveM, Minecraft, Roblox). Two-in-one: their rig serves inference AND they contribute widgets for their niches.' },
      { title: 'Operator-modded dashboards + affinity routing', body: 'Top operators get customisable public dashboards. Consumers visiting an operator\'s page get affinity-routed to their node when hardware/model match. V2 post-marketplace (month 4-6).' },
      { title: 'Cash payouts', body: 'Not currently offered. kT credits are redeemable for inference on the network and do not convert to cash. If a cash pathway is ever introduced, participation will require separate opt-in and new terms; existing credit balances will not be converted. No timeline, no commitment.' },
      { title: 'Frontier open-weight on DC partners', body: 'IREN / Applied Digital / Crusoe / Core Scientific — only after MRR base justifies a pilot prepay. Month 3+.' },
      { title: 'Enterprise tier', body: 'SSO, audit logs, on-prem, SLA. Driven by the first three inbound enterprise conversations, not speculative build.' },
      { title: 'Claude Code native integrations', body: 'Statusline, slash-commands, chat-side gauge display.' },
      { title: 'Community Council', body: '5 seats, rotating quarterly, top-contributor voted, advisory not binding. Month 2.' },
      { title: 'Other compute-utility SKUs', body: 'iOS/macOS CI build farms, video transcoding, RAG indexing. Opt-in per operator on the same peer infra.' },
      { title: 'Bittensor / Akash / io.net adapters', body: 'If we see consumer demand for that kind of privacy/pricing mix.' },
    ],
  },
  {
    bucket: 'ruled-out',
    label: 'Ruled out',
    glyph: '✕',
    color: '#71717a',
    description: 'We looked at this and said no.',
    items: [
      { title: 'Cryptocurrency or tradable token', body: 'kT credits are internal accounting, not tradable. No ICO, no airdrop. Cash redemption, when it exists, is plain USD.' },
      { title: 'Game-server hosting', body: 'Residential ISP conditions kill SLA economics; publishers are hostile to player-run infra. Not our game.' },
      { title: 'Competing on frontier-model quality', body: 'We route to OpenAI/Anthropic; we don\'t try to beat their best.' },
    ],
  },
];

function RoadmapPage() {
  // local vote state only
  const [votes, setVotes] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('il_votes') || '{}'); } catch { return {}; }
  });
  const toggleVote = (key) => setVotes((v) => {
    const next = { ...v, [key]: v[key] ? 0 : 1 };
    try { localStorage.setItem('il_votes', JSON.stringify(next)); } catch {}
    return next;
  });

  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 32 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <span className="eyebrow fade-up">Roadmap</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
            Public, honest, <span className="serif">and</span> updated as we ship.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ maxWidth: 640 }}>
            Nothing here is a promise — it's what we're working on and in what order. If something matters to you, vote it up, open a discussion, or send us a PR.
          </p>
          <div className="rm-legend fade-up fade-up-d3">
            {ROADMAP_DATA.map((b) => (
              <span key={b.bucket} className="rm-legend-pill" style={{ '--c': b.color }}>
                <span className="rm-legend-glyph">{b.glyph}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 1040 }}>
          {ROADMAP_DATA.map((bucket) => (
            <div key={bucket.bucket} className="rm-bucket fade-up" style={{ '--c': bucket.color }}>
              <div className="rm-bucket-head">
                <span className={'rm-bucket-badge' + (bucket.bucket === 'building' ? ' pulse' : '')}>
                  <span className="rm-bucket-glyph">{bucket.glyph}</span>
                  {bucket.label}
                </span>
                <span className="rm-bucket-desc">{bucket.description}</span>
                <span className="rm-bucket-count">{bucket.items.length} items</span>
              </div>
              <div className="rm-grid">
                {bucket.items.map((it, i) => {
                  const key = `${bucket.bucket}-${i}`;
                  const voted = !!votes[key];
                  return (
                    <div key={key} className="rm-card">
                      <div className="rm-card-body">
                        <h4>{it.title}</h4>
                        <p>{it.body}</p>
                      </div>
                      <button
                        className={'rm-vote' + (voted ? ' on' : '')}
                        onClick={() => toggleVote(key)}
                        aria-pressed={voted}
                      >
                        <span>👍</span>
                        <span className="rm-vote-n">{(7 + (i * 3)) + (voted ? 1 : 0)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40, paddingBottom: 100 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <div className="glass rm-influence">
            <h2 className="h2">How to influence this roadmap</h2>
            <ol className="rm-steps">
              <li><strong>Open a discussion.</strong> #roadmap-requests on Discord, or a GitHub issue tagged roadmap-suggestion. Describe the problem, not the solution.</li>
              <li><strong>Vote.</strong> 👍 items you want. We review top-voted items in the monthly community call.</li>
              <li><strong>Join the Community Council</strong> (month 2+). Top 5 merged-code contributors or transparency-report reviewers rotate in quarterly.</li>
              <li><strong>Contribute code.</strong> Pick a help-wanted issue, submit a PR. See CONTRIBUTING.md.</li>
            </ol>
            <div className="rm-cta-row">
              <a href="https://discord.gg/" className="btn btn-primary btn-small">Join Discord</a>
              <a href="https://github.com/" className="btn btn-ghost btn-small">GitHub</a>
              <a href="#community" className="btn btn-ghost btn-small">Community</a>
            </div>
            <div className="rm-updated">Last updated: 2026-04-22</div>
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { RoadmapPage });
