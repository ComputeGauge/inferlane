/* Transparency page — four giant stat cards + moderation + governance links */

function TransparencyPage() {
  // Static stub numbers — real page would fetch /api/public/stats
  const stats = [
    { n: 312, k: 'Active operators', c: '#f59e0b' },
    { n: 1870, k: 'Active consumer keys', c: '#06b6d4' },
    { n: 54_320_000, k: 'Requests this month', c: '#10b981' },
    { n: 4_120_000, k: 'kT in circulation', c: '#a78bfa' },
  ];
  const mod = [
    { what: 'Pre-inference rejections', v: '38,204', d: 'Moderation gate blocked request before routing' },
    { what: 'Post-response blocks', v: '1,204', d: 'Classifier caught an abusive completion before delivery' },
    { what: 'Operator terminations', v: '3', d: 'Operator-agreement violations this month' },
    { what: 'Account bans', v: '41', d: 'Consumer AUP violations this month' },
    { what: 'Law-enforcement requests received', v: '0', d: 'We publish a detailed breakdown annually' },
    { what: 'Law-enforcement requests complied with', v: '0', d: '' },
  ];

  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 30 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <span className="eyebrow fade-up">Transparency</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
            The network, <span className="serif">in</span> numbers.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ maxWidth: 620 }}>
            Aggregates only. No per-user data, no per-operator identifiers. Safe to embed, mirror, or archive. Pulled from <code style={{ fontFamily: 'var(--mono)', fontSize: 14, background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 4 }}>/api/public/stats</code> — last updated {new Date().toISOString().slice(0, 10)} 04:12 UTC.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 1120 }}>
          <div className="tr-stats">
            {stats.map((s) => (
              <TrStatCard key={s.k} {...s} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div className="glass tr-table-wrap fade-up">
            <div className="tr-table-head">
              <span className="eyebrow">Moderation · rolling 30 days</span>
              <h2 className="h2" style={{ marginTop: 6 }}>What the gate caught.</h2>
            </div>
            <div className="tr-table">
              <div className="tr-row tr-row-head">
                <div>Metric</div>
                <div>Count</div>
                <div>Notes</div>
              </div>
              {mod.map((r) => (
                <div key={r.what} className="tr-row">
                  <div><strong>{r.what}</strong></div>
                  <div className="mono">{r.v}</div>
                  <div style={{ color: 'var(--fg-muted)' }}>{r.d || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBottom: 100, paddingTop: 40 }}>
        <div className="wrap" style={{ maxWidth: 1040 }}>
          <div style={{ marginBottom: 22 }}>
            <span className="eyebrow">Governance</span>
            <h2 className="h2" style={{ marginTop: 6 }}>The rules you're agreeing to.</h2>
          </div>
          <div className="tr-gov">
            {[
              { href: '#aup', t: 'Acceptable Use Policy', d: 'What you can and cannot do with the network.' },
              { href: '#operator-agreement', t: 'Operator Agreement', d: 'The contract between you and InferLane if you run a node.' },
              { href: '#code-of-conduct', t: 'Code of Conduct', d: 'How we behave in community spaces.' },
              { href: '#roadmap', t: 'Roadmap', d: 'Shipped, building, considering, ruled out.' },
            ].map((g) => (
              <a key={g.t} href={g.href} className="tr-gov-card">
                <h4>{g.t}</h4>
                <p>{g.d}</p>
                <span className="tr-gov-cta">Open <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              </a>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center', marginTop: 40 }}>
            Aggregates only. No per-user data. Safe to embed, mirror, or archive.
          </p>
        </div>
      </section>
    </>
  );
}

function TrStatCard({ n, k, c }) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = React.useState(reduced ? n : Math.round(n * 0.1));
  React.useEffect(() => {
    if (reduced) { setDisplay(n); return; }
    const start = performance.now();
    const from = Math.round(n * 0.1);
    let raf;
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / 1600);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (n - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, reduced]);

  const fmt = (x) => {
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return x.toLocaleString();
  };

  return (
    <div className="tr-stat fade-up" style={{ '--c': c }}>
      <div className="tr-stat-n">{fmt(display)}</div>
      <div className="tr-stat-k">{k}</div>
      <div className="tr-stat-bar" />
    </div>
  );
}

Object.assign(window, { TransparencyPage });
