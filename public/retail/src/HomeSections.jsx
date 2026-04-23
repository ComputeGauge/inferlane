function HomeSections() {
  return (
    <>
      {/* Pre-launch strip — honest, not bragging about fake numbers */}
      <section className="section" style={{ paddingTop: 20, paddingBottom: 60 }}>
        <div className="wrap">
          <div className="stats-strip fade-up">
            <div className="stat-cell"><div className="v">Open beta</div><div className="k">Network status</div></div>
            <div className="stat-cell"><div className="v">macOS · Linux</div><div className="k">Daemon builds shipping</div></div>
            <div className="stat-cell"><div className="v">Be first 100</div><div className="k">Founding operator slots</div></div>
          </div>
        </div>
      </section>

      {/* Animated network-forming mesh */}
      <section className="section network-section" id="home-network">
        <div className="wrap">
          <div className="section-header">
            <span className="eyebrow">The network</span>
            <h2 className="h2">Not a cloud. Not a chain. A community of machines.</h2>
            <p className="lede">
              Every dot is somebody's Mac mini, studio rig, or GPU server. When
              you install the daemon, you become one. When you route inference,
              you depend on one.
            </p>
          </div>
          <div className="network-stage">
            <NetworkMesh />
          </div>
        </div>
      </section>

      {/* How it works — plain english */}
      <section className="section" id="home-how">
        <div className="wrap">
          <div className="section-header">
            <span className="eyebrow">How It Works</span>
            <h2 className="h2">Three quiet things happen.</h2>
            <p className="lede">
              No cryptocurrency. No mining. No burning the walls. You leave a
              small helper app — a <em>daemon</em> — running; the network sends
              you requests when it needs compute; you earn credits that spend
              on inference from the network.
            </p>
          </div>

          <div className="steps">
            <div className="step fade-up">
              <div className="step-num">i.</div>
              <h3>Install the helper app</h3>
              <p>Download the signed InferLane daemon for macOS, Linux, or Windows/WSL. It sits quietly in your menu bar. Green means you're available to serve requests.</p>
              <div className="step-viz"><OrbitViz color="#f59e0b" count={3} /></div>
            </div>
            <div className="step fade-up fade-up-d1">
              <div className="step-num">ii.</div>
              <h3>The network sends work</h3>
              <p>When an agent asks for inference, our coordinator finds the best operator for the job — cheapest, closest, spec-matched. Your rig does a few seconds of work.</p>
              <div className="step-viz"><WaveViz color="#8b5cf6" /></div>
            </div>
            <div className="step fade-up fade-up-d2">
              <div className="step-num">iii.</div>
              <h3>You earn credits</h3>
              <p>kT (kilo-token) credits land in your ledger within 15 minutes. 1 kT ≈ 1,000 tokens of served inference. Credits spend on inference from the network today; cash redemption is not offered.</p>
              <div className="step-viz"><StackViz color="#fbbf24" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Why we did it — single shield animation replaces rotating tiles */}
      <section className="section story-cinema" id="home-why">
        <Aurora variant="purple" intensity={0.55} />
        <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
          <div className="section-header" style={{ marginBottom: 30 }}>
            <span className="eyebrow">Why this, why now</span>
            <h2 className="h2">Honest tiers. Written threat models. No hand-waving.</h2>
            <p className="lede">
              Every privacy tier has a threat model a security engineer signed
              off on. If a request is cheap inference on a stranger's RAM, we
              say that. If it's sealed in an H100 enclave, we say that. No
              "military-grade" marketing — ever.
            </p>
          </div>
          <div className="shield-stage">
            <ShieldRedraw />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <div className="section-header">
            <span className="eyebrow">Early contributors</span>
            <h2 className="h2">People who were already leaving their machines on.</h2>
          </div>
          <div className="quote-grid">
            <div className="quote fade-up">
              <blockquote>My Studio's on anyway for Ableton. The daemon just sits there earning credits while I sleep — I spend them on my own inference, basically pays for power.</blockquote>
              <div className="attr">
                <Avatar name="Priya Natarajan" color="#f59e0b" />
                <div><div className="name">Priya N.</div><div className="role">Music producer · Sydney</div></div>
              </div>
            </div>
            <div className="quote fade-up fade-up-d1">
              <blockquote>Had four old Mac minis from our studio's upgrade cycle sitting in a cupboard. Now they're a little rack serving the network instead of gathering dust.</blockquote>
              <div className="attr">
                <Avatar name="Alex Chen" color="#8b5cf6" />
                <div><div className="name">Alex C.</div><div className="role">Studio owner · Melbourne</div></div>
              </div>
            </div>
            <div className="quote fade-up fade-up-d2">
              <blockquote>The threat model is written down. I know what the daemon sees and doesn't see. No weird mining-app vibes — just a signed binary doing one thing.</blockquote>
              <div className="attr">
                <Avatar name="Sam Williams" color="#06b6d4" />
                <div><div className="name">Sam W.</div><div className="role">Engineer · Brisbane</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started CTA */}
      <section className="section" id="start">
        <div className="wrap">
          <GetStartedPanel />
        </div>
      </section>
    </>
  );
}

