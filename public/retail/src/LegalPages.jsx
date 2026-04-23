/* Legal pages — faithful renderings of TERMS_OF_SERVICE.md, PRIVACY_POLICY.md, SECURITY.md,
   plus a shared LegalShell that supports pending-counsel banner + eyebrow label. */

function LegalShell({ title, updated, eyebrow = 'Legal', pending = false, children }) {
  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 24 }}>
        <div className="wrap-narrow">
          <span className="eyebrow fade-up" style={{ marginBottom: 28, display: 'inline-flex' }}>{eyebrow}</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(36px, 5vw, 56px)', marginTop: 0 }}>{title}</h1>
          <p className="legal-updated fade-up fade-up-d2">
            Last updated: <strong>{updated}</strong>
          </p>
          {pending && <div className="fade-up fade-up-d3"><PendingCounselBanner /></div>}
        </div>
      </section>
      <section className="section" style={{ paddingTop: 20, paddingBottom: 100 }}>
        <div className="wrap-narrow legal-body">
          {children}
        </div>
      </section>
    </>
  );
}

function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="2026-04-22" pending>
      <p className="legal-hint">These Terms govern your access to and use of the InferLane platform — the <code>@inferlane/mcp</code> package, the Claude Code plugin, the web apps, the CLI, and the peer inference network (collectively, the "Service"). By installing the plugin, running the daemon, creating an account, or using any part of the Service, you agree to these Terms. If you don't agree, don't use the Service.</p>

      <h2>1. Who we are</h2>
      <p>The Service is operated by the legal entity that administers the <code>inferlane.dev</code> domain ("we", "us", "InferLane"). Operational contact: <code>support@inferlane.dev</code>. Legal notices: <code>legal@inferlane.dev</code>.</p>

      <h2>2. Who can use the Service</h2>
      <p>You must be at least 18 years old and legally able to enter into a binding contract in your jurisdiction. The Service is not available in countries or to persons subject to comprehensive sanctions imposed by OFAC, the United Nations Security Council, the EU, the UK, or Australia — including (as of the effective date) Iran, North Korea, Syria, Cuba, and the Crimea, Donetsk, and Luhansk regions.</p>
      <p>If you use the Service on behalf of an organisation, you represent that you have authority to bind that entity to these Terms.</p>

      <h2>3. Accounts and security</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>Keeping your credentials secure</li>
        <li>Reporting suspected compromises to <code>security@inferlane.dev</code> within 72 hours of discovery</li>
        <li>All activity under your account until you report it compromised</li>
      </ul>
      <p>We may suspend or terminate access in response to security incidents, suspected fraud, or violation of the <a href="#aup">Acceptable Use Policy</a>.</p>

      <h2>4. Acceptable use</h2>
      <p>You agree to comply with our <a href="#aup">Acceptable Use Policy</a> at all times. Violations may result in immediate termination, forfeiture of credits, and reporting to law enforcement where required.</p>

      <h2>5. Operators</h2>
      <p>If you register as an operator running the InferLane node daemon, the <a href="#operator-agreement">Operator Agreement</a> also applies. Operators are independent contractors, bear their own legal risk, and indemnify InferLane as described in that agreement.</p>

      <h2>6. Credits and payments</h2>
      <h3>Credits</h3>
      <p>The Service uses an internal credit system ("Credits", denominated in "kT" kilotokens) per our published rate tables. Credits earned by serving inference <strong>can only be spent on inference on the Service</strong>. Credits <strong>do not convert to cash</strong>, currency, or any other asset. Credits are not securities, cryptocurrency tokens, or transferable instruments. They have no value outside the Service and no resale market. The Service currently operates in a credits-only mode. If InferLane introduces a cash-payout pathway in the future, participation will require separate affirmative opt-in, new path-specific terms, and identity verification; existing credit balances will not be converted.</p>
      <h3>Cash payments — not currently offered</h3>
      <ul>
        <li>The Service does not currently offer cash payouts to operators</li>
        <li>Consumer prepayments are processed via Stripe (the licensed provider); InferLane does not hold customer funds</li>
        <li>Taxes, withholdings, and reporting are your responsibility; we issue 1099-MISC (US) or equivalent where legally required</li>
        <li>Subscriptions (e.g. MCP Pro) renew automatically until cancelled; cancellation is effective at the end of the current billing period</li>
      </ul>
      <h3>Refunds</h3>
      <ul>
        <li>Subscription fees are non-refundable except where required by law</li>
        <li>Credits are non-refundable once purchased, except where required by law or where the Service has failed materially</li>
      </ul>

      <h2>7. Intellectual property</h2>
      <h3>Our IP</h3>
      <p>The Service (platform software, documentation, branding, and protocols) is owned by us. These Terms grant you a non-exclusive, non-transferable, revocable licence to use the Service as intended. Open-source components are governed by their respective licences (MIT / Apache-2.0, published per file).</p>
      <h3>Your content</h3>
      <p>You retain ownership of the prompts, responses, configurations, and other content you submit through the Service ("Your Content"). You grant us a worldwide, royalty-free licence to process Your Content solely to operate, maintain, and improve the Service.</p>
      <p>We do <strong>not</strong> use Your Content to train foundation models or to create derivative datasets. Any aggregated analytics we publish are de-identified and cannot be reasonably linked back to you.</p>
      <h3>Feedback</h3>
      <p>If you send us feedback, feature requests, or suggestions, you grant us the right to use that feedback without restriction or compensation.</p>

      <h2>8. Privacy</h2>
      <p>Our <a href="#privacy">Privacy Policy</a> describes what we collect, how we use it, and your rights. The Privacy Policy is incorporated into these Terms by reference.</p>

      <h2>9. Third-party services</h2>
      <p>The Service routes inference through third-party providers (Anthropic, OpenAI, Google, and others) and may integrate with third-party tools (Stripe, Discord, etc.). Your use of those services is governed by their terms. We are not responsible for third-party acts, outages, or policies.</p>

      <h2>10. Warranties and disclaimers</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT MODEL OUTPUTS WILL BE ACCURATE, APPROPRIATE, OR FREE FROM HARM.</p>
      <p>Nothing in this section limits or excludes warranties that cannot be limited or excluded under applicable consumer-protection law (including the Australian Consumer Law, where applicable).</p>

      <h2>11. Limitation of liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE IS LIMITED TO THE GREATER OF (A) USD $100 OR (B) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>
      <p>WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
      <p>Nothing in this section limits or excludes liability that cannot be limited or excluded under applicable law.</p>

      <h2>12. Indemnification</h2>
      <p>You agree to indemnify, defend, and hold harmless InferLane and its officers, employees, agents, and contractors from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or related to:</p>
      <ul>
        <li>Your use of the Service</li>
        <li>Your violation of these Terms, the Acceptable Use Policy, or the Operator Agreement (if applicable)</li>
        <li>Your violation of any law or regulation</li>
        <li>Your infringement of any third party's rights</li>
        <li>Any content you submit, transmit, or process through the Service</li>
        <li>Any dispute between you and a third party arising from your use of the Service</li>
      </ul>
      <p>We reserve the right to assume the exclusive defence of any matter subject to indemnification, at your expense, and you will cooperate in that defence.</p>

      <h2>13. Termination</h2>
      <p>Either party may terminate at any time. You: by closing your account and uninstalling our software. Us: by notice to the email associated with your account, either for cause (violation of these Terms) or for convenience.</p>
      <p>On termination, your licence to use the Service ends; credits may expire per the published schedule; outstanding cash balances below the minimum payout threshold are forfeited; balances above the threshold are paid on the normal settlement cycle. Provisions that by their nature survive termination (liability limits, indemnification, dispute resolution, IP ownership) survive.</p>

      <h2>14. Changes to these Terms</h2>
      <p>We may update these Terms periodically. Material changes are announced at least 30 days before taking effect, by email and in the monthly transparency report. Continued use after the effective date constitutes acceptance. If you don't accept, your remedy is to stop using the Service.</p>

      <h2>15. Governing law and dispute resolution</h2>
      <p>These Terms are governed by the laws of Australia, without regard to conflict of laws principles. Any dispute will be resolved exclusively in the courts of Australia, except that either party may seek injunctive relief in any court of competent jurisdiction. If you are a consumer in a jurisdiction where mandatory local law overrides a contractual choice of law, that local law prevails to the extent required.</p>

      <h2>16. Export control and sanctions</h2>
      <p>You agree to comply with all applicable export control and sanctions laws. You represent that you are not located in, under the control of, or a national or resident of any country or person subject to comprehensive sanctions as described in Section 2.</p>

      <h2>17. Force majeure</h2>
      <p>Neither party is liable for failure to perform due to events beyond reasonable control, including natural disasters, war, terrorism, labour disputes, government action, internet or utility outages, or third-party infrastructure failures.</p>

      <h2>18. Miscellaneous</h2>
      <ul>
        <li><strong>Entire agreement:</strong> these Terms (with the AUP, Privacy Policy, and Operator Agreement where applicable) constitute the entire agreement between you and us regarding the Service.</li>
        <li><strong>Severability:</strong> if any provision is unenforceable, the remaining provisions remain in effect.</li>
        <li><strong>Assignment:</strong> you may not assign these Terms without our consent. We may assign to an affiliate or in connection with a merger, sale, or reorganisation.</li>
        <li><strong>No waiver:</strong> our failure to enforce any provision is not a waiver.</li>
        <li><strong>Contact:</strong> <code>legal@inferlane.dev</code> for legal notices; <code>support@inferlane.dev</code> for other matters.</li>
      </ul>
    </LegalShell>
  );
}

