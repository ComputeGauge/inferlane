/* Run-a-node page — unit economics, hardware picker, operator-agreement summary */

function RunANodePage() {
  const [hwId, setHwId] = React.useState('m4mini');
  const [electricityRate, setElectricityRate] = React.useState(0.18); // USD / kWh
  const [hours, setHours] = React.useState(14);
  const hw = HARDWARE.find(h => h.id === hwId);

  // rough math: kT is proportional to hours; electricity = watts * hours * rate / 1000 * 30
  const kt = Math.round(hw.kt * (hours / 14));
  const tokensPerMonth = kt * 1000; // kT already × 1000 elsewhere; treat kT as tokens-in-thousands for display
  const elec = hw.watts * hours * electricityRate * 30 / 1000;
  const ktValueUSD = kt * 0.001; // nominal service-equivalent; no cash conversion
  const netWhenCash = Math.max(0, ktValueUSD * 0.9 - elec);

  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 40 }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <a href="#install" className="eyebrow eyebrow-link fade-up" style={{ marginBottom: 28, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Run A Node
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(44px, 6vw, 72px)', marginTop: 0 }}>
            Your idle Mac mini <span className="serif">is</span> a contribution waiting to happen.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ maxWidth: 620 }}>
            Install a signed daemon. Serve requests the coordinator routes to you. Earn kT credits — redeemable for inference on the network. Credits only; no cash conversion. Leave with one command whenever you want.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 10 }}>
        <div className="wrap" style={{ maxWidth: 1060 }}>
          <div className="ran-calc fade-up">
            <div className="ran-calc-left">
              <h3 className="h3" style={{ margin: 0 }}>Anticipated unit economics.<sup style={{ color: '#f59e0b', fontSize: 14, marginLeft: 3 }}>*</sup></h3>
              <p style={{ color: 'var(--fg-dim)', fontSize: 14, margin: '8px 0 22px', lineHeight: 1.6 }}>
                Rough estimates at anticipated network demand. Real numbers vary with your region, your model residency, and the luck of the request queue.
              </p>

              <div className="ran-picker" role="radiogroup" aria-label="Hardware class">
                {HARDWARE.map((h) => (
                  <button
                    key={h.id}
                    role="radio"
                    aria-checked={hwId === h.id}
                    className={'ran-pick' + (hwId === h.id ? ' on' : '')}
                    onClick={() => setHwId(h.id)}
                  >
                    <div className="ran-pick-top">{h.name}</div>
                    <div className="ran-pick-bot">{h.ram} · {h.req} tok/s · {h.watts}W</div>
                  </button>
                ))}
              </div>

              <div className="ran-sliders">
                <div className="ran-slider">
                  <div className="ran-slider-head">
                    <label htmlFor="ran-hours">Hours active / day</label>
                    <span>{hours}h</span>
                  </div>
                  <input id="ran-hours" type="range" min="1" max="24" value={hours} onChange={(e) => setHours(+e.target.value)} />
                </div>
                <div className="ran-slider">
                  <div className="ran-slider-head">
                    <label htmlFor="ran-elec">Electricity (USD / kWh)</label>
                    <span>${electricityRate.toFixed(2)}</span>
                  </div>
                  <input id="ran-elec" type="range" min="0.05" max="0.55" step="0.01" value={electricityRate} onChange={(e) => setElectricityRate(+e.target.value)} />
                </div>
              </div>
            </div>

            <div className="ran-calc-right">
              <div className="ran-big">
                <div className="ran-big-label">
                  Credits earned / month
                  <span className="kt-hint"
                    title="kT = kilo-tokens. Our internal credit unit. 1 kT ≈ 1,000 tokens of served inference. 38k kT ≈ 38 million tokens served that month."
                  >?</span>
                </div>
                <div className="ran-big-v">{formatKT(kt)}</div>
                <div className="ran-big-sub">≈ {(tokensPerMonth / 1_000_000).toFixed(1)}M Llama-70B-equivalent tokens served</div>
                <div className="kt-define">
                  <strong>kT</strong> = <em>kilo-tokens</em>. Internal credit unit; 1 kT is earned per ~1,000 tokens of inference you serve. Spendable on inference today; cash-redemption is planned.
                </div>
                <div className="ran-approx">Approximate values at estimated network demand. Real earnings depend on how often the coordinator routes to you.</div>
              </div>
              <div className="ran-lines">
                <div className="ran-line"><span>Credit value (nominal)</span><span>${ktValueUSD.toFixed(2)}</span></div>
                <div className="ran-line"><span>Electricity cost</span><span>− ${elec.toFixed(2)}</span></div>
                <div className="ran-line"><span>Platform fee (10%)</span><span>− ${(ktValueUSD * 0.1).toFixed(2)}</span></div>
                <div className="ran-line ran-line-tot">
                  <span>Credits redeemable for inference on the network <em>— no cash conversion</em></span>
                  <span>${netWhenCash.toFixed(2)}</span>
                </div>
              </div>
              <p className="ran-caveat">
                Credits turn on day one. Cash payouts are not offered; there is no timeline and no commitment to introduce them. You earn the same kT either way — credits redeem for inference on the network; they do not convert to cash.
              </p>
              <p className="ran-caveat" style={{ marginTop: 10, fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.55, opacity: 0.7 }}>
                <strong style={{ color: '#f59e0b' }}>*</strong> Anticipated figures, not guaranteed earnings. Illustrative only — not financial advice, not an investment, not a securities offering, not a financial product. kT credits are a service unit redeemable for inference on the network; they are not currency, not a security, and not a claim on InferLane revenue. Cash redemption is planned but not yet live and may never go live. Your actual earnings depend on hardware, uptime, electricity cost, regional demand, platform fees and moderation outcomes, and may be zero. No guarantee, express or implied, is made as to future earnings, payout timing, or credit value.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 1060 }}>
          <div className="ran-summary fade-up">
            <div>
              <span className="eyebrow">One-page summary</span>
              <h2 className="h2" style={{ marginTop: 6 }}>Operator Agreement, in plain English.</h2>
            </div>
            <ol className="ran-agree">
              <li><strong>You are an independent contractor.</strong> You run a daemon on your hardware. You pay your own taxes. You comply with your own local law.</li>
              <li><strong>You run only the signed daemon.</strong> Hashes are public at <code>releases.inferlane.dev</code>. Modified binaries void the agreement and forfeit pending credits.</li>
              <li><strong>You do not log prompts or responses.</strong> Beyond RAM lifetime. No sampling, no disk writes, no model-context retention across requests.</li>
              <li><strong>You do not veto requests.</strong> The coordinator's moderation gate is the single content policy surface. If we routed it to you, it passed the gate.</li>
              <li><strong>You indemnify InferLane</strong> for your conduct, your modifications, and your local-law violations. InferLane does not indemnify operators — but we do run the moderation gate, publish the AUP, and handle abuse reports so you don't have to.</li>
              <li><strong>You can leave any time.</strong> Run <code>inferlane daemon stop</code> and you're out. Credits within the last 30 days settle on the normal schedule.</li>
            </ol>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <a href="#operator-agreement" className="btn btn-ghost btn-small">Read The Full Operator Agreement →</a>
              <a href="#aup" className="btn btn-ghost btn-small">Read The AUP →</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBottom: 100 }}>
        <div className="wrap" style={{ maxWidth: 1060 }}>
          <div className="ran-cta fade-up">
            <div>
              <h3 className="h3" style={{ margin: 0 }}>Ready when you are.</h3>
              <p style={{ color: 'var(--fg-dim)', fontSize: 15, margin: '8px 0 0', maxWidth: 520 }}>
                One command gets the daemon on your machine. Takes about 40 seconds. You can uninstall with one more.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="#install" className="btn btn-primary">Install The Daemon</a>
              <a href="#community-discord" className="btn btn-ghost">Join #new-operators</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { RunANodePage });
