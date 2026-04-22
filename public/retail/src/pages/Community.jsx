/* Community page — three-door pillars, Discord, six tenets, link trio */

function CommunityPage() {
  const channels = [
    '#help-me-model', '#new-operators', '#benchmarks', '#roadmap-requests',
    '#contributing', '#report-abuse', '#announcements', '#off-topic',
  ];
  const tenets = [
    { t: 'Honest', d: 'We tell you what we\'ve shipped and what we haven\'t. The roadmap is public; the receipts are receipts.' },
    { t: 'Credit-first', d: 'Contributions earn kT immediately. Cash comes when MRR justifies it — not when VCs allow.' },
    { t: 'Community-owned', d: 'The Council advises the roadmap. Top contributors shape what we build next.' },
    { t: 'Safe by default', d: 'The coordinator moderates before routing. Operators don\'t decide what requests to serve.' },
    { t: 'Cross-platform', d: 'macOS, Linux, Windows — Apple Silicon, NVIDIA, CPU-only. Your hardware is welcome.' },
    { t: 'Privacy-respecting', d: 'We don\'t train on your traffic. We don\'t log prompt content on E2EE routes. The fuel gauge runs fully local.' },
  ];

  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 40 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <span className="eyebrow fade-up">Community</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
            Share what you've got.<br/>
            <span className="serif">Use</span> what others share.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ maxWidth: 640 }}>
            InferLane is what happens when a few hundred developers agree to pool their idle compute. Three ways in.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="cm-doors">
            {[
              { num: '01', title: "Share what you've got", href: '#run-a-node', cta: 'Run A Node',
                body: 'Run a node on your Mac mini, gaming rig, or spare GPU. Earn kT credits when others use your compute. Cash when payouts go live.', c: '#f59e0b' },
              { num: '02', title: 'Use what others share', href: '#install', cta: 'Install The Daemon',
                body: 'Route bulk inference through the peer network at a fraction of hosted-provider cost. Keep your frontier workloads on Claude / OpenAI / Gemini.', c: '#06b6d4' },
              { num: '03', title: 'Build on the platform', href: '#marketplace', cta: 'Open Marketplace',
                body: 'Widgets, dashboards, routing policies, provider adapters. Revenue share on adoption. 40% MRR for UI components; 50% for adapters.', c: '#a78bfa' },
            ].map((d) => (
              <a key={d.num} href={d.href} className="cm-door fade-up" style={{ '--c': d.c }}>
                <div className="cm-door-num">{d.num}</div>
                <h3 className="cm-door-title">{d.title}</h3>
                <p className="cm-door-body">{d.body}</p>
                <span className="cm-door-cta">
                  {d.cta}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="community-discord">
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div className="glass cm-discord fade-up">
            <div className="cm-discord-text">
              <span className="eyebrow">Discord</span>
              <h2 className="h2" style={{ marginTop: 6 }}>Where the real work happens.</h2>
              <p className="lede" style={{ fontSize: 16, maxWidth: 520 }}>
                A few hundred developers, operators, and contributors. No AI bots with anime avatars, no wen-token, no influencer grift. Just people building.
              </p>
              <div className="cm-chan-grid">
                {channels.map((c) => <span key={c} className="cm-chan">{c}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
                <a href="https://discord.gg/" className="btn btn-primary btn-small">Open Discord</a>
                <a href="#code-of-conduct" className="btn btn-ghost btn-small">Read The Code Of Conduct</a>
              </div>
            </div>
            <div className="cm-discord-stats">
              <div className="cm-dstat"><div className="n">312</div><div className="k">members</div></div>
              <div className="cm-dstat"><div className="n">8</div><div className="k">channels</div></div>
              <div className="cm-dstat"><div className="n">72h</div><div className="k">avg response</div></div>
              <div className="cm-dstat"><div className="n">0</div><div className="k">bots selling tokens</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="community-tenets">
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div style={{ marginBottom: 32 }}>
            <span className="eyebrow">Our tenets</span>
            <h2 className="h2" style={{ marginTop: 6 }}>What we commit to. What you can hold us to.</h2>
          </div>
          <div className="cm-tenets">
            {tenets.map((t, i) => (
              <div key={t.t} className="cm-tenet fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="cm-tenet-num">{String(i + 1).padStart(2, '0')}</div>
                <h4>{t.t}</h4>
                <p>{t.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBottom: 100 }}>
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div className="cm-trio">
            {[
              { href: '#roadmap', title: 'Roadmap', body: 'What we\'re shipping, what we\'re building, what we ruled out.', c: '#f59e0b' },
              { href: '#marketplace', title: 'Marketplace', body: 'Build widgets, policies, adapters. Earn on adoption.', c: '#a78bfa' },
              { href: '#transparency', title: 'Transparency', body: 'Live network stats. Moderation figures. Governance links.', c: '#10b981' },
            ].map((x) => (
              <a key={x.title} href={x.href} className="cm-trio-card fade-up" style={{ '--c': x.c }}>
                <h4>{x.title}</h4>
                <p>{x.body}</p>
                <span className="cm-trio-cta">Open <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { CommunityPage });
