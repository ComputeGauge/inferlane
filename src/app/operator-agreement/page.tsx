import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Operator Agreement — InferLane',
  description: 'The agreement between InferLane and people running the node daemon. One-way indemnification (operators indemnify us, we do not indemnify operators).',
};

export default function OperatorAgreementPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
      <h1>Operator Agreement</h1>
      <p className="text-sm text-zinc-400">Effective: April 22, 2026</p>

      <div className="not-prose rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200 mb-10">
        <p className="font-semibold text-amber-300 mb-1">Pending counsel review</p>
        <p className="text-amber-200/90">
          This Operator Agreement reflects the product&apos;s compliance
          posture. It will be finalised by external counsel before operators
          can register.
        </p>
      </div>

      <p>
        This agreement covers the relationship between InferLane and people
        running our daemon to serve inference on the peer network. It sits
        alongside our <Link href="/terms">Terms of Service</Link> and{' '}
        <Link href="/aup">Acceptable Use Policy</Link>. Where it conflicts
        with local law in your jurisdiction, local law prevails.
      </p>

      <h2>1. Your status</h2>
      <p>
        You are an <strong>independent contractor</strong>, not an employee,
        agent, partner, or joint venturer of InferLane. You run a daemon on
        hardware you own or control, and you earn kT credits (and,
        eventually, cash) in exchange for serving inference requests routed
        to you by our coordinator. You are responsible for your own taxes,
        insurance, and compliance with local employment and business
        registration laws in your jurisdiction.
      </p>

      <h2>2. What you agree to do</h2>
      <ol>
        <li><strong>Run only the approved daemon binary.</strong> Signed releases at <code>releases.inferlane.dev</code> with SHA-256 hashes. Running modified binaries voids this agreement and forfeits pending payouts.</li>
        <li><strong>Keep the daemon up to date.</strong> Security patches release via the self-update channel. Opt-out limited to 14 days per release.</li>
        <li><strong>Maintain reasonable uptime.</strong> Sustained uptime below 70% over 30 days deactivates your operator profile until issues are resolved.</li>
        <li><strong>Do not log prompts or responses</strong> beyond RAM lifetime of the request. No writing to disk, stdout, remote endpoints, or any storage. No sampling, statistical collection, or training-data extraction.</li>
        <li><strong>Do not modify model behaviour.</strong> Serve exactly the version requested. No substitution, no proxy-level transforms, no system-prompt injection.</li>
        <li><strong>Serve all requests routed to you</strong> subject to the moderation gate at the coordinator. You do not have personal veto power over routed content.</li>
        <li><strong>Keep your operator credentials secure.</strong> Hardware-bound keys where available (Secure Enclave / TPM / HSM). Compromised keys must be rotated within 24 hours of discovery.</li>
      </ol>

      <h2>3. What InferLane agrees to do</h2>
      <ol>
        <li>Route inference fairly, with published weighting of price / latency / reliability / reputation.</li>
        <li>Operate the moderation gate so prohibited content is blocked before it reaches your node.</li>
        <li>Pay you what you&apos;ve earned on the published schedule — weekly in credits, monthly in cash (when cash payouts launch).</li>
        <li>Not disclose your identity without your consent or valid legal process.</li>
        <li>Give you 30 days&apos; notice of material changes to this agreement.</li>
      </ol>

      <h2>4. Indemnification</h2>
      <p>
        <strong>You indemnify InferLane</strong> (including its officers,
        employees, and agents) against all claims, damages, losses,
        liabilities, costs, and expenses (including legal fees) arising out
        of or related to your operation of the daemon, your violation of
        this agreement or applicable law, your running of modified or
        unauthorised daemon code, your logging or transmission of prompts or
        responses, or any third-party claim in connection with your node,
        your hardware, or your conduct as an operator.
      </p>
      <p>
        <strong>InferLane does not indemnify operators.</strong> You are an
        independent contractor operating your own hardware in your own
        jurisdiction. You are responsible for your own legal compliance,
        insurance, and tax obligations.
      </p>
      <p>
        <strong>What we do instead of indemnification:</strong>
      </p>
      <ul>
        <li>Operate a moderation gate that rejects prohibited content <em>before</em> it is routed to your node</li>
        <li>Publish a clear <Link href="/aup">Acceptable Use Policy</Link> that consumers must accept</li>
        <li>Cooperate with valid legal process and only disclose operator-identifying information when legally compelled</li>
        <li>Not proactively monitor your node beyond operational telemetry (uptime, response-code signals) required to route traffic</li>
      </ul>
      <p>
        You benefit from intermediary-liability protections available in
        your jurisdiction (e.g. Section 230 in the US, Online Safety Act
        safe harbour in Australia, DSA hosting-service provisions in the EU)
        <strong> to the extent applicable to your role and conduct</strong>.
        Availability is not guaranteed by this agreement. You should consult
        your own legal counsel before becoming an operator.
      </p>

      <h2>5. Payment</h2>
      <p>
        <strong>kT credits (launch phase):</strong> earned at the rate at{' '}
        <code>/docs/rates</code> (initially 0.8 kT per 1,000 Llama-70B-equivalent
        tokens served; multipliers for frontier and confidential tiers).
        Credited within 15 minutes of request completion + moderation
        review. Credits expire 6 months from earn date, except contribution
        kT via the marketplace which never expires. Maximum balance: 10M kT.
      </p>
      <p>
        <strong>Cash payouts (Phase 2 — target Month 3):</strong> weekly
        settlements through our licensed payment processor. USD $20 minimum
        payout. 10% platform fee on gross operator earnings. Tax reporting
        via 1099-MISC (US) or equivalent where required. KYC required
        before first cash payout.
      </p>
      <p>
        <strong>Clawbacks:</strong> we may reverse credits or cash within 30
        days of issuance if post-review audit finds an AUP violation was
        incorrectly routed (we absorb the cost; you are not charged) or the
        operator violated this agreement (earnings forfeited).
      </p>

      <div className="not-prose rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-100/90 my-8">
        <p className="font-semibold text-amber-300 mb-2">What kT credits are NOT</p>
        <p>
          Credits and the kT unit are <strong>not</strong> securities,
          investment contracts, cryptocurrency, currency, deposits,
          derivatives, or financial instruments of any kind. They are
          internal service-redemption units earned for inference work
          performed. They carry no investment character, no expectation of
          profit, no yield, and no claim on InferLane revenue or assets.
          They are not transferable between operators except through the
          platform-operated redemption mechanism. They have no market value
          and are not permitted to be traded, pledged, or used as
          collateral. You should not participate as an operator to acquire
          Credits as an investment.
        </p>
      </div>

      <h2>6. Termination</h2>
      <p>
        Either party may terminate at any time. You leave by deactivating
        your daemon. We terminate for cause (agreement/AUP/ToS violation)
        with immediate deactivation and forfeiture. If we wind the service
        down, we give 90 days&apos; notice and earned credits become cashable
        at the published rate during the wind-down.
      </p>

      <h2>7. Governing law</h2>
      <p>
        Governed by the laws of Australia. Disputes proceed in AU courts
        unless mandatory local consumer-protection law overrides.
      </p>

      <h2>8. Signing</h2>
      <p>
        You accept this agreement by running the daemon&apos;s{' '}
        <code>inferlane daemon register</code> command, providing an email
        for operational notices, and clicking through the acceptance dialog
        on first start. A signed copy is stored locally at{' '}
        <code>~/.config/inferlane/operator-agreement.pdf</code> and a hash is
        recorded on our coordinator for dispute resolution.
      </p>

      <p className="text-sm text-zinc-500 mt-10">
        Full text mirrored in the repo at{' '}
        <a href="https://github.com/ComputeGauge/inferlane/blob/main/OPERATOR_AGREEMENT.md">OPERATOR_AGREEMENT.md</a>.
      </p>
    </main>
  );
}