/* ─── Animated network-forming mesh ──────────────────────── */
function NetworkMesh() {
  const canvasRef = React.useRef(null);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf, running = true, start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    // 40 nodes placed on a loose world-map-ish grid
    const NODE_COUNT = 40;
    const rng = (i) => { const x = Math.sin(i * 9301 + 49297) * 233280; return x - Math.floor(x); };
    const nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
      // Cluster more densely in 4 regions (AU, NA, EU, Asia)
      const regionIdx = i % 4;
      const region = [
        { cx: 0.82, cy: 0.72 }, // AU
        { cx: 0.25, cy: 0.45 }, // NA
        { cx: 0.50, cy: 0.38 }, // EU
        { cx: 0.70, cy: 0.50 }, // Asia
      ][regionIdx];
      const jx = (rng(i * 3) - 0.5) * 0.18;
      const jy = (rng(i * 7) - 0.5) * 0.22;
      return {
        x: Math.max(0.05, Math.min(0.95, region.cx + jx)),
        y: Math.max(0.1, Math.min(0.9, region.cy + jy)),
        appearAt: 500 + i * 140,     // stagger reveal
        load: 0.3 + rng(i * 11) * 0.7,
        phase: rng(i * 13) * Math.PI * 2,
      };
    });

    // Precompute edges: each node connects to ~2-3 nearest
    const edges = [];
    nodes.forEach((a, i) => {
      const sorted = nodes
        .map((b, j) => ({ j, d: (b.x - a.x) ** 2 + (b.y - a.y) ** 2 }))
        .sort((x, y) => x.d - y.d)
        .slice(1, 4);
      sorted.forEach(({ j }) => {
        if (!edges.some(e => (e.a === i && e.b === j) || (e.a === j && e.b === i))) {
          edges.push({ a: i, b: j, appearAt: Math.max(nodes[i].appearAt, nodes[j].appearAt) + 300 });
        }
      });
    });

    const packets = []; // traveling dots
    let lastPacket = 0;

    const draw = (ts) => {
      const t = ts - start;
      ctx.clearRect(0, 0, w, h);

      // Faint grid (world-ish)
      ctx.strokeStyle = 'rgba(245,158,11,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo((w * i) / 8, 0);
        ctx.lineTo((w * i) / 8, h);
        ctx.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (h * i) / 4);
        ctx.lineTo(w, (h * i) / 4);
        ctx.stroke();
      }

      // Edges
      edges.forEach((e) => {
        if (t < e.appearAt) return;
        const growth = Math.min(1, (t - e.appearAt) / 900);
        const a = nodes[e.a], b = nodes[e.b];
        const ax = a.x * w, ay = a.y * h;
        const bx = b.x * w, by = b.y * h;
        ctx.strokeStyle = `rgba(245,158,11,${0.1 + growth * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (bx - ax) * growth, ay + (by - ay) * growth);
        ctx.stroke();
      });

      // Nodes
      nodes.forEach((n) => {
        if (t < n.appearAt) return;
        const reveal = Math.min(1, (t - n.appearAt) / 700);
        const pulse = 0.85 + Math.sin(t * 0.002 + n.phase) * 0.15;
        const cx = n.x * w, cy = n.y * h;
        const r = (2 + n.load * 4) * reveal * pulse;

        // Glow
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 5);
        grad.addColorStop(0, `rgba(245,158,11,${0.4 * reveal})`);
        grad.addColorStop(1, 'rgba(245,158,11,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 5, 0, Math.PI * 2);
        ctx.fill();

        // Dot
        ctx.fillStyle = `rgba(251,191,36,${reveal})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Spawn packets (only after first few nodes + edges exist)
      if (t > 3500 && !reduced) {
        if (t - lastPacket > 260) {
          lastPacket = t;
          const e = edges[Math.floor(Math.random() * edges.length)];
          if (e && t > e.appearAt + 900) {
            packets.push({ edge: e, birth: t, life: 1200 + Math.random() * 700 });
          }
        }
      }

      // Draw packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const age = t - p.birth;
        if (age > p.life) { packets.splice(i, 1); continue; }
        const prog = age / p.life;
        const a = nodes[p.edge.a], b = nodes[p.edge.b];
        const cx = (a.x + (b.x - a.x) * prog) * w;
        const cy = (a.y + (b.y - a.y) * prog) * h;
        ctx.fillStyle = `rgba(255,220,150,${1 - Math.abs(0.5 - prog) * 1.5})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (reduced) {
      // Render a single static frame with all nodes/edges revealed
      draw(100000);
    } else {
      const loop = (ts) => {
        if (!running) return;
        draw(ts);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduced]);

  return (
    <div className="network-canvas-wrap">
      <canvas ref={canvasRef} className="network-canvas" />
      <div className="network-legend">
        <span><span className="legend-dot" style={{ background: '#fbbf24' }}/>Nodes = operators</span>
        <span><span className="legend-dot" style={{ background: '#f59e0b' }}/>Edges = routing links</span>
        <span><span className="legend-dot" style={{ background: '#fff6d6' }}/>Pulses = live requests</span>
      </div>
    </div>
  );
}

/* ─── Single shield that redraws tier bars (replaces 3-tile rotation) ───── */
function ShieldRedraw() {
  const reduced = usePrefersReducedMotion();
  const tiers = [
    { id: 'T0',   name: 'Everyday',     c: '#f59e0b', pct: 62, desc: 'Signed daemon · pseudonymous operator' },
    { id: 'T0.5', name: 'Distributed',  c: '#d97757', pct: 74, desc: 'Split across operators · no single node sees all' },
    { id: 'T1',   name: 'Confidential', c: '#10b981', pct: 94, desc: 'H100 CC partner · hardware attestation' },
    { id: 'T2',   name: 'Local',        c: '#06b6d4', pct: 100, desc: 'Your machine · never routed off-device' },
  ];

  return (
    <div className="tiers-card">
      <div className="tiers-card-head">
        <span className="tiers-eyebrow">Four tiers</span>
        <span className="tiers-sub">each with a written threat model</span>
      </div>
      <div className="tiers-rows">
        {tiers.map((t, i) => (
          <div key={t.id} className="tier-row" style={{ '--tc': t.c, animationDelay: reduced ? '0s' : `${0.15 + i * 0.12}s` }}>
            <div className="tier-pill" style={{ borderColor: t.c, color: t.c, background: `${t.c}12` }}>{t.id}</div>
            <div className="tier-body">
              <div className="tier-name">{t.name}</div>
              <div className="tier-bar">
                <div className="tier-bar-fill" style={{ width: `${t.pct}%`, background: t.c, animationDelay: reduced ? '0s' : `${0.4 + i * 0.18}s` }} />
                <div className="tier-bar-ticks" />
              </div>
            </div>
            <div className="tier-desc">{t.desc}</div>
          </div>
        ))}
      </div>
      <div className="tiers-footer">
        <span className="tiers-foot-label">Pick your tier per request. We'll tell you the price and the trade-off before you route.</span>
      </div>
    </div>
  );
}

/* ─── Get Started panel — guided, not waitlist ─────────── */
function GetStartedPanel() {
  const [mode, setMode] = React.useState('run');
  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState('');
  const [os, setOs] = React.useState('mac');
  const [copied, setCopied] = React.useState(false);
  const reduced = usePrefersReducedMotion();

  const installCmd = os === 'mac' || os === 'linux'
    ? 'curl -fsSL https://install.inferlane.dev | bash'
    : 'iwr https://install.inferlane.dev/install.ps1 -useb | iex';

  function copy() {
    navigator.clipboard?.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const steps = mode === 'run'
    ? ['Pick Your OS', 'Install The Daemon', 'Accept The Agreement', "You're Live"]
    : ['Install The MCP Plugin', 'Set A Local Budget', 'Route Through The Network'];

  return (
    <div className="cta-panel fade-up">
      <Aurora variant="purple" intensity={0.6} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <span className="eyebrow" style={{ marginBottom: 20 }}>Get started</span>
        <h2 className="h2" style={{ maxWidth: 720, margin: '0 auto 14px' }}>
          Up and running in <span className="serif" style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', color: '#fbbf24' }}>four minutes.</span>
        </h2>
        <p className="lede">
          No waitlist. Pick what you want to do; we'll walk you through the rest.
        </p>

        <div className="tabs" role="tablist" style={{ marginTop: 22 }}>
          <button className={'tab-btn' + (mode === 'run' ? ' active' : '')} onClick={() => { setMode('run'); setStep(0); }}>Run A Node</button>
          <button className={'tab-btn' + (mode === 'use' ? ' active' : '')} onClick={() => { setMode('use'); setStep(0); }}>Install &amp; Use</button>
        </div>

        <div className="stepper">
          {steps.map((label, i) => (
            <div key={i} className={'step-node' + (i <= step ? ' done' : '')}>
              <div className="step-dot">{i < step ? '✓' : i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="gs-body">
          {mode === 'run' && step === 0 && (
            <div className="gs-panel fade-up">
              <h4>Which operating system?</h4>
              <div className="os-picker">
                {[
                  { id: 'mac',   name: 'macOS',   sub: 'Apple Silicon, 11+' },
                  { id: 'linux', name: 'Linux',   sub: 'Ubuntu 22+, Debian' },
                  { id: 'win',   name: 'Windows', sub: '11 with WSL2' },
                ].map((o) => (
                  <button key={o.id} className={'os-opt' + (os === o.id ? ' active' : '')} onClick={() => setOs(o.id)}>
                    <div className="os-name">{o.name}</div>
                    <div className="os-sub">{o.sub}</div>
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={() => setStep(1)}>
                Continue
              </button>
            </div>
          )}

          {mode === 'run' && step === 1 && (
            <div className="gs-panel fade-up">
              <h4>Paste this into Terminal</h4>
              <p className="gs-hint">One line. Downloads the signed daemon and registers your machine. Uninstall any time with <code>inferlane uninstall</code>.</p>
              <div className="terminal">
                <div className="term-bar"><span className="d"/><span className="d"/><span className="d"/><span className="t">Terminal</span></div>
                <div className="term-body">
                  <span className="prompt">$</span> <span className="cmd">{installCmd}</span>
                  <button className="copy-btn" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>I Ran It</button>
              </div>
            </div>
          )}

          {mode === 'run' && step === 2 && (
            <div className="gs-panel fade-up">
              <h4>Accept the Operator Agreement</h4>
              <p className="gs-hint">One-page summary; full text at <a href="#operator-agreement" style={{color:'var(--amber)'}}>/operator-agreement</a>. You're an independent contractor; we route traffic through a moderation gate; you don't log prompts.</p>
              <div className="kv-list">
                <div className="kv-row"><span className="k">Credit share on served inference</span><span className="v">90% to you</span></div>
                <div className="kv-row"><span className="k">Payout currency</span><span className="v">USD</span></div>
                <div className="kv-row"><span className="k">Minimum payout</span><span className="v">$20</span></div>
                <div className="kv-row"><span className="k">Credit expiry</span><span className="v">6 months (contribution kT never expires)</span></div>
              </div>
              <input
                className="gs-input"
                type="email" placeholder="you@domain.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={!email} onClick={() => setStep(3)}>Accept &amp; Continue</button>
              </div>
            </div>
          )}

          {mode === 'run' && step === 3 && (
            <div className="gs-panel fade-up gs-done">
              <div className="done-glyph" aria-hidden>
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeOpacity="0.3" strokeWidth="2"/>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="314" strokeDashoffset="0" style={reduced ? {} : { animation: 'dashDraw 1.2s ease-out' }} />
                  <path d="M 40 62 L 54 78 L 82 46" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4 style={{ textAlign: 'center' }}>You're live.</h4>
              <p style={{ textAlign: 'center', color: 'var(--fg-dim)', marginBottom: 12 }}>
                Your node is in the pool as <code>op_{email ? email.split('@')[0].slice(0,8) : 'pending'}</code>. First request usually lands within 2 minutes.
              </p>
              <a href="#dashboard" className="btn btn-primary" style={{ width: '100%' }}>Open Your Dashboard</a>
            </div>
          )}

          {mode === 'use' && step === 0 && (
            <div className="gs-panel fade-up">
              <h4>Install the MCP plugin for Claude Code</h4>
              <p className="gs-hint">Free while you run the local fuel gauge. Tracks every token your agents spend. Zero account needed.</p>
              <div className="terminal">
                <div className="term-bar"><span className="d"/><span className="d"/><span className="d"/><span className="t">Terminal</span></div>
                <div className="term-body">
                  <span className="prompt">$</span> <span className="cmd">npm i -g @inferlane/mcp</span>
                  <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText('npm i -g @inferlane/mcp'); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? '✓' : 'Copy'}</button>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={() => setStep(1)}>Installed →</button>
            </div>
          )}

          {mode === 'use' && step === 1 && (
            <div className="gs-panel fade-up">
              <h4>Set a local budget</h4>
              <p className="gs-hint">The fuel gauge warns you before Claude Code burns through your month.</p>
              <div className="terminal">
                <div className="term-bar"><span className="d"/><span className="d"/><span className="d"/><span className="t">Terminal</span></div>
                <div className="term-body mono">
                  <span className="prompt">$</span> <span className="cmd">inferlane budget set --monthly 200</span><br/>
                  <span style={{ color: '#7a7f8e' }}>{'// Dashboard live at http://localhost:7070/dashboard'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>Continue</button>
              </div>
            </div>
          )}

          {mode === 'use' && step === 2 && (
            <div className="gs-panel fade-up gs-done">
              <div className="done-glyph" aria-hidden>
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeOpacity="0.3" strokeWidth="2"/>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="3" />
                  <path d="M 40 62 L 54 78 L 82 46" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4 style={{ textAlign: 'center' }}>Route bulk jobs through the network.</h4>
              <div className="terminal" style={{ marginTop: 10 }}>
                <div className="term-bar"><span className="d"/><span className="d"/><span className="d"/><span className="t">claude-code</span></div>
                <div className="term-body mono">
                  <span style={{ color: '#7a7f8e' }}>{'// Everything "just works" — MCP routes Haiku-class tasks'}</span><br/>
                  <span style={{ color: '#7a7f8e' }}>{'// through the peer network. Frontier stays on Anthropic.'}</span><br/>
                  <span style={{ color: '#10b981' }}>✓ saved $47 this week</span>
                </div>
              </div>
              <a href="#dashboard" className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>Open Your Fuel Gauge</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const WaitlistPanel = GetStartedPanel;

Object.assign(window, { HomeSections, WaitlistPanel, GetStartedPanel, NetworkMesh, ShieldRedraw });
