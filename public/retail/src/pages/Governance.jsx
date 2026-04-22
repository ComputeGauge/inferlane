/* Governance prose pages — AUP, Operator Agreement, Code of Conduct
   Each renders faithfully from the attached MD file. Legal shell reused from LegalPages. */

function AupPage() {
  return (
    <LegalShell title="Acceptable Use Policy" updated="2026-04-22" eyebrow="Governance">
      <p className="legal-hint">Not legal advice. This document describes our operational policy, not a legal opinion.</p>

      <h2>Binding principle</h2>
      <p>You may not use InferLane to generate, transmit, store, or solicit content or activity that violates applicable law in your jurisdiction or ours (Australia, United States, European Union, United Kingdom, and any other jurisdiction where we operate or where users are located).</p>

      <h2>Prohibited uses</h2>
      <p>All of the following are prohibited. Detection results in immediate account termination, credit forfeiture, and — where legally required or where the harm warrants it — preservation of evidence and reporting to the relevant authority (NCMEC, AU eSafety Commissioner, FBI, or equivalent).</p>
      <ol>
        <li><strong>Child sexual abuse material (CSAM)</strong> — generating, analysing, transmitting, or soliciting any sexualised depiction of minors, including AI-generated imagery, text, or code.</li>
        <li><strong>Terrorism content</strong> — planning, recruitment, glorification, or operational support for acts of terrorism as defined by US/UK/EU/AU lists of designated terrorist organisations.</li>
        <li><strong>Incitement to violence</strong> — targeted incitement, threats, or planning of violence against identifiable individuals or groups.</li>
        <li><strong>Weapons of mass destruction</strong> — bioweapons, chemical weapons, nuclear weapons: synthesis routes, acquisition guides, targeting advice.</li>
        <li><strong>Non-consensual intimate imagery</strong> — including synthetic or deepfake imagery of real people.</li>
        <li><strong>Human trafficking</strong> — facilitation, recruitment, or operational support.</li>
        <li><strong>Illegal drug synthesis or trafficking</strong> — synthesis instructions, acquisition routes, evasion of drug-enforcement authorities.</li>
        <li><strong>Firearms trafficking or illegal modifications</strong> — including 3D-printable firearms in jurisdictions where illegal.</li>
        <li><strong>Fraud / identity theft</strong> — generating false identity documents, phishing kits, instructions for financial fraud, impersonation at scale.</li>
        <li><strong>Malware / cyberweapons</strong> — creating, distributing, or configuring malicious software designed to harm systems without authorisation.</li>
        <li><strong>Sanctions evasion</strong> — using our service from or on behalf of entities in OFAC-sanctioned jurisdictions (Iran, North Korea, Syria, Cuba, Crimea / Donetsk / Luhansk), or for entities on OFAC / UN sanctions lists.</li>
        <li><strong>Mass copyright infringement</strong> — automated scraping of paywalled content, redistribution of copyrighted material at scale.</li>
        <li><strong>Automated abuse</strong> — spam, coordinated inauthentic behaviour, bulk account creation, CAPTCHA-bypass operations.</li>
        <li><strong>Privacy violations</strong> — doxxing, unauthorised collection of personal data, surveillance of individuals without lawful basis.</li>
        <li><strong>Medical, legal, or financial advice presented to end-users as professional advice.</strong> Educational and research use is fine; routing model output to a consumer as if it were advice from a qualified professional is not.</li>
        <li><strong>Adult content.</strong> Not served on the network. No exceptions.</li>
        <li><strong>Unauthorised security testing</strong> — penetration testing, vulnerability research, or red-teaming against systems without explicit written authorisation from the system owner.</li>
      </ol>

      <h2>How we enforce</h2>
      <ol>
        <li><strong>Pre-inference moderation gate</strong> — every request passes through automated classifiers (OpenAI Moderation API, Anthropic Moderation API, regex rules, and our own classifier). Requests matching prohibited categories are rejected before they reach an operator.</li>
        <li><strong>Post-response moderation</strong> — outputs from models are scanned. Abusive completions are blocked before delivery.</li>
        <li><strong>Account-level pattern detection</strong> — repeated attempts, jailbreak patterns, and off-platform signals trigger review.</li>
        <li><strong>Community reports</strong> — operators, contributors, and other users can flag abuse via Discord or email (<code>abuse@inferlane.dev</code>).</li>
        <li><strong>Law-enforcement cooperation</strong> — we respond to valid legal process through our designated agent. Published annually in our transparency report.</li>
      </ol>

      <h2>Consequences of violation</h2>
      <p>Depending on the nature of the violation, any of the following may apply:</p>
      <ul>
        <li>Warning and required educational response.</li>
        <li>Account termination and forfeiture of any kT balance.</li>
        <li>Permanent ban from the Service, including operator status where applicable.</li>
        <li>Termination of operator status and forfeiture of pending payouts. Revoked credits are reallocated to a reserve for abuse-response costs.</li>
        <li>Preservation of evidence and reporting to the relevant authority (NCMEC, AU eSafety Commissioner, FBI, or equivalent) where required by law or where the harm warrants it.</li>
      </ul>

      <h2>For operators specifically</h2>
      <p>Operators agree not to:</p>
      <ul>
        <li>Log, store, analyse, or transmit prompts or responses passing through their node (beyond ephemeral RAM during inference)</li>
        <li>Modify the approved inference binary</li>
        <li>Refuse routed requests based on their personal content judgment (the moderation gate at our coordinator is the single policy surface)</li>
        <li>Use operator status to collect data on users or other operators</li>
      </ul>
      <p>Operator violations result in permanent termination, loss of pending payouts, and potential civil liability under the Operator Agreement.</p>

      <h2>Reporting abuse</h2>
      <ul>
        <li>Email: <code>abuse@inferlane.dev</code></li>
        <li>Discord: <code>#report-abuse</code> (private channel; visible only to moderators)</li>
        <li>Urgent (CSAM, imminent violence): include "URGENT" in the subject line; we respond within 4 hours</li>
      </ul>

      <h2>Changes to this policy</h2>
      <p>We update this policy as law and operational experience evolve. Material changes are announced 30 days in advance in our monthly transparency report and on Discord. Continued use after a change constitutes acceptance.</p>

      <h2>Questions</h2>
      <ul>
        <li>General: <code>support@inferlane.dev</code></li>
        <li>Legal process / law enforcement: <code>legal@inferlane.dev</code></li>
        <li>Privacy / data requests: <code>privacy@inferlane.dev</code></li>
      </ul>
    </LegalShell>
  );
}

