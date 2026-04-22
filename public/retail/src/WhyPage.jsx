function WhyPage() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 40 }}>
        <Aurora variant="purple" />
        <div className="wrap" style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 920, margin: '0 auto' }}>
          <span className="eyebrow fade-up">Why InferLane</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ margin: '18px auto 20px' }}>
            The spare silicon <span className="serif">was the opportunity.</span>
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ margin: '0 auto' }}>
            We didn't want to build another cloud. We wanted the machines people already own to stop being idle — and pay their owners for the hours they already keep them on.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 60 }}>
        <div className="wrap-narrow">
          <div className="glass fade-up" style={{ padding: 44, marginBottom: 24 }}>
            <h2 className="h2" style={{ marginBottom: 14 }}>The world already has the hardware.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              There are hundreds of millions of Apple Silicon devices and gamer rigs idling overnight. A studio we spoke to had six M1 Maxes sitting in a cupboard. An engineer we know has two H100s in a home lab. Meanwhile every AI company is paying top dollar for cloud GPUs during peak hours. This is a distribution problem disguised as a compute problem.
            </p>
          </div>

          <div className="glass fade-up fade-up-d1" style={{ padding: 44, marginBottom: 24 }}>
            <h2 className="h2" style={{ marginBottom: 14 }}>Cloud pricing doesn't work for agents.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              Agents — Claude Code, Cursor, your own autonomous systems — run <em>lots</em> of small requests. A hundred tool calls to answer one question. The cloud prices this like it's a single big workload, with an hourly GPU reservation. We route per-request to whichever operator has spare cycles <em>right now</em>. You pay for what you used; they earn for what they served.
            </p>
          </div>

          <div className="glass fade-up fade-up-d2" style={{ padding: 44, marginBottom: 24 }}>
            <h2 className="h2" style={{ marginBottom: 14 }}>The community is the moat.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              Centralised clouds compete on capex. We compete on the boring everyday fact that thousands of developers already own compute that sits idle most of the day. Credits-first means nobody is waiting on VC timelines to get paid for contributing — you earn the moment you serve a request, even before this pathway is ever offered.
            </p>
          </div>

          <div className="glass fade-up fade-up-d3" style={{ padding: 44 }}>
            <h2 className="h2" style={{ marginBottom: 14 }}>We say what we mean.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              Every privacy tier has a written threat model that a lawyer and a security engineer signed off on. If a request is "cheap inference on a stranger's RAM," we say that. If it's "sealed inside an H100 enclave that not even the operator can read," we say that. <em>We don't do 'military-grade encryption' in all caps.</em> Honesty was the brand before we had a brand.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="section">
        <div className="wrap">
          <div className="section-header">
            <span className="eyebrow">Who it's for</span>
            <h2 className="h2">Two sides of the same market.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }} className="who-grid">
            <div className="glass fade-up" style={{ padding: 40 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fbbf24', fontWeight: 600, marginBottom: 10 }}>For operators</div>
              <h3 style={{ fontSize: 24, fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Your rig wants a job.</h3>
              <p style={{ color: 'var(--fg-dim)', fontSize: 15, marginBottom: 20 }}>
                You already own the hardware. You already leave it on. We're the polite way to put those idle hours to work without the electricity sink of cryptocurrency.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Signed, notarised daemon', '90% revenue share (when this pathway is ever offered)', 'Credits now; cash via Stripe when MRR justifies', 'Moderation gate at the coordinator — we filter before routing'].map((x) => (
                  <li key={x} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--fg-dim)', fontSize: 14 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" fill="#10b98122" /><path d="M8 12l3 3 5-6" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {x}
                  </li>
                ))}
              </ul>
              <a href="#run-a-node" className="btn btn-primary" style={{ marginTop: 24 }}>Run A Node</a>
            </div>

            <div className="glass fade-up fade-up-d1" style={{ padding: 40 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#06b6d4', fontWeight: 600, marginBottom: 10 }}>For consumers</div>
              <h3 style={{ fontSize: 24, fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Inference that doesn't spy on you.</h3>
              <p style={{ color: 'var(--fg-dim)', fontSize: 15, marginBottom: 20 }}>
                Bring your own agent. MCP-compatible with Claude Code, Cursor, your own tools. Tier per request — Tier 2 keeps it local; Tier 1 seals it in hardware; Tier 0 saves money when it doesn't matter.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Honest threat model per tier', 'No logs of prompt content, ever', 'Pay only what you used — per request', 'Free while you run the local fuel gauge'].map((x) => (
                  <li key={x} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--fg-dim)', fontSize: 14 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" fill="#06b6d422" /><path d="M8 12l3 3 5-6" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {x}
                  </li>
                ))}
              </ul>
              <a href="#install" className="btn btn-ghost" style={{ marginTop: 24 }}>Install The MCP Plugin</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap"><WaitlistPanel /></div>
      </section>
    </>
  );
}

Object.assign(window, { WhyPage });
