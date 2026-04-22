import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Not a Financial Product — InferLane',
  description: 'InferLane, kT credits, and operator earnings are not financial products. Plain-language disclosure of what we are not.',
};

export default function NotAFinancialProductPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
      <h1>Not a Financial Product</h1>
      <p className="text-sm text-zinc-400">Effective: April 22, 2026 · Last updated: April 22, 2026</p>

      <div className="not-prose rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200 mb-10">
        <p className="font-semibold text-amber-300 mb-1">Plain-language disclosure</p>
        <p className="text-amber-200/90">
          This page exists to make it unambiguous that InferLane, its
          credits, its marketplace, and its operator earnings are
          <strong> not financial products, not securities, and not
          regulated financial services</strong>. If you&apos;re reading
          this because you&apos;re evaluating InferLane under a financial-
          regulation framework, the summary here is the short version of
          what&apos;s already in our Terms of Service, Operator Agreement,
          and Transparency page.
        </p>
      </div>

      <h2>What InferLane is not</h2>
      <ul>
        <li><strong>Not a bank</strong> or deposit-taking institution</li>
        <li><strong>Not a money transmitter</strong> or money services business (MSB). Customer funds are held by our licensed payment processor (Stripe) under their regulated arrangements. We do not take custody of your money.</li>
        <li><strong>Not a securities broker-dealer, exchange, or alternative trading system (ATS)</strong></li>
        <li><strong>Not a futures commission merchant</strong> (FCM), commodity pool operator (CPO), or commodity trading advisor (CTA)</li>
        <li><strong>Not a qualified custodian</strong> of securities or digital assets</li>
        <li><strong>Not a crypto exchange</strong>, stablecoin issuer, virtual asset service provider (VASP), or DeFi protocol</li>
        <li><strong>Not an investment adviser</strong> or provider of investment, legal, tax, or financial advice</li>
        <li><strong>Not offering investment contracts</strong> under the Howey test or its international analogues — InferLane does not pool capital, does not promise returns, and does not derive its operations or any advertised return from third-party investment</li>
      </ul>

      <h2>What kT credits are not</h2>
      <p>
        Credits are denominated in <code>kT</code> (&quot;kilotokens&quot;) and
        are earned by operators who serve inference on the network or by
        contributors whose components are adopted by users. Credits can be
        spent on inference from the network or, where offered, redeemed for
        cash at face value through our licensed payment processor.
      </p>
      <p>For the avoidance of doubt, kT credits are:</p>
      <ul>
        <li><strong>Not</strong> a security, investment contract, note, or other regulated financial instrument</li>
        <li><strong>Not</strong> currency, legal tender, e-money, or a stablecoin</li>
        <li><strong>Not</strong> a cryptocurrency, token on any blockchain, or digital asset</li>
        <li><strong>Not</strong> a deposit or deposit-equivalent</li>
        <li><strong>Not</strong> a derivative, future, forward, option, or swap</li>
        <li><strong>Not</strong> a claim on InferLane revenue, assets, profits, or equity</li>
        <li><strong>Not</strong> transferable between users on a secondary market</li>
        <li><strong>Not</strong> tradeable on any exchange</li>
        <li><strong>Not</strong> permitted to be pledged, staked, or used as collateral</li>
      </ul>
      <p>Credits carry:</p>
      <ul>
        <li><strong>No</strong> investment character</li>
        <li><strong>No</strong> expectation of profit</li>
        <li><strong>No</strong> yield, interest, or appreciation</li>
        <li><strong>No</strong> voting rights in InferLane</li>
        <li><strong>No</strong> residual claim on InferLane in insolvency</li>
      </ul>

      <h2>What operator earnings are not</h2>
      <p>
        Running an InferLane node is independent-contractor work. Earnings
        are compensation for work performed (serving inference routed to
        your hardware). They are <strong>not</strong>:
      </p>
      <ul>
        <li>A dividend, yield, or distribution</li>
        <li>A share of InferLane&apos;s revenue or profits</li>
        <li>A return on an investment in InferLane</li>
        <li>A guaranteed income, annuity, or pension</li>
      </ul>
      <p>
        You do not purchase or own a stake in InferLane by becoming an
        operator. You can leave at any time and your future earnings stop
        at that point.
      </p>

      <h2>What the marketplace is not</h2>
      <p>
        The contributor marketplace pays creators a percentage of the
        direct sales of their components (widgets, themes, routing
        policies, adapters, plugins). This is a commercial commission —
        the same structure as app stores, creator platforms, and affiliate
        programmes. It is <strong>not</strong>:
      </p>
      <ul>
        <li>An investment contract</li>
        <li>A profit-sharing security</li>
        <li>A claim on InferLane revenue beyond payment for your specific component&apos;s attributed sales</li>
        <li>An equity grant, option, or synthetic equity</li>
      </ul>

      <h2>What the capacity-commitment offering is not</h2>
      <p>
        Enterprise customers may pre-purchase a block of inference
        capacity at a fixed per-token rate for a specified period
        (&quot;capacity commitments&quot;). This is a commercial volume
        commitment, the same as a bulk prepaid service contract. It is
        <strong> not</strong>:
      </p>
      <ul>
        <li>A futures, forward, or option contract</li>
        <li>A derivative of any kind</li>
        <li>Tradeable, transferable, or settable outside the contracted customer</li>
        <li>A financial instrument or security</li>
      </ul>
      <p>
        The difference between the customer&apos;s committed rate and the
        spot rate at fulfilment is accounted for as commercial margin
        (positive or negative), not as trading gains or losses.
      </p>

      <h2>If you think we&apos;re one of the above</h2>
      <p>
        If you are a regulator, lawyer, or compliance officer and you
        believe InferLane&apos;s structure falls within a regulated
        financial-services definition in your jurisdiction,{' '}
        <strong>please reach us at <code>legal@inferlane.dev</code></strong>{' '}
        before taking any public or enforcement step. We are happy to
        provide documentation, walk through the operational flow, and
        restructure any element that crosses a line we haven&apos;t seen.
        We have no interest in operating as an unlicensed financial
        institution and every interest in being compliant.
      </p>

      <h2>Nothing here is advice</h2>
      <p>
        This page is our own disclosure of what we are and are not. It
        does not constitute legal, financial, tax, or regulatory advice
        to you. If you&apos;re making decisions based on any of the above,
        consult your own advisors.
      </p>

      <p className="text-sm text-zinc-500 mt-10">
        See also:{' '}
        <Link href="/terms">Terms of Service</Link> ·{' '}
        <Link href="/operator-agreement">Operator Agreement</Link> ·{' '}
        <Link href="/transparency">Transparency</Link>
      </p>
    </main>
  );
}
