/* Marketplace page — six tier cards + attribution rules + operator-modded-dashboard teaser */

const MP_TIERS = [
  {
    name: 'UI Widget', risk: 'low', riskC: '#10b981',
    desc: 'React component rendered in iframe on the dashboard. Pure client-side, postMessage API only. No server or backend access.',
    gate: 'Core team review + published to @inferlane-community/* npm scope.',
    reward: '40% of MRR from users who activated the widget in the prior 30 days. Last-touch attribution, 30-day clawback on churn.',
    phase: 'V1 · Month 2-3',
    c: '#f59e0b',
  },
  {
    name: 'Routing Policy', risk: 'very low', riskC: '#22c55e',
    desc: 'Declarative JSON rules ("route Haiku for task X under $Y"). Data, not code. Runs through our safe evaluator.',
    gate: 'Lint + schema validation — no human review.',
    reward: 'kT bonus per 1k adoptions.',
    phase: 'V1 · Month 2-3',
    c: '#f59e0b',
  },
  {
    name: 'Dashboard Theme', risk: 'very low', riskC: '#22c55e',
    desc: 'CSS variables + token set. Visual only, no logic. Bring your brand palette to the fuel gauge.',
    gate: 'Lint + visual review.',
    reward: 'kT bonus + theme-creator badge.',
    phase: 'V1 · Month 2-3',
    c: '#f59e0b',
  },
  {
    name: 'Integration Recipe', risk: 'low', riskC: '#10b981',
    desc: 'Pre-baked config for Slack / Linear / Discord / Notion webhook alerts. "When spend crosses 80%, ping #eng."',
    gate: 'Core team review.',
    reward: '30% of recipe-driven conversions (e.g. user installs Slack recipe and upgrades to MCP Pro).',
    phase: 'V2 · Month 4-6',
    c: '#a78bfa',
  },
  {
    name: 'Provider Adapter', risk: 'medium', riskC: '#f59e0b',
    desc: 'New LLM backend route (e.g. Cerebras, Mistral Hosted, SambaNova, local Ollama pools).',
    gate: 'Full PR review, merged into main product.',
    reward: '50,000 kT merged + negotiated revenue share for commercial adapters.',
    phase: 'V2 · Month 4-6',
    c: '#a78bfa',
  },
  {
    name: 'Daemon Plugin', risk: 'high', riskC: '#ef4444',
    desc: 'Operator-side logic: custom benchmarks, fleet coordination, regional routing, experimental quantisation handlers.',
    gate: 'PR-only, full code audit, signed releases, security review.',
    reward: '150,000 kT merged + negotiated revshare for commercial plugins.',
    phase: 'V3 · Month 6+',
    c: '#06b6d4',
  },
];

function MarketplacePage() {
  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 30 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <span className="eyebrow fade-up">Marketplace</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
            Build what the network runs.<br/>
            <span className="serif">Earn</span> when people use it.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ maxWidth: 640 }}>
            Six tiers, security-gated from trivial to full-code-audit. Pure UI components launch first; daemon plugins much later once we can audit every line.
          </p>
          <div className="fade-up fade-up-d3" style={{ maxWidth: 720 }}>
            <ComingSoonBanner>
              <strong>Coming soon.</strong> Launching in phases from month 2-3. Join the Discord for beta invites and to shape the first wave of tiers.
            </ComingSoonBanner>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 1120 }}>
          <div className="mp-grid">
            {MP_TIERS.map((t) => (
              <div key={t.name} className="mp-card fade-up" style={{ '--c': t.c, '--rc': t.riskC }}>
                <div className="mp-card-top">
                  <div>
                    <h3>{t.name}</h3>
                    <span className="mp-risk">risk: <strong>{t.risk}</strong></span>
                  </div>
                  <span className="mp-phase">{t.phase}</span>
                </div>
                <p className="mp-desc">{t.desc}</p>
                <div className="mp-split">
                  <div className="mp-split-col">
                    <div className="mp-split-label">Review gate</div>
                    <div className="mp-split-body">{t.gate}</div>
                  </div>
                  <div className="mp-split-col">
                    <div className="mp-split-label">Reward</div>
                    <div className="mp-split-body">{t.reward}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div className="glass mp-attr fade-up">
            <div className="mp-attr-head">
              <span className="eyebrow">Attribution rules</span>
              <h2 className="h2" style={{ marginTop: 6 }}>We wrote this down so you don't have to ask.</h2>
              <p style={{ color: 'var(--fg-dim)', fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
                Marketplace revenue splits work only if attribution is boring and predictable. Here's exactly how we count.
              </p>
            </div>
            <ul className="mp-attr-list">
              {[
                ['Server-side logging', 'Install events are logged server-side, not trusted from the client. No shadowing a competitor\'s widget.'],
                ['30-day last-touch', 'Attribution runs on a 30-day last-touch window. The last contributor to convert a user gets the credit.'],
                ['Churn clawback', 'If a user churns within 30 days, the attributed revenue is refunded to the platform.'],
                ['15% creator cap', 'No single creator receives more than 15% of total marketplace revenue in a period. Concentration risk goes down, not up.'],
                ['Verified identity', 'GitHub OAuth or Stripe Connect ID required before revenue-share is credited. No sock-puppet creators.'],
              ].map(([h, b]) => (
                <li key={h}><strong>{h}.</strong> {b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40, paddingBottom: 100 }}>
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div className="mp-modded fade-up">
            <div className="mp-modded-badge">V2+ teaser</div>
            <h2 className="h2" style={{ color: '#fff', marginBottom: 10 }}>Operator-modded dashboards.</h2>
            <p className="lede" style={{ fontSize: 16, maxWidth: 680, margin: 0, color: 'rgba(255,255,255,0.82)' }}>
              Top operators get a customisable public dashboard — logo, theme, featured widgets, bio, benchmark board. Consumers visiting an operator's branded page get <em>affinity-routed</em> to that operator's node when hardware and model requirements match.
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', marginTop: 14, maxWidth: 680, lineHeight: 1.6 }}>
              Operators can strike independent affiliate deals with widget creators via the marketplace; we facilitate attribution and payment splits on-platform. Inspired by Roblox experiences + Twitch affiliate programmes. Operator dashboards render from a sandboxed subset of the marketplace components — no arbitrary HTML or JS injection. Target: V2 post-marketplace launch (month 4-6).
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <a href="#community-discord" className="btn btn-primary btn-small">Join Discord For Beta Invites</a>
              <a href="#roadmap" className="btn btn-ghost btn-small">Full Roadmap</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { MarketplacePage });
