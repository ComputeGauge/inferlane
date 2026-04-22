function ProductPage() {
  const [tab, setTab] = React.useState('dashboard');
  return (
    <>
      <section className="hero" style={{ paddingBottom: 30 }}>
        <Aurora variant="amber" intensity={0.8} />
        <div className="wrap" style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 880, margin: '0 auto' }}>
          <span className="eyebrow fade-up">Product tour</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ margin: '18px auto 16px' }}>
            Here's what it <span className="serif">actually</span> looks like.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ margin: '0 auto' }}>
            Three real pieces: the menu-bar app on your machine, the web dashboard where you watch the money come in, and the SDK playground where consumers test requests.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 30 }}>
        <div className="wrap">
          <div className="product-tabs">
            {[
              { id: 'menubar',   name: 'Menu-bar app' },
              { id: 'dashboard', name: 'Operator dashboard' },
              { id: 'playground',name: 'SDK playground' },
            ].map((t) => (
              <button key={t.id} className={'ptab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>{t.name}</button>
            ))}
          </div>

          {tab === 'menubar' && <MenuBarDemo />}
          {tab === 'dashboard' && <DashboardDemo />}
          {tab === 'playground' && <PlaygroundDemo />}
        </div>
      </section>

      <section className="section">
        <div className="wrap"><GetStartedPanel /></div>
      </section>
    </>
  );
}

function MenuBarDemo() {
  return (
    <div className="demo-frame fade-up">
      <div className="os-bg">
        <div className="menubar">
          <div className="mb-left"><span>InferLane</span><span>File</span><span>Edit</span><span>View</span></div>
          <div className="mb-right">
            <div className="mb-icon"><span className="mb-dot on" /> <span className="mb-txt">1.2K req</span></div>
            <span>100%</span><span>Wed 9:41</span>
          </div>
        </div>
        <div className="menubar-popover fade-up">
          <div className="pop-head">
            <div className="led on" />
            <div>
              <div className="pop-title">InferLane is running</div>
              <div className="pop-sub">Serving Tier 0 · 3 requests/min</div>
            </div>
          </div>
          <div className="pop-stats">
            <div><div className="v">1,248</div><div className="k">Today</div></div>
            <div><div className="v">$7.40</div><div className="k">Earned</div></div>
            <div><div className="v">41ms</div><div className="k">Median</div></div>
          </div>
          <div className="pop-sparkline"><PopSparkline /></div>
          <div className="pop-actions">
            <button className="pop-btn">Pause</button>
            <button className="pop-btn">Dashboard</button>
          </div>
          <div className="pop-foot">Model · gemma-2-9b-q4 · M4 Mac Mini · 24GB</div>
        </div>
      </div>
    </div>
  );
}

