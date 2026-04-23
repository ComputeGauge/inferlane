function EarnPage() {
  const [hwId, setHwId] = React.useState('m4mini');
  const [hours, setHours] = React.useState(12);
  const hw = HARDWARE.find(h => h.id === hwId);
  const gross = hw.perMonth * (hours / 10);
  const platform = gross * 0.1;
  const net = gross - platform;
  const animated = useCount(net, 1000);
  const sliderPct = ((hours - 1) / 23) * 100;

  return (
    <>
      <section className="hero" style={{ paddingBottom: 40 }}>
        <Aurora variant="amber" />
        <div className="wrap" style={{ position: 'relative', zIndex: 2, textAlign: 'center', paddingBottom: 20 }}>
          <span className="eyebrow fade-up">Earn · side income</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ margin: '18px auto 20px', maxWidth: 900 }}>
            Turn your rig into a <span className="serif">little power station.</span>
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ margin: '0 auto 28px' }}>
            It&apos;s simpler than it sounds. You install the daemon. It serves inference requests when the network needs them. You earn kT credits — redeemable for inference on the network. The Service operates in a credits-only mode; credits do not convert to cash. That&apos;s the whole thing.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="calc-deep">
            <div className="glass glass-amber" style={{ padding: 36 }}>
              <div className="label" style={{ fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 14 }}>Your estimated monthly earnings</div>
              <div className="earn-big" style={{ marginBottom: 8 }}>
                <span className="cur">$</span>
                <span>{Math.round(animated).toLocaleString()}</span>
                <span className="per">/month</span>
              </div>
              <div className="earn-sub">= {hours} hr/day × {hw.name} × 90% share</div>

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
                />
              </div>

              <div className="earn-ctrl" style={{ marginTop: 20 }}>
                <div className="row">
                  <span className="name">Pick your hardware</span>
                  <span className="val">{hw.ram}</span>
                </div>
                <div className="hw-pick">
                  {HARDWARE.map((h) => (
                    <button
                      key={h.id}
                      className={'hw-chip' + (h.id === hwId ? ' active' : '')}
                      onClick={() => setHwId(h.id)}
                    >
                      {h.name}<span className="sub">{h.ram}</span>
                    </button>
                  ))}
                </div>
              </div>

              <a href="#install" className="btn btn-primary" style={{ width: '100%', marginTop: 28 }}>
                Install The Daemon
              </a>
            </div>

            <div className="receipt-card">
              <div className="top-row">
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontWeight: 600 }}>InferLane</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginTop: 2 }}>Monthly statement</div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg-muted)' }}>est. Apr 2026</div>
              </div>
              <div className="line emph"><span>Hardware</span><span>{hw.name}</span></div>
              <div className="line"><span>Memory</span><span>{hw.ram}</span></div>
              <div className="line"><span>Requests served</span><span>{(hw.req * hours * 30).toLocaleString()}</span></div>
              <div className="line"><span>Gross earnings</span><span>${Math.round(gross).toLocaleString()}</span></div>
              <div className="line" style={{ color: 'var(--fg-muted)' }}><span>Platform fee (10%)</span><span>− ${Math.round(platform).toLocaleString()}</span></div>
              <div className="total">
                <div>
                  <div className="k">Net payout</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>paid via Stripe Connect</div>
                </div>
                <div className="v">${Math.round(net).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-header">
            <span className="eyebrow">What to expect</span>
            <h2 className="h2">A month in the life of an operator.</h2>
          </div>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="timeline">
              <div className="timeline-step">
                <h4>Day 0 · Install & verify</h4>
                <p>Download the signed macOS app. It runs through a quick hardware benchmark so the router knows which models you can serve. Sits in your menu bar.</p>
              </div>
              <div className="timeline-step">
                <h4>Day 1 · First requests</h4>
                <p>As soon as your tier onboarding clears (usually a few hours), requests start flowing. You'll see a little counter tick in the menu bar.</p>
              </div>
              <div className="timeline-step">
                <h4>Day 7 · First real picture</h4>
                <p>By week one you'll have a clean average. The dashboard shows earnings by day, by model, by tier. No guessing.</p>
              </div>
              <div className="timeline-step">
                <h4>Day 30 · Your credits are yours</h4>
                <p>kT credits you&apos;ve earned are visible in the dashboard and redeemable for inference on the network. The Service operates in a credits-only mode — credits do not convert to cash. If a cash pathway is ever introduced, participation will require separate opt-in and identity verification; existing credits will not be converted.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <WaitlistPanel />
        </div>
      </section>
    </>
  );
}

Object.assign(window, { EarnPage });
