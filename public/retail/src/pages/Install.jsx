/* Install page — OS tabs, mode cards, step list, after-install links */

function InstallPage() {
  const [os, setOs] = React.useState('macos');
  const [mode, setMode] = React.useState('mcp');
  const [copied, setCopied] = React.useState(false);

  const cmds = {
    macos: 'curl -fsSL https://install.inferlane.dev | bash',
    linux: 'curl -fsSL https://install.inferlane.dev | bash',
    windows: 'iwr -useb https://install.inferlane.dev/win.ps1 | iex',
  };
  const label = { macos: 'macOS', linux: 'Linux', windows: 'Windows' };
  const flag = { mcp: '', operator: ' --operator', both: ' --both' };
  const cmd = cmds[os] + flag[mode];

  const copy = () => {
    navigator.clipboard?.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 20 }}>
        <div className="wrap" style={{ maxWidth: 880, textAlign: 'center' }}>
          <span className="eyebrow fade-up">Install</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
            One command.<br/>
            <span className="serif">Cross</span>-platform.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ maxWidth: 580, margin: '0 auto' }}>
            macOS, Linux, Windows. MCP plugin, node daemon, or both. Takes about 40 seconds.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="install-card fade-up">
            <div className="install-tabs">
              {(['macos', 'linux', 'windows']).map((k) => (
                <button key={k} className={'install-tab' + (os === k ? ' on' : '')} onClick={() => setOs(k)}>
                  {label[k]}
                </button>
              ))}
            </div>
            <div className="install-cmd-wrap">
              <pre className="install-cmd"><code>$ <span style={{ color: 'var(--amber)' }}>{cmd}</span></code></pre>
              <button className="install-copy" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
            <div className="install-modes">
              {[
                { k: 'mcp',      t: 'mcp',      d: 'Install the MCP plugin for Claude Code.', hint: 'Default.' },
                { k: 'operator', t: 'operator', d: 'Install the node daemon. Run a node, earn credits.', hint: '' },
                { k: 'both',     t: 'both',     d: 'Install both. For people who both use AND contribute compute.', hint: '' },
              ].map((m) => (
                <button
                  key={m.k}
                  onClick={() => setMode(m.k)}
                  className={'install-mode' + (mode === m.k ? ' on' : '')}
                >
                  <div className="install-mode-head">
                    <code className="install-mode-flag">{m.t}</code>
                    {m.hint && <span className="install-mode-hint">{m.hint}</span>}
                  </div>
                  <p>{m.d}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="install-two">
            <div className="install-box fade-up">
              <h4>Requirements</h4>
              <ul className="install-list">
                <li><code>Node.js ≥ 20</code> — checked automatically</li>
                <li><code>Claude Code CLI</code> — for <code>mcp</code> mode only</li>
                <li><code>6GB+ RAM free</code> — for <code>operator</code> mode</li>
                <li><code>curl or iwr</code> — standard on supported OSes</li>
              </ul>
            </div>
            <div className="install-box fade-up">
              <h4>What the install does</h4>
              <ol className="install-steps">
                <li>Validates Node version (fails cleanly if &lt; 20)</li>
                <li>Fetches the signed package from releases.inferlane.dev</li>
                <li>Verifies SHA-256 against the published hash</li>
                <li>Symlinks <code>inferlane</code> to your <code>PATH</code></li>
                <li>Prompts for optional monthly budgets</li>
                <li>Starts the local fuel gauge at <code>localhost:7070</code></li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBottom: 100 }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="install-after fade-up">
            <div className="install-after-head">
              <span className="eyebrow">After install</span>
              <h3 className="h3" style={{ marginTop: 4 }}>Everything you need, one row.</h3>
            </div>
            <div className="install-links">
              <a href="#dashboard" className="install-link"><strong>Dashboard</strong><span>localhost:7070</span></a>
              <a href="#tech" className="install-link"><strong>Docs</strong><span>Protocol + SDK</span></a>
              <a href="#community" className="install-link"><strong>Discord</strong><span>#new-operators</span></a>
              <a href="#run-a-node" className="install-link"><strong>Run-a-node</strong><span>Hardware guide</span></a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { InstallPage });
