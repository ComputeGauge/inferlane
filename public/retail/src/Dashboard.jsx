/* Dashboard — login → terms → compute-flow dashboard */

function useAuth() {
  const [state, setState] = React.useState(() => {
    try {
      const raw = localStorage.getItem('il_auth');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { signedIn: false, email: '', acceptedTerms: false };
  });
  React.useEffect(() => {
    try { localStorage.setItem('il_auth', JSON.stringify(state)); } catch(e){}
  }, [state]);
  return [state, setState];
}

function DashboardRoute() {
  const [auth, setAuth] = useAuth();
  if (!auth.signedIn) return <LoginGate onSignIn={(email) => setAuth({ ...auth, signedIn: true, email })} />;
  if (!auth.acceptedTerms) return <TermsGate email={auth.email} onAccept={() => setAuth({ ...auth, acceptedTerms: true })} onSignOut={() => setAuth({ signedIn: false, email: '', acceptedTerms: false })} />;
  return <ComputeFlowDashboard auth={auth} onSignOut={() => setAuth({ signedIn: false, email: '', acceptedTerms: false })} />;
}

function LoginGate({ onSignIn }) {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  function submit(e) {
    e.preventDefault();
    if (!email.includes('@')) return;
    setLoading(true);
    setTimeout(() => onSignIn(email), 700);
  }
  return (
    <section className="section" style={{ paddingTop: 80, minHeight: '70vh' }}>
      <Aurora variant="amber" intensity={0.5} />
      <div className="wrap" style={{ position: 'relative', zIndex: 2, maxWidth: 440, margin: '0 auto' }}>
        <div className="login-card fade-up">
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 12 }}>Dashboard</span>
          <h2 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Sign In</h2>
          <p style={{ color: 'var(--fg-muted)', fontSize: 14, margin: '0 0 22px' }}>We'll send a magic link. No password, no tracking.</p>
          <form onSubmit={submit}>
            <label className="gs-label">Email</label>
            <input
              className="gs-input" type="email" placeholder="you@domain.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              autoFocus required style={{ marginBottom: 14 }}
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !email} style={{ width: '100%' }}>
              {loading ? 'Sending Link…' : 'Continue →'}
            </button>
          </form>
          <div className="login-alt">
            <span>or</span>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 8 }} onClick={() => { setEmail('demo@inferlane.dev'); setTimeout(() => onSignIn('demo@inferlane.dev'), 300); }}>
            Continue With Google
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => { setEmail('demo@inferlane.dev'); setTimeout(() => onSignIn('demo@inferlane.dev'), 300); }}>
            Continue With GitHub
          </button>
          <p style={{ fontSize: 11, color: 'var(--fg-muted)', textAlign: 'center', marginTop: 18 }}>
            By continuing you agree to our <a href="#terms" style={{color:'var(--amber)'}}>Terms</a> and <a href="#privacy" style={{color:'var(--amber)'}}>Privacy</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

function TermsGate({ email, onAccept, onSignOut }) {
  const [checked, setChecked] = React.useState(false);
  const [aup, setAup] = React.useState(false);
  return (
    <section className="section" style={{ paddingTop: 60, minHeight: '70vh' }}>
      <div className="wrap" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="login-card fade-up">
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 12 }}>One-time consent</span>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Before we open your dashboard</h2>
          <p style={{ color: 'var(--fg-muted)', fontSize: 13, margin: '0 0 18px' }}>Signed in as <span className="mono" style={{color:'#fff'}}>{email}</span> — <button onClick={onSignOut} style={{color:'var(--amber)',background:'none',padding:0,fontSize:13}}>switch account</button></p>

          <div className="terms-summary">
            <h4>What you're agreeing to — in plain English</h4>
            <ul>
              <li><strong>We log metadata, never prompts.</strong> Timestamps, token counts, tier, latency. Not content.</li>
              <li><strong>Stripe handles payouts.</strong> You keep 90%. We never touch your funds.</li>
              <li><strong>You can leave at any time.</strong> Run <code>inferlane uninstall</code> and your machine is gone from the network.</li>
              <li><strong>Every request is moderated at the coordinator before dispatch.</strong> Operators are independent contractors — you serve only what we route, only what passed the gate.</li>
            </ul>
          </div>

          <label className="terms-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>I have read and accept the <a href="#terms" target="_blank" style={{color:'var(--amber)'}}>Terms of Service</a> and <a href="#privacy" target="_blank" style={{color:'var(--amber)'}}>Privacy Policy</a>.</span>
          </label>
          <label className="terms-check">
            <input type="checkbox" checked={aup} onChange={(e) => setAup(e.target.checked)} />
            <span>I agree to the <a href="#terms" target="_blank" style={{color:'var(--amber)'}}>Acceptable Use Policy</a>.</span>
          </label>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={!checked || !aup} onClick={onAccept}>
            Open Dashboard →
          </button>
        </div>
      </div>
    </section>
  );
}

