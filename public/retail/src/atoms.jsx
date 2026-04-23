// Shared data + small helpers

const PAGES = [
  { key: 'home',        label: 'Home' },
  { key: 'how',         label: 'How It Works' },
  { key: 'why',         label: 'Why InferLane' },
  { key: 'run-a-node',  label: 'Run A Node' },
  { key: 'community',   label: 'Community' },
  { key: 'roadmap',     label: 'Roadmap' },
  { key: 'faq',         label: 'FAQ' },
  { key: 'tech',        label: 'For Engineers' },
];

// Routes that exist but are not in top-nav
const HIDDEN_ROUTES = [
  'dashboard', 'install', 'marketplace', 'transparency',
  'operator-agreement', 'code-of-conduct', 'aup',
  'terms', 'privacy', 'security', 'cookies',
  'product', 'earn', 'start', 'waitlist', 'login',
];

const LEGAL_PAGES = [
  { key: 'terms',              label: 'Terms Of Service' },
  { key: 'privacy',            label: 'Privacy Policy' },
  { key: 'aup',                label: 'Acceptable Use' },
  { key: 'operator-agreement', label: 'Operator Agreement' },
  { key: 'code-of-conduct',    label: 'Code Of Conduct' },
  { key: 'security',           label: 'Security' },
  { key: 'cookies',            label: 'Cookies' },
];

// Hardware rows — monthly credit earnings (kT) for "run a node" calculator.
// Numbers are honest estimates assuming 14hr/day avg + current network demand.
const HARDWARE = [
  { id: 'm4mini',  name: 'M4 Mac mini',    ram: '24GB',  kt: 38000,  watts: 28,  req: 14 },
  { id: 'm4pro',   name: 'M4 Pro MBP',     ram: '64GB',  kt: 72000,  watts: 42,  req: 22 },
  { id: 'm4max',   name: 'M4 Max Studio',  ram: '128GB', kt: 128000, watts: 88,  req: 41 },
  { id: '4090',    name: 'RTX 4090 rig',   ram: '24GB',  kt: 180000, watts: 380, req: 66 },
  { id: 'h100',    name: 'H100 80GB',      ram: '80GB',  kt: 820000, watts: 640, req: 188 },
];

function usePrefersReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cb = () => setR(mq.matches);
    cb();
    mq.addEventListener?.('change', cb);
    return () => mq.removeEventListener?.('change', cb);
  }, []);
  return r;
}

// Smooth number counter
function useCount(target, duration = 1600) {
  const [v, setV] = React.useState(target * 0.1);
  const reduced = usePrefersReducedMotion();
  React.useEffect(() => {
    if (reduced) { setV(target); return; }
    const start = performance.now();
    let raf;
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(eased * target);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return v;
}

function formatUSD(n) {
  return '$' + Math.round(n).toLocaleString();
}
function formatKT(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M kT';
  if (n >= 1_000) return Math.round(n / 1_000).toLocaleString() + 'k kT';
  return Math.round(n).toLocaleString() + ' kT';
}
const formatAUD = formatUSD; // compat alias — any stragglers render as USD

// Initialed avatar
function Avatar({ name, color }) {
  const initials = name.split(' ').map(s => s[0]).slice(0,2).join('');
  return (
    <div
      className="avatar"
      style={{ background: `linear-gradient(135deg, ${color}aa, ${color}44)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// Global route state via hash
function useRoute() {
  const [route, setRoute] = React.useState(() => (window.location.hash || '#home').slice(1).split('/')[0] || 'home');
  React.useEffect(() => {
    const cb = () => {
      setRoute((window.location.hash || '#home').slice(1).split('/')[0] || 'home');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', cb);
    return () => window.removeEventListener('hashchange', cb);
  }, []);
  return route;
}

// Small reusable: pending-counsel banner
function PendingCounselBanner() {
  return (
    <div className="pending-banner" role="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="1.8"/>
        <path d="M12 7v6m0 3v.5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <div>
        <strong>Pending counsel review.</strong> This document reflects our
        operational policy but hasn't been audited by external counsel for
        every jurisdiction yet. We'll mark it as final once it has.
      </div>
    </div>
  );
}

// Small reusable: coming-soon banner (amber, same style)
function ComingSoonBanner({ children }) {
  return (
    <div className="pending-banner" role="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="1.8"/>
        <path d="M12 7v5l3 2" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <div>{children}</div>
    </div>
  );
}

Object.assign(window, {
  PAGES, HIDDEN_ROUTES, LEGAL_PAGES, HARDWARE,
  usePrefersReducedMotion, useCount, formatAUD, formatUSD, formatKT,
  Avatar, useRoute, PendingCounselBanner, ComingSoonBanner,
});
