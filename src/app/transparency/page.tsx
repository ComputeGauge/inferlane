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

export default function TransparencyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-200">
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
            <h3 className="font-semibold text-white mb-1">1. Float on deposits</h3>
            <p className="text-sm text-gray-400">
              Your prepaid wallet balance sits in FDIC-insured partner
              accounts until you use it. We keep the Treasury yield on the
              held balance. This is how Tether and Stripe Treasury make
              most of their money too — we just made it explicit.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">2. Provider rebates</h3>
            <p className="text-sm text-gray-400">
              We route enough volume to qualify for privately-negotiated
              rates with many model providers. We quote you near rack rate
              and are invoiced at the partnership rate. The delta is our
              revenue. See the rebate table below for the providers we
              have arrangements with.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">3. Compute futures spread</h3>
            <p className="text-sm text-gray-400">
              InferLane runs a compute futures market where buyers can
              lock in forward prices on inference capacity. We earn a
              standard exchange spread and settlement fee on trades. This
              revenue only applies to the futures market, not to your
              routine routing.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="font-semibold text-white mb-1">
              4. Premium surfaces (Pro, Enterprise, Supplier)
            </h3>
            <p className="text-sm text-gray-400">
              Advanced tooling (session history, chain builder, SSO,
              DPA negotiation, dedicated capacity) is sold as a
              subscription. Routing itself is never behind a paywall.
            </p>
          </div>
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
          Prepaid balances are held at licensed partner banks via Stripe
          Treasury (FDIC-insured) and, for operator payouts in
          jurisdictions Stripe doesn&apos;t reach, via Fireblocks (qualified
          custodian). InferLane does not hold customer funds directly;
          we are a customer of the partner, not a money transmitter.
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

      <footer className="pt-10 mt-12 border-t border-[#1e1e2e] text-sm text-gray-500">
        Last updated: 2026-04-15. This page is version-controlled in the
        public repo; the git history is the change log.
      </footer>
    </div>
  );
}
