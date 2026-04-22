/* ── Animated tech diagrams ────────────────────── */

function ProtocolDiagram() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="diagram">
      <svg viewBox="0 0 800 220" className="diag-svg">
        <defs>
          <linearGradient id="pulse-amber" x1="0" x2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0"/>
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="1"/>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Nodes */}
        {[
          { x: 80,  label: 'client.sdk', c: '#06b6d4' },
          { x: 280, label: 'coordinator', c: '#8b5cf6' },
          { x: 480, label: 'attest.svc', c: '#fbbf24' },
          { x: 680, label: 'operator',    c: '#10b981' },
        ].map((n, i) => (
          <g key={i} transform={`translate(${n.x}, 110)`}>
            <circle r="36" fill="#12121a" stroke={n.c} strokeOpacity="0.4" strokeWidth="1.5"/>
            <circle r="36" fill="none" stroke={n.c} strokeOpacity="0.25" strokeWidth="1">
              {!reduced && <animate attributeName="r" values="36;44;36" dur={`${3 + i * 0.3}s`} repeatCount="indefinite"/>}
              {!reduced && <animate attributeName="stroke-opacity" values="0.25;0;0.25" dur={`${3 + i * 0.3}s`} repeatCount="indefinite"/>}
            </circle>
            <text y="5" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={n.c}>{n.label}</text>
          </g>
        ))}
        {/* Connectors */}
        {[[116, 244], [316, 444], [516, 644]].map(([x1, x2], i) => (
          <line key={i} x1={x1} y1="110" x2={x2} y2="110" stroke="#2a2a3a" strokeWidth="1" strokeDasharray="3 4"/>
        ))}
        {/* Traveling pulse */}
        {!reduced && (
          <circle r="4" fill="#fbbf24">
            <animateMotion path="M 116 110 L 244 110 M 316 110 L 444 110 M 516 110 L 644 110" dur="3s" repeatCount="indefinite" keyPoints="0;0.33;0.33;0.66;0.66;1" keyTimes="0;0.3;0.35;0.6;0.65;1"/>
          </circle>
        )}
        {/* Labels */}
        <g fontFamily="JetBrains Mono" fontSize="9" fill="#7a7f8e">
          <text x="180" y="85">sealed POST</text>
          <text x="380" y="85">verify hash</text>
          <text x="580" y="85">dispatch</text>
          <text x="180" y="160">mTLS</text>
          <text x="380" y="160">attest quote</text>
          <text x="580" y="160">X25519</text>
        </g>
      </svg>
    </div>
  );
}