function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="2026-04-22" pending>
      <p className="legal-hint">If you only install the MCP plugin and use the local fuel gauge (no account created, no cloud sync), very little of this policy applies — the data stays on your machine. Details in §1.3 below.</p>

      <h2>1. What we collect</h2>
      <h3>1.1 Data you give us</h3>
      <ul>
        <li><strong>Account data:</strong> email, display name, organisation (optional)</li>
        <li><strong>Payment data:</strong> processed entirely by Stripe; we never see your full card number. We receive a payment-method identifier, last 4 digits, country, and billing postcode for tax purposes.</li>
        <li><strong>Operator data:</strong> if you run a node, we collect your Stripe Connect account identifier, tax residency, hardware specifications (GPU model, RAM), and regional information for routing. KYC data flows directly from Stripe Connect to their verification partners — we see only a pass/fail outcome.</li>
        <li><strong>Communications:</strong> when you email us, post in Discord, or file a support ticket, we keep the messages and metadata.</li>
      </ul>

      <h3>1.2 Data we receive automatically</h3>
      <ul>
        <li><strong>Usage metadata:</strong> which API endpoints you call, when, from which IP, which MCP tool triggered the call. We do NOT store prompt or response content when you use end-to-end encrypted routes.</li>
        <li><strong>Device data:</strong> browser user-agent, OS version, device identifiers (for fraud detection only), screen size.</li>
        <li><strong>Daemon telemetry:</strong> for operators, we collect heartbeat signals (uptime, last-seen-at), aggregate throughput, and error rates. We do NOT collect prompts, responses, or client identifiers from operator heartbeats.</li>
      </ul>

      <h3>1.3 Local-only data (never transmitted)</h3>
      <p>When you install the MCP plugin and run the local fuel gauge, the following stays on your machine unless you explicitly enable cloud sync:</p>
      <ul>
        <li>Your Claude Code transcript file contents (read-only, for token counting)</li>
        <li>Your local SQLite database (<code>~/.inferlane/state.db</code>)</li>
        <li>Your budget configuration, provider API keys, routing policies</li>
        <li>Your aggregate spend history</li>
      </ul>
      <p>We have no visibility into any of this unless you set <code>INFERLANE_API_KEY</code> to enable cloud sync.</p>

      <h2>2. How we use what we collect</h2>
      <ul>
        <li><strong>Run the Service</strong> — route inference, settle credits, issue payouts, keep you logged in <em>(contract)</em></li>
        <li><strong>Moderate abuse</strong> — apply AUP, investigate reports, terminate bad actors <em>(legitimate interest)</em></li>
        <li><strong>Security</strong> — detect fraud, protect accounts, prevent abuse <em>(legitimate interest)</em></li>
        <li><strong>Communicate with you</strong> — transactional emails, security alerts <em>(contract / legitimate interest)</em></li>
        <li><strong>Improve the Service</strong> — de-identified aggregate analytics <em>(legitimate interest)</em></li>
        <li><strong>Comply with law</strong> — subpoenas, tax reporting, NCMEC reporting <em>(legal obligation)</em></li>
        <li><strong>Marketing</strong> — community newsletter, opt-in only <em>(consent)</em></li>
      </ul>

      <h2>3. What we don't do</h2>
      <ul>
        <li>We do <strong>not</strong> train AI models on your prompts or responses</li>
        <li>We do <strong>not</strong> sell personal information to third parties</li>
        <li>We do <strong>not</strong> share your content with other operators or consumers beyond what's required to complete a specific inference request</li>
        <li>We do <strong>not</strong> access your local fuel-gauge data unless you enable cloud sync</li>
        <li>We do <strong>not</strong> use advertising cookies or third-party ad networks</li>
      </ul>

      <h2>4. Who we share with</h2>
      <ul>
        <li><strong>Payment processors</strong> (Stripe) for billing and payouts</li>
        <li><strong>Identity verification</strong> (via Stripe Connect) for operator KYC</li>
        <li><strong>Cloud infrastructure</strong> (Vercel, AWS, Cloudflare) — they see encrypted data only</li>
        <li><strong>Analytics</strong> (self-hosted Plausible or PostHog — never Google) for aggregate usage; no PII</li>
        <li><strong>Moderation partners</strong> (OpenAI Moderation API, Anthropic Moderation API) — inputs are sent to them ONLY when routing through our hosted proxy (not E2EE routes). Contractually restricted from using the data for training.</li>
        <li><strong>Law enforcement</strong> on receipt of valid legal process. We publish aggregate statistics annually.</li>
        <li><strong>Successors</strong> in the event of a merger, acquisition, or restructuring.</li>
      </ul>
      <p>We do not share data with anyone else without your explicit consent.</p>

      <h2>5. International transfers</h2>
      <p>We are based in Australia; some processors (Stripe, Cloudflare, Vercel) are based in the United States, European Union, or other jurisdictions. Transfers occur under Standard Contractual Clauses (SCCs) where the recipient is in a non-adequacy jurisdiction under GDPR, APEC Cross-Border Privacy Rules where applicable, and equivalent safeguards for Australian Privacy Principles compliance. Request a copy of the SCCs at <code>privacy@inferlane.dev</code>.</p>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>Account profile — duration of your account + 30 days after closure</li>
        <li>Billing records — 7 years (tax law)</li>
        <li>Payout records — 7 years (tax law)</li>
        <li>Usage metadata (non-content) — 24 months</li>
        <li>Abuse reports and moderation decisions — 5 years (safety)</li>
        <li>Daemon telemetry (operator) — 12 months</li>
        <li>Support correspondence — 24 months</li>
        <li>KYC outcomes — 7 years post-closure (AML)</li>
        <li>Local fuel-gauge data — until you delete it (on your machine)</li>
      </ul>

      <h2>7. How we protect it</h2>
      <ul>
        <li>TLS 1.3+ in transit; AES-256 at rest</li>
        <li>Credentials hashed with Argon2id or bcrypt per OWASP current standard</li>
        <li>Stripe holds all payment card data — we never do</li>
        <li>Role-based access control on staff access; audit logs retained 2 years</li>
        <li>Encryption keys rotated annually</li>
        <li>Incident response: we notify affected users within 72 hours of confirming a breach</li>
        <li>Third-party penetration test annually (post-launch)</li>
      </ul>

      <h2>8. Cookies and similar tech</h2>
      <ul>
        <li><strong>Essential</strong> (session auth, CSRF): required</li>
        <li><strong>Analytics:</strong> self-hosted Plausible, no third-party trackers, no cross-site tracking</li>
        <li>No advertising cookies, no ad retargeting, no third-party analytics</li>
      </ul>

      <h2>9. Your rights</h2>
      <p>Regardless of jurisdiction, you have the right to:</p>
      <ul>
        <li><strong>Access</strong> — see what we have about you → <code>privacy@inferlane.dev</code></li>
        <li><strong>Correct</strong> — update inaccurate data in your account settings, or email us</li>
        <li><strong>Delete</strong> — request deletion; we complete within 30 days except where law requires retention</li>
        <li><strong>Export</strong> — receive a machine-readable copy of your data</li>
        <li><strong>Restrict</strong> — ask us to limit processing while we investigate a dispute</li>
        <li><strong>Object</strong> — to marketing emails (unsubscribe) or legitimate-interest processing (email us)</li>
        <li><strong>Withdraw consent</strong> — for anything we process on a consent basis</li>
        <li><strong>Complain</strong> — to your local data-protection authority (OAIC Australia, ICO UK, national DPA in EU, relevant state AG in US)</li>
      </ul>
      <p>Submit requests to <code>privacy@inferlane.dev</code>. We respond within 30 days (GDPR) or 45 days (CCPA).</p>

      <h2>10. Children</h2>
      <p>The Service is not directed at children under 18. We do not knowingly collect information from children. If we learn we've collected data from a child, we delete it promptly. Contact <code>privacy@inferlane.dev</code> to report.</p>

      <h2>11. Regional disclosures</h2>
      <h3>GDPR (EU / UK)</h3>
      <ul>
        <li><strong>Data controller:</strong> the legal entity operating <code>inferlane.dev</code></li>
        <li><strong>Lawful basis</strong> for each purpose: listed in Section 2</li>
        <li><strong>DPO:</strong> not currently required under Article 37 thresholds; contact <code>privacy@inferlane.dev</code> for privacy matters</li>
      </ul>
      <h3>CCPA / CPRA (California)</h3>
      <ul>
        <li><strong>Categories collected</strong> in the last 12 months: identifiers, commercial information, internet/electronic network activity, approximate geolocation, professional information (for operators)</li>
        <li><strong>Sold or shared:</strong> we do not "sell" or "share" personal information as those terms are defined under CCPA/CPRA</li>
        <li><strong>Right to opt out:</strong> not applicable (we don't sell or share)</li>
      </ul>
      <h3>Australian Privacy Principles</h3>
      <ul>
        <li><strong>Complaints:</strong> email first, escalate to OAIC if unresolved in 30 days</li>
        <li><strong>Anonymity:</strong> you can use the MCP plugin anonymously (no account needed for local-only mode)</li>
        <li><strong>Cross-border:</strong> see Section 5</li>
      </ul>

      <h2>12. Changes to this policy</h2>
      <p>Material changes are announced at least 30 days before taking effect. Continued use after the effective date constitutes acceptance.</p>

      <h2>13. Contact</h2>
      <ul>
        <li>General: <code>privacy@inferlane.dev</code></li>
        <li>Security incidents: <code>security@inferlane.dev</code></li>
        <li>Data-protection authority escalation: as listed in Section 11</li>
      </ul>
    </LegalShell>
  );
}