function PopSparkline() {
  const pts = React.useMemo(() => Array.from({length:32}).map((_,i)=> 10 + Math.sin(i*0.6)*6 + Math.random()*4), []);
  const max = Math.max(...pts);
  const d = pts.map((v,i)=>`${(i/(pts.length-1))*100},${30-(v/max)*28}`).join(' L');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none">
      <path d={`M ${d}`} fill="none" stroke="#fbbf24" strokeWidth="1.2" />
      <path d={`M ${d} L 100,30 L 0,30 Z`} fill="url(#spark-g)" opacity="0.4"/>
      <defs>
        <linearGradient id="spark-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function DashboardDemo() {
  const [range, setRange] = React.useState('7d');
  const reduced = usePrefersReducedMotion();
  return (
    <div className="demo-frame dash-frame fade-up">
      <div className="browser-bar">
        <span className="b-dot" /><span className="b-dot" /><span className="b-dot" />
        <div className="url-bar">app.inferlane.dev/dashboard</div>
      </div>
      <div className="dash-grid">
        <aside className="dash-side">
          <div className="ds-brand"><span className="brand-mark"/> InferLane</div>
          <nav className="ds-nav">
            <a className="active">Overview</a>
            <a>Requests</a>
            <a>Earnings</a>
            <a>Models</a>
            <a>Payouts</a>
            <a>Settings</a>
          </nav>
          <div className="ds-op-card">
            <div className="k">Operator</div>
            <div className="v">op_priyan_a4</div>
            <div className="ds-led" />
          </div>
        </aside>
        <main className="dash-main">
          <div className="dash-head">
            <div>
              <h3>Good morning, Priya</h3>
              <div className="dash-sub">Your rig has served 41,284 requests this month.</div>
            </div>
            <div className="dash-range">
              {['24h','7d','30d','All'].map(r => (
                <button key={r} className={range===r?'active':''} onClick={()=>setRange(r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="dash-kpis">
            <div className="kpi"><div className="k">This month</div><div className="v">$247.08</div><div className="d up">+12% vs last</div></div>
            <div className="kpi"><div className="k">Requests</div><div className="v">41,284</div><div className="d up">+8%</div></div>
            <div className="kpi"><div className="k">Median latency</div><div className="v">38ms</div><div className="d">–</div></div>
            <div className="kpi"><div className="k">Success rate</div><div className="v">99.82%</div><div className="d up">+0.1%</div></div>
          </div>
          <div className="dash-chart">
            <div className="chart-head">
              <span>Earnings</span>
              <span className="chart-sub">Hourly · last 7 days</span>
            </div>
            <AreaChart reduced={reduced} />
          </div>
          <div className="dash-table">
            <div className="dt-head">Recent requests</div>
            <table>
              <thead><tr><th>Time</th><th>Model</th><th>Tier</th><th>Tokens</th><th>Earned</th><th>Status</th></tr></thead>
              <tbody>
                {[
                  ['09:41:12', 'gemma-2-9b',   'T0',   312,  0.018, 'ok'],
                  ['09:41:08', 'llama-3.1-8b', 'T1',  1420,  0.094, 'ok'],
                  ['09:41:03', 'qwen-2.5-7b',  'T0',   88,   0.006, 'ok'],
                  ['09:40:58', 'gemma-2-9b',   'T0.5', 640,  0.042, 'ok'],
                  ['09:40:52', 'mistral-7b',   'T0',   520,  0.030, 'ok'],
                  ['09:40:47', 'llama-3.1-8b', 'T1',   910,  0.061, 'ok'],
                ].map((r,i) => (
                  <tr key={i}>
                    <td className="mono">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td><span className={'t-pill t-'+r[2].replace('.','')}>{r[2]}</span></td>
                    <td className="mono">{r[3].toLocaleString()}</td>
                    <td className="mono">${r[4].toFixed(3)}</td>
                    <td><span className="ok-dot"/> 200</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function AreaChart({ reduced }) {
  const pts = React.useMemo(()=> Array.from({length:60}).map((_,i)=> 30 + Math.sin(i*0.25)*14 + Math.sin(i*0.6)*6 + (i*0.2)),[]);
  const max = Math.max(...pts);
  const d = pts.map((v,i)=>`${(i/(pts.length-1))*100},${100-(v/max)*88}`).join(' L');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="area-chart">
      <defs>
        <linearGradient id="area-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`M ${d} L 100,100 L 0,100 Z`} fill="url(#area-g)"/>
      <path d={`M ${d}`} fill="none" stroke="#fbbf24" strokeWidth="0.8" vectorEffect="non-scaling-stroke"
        style={reduced ? {} : { strokeDasharray: 400, strokeDashoffset: 400, animation: 'dashDraw 2s ease-out forwards' }} />
    </svg>
  );
}

function PlaygroundDemo() {
  const [tier, setTier] = React.useState('T0');
  const [running, setRunning] = React.useState(false);
  const [out, setOut] = React.useState('');
  const reduced = usePrefersReducedMotion();

  function run() {
    setRunning(true); setOut('');
    const full = 'Sure — to reduce agent latency, pin small models to Tier 0 and reserve Tier 1 for sensitive payloads. Batch tool calls when possible.';
    let i = 0;
    const tick = () => {
      setOut(full.slice(0, i));
      i += reduced ? full.length : 3;
      if (i <= full.length) setTimeout(tick, reduced ? 0 : 24);
      else setRunning(false);
    };
    setTimeout(tick, 400);
  }

  return (
    <div className="demo-frame fade-up">
      <div className="browser-bar">
        <span className="b-dot"/><span className="b-dot"/><span className="b-dot"/>
        <div className="url-bar">app.inferlane.dev/playground</div>
      </div>
      <div className="pg-grid">
        <div className="pg-left">
          <div className="pg-sect">
            <div className="pg-label">Tier</div>
            <div className="pg-tiers">
              {['T0','T0.5','T1','T2'].map(t=>(
                <button key={t} className={'pg-tier'+(tier===t?' active':'')} onClick={()=>setTier(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="pg-sect">
            <div className="pg-label">Model</div>
            <select className="pg-select"><option>llama-3.1-8b</option><option>gemma-2-9b</option><option>qwen-2.5-14b</option></select>
          </div>
          <div className="pg-sect">
            <div className="pg-label">Max tokens</div>
            <input className="pg-input" defaultValue="1024"/>
          </div>
          <div className="pg-sect">
            <div className="pg-label">Temperature</div>
            <input className="pg-input" defaultValue="0.7"/>
          </div>
          <div className="pg-meta">
            <div><span>est. cost</span><span className="mono">$0.0012</span></div>
            <div><span>est. latency</span><span className="mono">~180ms</span></div>
            <div><span>attestation</span><span className="mono">{tier==='T1'?'H100 CC':'signed bin'}</span></div>
          </div>
        </div>
        <div className="pg-right">
          <div className="pg-prompt">
            <div className="pg-label">Prompt</div>
            <textarea defaultValue="How do I minimize latency for agent tool calls?" />
          </div>
          <button className="btn btn-primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run Request'}</button>
          <div className="pg-resp">
            <div className="pg-label">Response {running && <span className="dot pulse" style={{background:'#10b981'}}/>} </div>
            <div className="pg-resp-body">{out || <span style={{color:'var(--fg-muted)'}}>Click run to send a real request through the network.</span>}{running && <span className="caret"/>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProductPage, MenuBarDemo, DashboardDemo, PlaygroundDemo });
