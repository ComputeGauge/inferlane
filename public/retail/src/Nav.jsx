function Nav() {
  const route = useRoute();
  const [open, setOpen] = React.useState(false);
  return (
    <nav className="nav" data-screen-label="00 Nav">
      <div className="nav-inner">
        <a href="#home" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true" />
          InferLane
        </a>
        <div className="nav-links">
          {PAGES.filter(p => p.key !== 'home').map((p) => (
            <a
              key={p.key}
              href={`#${p.key}`}
              className={'nav-link' + (route === p.key ? ' active' : '')}
            >
              {p.label}
            </a>
          ))}
        </div>
        <div className="nav-spacer" />
        <div className="nav-right">
          <a href="#tech" className="btn btn-ghost btn-small">Docs</a>
          <a href="#login" className="btn btn-ghost btn-small">Sign In</a>
          <a href="#install" className="btn btn-primary btn-small">Install The Daemon</a>
        </div>
        <button className="nav-burger" onClick={() => setOpen(!open)} aria-label="Menu">
          <span/><span/><span/>
        </button>
      </div>
      {open && (
        <div className="nav-mobile">
          {PAGES.map((p) => (
            <a key={p.key} href={`#${p.key}`} onClick={() => setOpen(false)}>{p.label}</a>
          ))}
          <a href="#install" onClick={() => setOpen(false)}>Install The Daemon</a>
          <a href="#login" onClick={() => setOpen(false)}>Sign In</a>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a href="#home" className="brand" style={{ marginBottom: 14 }}>
              <span className="brand-mark" />
              InferLane
            </a>
            <p style={{ maxWidth: 320, lineHeight: 1.6, marginTop: 10 }}>
              Community-owned AI inference. Share what you've got.
              Use what others share.
            </p>
          </div>
          <div className="foot-col">
            <h6>Product</h6>
            <a href="#how">How It Works</a>
            <a href="#why">Why InferLane</a>
            <a href="#install">Install</a>
            <a href="#run-a-node">Run A Node</a>
            <a href="#marketplace">Marketplace</a>
          </div>
          <div className="foot-col">
            <h6>Community</h6>
            <a href="#community">Community</a>
            <a href="#roadmap">Roadmap</a>
            <a href="#faq">FAQ</a>
            <a href="#transparency">Transparency</a>
            <a href="#tech">For Engineers</a>
          </div>
          <div className="foot-col">
            <h6>Governance</h6>
            <a href="#aup">Acceptable Use</a>
            <a href="#operator-agreement">Operator Agreement</a>
            <a href="#code-of-conduct">Code Of Conduct</a>
            <a href="#terms">Terms Of Service</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#security">Security</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 InferLane</span>
          <span style={{ color: 'var(--fg-muted)' }}>Open beta · credits-denominated</span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, Footer });
