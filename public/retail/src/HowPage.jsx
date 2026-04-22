function HowPage() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 60 }}>
        <Aurora variant="cool" />
        <div className="wrap" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="eyebrow fade-up">How It Works</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ margin: '18px auto 20px', maxWidth: 900 }}>
            An agent asks. The <span className="serif">network</span> answers.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ margin: '0 auto' }}>
            What actually happens when an agent on someone's laptop asks the network for an answer — written out, in plain English.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap-narrow">
          <div className="glass fade-up" style={{ padding: 40, marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Step one</div>
            <h2 className="h2" style={{ marginBottom: 12 }}>The agent tags the request.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              Every request carries a small tag: is this <em>code completion</em> (cheap, low sensitivity), a <em>healthcare note</em> (high sensitivity, needs hardware privacy), or something the user wants to keep on their own machine? The app decides. You don't have to think about it.
            </p>
            <div style={{ marginTop: 24, height: 120 }}><WaveViz color="#06b6d4" /></div>
          </div>

          <div className="glass fade-up fade-up-d1" style={{ padding: 40, marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Step two</div>
            <h2 className="h2" style={{ marginBottom: 12 }}>The router picks the right operator.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              Our coordinator — the matchmaker — finds an available operator whose rig matches the tag. Fast enough. Close enough. Trusted enough. Before any real work starts, it checks the operator's app is the exact signed build we shipped. If anything looks off, it moves on to the next.
            </p>
            <div style={{ marginTop: 24, height: 120 }}><OrbitViz color="#f59e0b" count={4} /></div>
          </div>

          <div className="glass fade-up fade-up-d2" style={{ padding: 40, marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Step three</div>
            <h2 className="h2" style={{ marginBottom: 12 }}>The operator answers. Memory gets wiped.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              Your machine generates the response and streams it back. The moment it's done, the working memory is scrubbed. Nothing lands on disk. The operator's app has no idea what the user asked, and no way to look later.
            </p>
            <div style={{ marginTop: 24, height: 120 }}><ShieldViz color="#10b981" /></div>
          </div>

          <div className="glass fade-up fade-up-d3" style={{ padding: 40 }}>
            <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Step four</div>
            <h2 className="h2" style={{ marginBottom: 12 }}>Everyone gets paid — or doesn't pay.</h2>
            <p className="lede" style={{ fontSize: 17, margin: 0 }}>
              The consumer's credit balance is decremented. The operator's earnings account ticks up. Stripe handles the money; we never touch it. At the end of the month, deposits land. That's the loop, every few hundred milliseconds, thousands of times a day.
            </p>
            <div style={{ marginTop: 24, height: 120 }}><StackViz color="#fbbf24" /></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-header">
            <span className="eyebrow">Four tiers, explained</span>
            <h2 className="h2">Privacy is a dial, not a switch.</h2>
            <p className="lede">Different requests need different protection. We built four modes. Pick per request — or let the app decide.</p>
          </div>

          <div className="feature-grid">
            {[
              { c: '#f59e0b', name: 'Everyday', tag: 'Tier 0', body: 'The bread and butter. Your request runs on a signed, sandboxed app in a stranger\'s RAM. Memory wiped after. Good for code completion, summaries, classifications.' },
              { c: '#8b5cf6', name: 'Split',    tag: 'Tier 0.5', body: 'The model is sliced across 3–5 operators. No single one sees the whole prompt or the whole answer. A good middle ground when you want extra comfort.' },
              { c: '#10b981', name: 'Sealed',   tag: 'Tier 1', body: 'Runs inside a hardware-sealed enclave — H100 Confidential Computing, AWS Nitro. Even the operator\'s OS can\'t read it. For healthcare, legal, finance.' },
              { c: '#06b6d4', name: 'Local',    tag: 'Tier 2', body: 'Routes to the user\'s own machine via Ollama. Never leaves the device. The strongest privacy is the one where nothing transits.' },
            ].map((t) => (
              <div className="feature fade-up" key={t.tag} style={{ gridColumn: 'span 1' }}>
                <div className="icon-wrap" style={{ background: `linear-gradient(135deg, ${t.c}33, ${t.c}08)` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${t.c}, ${t.c}88)` }} />
                </div>
                <div className="pill" style={{ color: t.c, borderColor: t.c + '55', background: t.c + '15', marginBottom: 12 }}>
                  <span className="dot" style={{ background: t.c }} />
                  {t.tag}
                </div>
                <h3>{t.name}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap"><WaitlistPanel /></div>
      </section>
    </>
  );
}

Object.assign(window, { HowPage });