function SecurityPage() {
  return (
    <LegalShell title="Security Policy" updated="2026-04-22" eyebrow="Engineering">
      <p className="legal-hint">How to report security issues, what's in scope, and how we respond. For data privacy questions, see the <a href="#privacy">Privacy Policy</a>.</p>

      <h2>Reporting a vulnerability</h2>
      <p>Email <code>security@inferlane.dev</code> with:</p>
      <ul>
        <li>A description of the issue</li>
        <li>Steps to reproduce (proof of concept welcome)</li>
        <li>Impact assessment (what data/systems are affected)</li>
        <li>Your preferred credit (name, handle, or anonymous)</li>
      </ul>
      <p><strong>Please do not:</strong></p>
      <ul>
        <li>Disclose the issue publicly before we've had a chance to fix it</li>
        <li>Access, modify, or exfiltrate data beyond what's needed to prove the issue</li>
        <li>Use social engineering or physical attacks against staff or operators</li>
        <li>Test on accounts that aren't yours without explicit authorisation</li>
        <li>Attack operator nodes directly — operators are third parties; our safe harbour does not extend to testing their systems</li>
      </ul>
      <p>We commit to:</p>
      <ul>
        <li>Acknowledging your report within 72 hours</li>
        <li>Investigating and confirming (or rejecting) within 7 days</li>
        <li>Fixing confirmed issues within 30 days for high-severity, 90 days for medium, 180 days for low — faster for anything being actively exploited</li>
        <li>Coordinating disclosure with you before publicly announcing</li>
        <li>Crediting you in our fix advisory (unless you prefer anonymous)</li>
      </ul>

      <h2>Scope</h2>
      <h3>In scope</h3>
      <ul>
        <li><code>inferlane.dev</code>, <code>inferlane.com.au</code>, <code>*.inferlane.dev</code> subdomains we operate</li>
        <li><code>@inferlane/mcp</code> npm package (MCP server)</li>
        <li>Claude Code plugin for InferLane</li>
        <li>Official node daemon (<code>@inferlane/node-daemon</code>)</li>
        <li>Our Next.js application source (when open-sourced)</li>
        <li>Smart contracts (if/when we deploy any)</li>
      </ul>
      <h3>Out of scope</h3>
      <ul>
        <li>Third-party integrations (Stripe, Anthropic, OpenAI, Google, Discord, Cloudflare) — report directly to the vendor</li>
        <li>Operator-run nodes — those are independent parties</li>
        <li>Rate-limiting, captcha-bypass, or DoS reports we already publicly document as trade-off decisions (unless a denial-of-wallet attack is demonstrable)</li>
        <li>Social engineering staff without explicit prior authorisation</li>
        <li>Physical attacks</li>
        <li>Theoretical or speculative issues without a working proof of concept</li>
      </ul>

      <h2>Rewards</h2>
      <p>We don't run a paid bug bounty programme yet. Post-launch we plan one with clear severity tiers and reward ranges. In the meantime:</p>
      <ul>
        <li><strong>Critical / high severity</strong> reports earn contribution-kT at the <code>help-wanted:large</code> rate (150,000 kT), plus public credit if wanted</li>
        <li><strong>Medium</strong> reports earn <code>help-wanted</code> rate (50,000 kT)</li>
        <li><strong>Low</strong> reports earn the bug-fix rate (10,000 kT)</li>
        <li>A Hall of Fame page credits researchers who want public acknowledgement</li>
      </ul>

      <h2>Our security practices</h2>
      <ul>
        <li><strong>TLS 1.3+</strong> enforced for all public endpoints</li>
        <li><strong>HSTS preload</strong> for <code>inferlane.dev</code></li>
        <li><strong>CSP headers</strong> restricting script sources; <code>'unsafe-inline'</code> avoided except where necessary (iframe-sandboxed marketplace widgets)</li>
        <li><strong>Authentication:</strong> passwordless (magic-link + OAuth); TOTP-2FA available; SSO for enterprise</li>
        <li><strong>Authorization:</strong> role-based; every API call authorises against the subject resource; we don't rely on object IDs being unguessable</li>
        <li><strong>Secrets management:</strong> no secrets in git; Vercel env vars + Cloudflare Workers KV; rotated quarterly</li>
        <li><strong>Dependency scanning:</strong> Dependabot on all repos; critical CVEs patched within 7 days</li>
        <li><strong>Code review:</strong> two-person review for any change touching authentication, billing, or moderation</li>
        <li><strong>Audit logs:</strong> every admin action and cross-tenant data access logged; 2-year retention</li>
        <li><strong>Penetration testing:</strong> annual third-party test (post-launch); summary findings published in the transparency report</li>
      </ul>

      <h2>Known trade-offs we have documented</h2>
      <ul>
        <li><strong>Local MCP plugin runs with user privileges</strong> on the user's machine. We don't sandbox it because it's designed to read the user's Claude Code transcripts — that's the point of the fuel gauge.</li>
        <li><strong>Operator nodes are untrusted by design</strong> (except for the TEE tier). We don't attempt to prevent a malicious operator from reading prompts routed to their node on T0; we rely on network crypto + AUP + reputation + termination. Users who need stronger protection use TEE-tier routing.</li>
        <li><strong>Rate limits are published;</strong> if a sophisticated attacker coordinates around them, we act case-by-case rather than pretending we can block all abuse.</li>
      </ul>

      <h2>Contact</h2>
      <ul>
        <li>Reports: <code>security@inferlane.dev</code> (PGP key available on request)</li>
        <li>General: <code>support@inferlane.dev</code></li>
        <li>Legal process: <code>legal@inferlane.dev</code></li>
      </ul>
    </LegalShell>
  );
}

function CookiesPage() {
  return (
    <LegalShell title="Cookies" updated="2026-04-22">
      <h2>Essential only</h2>
      <p>We use cookies that are strictly necessary to operate the Service. No advertising cookies. No third-party trackers.</p>
      <h2>What we set</h2>
      <ul>
        <li><code>il_session</code> — signed session cookie after login. Expires in 14 days of inactivity.</li>
        <li><code>il_csrf</code> — CSRF protection token bound to the session.</li>
        <li><code>il_consent</code> — remembers your cookie-banner choice for 12 months.</li>
      </ul>
      <h2>Analytics</h2>
      <p>We run a self-hosted Plausible or PostHog instance for aggregate traffic measurement. No cross-site tracking, no third-party cookies, no ad networks.</p>
      <h2>Opt out</h2>
      <p>Clear cookies from your browser at any time. The Service will still work; you'll be logged out.</p>
    </LegalShell>
  );
}

Object.assign(window, { LegalShell, TermsPage, PrivacyPage, SecurityPage, CookiesPage });