function AttestDiagram() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="diagram">
      <svg viewBox="0 0 800 240" className="diag-svg">
        {/* two lifelines */}
        <g fontFamily="JetBrains Mono" fontSize="11">
          <text x="100" y="24" fill="#06b6d4" textAnchor="middle">coordinator</text>
          <text x="700" y="24" fill="#10b981" textAnchor="middle">operator enclave</text>
        </g>
        <line x1="100" y1="34" x2="100" y2="220" stroke="#06b6d4" strokeOpacity="0.3" strokeDasharray="2 3"/>
        <line x1="700" y1="34" x2="700" y2="220" stroke="#10b981" strokeOpacity="0.3" strokeDasharray="2 3"/>
        {/* arrows */}
        {[
          { y: 60,  from: 100, to: 700, label: 'nonce + challenge',       c: '#06b6d4', dashed: false },
          { y: 105, from: 700, to: 100, label: 'attestation quote (TPM)', c: '#10b981', dashed: true  },
          { y: 150, from: 100, to: 700, label: 'sealed request blob',     c: '#fbbf24', dashed: false },
          { y: 195, from: 700, to: 100, label: 'response stream',          c: '#8b5cf6', dashed: true  },
        ].map((a, i) => (
          <g key={i}>
            <line x1={a.from} y1={a.y} x2={a.to} y2={a.y}
              stroke={a.c} strokeWidth="1.5"
              strokeDasharray={a.dashed ? '5 4' : 'none'}
              style={reduced ? {} : {
                strokeDasharray: a.dashed ? '5 4' : '600',
                strokeDashoffset: reduced ? 0 : 600,
                animation: `drawLine 1.4s ease-out ${i * 0.4}s forwards`,
              }}
            />
            <polygon
              points={a.from < a.to ? `${a.to},${a.y} ${a.to - 8},${a.y - 4} ${a.to - 8},${a.y + 4}` : `${a.to},${a.y} ${a.to + 8},${a.y - 4} ${a.to + 8},${a.y + 4}`}
              fill={a.c}
            />
            <text x={400} y={a.y - 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill={a.c}>{a.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function TierLadderDiagram() {
  return (
    <div className="diagram">
      <div className="tier-ladder-anim">
        {[
          { name: 'T0 · Everyday',    c: '#f59e0b', w: 25 },
          { name: 'T0.5 · Split',     c: '#8b5cf6', w: 55 },
          { name: 'T1 · Sealed',      c: '#10b981', w: 85 },
          { name: 'T2 · Local',       c: '#06b6d4', w: 100 },
        ].map((t, i) => (
          <div key={i} className="tier-rung fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
            <span className="rung-label" style={{ color: t.c }}>{t.name}</span>
            <div className="rung-track">
              <div className="rung-fill" style={{ '--tw': t.w + '%', background: `linear-gradient(90deg, ${t.c}88, ${t.c})` }} />
            </div>
            <span className="rung-meta">{['signed app', 'pipeline split', 'TEE enclave', 'your machine'][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreatMatrixMini() {
  const rows = [
    { atk: 'Malicious operator',   cells: ['mid','ok','ok','ok'] },
    { atk: 'Passive ISP observer', cells: ['ok','ok','ok','ok'] },
    { atk: 'Compelled coordinator',cells: ['mid','mid','ok','ok'] },
    { atk: 'Model inversion',      cells: ['bad','mid','ok','ok'] },
    { atk: 'Timing side-channel',  cells: ['mid','mid','mid','ok'] },
  ];
  return (
    <div className="diagram">
      <table className="tm-mini">
        <thead>
          <tr><th></th><th>T0</th><th>T0.5</th><th>T1</th><th>T2</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ animation: `fadeUp 0.5s ${i * 0.08}s both` }}>
              <td>{r.atk}</td>
              {r.cells.map((c, j) => (
                <td key={j} className={`cell-${c}`}>
                  {c === 'ok' ? 'blocked' : c === 'mid' ? 'partial' : 'exposed'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Tech page ─────────────────────────────── */
function TechPage() {
  const [active, setActive] = React.useState('t-protocol');
  const sectionIds = ['t-protocol','t-attest','t-tiers','t-sdk','t-threat','t-sla'];

  React.useEffect(() => {
    function onScroll() {
      const offsets = sectionIds.map(id => {
        const el = document.getElementById(id);
        if (!el) return { id, top: Infinity };
        return { id, top: el.getBoundingClientRect().top };
      });
      const above = offsets.filter(o => o.top <= 120).sort((a,b) => b.top - a.top);
      if (above[0]) setActive(above[0].id);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollTo(e, id) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  function downloadWhitepaper() {
    // Generate a real PDF bytes-as-blob and download it.
    // Minimal PDF with our protocol summary — enough to be a real file.
    const content = [
      '%PDF-1.4',
      '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj',
      '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj',
      '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>endobj',
      '4 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj',
      '5 0 obj<</Length 420>>stream',
      'BT /F1 22 Tf 72 720 Td (InferLane Whitepaper) Tj ET',
      'BT /F1 11 Tf 72 690 Td (Peer-to-peer AI inference with honest tier guarantees.) Tj ET',
      'BT /F1 11 Tf 72 660 Td (Draft v0.3 - 2026) Tj ET',
      'BT /F1 12 Tf 72 620 Td (1. Protocol) Tj ET',
      'BT /F1 10 Tf 72 600 Td (HTTP/2 POST sealed-box -> coordinator -> operator. mTLS all hops.) Tj ET',
      'BT /F1 12 Tf 72 560 Td (2. Attestation) Tj ET',
      'BT /F1 10 Tf 72 540 Td (Per-request; T1 uses cloud-native quotes. 5-min cache, session-bound.) Tj ET',
      'BT /F1 12 Tf 72 500 Td (3. Tier guarantees) Tj ET',
      'BT /F1 10 Tf 72 480 Td (T0 signed app; T0.5 pipeline-split; T1 TEE; T2 fully local.) Tj ET',
      'BT /F1 10 Tf 72 420 Td (Full whitepaper: inferlane.dev/whitepaper) Tj ET',
      'endstream endobj',
      'xref',
      '0 6',
      '0000000000 65535 f',
      '0000000010 00000 n',
      '0000000053 00000 n',
      '0000000098 00000 n',
      '0000000183 00000 n',
      '0000000240 00000 n',
      'trailer <</Size 6 /Root 1 0 R>>',
      'startxref',
      '700',
      '%%EOF'
    ].join('\n');
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inferlane-whitepaper-v0.3.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="hero" style={{ paddingBottom: 30 }}>
        <Aurora variant="cool" intensity={0.7} />
        <div className="wrap" style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 880, margin: '0 auto' }}>
          <span className="eyebrow fade-up">For Engineers</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ margin: '18px auto 16px' }}>
            The <span className="serif">technical</span> pages.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ margin: '0 auto' }}>
            Protocol, attestation, threat model, SDK. Everything you need to decide whether to trust the system with your agent's traffic.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <div className="tech-grid">
            <aside className="tech-toc">
              <h4>On this page</h4>
              {[
                { id: 't-protocol', label: 'protocol' },
                { id: 't-attest',   label: 'attestation' },
                { id: 't-tiers',    label: 'tier guarantees' },
                { id: 't-sdk',      label: 'sdk example' },
                { id: 't-threat',   label: 'threat model' },
                { id: 't-sla',      label: 'sla · status' },
              ].map((x) => (
                <a key={x.id} href={`#${x.id}`} className={active === x.id ? 'active' : ''} onClick={(e) => scrollTo(e, x.id)}>
                  {x.label}
                </a>
              ))}
              <div className="toc-divider" />
              <button className="btn btn-ghost btn-small" style={{ width: '100%', marginBottom: 8 }} onClick={downloadWhitepaper}>
                ↓ Whitepaper (PDF)
              </button>
            </aside>

            <div className="tech-section">
              <h3 id="t-protocol">Protocol</h3>
              <p>The client SDK sends each request as an HTTP/2 POST to a regional coordinator. The body is a sealed box (libsodium, X25519 + XSalsa20-Poly1305) keyed to the selected operator's attestation key. The coordinator never sees plaintext. mTLS between all hops. OpenTelemetry 1.29 spans emitted at each boundary; correlation id preserved end-to-end.</p>
              <ProtocolDiagram />

              <div className="code-block">
                <span className="c">// POST /v1/infer</span>{'\n'}
                <span className="k">{'{'}</span>{'\n'}
                <span>{'  '}</span><span className="s">"tier"</span>: <span className="s">"T1"</span>,{'\n'}
                <span>{'  '}</span><span className="s">"model"</span>: <span className="s">"llama-3.1-8b"</span>,{'\n'}
                <span>{'  '}</span><span className="s">"sealed_box"</span>: <span className="s">"base64..."</span>,{'\n'}
                <span>{'  '}</span><span className="s">"attest_required"</span>: <span className="n">true</span>,{'\n'}
                <span>{'  '}</span><span className="s">"max_tokens"</span>: <span className="n">2048</span>{'\n'}
                <span className="k">{'}'}</span>
              </div>

              <h3 id="t-attest">Attestation</h3>
              <p>Every request re-attests the operator's binary hash and tier-appropriate hardware. Tier 0 uses our own code-signing + runtime integrity checks. Tier 0.5 attests all shard-hosting operators. Tier 1 uses the cloud provider's native attestation service — NVIDIA nvtrust, AWS Nitro attestation, Azure MAA. Verified quotes are cached in-memory for 5 minutes and bound to the operator's ephemeral session key.</p>
              <AttestDiagram />

              <h3 id="t-tiers">Tier guarantees</h3>
              <p>Four tiers, plain words: <strong style={{ color: '#fff' }}>T0</strong> runs in a signed operator process with RAM scrubbing. Not cryptographic E2EE. <strong style={{ color: '#fff' }}>T0.5</strong> splits the model pipeline across multiple operators; no single operator sees both sides. <strong style={{ color: '#fff' }}>T1</strong> runs inside a TEE; even the host OS can't read plaintext. <strong style={{ color: '#fff' }}>T2</strong> never touches our infrastructure — we're just the router config for the user's local Ollama.</p>
              <TierLadderDiagram />

              <h3 id="t-sdk">SDK example</h3>
              <p>TypeScript, Python, and Go clients. MCP server built in for direct use from Claude Code, Cursor, or your own tool-using agent.</p>
              <div className="code-block">
                <span className="k">import</span> {'{'} InferLane {'}'} <span className="k">from</span> <span className="s">"@inferlane/sdk"</span>;{'\n\n'}
                <span className="k">const</span> il = <span className="k">new</span> <span className="n">InferLane</span>({'{ apiKey: process.env.IL_KEY }'});{'\n\n'}
                <span className="k">const</span> result = <span className="k">await</span> il.<span className="n">infer</span>({'{'}{'\n'}
                <span>{'  '}</span>tier: <span className="s">"T1"</span>,{'  '}<span className="c">// sealed hardware</span>{'\n'}
                <span>{'  '}</span>model: <span className="s">"llama-3.1-70b"</span>,{'\n'}
                <span>{'  '}</span>messages: [{'{'} role: <span className="s">"user"</span>, content: <span className="s">"..."</span> {'}'}],{'\n'}
                {'}'});
              </div>

              <h3 id="t-threat">Threat model</h3>
              <p>Published per tier. Enumerates the adversary classes we defend against (malicious operator, compelled coordinator, ISP-level passive observer, model inversion, rogue binary, timing side-channel) and rates each as <strong style={{ color: '#34d399' }}>blocked</strong>, <strong style={{ color: 'var(--amber)' }}>partial/deterred</strong>, or <strong style={{ color: '#f87171' }}>exposed</strong>. A full matrix is reviewed by an external firm quarterly; the current audit letter is linked from the Security page.</p>
              <ThreatMatrixMini />

              <h3 id="t-sla">SLA · status</h3>
              <p>99.5% per-tier availability target during beta; 99.9% at GA. Status page shows regional coordinators, operator pool health, and attestation-failure rate in real time. Bug bounty up to $17,000 for attestation-breaking reports.</p>

              <div style={{ marginTop: 32, padding: 20, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Want the full spec?</div>
                  <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>Protocol whitepaper, attestation ladder, audit letters.</div>
                </div>
                <button onClick={downloadWhitepaper} className="btn btn-ghost btn-small">Download PDF</button>
                <a href="#product" className="btn btn-ghost btn-small">See It Running</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap"><GetStartedPanel /></div>
      </section>
    </>
  );
}

Object.assign(window, { TechPage });
