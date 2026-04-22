// /transparency — the honest economics page.
//
// Tells visitors how InferLane makes money, how routing decisions
// are made, and which rebate arrangements we have with providers.
// This page exists because the "free at the surface" model only
// works if users trust it, and trust comes from being upfront about
// where the money flows.

export const metadata = {
  title: 'Transparency — InferLane',
  description:
    'How InferLane makes money, how routing decisions are made, and where your wallet balance actually lives.',
};

import PublicNav from '@/components/PublicNav';

export default function TransparencyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
    <PublicNav />
    <div className="mx-auto max-w-3xl px-6 py-10 text-gray-200">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Transparency</h1>
      <p className="text-lg text-gray-400 mb-10">
        InferLane is free at the point of use for most workloads. This page
        tells you exactly how that works, so you can verify that our
        incentives line up with yours.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          How we make money
        </h2>
        <p className="text-gray-400 mb-4">
          We have four independent revenue legs. None of them requires
          charging you per request.
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">1. Routing markup</h3>
            <p className="text-sm text-gray-400">
              When you route traffic through our hosted endpoint using your
              own provider API key, we add a small percentage markup on
              the provider&apos;s cost (typically 5–10%). The markup funds
              the router, moderation gate, and fuel gauge you&apos;re using.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">2. Provider rebates</h3>
            <p className="text-sm text-gray-400">
              We route enough volume to qualify for privately-negotiated
              rates with many model providers. We quote you near rack rate
              and are invoiced at the partnership rate. The delta is our
              revenue. See the rebate table below for the providers we
              have disclosed arrangements with.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">3. Capacity commitments</h3>
            <p className="text-sm text-gray-400">
              Enterprise customers can pre-purchase a block of inference
              capacity for a specified period at a fixed per-token rate.
              This is a commercial volume commitment — not a financial
              instrument, not tradeable, not transferable to other parties.
              The difference between their committed rate and the spot
              rate at fulfilment is our margin (positive or negative).
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">
              4. Premium surfaces (Pro, Enterprise)
            </h3>
            <p className="text-sm text-gray-400">
              Advanced tooling (team budgets, Slack alerts, SSO, audit
              logs, dedicated capacity) is sold as a subscription. Routing
              itself is never behind a paywall.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">5. Peer-network platform share</h3>
            <p className="text-sm text-gray-400">
              When consumers pay for inference served by peer operators on
              our network, operators are credited 90% of the service value
              in kT credits and we retain 10% as the platform share. kT
              credits are redeemable for inference on the network — they{' '}
              <strong className="text-amber-300">do not convert to cash</strong>.
              The Service operates in a credits-only mode. See the
              &quot;What InferLane is not&quot; box below.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="font-semibold text-amber-200 mb-2">What InferLane is not</h3>
          <ul className="text-sm text-amber-100/90 space-y-1.5 list-disc list-inside">
            <li>Not a bank, money transmitter, or money services business</li>
            <li>Not a broker-dealer, futures commission merchant, or securities exchange</li>
            <li>Not a deposit-taking institution</li>
            <li>Not a custodian of customer funds — Stripe (or equivalent licensed processor) holds funds; we record the service-credit balance</li>
            <li>Not an issuer of securities, tokens, or cryptocurrency</li>
            <li>Not a provider of investment, legal, tax, or financial advice</li>
          </ul>
          <p className="mt-3 text-xs text-amber-100/70">
            kT credits are service units redeemable for inference on the
            network. They are not a financial product. They have no
            investment character and no claim on InferLane revenue or
            assets. <strong>Credits do not convert to cash.</strong> The
            Service operates in a credits-only mode. If a cash pathway is
            introduced in the future, operators will need to separately
            opt in under new terms; existing credit balances will not be
            converted.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          The anti-conflict guarantee
        </h2>
        <p className="text-gray-400 mb-3">
          We explicitly cap the influence of rebate arrangements on
          routing decisions at 5% of the composite score. A provider with
          a bigger rebate can never beat a provider with better quality,
          lower cost, or lower latency. The rebate is only a tiebreaker
          when two candidates are within 0.5% of each other on the
          composite score.
        </p>
        <p className="text-gray-400">
          This is enforced in code at{' '}
          <a
            href="https://github.com/ComputeGauge/inferlane/blob/main/src/lib/proxy/router-commercial.ts"
            className="underline text-indigo-400 hover:text-indigo-300"
          >
            src/lib/proxy/router-commercial.ts
          </a>
          . You can audit it.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Where your wallet balance lives
        </h2>
        <p className="text-gray-400 mb-3">
          Prepaid balances are held by our licensed payment processor
          (Stripe) under their regulated payment-services arrangements.
          InferLane does not hold customer funds directly. We do not
          operate as a bank, money transmitter, money services business,
          securities broker, exchange, or qualified custodian. We record
          a service-credit balance that corresponds to the processor-held
          prepayment; we do not take custody of your money.
        </p>
        <p className="text-gray-400">
          The double-entry ledger that tracks your balance is auditable
          and reconciled nightly. Any discrepancy freezes the money
          layer until it&apos;s resolved.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Provider rebate arrangements
        </h2>
        <p className="text-gray-400 mb-4">
          We publish the providers we have disclosed rebate arrangements
          with. Specific percentages are negotiated privately and fall
          into ranges disclosed here.
        </p>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 text-sm text-gray-400">
          <p>
            No disclosed rebate arrangements are active yet — we&apos;re
            pre-launch. This list will populate as we sign partnership
            rate agreements and as customers reach volumes that qualify
            for their own disclosed discounts.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Privacy tiers &mdash; what we can and can&apos;t guarantee
        </h2>
        <p className="text-gray-400 mb-4">
          Different workloads have different privacy requirements. We route
          accordingly and are upfront about what each tier actually provides.
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <h3 className="font-semibold text-white">Cloud TEE &mdash; verifiable confidentiality</h3>
            </div>
            <p className="text-sm text-gray-400">
              Workloads route to providers with hardware-backed Trusted
              Execution Environments (Azure Confidential Computing, AWS
              Nitro Enclaves). Attestation is cryptographically verified.
              Use this for PII, financial data, and compliance-sensitive
              workloads (HIPAA, SOC 2).
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h3 className="font-semibold text-white">Cloud Standard &mdash; contractual privacy</h3>
            </div>
            <p className="text-sm text-gray-400">
              Workloads route to major cloud providers (Anthropic, OpenAI,
              Google). Privacy is backed by their terms of service and data
              processing agreements, not hardware attestation. Suitable for
              business data that isn&apos;t regulated.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
              <h3 className="font-semibold text-white">Best Effort &mdash; OS-level hardening only</h3>
            </div>
            <p className="text-sm text-gray-400">
              Workloads may route to community or decentralized nodes.
              Privacy relies on OS-level protections (SIP, hardened
              runtime) &mdash; not hardware enclaves. There is no way to
              cryptographically verify that a consumer Mac is running
              untampered code today.{' '}
              <strong className="text-gray-300">
                This tier is appropriate for public data, non-sensitive
                classification, and image generation &mdash; not for PII
                or confidential business data.
              </strong>
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Our routing engine selects the appropriate privacy tier
          automatically based on your configured policy. You can override
          per-request via the <code className="text-gray-400">privacyTier</code> parameter
          in the dispatch API, or set a default policy in your dashboard
          settings.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Subprocessors
        </h2>
        <p className="text-gray-400">
          The full list of third-party services InferLane uses to
          process customer data is at{' '}
          <a
            href="/legal/subprocessors"
            className="underline text-indigo-400 hover:text-indigo-300"
          >
            inferlane.dev/legal/subprocessors
          </a>
          . We give 14-day notice of changes to customers on enterprise
          contracts.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Security
        </h2>
        <ul className="text-gray-400 space-y-2 list-disc list-inside">
          <li>
            Responsible disclosure:{' '}
            <a href="/.well-known/security.txt" className="underline text-indigo-400">
              security.txt
            </a>
          </li>
          <li>
            Contact:{' '}
            <a href="mailto:security@inferlane.dev" className="underline text-indigo-400">
              security@inferlane.dev
            </a>
          </li>
          <li>
            Our ASVS L2 self-audit is public at{' '}
            <a
              href="https://github.com/ComputeGauge/inferlane/blob/main/commercial/security/asvs-l2.md"
              className="underline text-indigo-400"
            >
              commercial/security/asvs-l2.md
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Proxy latency overhead
        </h2>
        <p className="text-gray-400 mb-4">
          Every request through InferLane adds routing overhead (auth, model
          selection, provider lookup, cost logging). Here are real measurements
          from April 2026 — a minimal Haiku request, from Sydney to
          us-east-1 (Vercel + Anthropic):
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 text-center">
            <p className="text-3xl font-mono font-bold text-white">~750ms</p>
            <p className="text-sm text-gray-500 mt-1">Direct to Anthropic</p>
          </div>
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 text-center">
            <p className="text-3xl font-mono font-bold text-amber-400">~1.5s</p>
            <p className="text-sm text-gray-500 mt-1">Through InferLane proxy</p>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Overhead is ~500&ndash;800ms, mostly Vercel serverless cold starts
          and the routing DB lookup. For a typical 5&ndash;30 second inference
          call, this is 2&ndash;10% added latency. The MCP tools
          (<code className="text-gray-400">pick_model</code>,{' '}
          <code className="text-gray-400">session_cost</code>) run locally
          with zero network overhead. We plan to move the routing decision
          to Vercel Edge Functions to bring overhead under 50ms.
        </p>
      </section>

      <footer className="pt-10 mt-12 border-t border-[#1e1e2e] text-sm text-gray-500">
        Last updated: 2026-04-16. This page is version-controlled in the
        public repo; the git history is the change log.
      </footer>
    </div>
    </div>
  );
}