function ComputeFlowDashboard({ auth, onSignOut }) {
  const reduced = usePrefersReducedMotion();

  // Live simulated counters
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, [reduced]);

  // Compute flowing metrics seeded by tick
  const active = 3 + (tick % 5);
  const reqsMin = 14 + ((tick * 3) % 9);
  const earnedToday = 7.40 + (tick * 0.011);
  const queued = (tick % 3) === 0 ? 2 : 1;

  return (
    <section className="section dash-route" style={{ paddingTop: 32 }}>
      <div className="wrap">
        <div className="dash-hero fade-up">
          <div>
            <div className="pill" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: '#34d399' }}>
              <span className="dot pulse" style={{ background: '#22c55e' }} /> Operator online · op_demo_a4
            </div>
            <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 600, letterSpacing: '-0.025em', margin: '12px 0 6px' }}>
              Welcome Back.
            </h1>
            <p style={{ color: 'var(--fg-muted)', margin: 0 }}>
              <span className="mono" style={{color:'#fff'}}>{auth.email}</span> · your rig has been serving for 14 days
            </p>
          </div>
          <div className="dash-hero-right">
            <button className="btn btn-ghost btn-small" onClick={onSignOut}>Sign Out</button>
          </div>
        </div>

        {/* KPI row */}
        <div className="dash-kpis" style={{ marginTop: 24 }}>
          <div className="kpi"><div className="k">Earned Today</div><div className="v">{(earnedToday * 40).toFixed(0)} kT</div><div className="d up">live</div></div>
          <div className="kpi"><div className="k">This Month</div><div className="v">9,883 kT</div><div className="d up">+12%</div></div>
          <div className="kpi"><div className="k">Active Requests</div><div className="v">{active}</div><div className="d">serving now</div></div>
          <div className="kpi"><div className="k">Median latency</div><div className="v">{38 + (tick % 7)}ms</div><div className="d">p50</div></div>
        </div>

        {/* Compute flow visual */}
        <div className="flow-card fade-up">
          <div className="flow-head">
            <div>
              <div className="flow-title">Current Compute Flow</div>
              <div className="flow-sub">Live requests moving through your rig, right now.</div>
            </div>
            <div className="flow-meta">
              <span className="mono" style={{color:'#fff'}}>{reqsMin}</span>
              <span> req/min</span>
              <span className="dot pulse" style={{ background: '#f59e0b', marginLeft: 10 }} />
            </div>
          </div>
          <ComputeFlowSVG tick={tick} reduced={reduced} active={active} queued={queued} />
          <div className="flow-legend">
            <div><span className="sw" style={{background:'#8b5cf6'}}/>Incoming request</div>
            <div><span className="sw" style={{background:'#f59e0b'}}/>Your GPU / Neural Engine</div>
            <div><span className="sw" style={{background:'#10b981'}}/>Streaming response</div>
            <div><span className="sw" style={{background:'#06b6d4'}}/>Settled to Stripe</div>
          </div>
        </div>

        {/* Two-col: model load + recent */}
        <div className="dash-split">
          <div className="flow-card">
            <div className="flow-head">
              <div>
                <div className="flow-title">Model Residency</div>
                <div className="flow-sub">Which weights are hot in your RAM.</div>
              </div>
            </div>
            <div className="model-rows">
              {[
                { name: 'gemma-2-9b-q4', size: '4.2GB', load: 78, color: '#f59e0b' },
                { name: 'llama-3.1-8b',  size: '4.8GB', load: 62, color: '#10b981' },
                { name: 'qwen-2.5-7b',   size: '4.1GB', load: 34, color: '#06b6d4' },
                { name: 'mistral-7b',    size: '3.9GB', load: 18, color: '#8b5cf6' },
              ].map((m) => (
                <div key={m.name} className="model-row">
                  <div className="mr-head">
                    <span className="mr-name">{m.name}</span>
                    <span className="mr-size mono">{m.size}</span>
                  </div>
                  <div className="mr-bar">
                    <div className="mr-fill" style={{ width: m.load + '%', background: `linear-gradient(90deg, ${m.color}66, ${m.color})` }} />
                  </div>
                  <div className="mr-foot mono">{m.load}% util</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flow-card">
            <div className="flow-head">
              <div>
                <div className="flow-title">Credits (7-day)</div>
                <div className="flow-sub">kT earned per hour</div>
              </div>
            </div>
            <EarningsChart reduced={reduced} />
            <div className="ledger-foot">
              <div><span>Best hour</span><span className="mono">167 kT · 22:00 AEDT</span></div>
              <div><span>Payout in</span><span className="mono">11 days</span></div>
              <div><span>Next payout</span><span className="mono">9,883 kT</span></div>
            </div>
          </div>
        </div>

        {/* Live request ticker */}
        <div className="flow-card">
          <div className="flow-head">
            <div>
              <div className="flow-title">Live Request Stream</div>
              <div className="flow-sub">The last 30 seconds, moderated and attested.</div>
            </div>
            <div className="flow-meta"><span className="dot pulse" style={{background:'#22c55e'}}/> streaming</div>
          </div>
          <LiveTicker tick={tick} reduced={reduced} />
        </div>
      </div>
    </section>
  );
}

function ComputeFlowSVG({ tick, reduced, active, queued }) {
  // 5 lanes: client → coordinator → you → response → settled
  return (
    <div className="compute-flow">
      <svg viewBox="0 0 900 236" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="cf-pipe" x1="0" x2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4"/>
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4"/>
          </linearGradient>
          <filter id="cf-glow"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>

        {/* Pipe */}
        <rect x="80" y="98" width="740" height="24" rx="12" fill="#0a0a12" stroke="url(#cf-pipe)" strokeWidth="1"/>

        {/* Nodes */}
        {[
          { x: 80,  label: 'Client SDK', sub: 'agent', color: '#8b5cf6' },
          { x: 265, label: 'Coordinator', sub: 'routes + attests', color: '#8b5cf6' },
          { x: 450, label: 'Your rig', sub: 'op_demo_a4', color: '#f59e0b', hero: true },
          { x: 635, label: 'Response', sub: 'streaming', color: '#10b981' },
          { x: 820, label: 'Settled', sub: 'Stripe', color: '#06b6d4' },
        ].map((n, i) => (
          <g key={i}>
            {n.hero && (
              <circle cx={n.x} cy="110" r="38" fill={n.color} fillOpacity="0.08" stroke={n.color} strokeOpacity="0.3">
                {!reduced && <animate attributeName="r" values="38;44;38" dur="3s" repeatCount="indefinite"/>}
              </circle>
            )}
            <circle cx={n.x} cy="110" r={n.hero ? 26 : 20} fill="#14141e" stroke={n.color} strokeWidth={n.hero ? 2 : 1.5}/>
            {n.hero && (
              <g transform={`translate(${n.x - 12}, ${98})`}>
                <rect width="24" height="24" rx="4" fill="none" stroke={n.color} strokeWidth="1.5"/>
                <rect x="5" y="5" width="14" height="14" rx="1" fill={n.color} fillOpacity="0.35"/>
                <circle cx="12" cy="12" r="3" fill={n.color}/>
              </g>
            )}
            {!n.hero && (
              <circle cx={n.x} cy="110" r="5" fill={n.color} fillOpacity="0.8">
                {!reduced && <animate attributeName="r" values="4;6;4" dur="2s" begin={`${i*0.3}s`} repeatCount="indefinite"/>}
              </circle>
            )}
            <text x={n.x} y="168" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="12" fontWeight="600" fill="#fff">{n.label}</text>
            <text x={n.x} y="184" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill={n.color}>{n.sub}</text>
          </g>
        ))}

        {/* Flowing packets */}
        {!reduced && Array.from({ length: 4 }).map((_, i) => (
          <g key={i}>
            <circle r="5" fill="#f59e0b" filter="url(#cf-glow)">
              <animateMotion
                path="M 80 110 L 820 110"
                dur={`${4 + i * 0.5}s`}
                begin={`${i * 1.1}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle r="3" fill="#fff">
              <animateMotion
                path="M 80 110 L 820 110"
                dur={`${4 + i * 0.5}s`}
                begin={`${i * 1.1}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

        {/* Labels over nodes */}
        <text x="80"  y="70" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="#6b7280">t+0ms</text>
        <text x="265" y="70" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="#6b7280">t+8ms</text>
        <text x="450" y="70" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="#f59e0b">t+12ms</text>
        <text x="635" y="70" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="#6b7280">+180ms</text>
        <text x="820" y="70" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="#6b7280">batch</text>

        {/* Active count badge — sits in its own row under the op_demo_a4 sub-label */}
        <g transform="translate(376, 202)">
          <rect width="148" height="22" rx="11" fill="#0a0a12" stroke="#f59e0b" strokeOpacity="0.5"/>
          <circle cx="14" cy="11" r="3.2" fill="#22c55e"/>
          <text x="82" y="15" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill="#f59e0b">{active} active · {queued} queued</text>
        </g>
      </svg>
    </div>
  );
}

function EarningsChart({ reduced }) {
  const bars = React.useMemo(() => Array.from({length:7}, (_, i) => 28 + Math.sin(i*0.8)*10 + Math.random()*12 + i*2), []);
  const max = Math.max(...bars);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <div className="earn-bars">
      {bars.map((b, i) => (
        <div key={i} className="eb-col">
          <div className="eb-bar-area">
            <div className="eb-bar" style={{ '--h': (b/max*100) + '%', animationDelay: reduced ? '0s' : (i*0.08)+'s' }} />
          </div>
          <div className="eb-label">{days[i]}</div>
          <div className="eb-val mono">{(b * 40).toFixed(0)} kT</div>
        </div>
      ))}
    </div>
  );
}

function LiveTicker({ tick, reduced }) {
  const entries = React.useMemo(() => {
    const models = ['gemma-2-9b','llama-3.1-8b','qwen-2.5-7b','mistral-7b'];
    const tiers = ['T0','T0','T0','T0.5','T1'];
    return Array.from({length: 6}).map((_, i) => ({
      t: `09:41:${String(52 - i*4).padStart(2,'0')}`,
      model: models[i % models.length],
      tier: tiers[i % tiers.length],
      tokens: 200 + Math.round(Math.random()*1400),
      ms: 28 + Math.round(Math.random()*160),
      earned: (0.004 + Math.random()*0.09),
    }));
  }, [Math.floor(tick / 4)]);

  return (
    <div className="live-ticker">
      {entries.map((e, i) => (
        <div key={e.t + i} className={'lt-row' + (i === 0 ? ' lt-new' : '')}>
          <span className="lt-time mono">{e.t}</span>
          <span className="lt-model">{e.model}</span>
          <span className={'t-pill t-' + e.tier.replace('.','')}>{e.tier}</span>
          <span className="lt-tok mono">{e.tokens.toLocaleString()} tok</span>
          <span className="lt-ms mono">{e.ms}ms</span>
          <span className="lt-earn mono">+{(e.earned * 40).toFixed(1)} kT</span>
          <span className="lt-status"><span className="ok-dot"/> ok</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { DashboardRoute, useAuth });