function OperatorAgreementPage() {
  return (
    <LegalShell title="Operator Agreement" updated="2026-04-22" eyebrow="Governance" pending>
      <p className="legal-hint">Not legal advice. This is our operational agreement. Where it conflicts with local law in your jurisdiction, local law prevails.</p>

      <p>This agreement covers the relationship between InferLane and people running our daemon to serve inference on the peer network. It sits alongside our <a href="#terms">Terms of Service</a> and <a href="#aup">Acceptable Use Policy</a>.</p>

      <h2>Your status</h2>
      <p>You are an <strong>independent contractor</strong>, not an employee, agent, partner, or joint venturer of InferLane. You run a daemon on hardware you own or control, and you earn kT credits in exchange for serving inference requests routed to you by our coordinator. The Service currently operates in a credits-only mode: kT credits are redeemable for inference on the network and do not convert to cash, currency, or any other asset.</p>
      <p>You are responsible for your own taxes, insurance, and compliance with local employment and business registration laws in your jurisdiction.</p>

      <h2>What you agree to do</h2>
      <ol>
        <li><strong>Run only the approved daemon binary.</strong> Signed releases are published at <code>releases.inferlane.dev</code> with SHA-256 hashes. Running modified binaries voids this agreement and forfeits pending payouts.</li>
        <li><strong>Keep your daemon up to date.</strong> Security patches are released via the self-update channel. Opt-out is limited to 14 days per release.</li>
        <li><strong>Maintain reasonable uptime.</strong> We target 95%+ for active operators; sustained uptime below 70% over a rolling 30-day window deactivates your operator profile until hardware/network issues are resolved.</li>
        <li><strong>Not log or persist prompts or responses</strong> beyond the RAM lifetime of the request. No writing prompts to disk, stdout, or remote endpoints; no sampling or training-data extraction; no retention of model-context windows across requests.</li>
        <li><strong>Not modify model behaviour.</strong> The coordinator routes specific model versions; you serve exactly the version requested. No substitution, no proxy-level transforms, no system-prompt injection.</li>
        <li><strong>Serve all requests routed to you</strong> subject to the moderation gate at the coordinator. You do not have personal veto power over routed content.</li>
        <li><strong>Keep your operator credentials secure.</strong> Hardware-bound keys (Secure Enclave on macOS, TPM on Windows, HSM where available). Compromised keys must be rotated via <code>inferlane daemon rotate-key</code> within 24 hours of discovery.</li>
      </ol>

      <h2>What InferLane agrees to do</h2>
      <ol>
        <li><strong>Route inference fairly.</strong> Routing decisions weight price, latency, reliability, and operator reputation — not personal relationships. Algorithm documented at <code>/docs/routing</code>.</li>
        <li><strong>Operate the moderation gate.</strong> Prohibited content is blocked before it reaches your node.</li>
        <li><strong>Credit you with what you&apos;ve earned</strong> weekly in kT credits. The Service operates in a credits-only mode; no cash payouts are offered. Disputes resolved within 14 days.</li>
        <li><strong>Not disclose your identity</strong> without your consent or valid legal process. Operator profiles are pseudonymous unless you opt into public attribution.</li>
        <li><strong>Give you 30 days' notice</strong> of material changes to this agreement. Minor technical updates (daemon versions, routing tweaks) may be made without notice.</li>
      </ol>

      <h2>Indemnification</h2>
      <p><strong>You indemnify InferLane</strong> (including its officers, employees, and agents) against all claims, damages, losses, liabilities, costs, and expenses (including legal fees) arising out of or related to:</p>
      <ul>
        <li>Your operation of the daemon or participation in the network</li>
        <li>Your violation of this agreement, the Terms of Service, or the Acceptable Use Policy</li>
        <li>Your violation of any law (including local business registration, tax, employment, privacy, data protection, or export-control laws)</li>
        <li>Running modified, unauthorised, or out-of-date daemon code</li>
        <li>Logging, storing, analysing, or transmitting prompts or responses</li>
        <li>Abuse of the credit ledger or payout system</li>
        <li>Any claim brought against InferLane by a third party in connection with your node, your hardware, or your conduct as an operator</li>
      </ul>
      <p><strong>InferLane does not indemnify operators.</strong> You are an independent contractor operating your own hardware in your own jurisdiction. You are responsible for your own legal compliance, insurance, and tax obligations.</p>

      <p><strong>What we do instead of indemnifying you:</strong></p>
      <ul>
        <li>We operate a moderation gate at the coordinator that rejects prohibited content <em>before</em> it is routed to your node. This reduces — but does not eliminate — the risk of you processing harmful content.</li>
        <li>We publish a clear Acceptable Use Policy that consumers must accept before using the network.</li>
        <li>We cooperate with valid legal process and may disclose operator-identifying information only when legally compelled.</li>
        <li>We do not proactively monitor your node beyond operational telemetry required to route traffic.</li>
        <li>You benefit from intermediary-liability protections available in your jurisdiction (e.g. Section 230 in the US, Online Safety Act safe harbour in Australia, DSA hosting-service provisions in the EU) <strong>to the extent applicable to your role and conduct</strong>. Availability depends on your facts and jurisdiction and is not guaranteed by this agreement.</li>
      </ul>
      <p><strong>You should consult your own legal counsel</strong> before becoming an operator. If you are not comfortable accepting the liability position described here, do not register as an operator.</p>

      <h2>Payment — kT credits (launch phase)</h2>
      <ul>
        <li>Earned at the rate published in <code>/docs/rates</code> (initially 0.8 kT per 1,000 Llama-70B-equivalent tokens served, with multipliers for frontier and confidential tiers)</li>
        <li>Credited to your operator balance within 15 minutes of request completion and moderation review</li>
        <li>Credits expire 6 months from earning, except contribution-kT earned via the marketplace which never expires</li>
        <li>Maximum balance: 10,000,000 kT (prevents speculation; adjust via governance vote)</li>
      </ul>

      <h2>Cash payouts — not currently offered</h2>
      <ul>
        <li><strong>Weekly</strong> settlements via Stripe Connect (or alternative provider as available in your jurisdiction)</li>
        <li><strong>Minimum payout threshold:</strong> USD $20</li>
        <li><strong>Platform fee:</strong> 10% of gross operator earnings</li>
        <li><strong>Tax reporting:</strong> 1099-MISC (US) or equivalent where required above regulatory thresholds</li>
        <li><strong>KYC required</strong> not applicable — cash payouts are not offered</li>
        <li><strong>Currency:</strong> paid in USD by default; local currency via Stripe FX where supported</li>
      </ul>

      <h2>Clawbacks</h2>
      <p>We may reverse credits within 30 days of issuance if:</p>
      <ul>
        <li>Post-review audit finds the request violated our AUP and was incorrectly routed (we absorb the cost; you aren't charged)</li>
        <li>The operator was found to have violated this agreement (your earnings for the violating period are forfeited)</li>
        <li>A consumer chargeback is upheld (pro-rata deduction; we maintain a 2% reserve against this risk)</li>
      </ul>

      <h2>Termination</h2>
      <ul>
        <li><strong>You leave:</strong> deactivate your daemon. Future routing stops immediately. Credits from the last 30 days are paid on the normal schedule. Credits older than 30 days can be redeemed for inference within 6 months of termination.</li>
        <li><strong>We terminate you for cause</strong> (violation of this agreement, AUP, or ToS): immediate deactivation. Forfeiture of pending earnings. Public naming reserved for egregious violations.</li>
        <li><strong>We wind down the service:</strong> 90 days' notice. Earned credits become cashable at the published rate during the wind-down period.</li>
      </ul>

      <h2>Governing law</h2>
      <p>This agreement is governed by the laws of Australia. Disputes proceed in AU courts, or by agreement in your local jurisdiction. If a specific operator-protection law applies in your jurisdiction (e.g. EU platform-to-business regulation), that law prevails.</p>

      <h2>Signing</h2>
      <p>You accept this agreement by:</p>
      <ol>
        <li>Running <code>inferlane daemon register</code></li>
        <li>Providing an email for operational notices</li>
        <li>Clicking through the acceptance dialog on first start</li>
      </ol>
      <p>A signed copy is stored locally at <code>~/.config/inferlane/operator-agreement.pdf</code> and a hash is recorded on our coordinator for dispute resolution.</p>

      <h2>Questions</h2>
      <ul>
        <li>General: <code>operators@inferlane.dev</code></li>
        <li>Legal: <code>legal@inferlane.dev</code></li>
        <li>Support: Discord <code>#operator-support</code></li>
      </ul>
    </LegalShell>
  );
}

function CodeOfConductPage() {
  return (
    <LegalShell title="Code of Conduct" updated="2026-04-22" eyebrow="Governance">
      <h2>Our pledge</h2>
      <p>We want InferLane to be a community where everyone — contributors, operators, consumers, and maintainers — feels welcome and safe to participate. We commit to this regardless of age, body size, disability, ethnicity, gender identity or expression, experience level, education, socioeconomic status, nationality, personal appearance, race, religion, or sexual identity or orientation.</p>

      <h2>What we expect</h2>
      <ul>
        <li><strong>Be respectful.</strong> Disagree with ideas, not people.</li>
        <li><strong>Assume good faith.</strong> Most friction is miscommunication, not malice.</li>
        <li><strong>Credit people's work.</strong> A PR is someone's time; a benchmark submission is someone's electricity bill.</li>
        <li><strong>Be honest about uncertainty.</strong> "I don't know" is almost always the right answer when you don't.</li>
        <li><strong>Share knowledge back.</strong> If someone helped you, help the next person.</li>
      </ul>

      <h2>What's not OK</h2>
      <ul>
        <li>Harassment, discrimination, or personal attacks of any kind</li>
        <li>Sexualised language or imagery in community spaces</li>
        <li>Doxxing or sharing private information without consent</li>
        <li>Sustained disruption of discussion, talks, or events</li>
        <li>Using contribution status as leverage for special treatment</li>
        <li>Running inference traffic that violates our <a href="#aup">Acceptable Use Policy</a></li>
      </ul>

      <h2>Enforcement</h2>
      <p>Maintainers may warn, mute, or ban participants who violate this code. Decisions are final but reviewable — if you think we got it wrong, email <code>conduct@inferlane.dev</code> and another maintainer will review.</p>
      <p>Bans from the codebase or Discord also suspend any contribution-reward kT balance. Credits earned through abusive means (sock-puppet PRs, gamed benchmarks) will be revoked.</p>

      <h2>Reporting</h2>
      <p>If you experience or witness unacceptable behaviour, email <code>conduct@inferlane.dev</code>. We read every report. You don't need to be the target — bystander reports are welcome. Reports are handled privately unless you ask us to go public.</p>

      <h2>Scope</h2>
      <p>This applies in all community spaces: GitHub, Discord, Twitter/X replies, in-person events, and any other space where you're representing InferLane.</p>

      <h2>Attribution</h2>
      <p>Adapted from the Contributor Covenant 2.1, trimmed and rewritten for an inference network rather than a pure code project.</p>
    </LegalShell>
  );
}

Object.assign(window, { AupPage, OperatorAgreementPage, CodeOfConductPage });
