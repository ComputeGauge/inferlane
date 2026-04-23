function HomeHero() {
  const [hwId, setHwId] = React.useState('m4mini');
  const [hours, setHours] = React.useState(14);
  const hw = HARDWARE.find(h => h.id === hwId);
  const monthly = Math.round(hw.kt * (hours / 14));
  const animated = useCount(monthly, 1200);
  const sliderPct = ((hours - 1) / 23) * 100;

  return (
    <section className="hero">
      <Aurora variant="amber" intensity={1} />
      <div className="wrap hero-grid">
        <div className="hero-left">
          <span className="eyebrow fade-up">Open beta · be one of the first 100</span>
          <h1 className="h-display fade-up fade-up-d1">
            Share what you've got.<br/>
            <span className="serif">Use</span> what others share.
          </h1>
          <p className="lede fade-up fade-up-d2">
            InferLane is community-owned AI inference. Install a small helper
            app — what engineers call a <em>daemon</em> — and your idle Mac or
            GPU serves requests for others on the network. You earn credits
            while you sleep, which you can spend on inference from the network.
          </p>
          <div className="hero-cta-row fade-up fade-up-d3">
            <a href="#install" className="btn btn-primary">
              Install The Daemon
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <a href="#how" className="btn btn-ghost">See How It Works</a>
          </div>

          <div className="three-door fade-up fade-up-d3">
            <a href="#install" className="door-chip"><span className="num">1</span><span>Install &amp; Use</span></a>
            <a href="#run-a-node" className="door-chip"><span className="num">2</span><span>Run A Node</span></a>
            <a href="#marketplace" className="door-chip"><span className="num">3</span><span>Build On Top</span></a>
          </div>

          <div className="hero-meta fade-up fade-up-d4">
            <div className="hero-meta-item"><span className="k">Network status</span><span className="v">Open beta</span></div>
            <div className="hero-meta-item"><span className="k">Founding operators</span><span className="v">Be first</span></div>
            <div className="hero-meta-item"><span className="k">Pathway</span><span className="v">Credits only</span></div>
          </div>
        </div>

        <div className="earn-card fade-up fade-up-d2">
          <div className="label">
            <span className="live-dot" />Estimate only
            <span className="kt-hint"
              title="kT = kilo-tokens. Our internal credit unit — 1 kT is earned per ~1,000 tokens of inference you serve. Spendable on inference today; cash redemption is not offered."
            >?</span>
          </div>
          <div className="earn-big">
            <span>{formatKT(Math.round(animated))}</span>
            <span className="per">/month *</span>
          </div>
          <div className="earn-sub">Rough estimate at {hours} hr/day · {hw.name}. Credits spend on inference from the network. <em>Credits only — no cash conversion.</em></div>
          <div className="earn-approx">Approximate values at estimated network demand. Real earnings depend on how often the coordinator routes to you.</div>

          <div className="earn-divider" />

          <div className="earn-ctrl">
            <div className="row">
              <span className="name">Hours online per day</span>
              <span className="val">{hours} hr</span>
            </div>
            <input
              type="range" min="1" max="24" step="1"
              value={hours}
              onChange={(e) => setHours(+e.target.value)}
              className="slider"
              style={{ '--p': sliderPct + '%' }}
              aria-label="hours per day"
            />
          </div>

          <div className="earn-ctrl">
            <div className="row">
              <span className="name">Your hardware</span>
              <span className="val">{hw.ram}</span>
            </div>
            <div className="hw-pick">
              {HARDWARE.map((h) => (
                <button
                  key={h.id}
                  className={'hw-chip' + (h.id === hwId ? ' active' : '')}
                  onClick={() => setHwId(h.id)}
                >
                  {h.name}
                  <span className="sub">{h.ram}</span>
                </button>
              ))}
            </div>
          </div>

          <a href="#install" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            Install The Daemon
          </a>
          <p className="earn-footnote">
            * Estimate only. kT = "kilo-tokens" — our internal credit unit.
            Serving ~1,000 tokens of inference earns 1 kT. Credits are
            spendable on inference on the network; they do not convert
            to cash.
          </p>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HomeHero });
