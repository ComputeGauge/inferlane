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
        contributors whose components are adopted by users.{' '}
        <strong>Credits can only be spent on inference on the network.
        They do not convert to cash, currency, or any other asset.</strong>
      </p>
      <div className="not-prose rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 my-6 text-sm text-amber-100/90">
        <p className="font-semibold text-amber-300 mb-2">Current operating mode: credits only</p>
        <p>
          InferLane currently operates in a <strong>credits-only mode</strong>.
          No cash-payout pathway for kT credits exists. If, at any future
          point, InferLane introduces a cash-payout pathway, participation
          will require <strong>separate affirmative opt-in</strong> by the
          operator, acceptance of new path-specific terms, and completion
          of identity verification (KYC) as required by our licensed payment
          processor at the time. Existing kT credit balances will{' '}
          <strong>not</strong> be converted to cash as part of any such
          future arrangement. Operators who wish to receive cash for work
          performed (if and when that pathway is introduced) must elect
          cash payment going forward only; the credit path and the cash
          path (if any) operate as independent systems.
        </p>
      </div>
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
        <li><strong>Not</strong> convertible to cash, currency, or any other asset — credits are redeemable only for inference on the InferLane network</li>
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

      <h2>Why we are not a security under Howey (US)</h2>
      <p>
        The Howey test asks whether a contract or scheme constitutes an
        &quot;investment contract&quot; by requiring ALL four prongs:{' '}
        <strong>(1)</strong> investment of money,{' '}
        <strong>(2)</strong> in a common enterprise,{' '}
        <strong>(3)</strong> with expectation of profit,{' '}
        <strong>(4)</strong> derived from the efforts of others. InferLane
        fails prong (3) unambiguously:
      </p>
      <ul>
        <li>kT credits redeem <strong>only</strong> for inference service on our network</li>
        <li>kT have <strong>no cash-conversion path</strong> — earning credits cannot result in receiving dollars, cryptocurrency, or any other asset</li>
        <li>The Service currently operates in a <strong>credits-only mode</strong>; no cash-payout pathway exists</li>
        <li>If a cash pathway is ever introduced, it will require a separate opt-in under new terms — it is not a conversion of existing credits</li>
        <li>Credits have a <strong>fixed face rate</strong> (1 kT = 1,000 Llama-70B-equivalent tokens of inference); they do not appreciate</li>
        <li>Credits are non-transferable between users; there is no secondary market</li>
        <li>Credits expire 6 months from earn date — they cannot be held as an investment</li>
      </ul>
      <p>
        The structure matches gift-card and loyalty-points precedent (e.g.
        <em>In re JetBlue Airways Corp. Securities Litigation</em>) where
        courts have repeatedly held that redemption-for-service units are
        not securities.
      </p>

      <h2>Why we are not subject to CFTC (US commodities / derivatives)</h2>
      <p>
        The Commodity Exchange Act covers trading of commodities, futures,
        forwards, swaps, and options. InferLane offers none of these:
      </p>
      <ul>
        <li>No commodity trading — kT are service-redemption units, not commodities</li>
        <li>No futures or forward contracts — enterprise &quot;capacity commitments&quot; are <strong>prepaid service bundles</strong> with fixed pricing set at purchase, not price-locked forward delivery contracts</li>
        <li>No swaps, options, or derivatives of any kind</li>
        <li>No exchange or trading facility operated by us</li>
      </ul>
      <p>
        Prepaid service bundles (&quot;pay $X today, use up to Y tokens by
        date Z&quot;) are the same legal structure as mobile-phone prepaid
        plans or cloud-provider reserved instances — commercial bundles,
        not derivatives.
      </p>

      <h2>Why we are not a Money Services Business (FinCEN / AUSTRAC)</h2>
      <p>
        A money services business holds customer funds, transmits money
        between parties, or exchanges currency. InferLane does none of
        these:
      </p>
      <ul>
        <li><strong>Stripe holds 100% of customer funds.</strong> Always. We do not have merchant accounts for customer prepayments beyond Stripe&apos;s licensed arrangements.</li>
        <li><strong>Operator payouts flow through Stripe Connect.</strong> Stripe is the licensed money transmitter; we record the earning event and instruct Stripe.</li>
        <li><strong>No customer-to-customer money transmission.</strong> We never move dollars from one user to another.</li>
        <li><strong>No currency exchange.</strong> We do not convert USD to any other currency, virtual or otherwise.</li>
        <li><strong>No float yield.</strong> We do not earn yield on prepaid customer balances. Any float yield remains with Stripe under their arrangement.</li>
      </ul>

      <h2>Why we are not a Virtual Asset Service Provider</h2>
      <p>
        VASP registration under the FATF framework (implemented nationally
        as AUSTRAC in Australia, FinCEN MSB in the US, MiCA in the EU, FCA
        registration in the UK) covers crypto exchange, transfer, custody,
        and issuance. InferLane touches no virtual assets:
      </p>
      <ul>
        <li>No cryptocurrency accepted as payment</li>
        <li>No cryptocurrency paid out to operators</li>
        <li>No token on any blockchain — kT is a database row, not an on-chain asset</li>
        <li>No custody of user-owned crypto</li>
        <li>No exchange functionality — not between crypto-and-fiat, not between any two assets</li>
      </ul>

      <h2>Why we are not carrying on a regulated activity under FSMA (UK)</h2>
      <p>
        The Financial Services and Markets Act regulates a closed list of
        activities in the UK. InferLane matches none of the captured
        categories:
      </p>
      <ul>
        <li>Not accepting deposits — prepayments are held by Stripe under their licensed arrangement; customers have no banking-style claim</li>
        <li>Not dealing in investments — kT are not securities, not derivatives, not collective investment schemes</li>
        <li>Not running a multilateral trading facility — no user-to-user trading of credits</li>
        <li>Not providing investment advice — our routing recommendations are cost/quality routing, not investment recommendations</li>
      </ul>

      <h2>Why we are not offering a financial product under Australian law</h2>
      <p>
        The Australian <em>Corporations Act 2001</em> defines a financial
        product broadly to cover investment, risk management, and non-cash
        payment facilities. InferLane&apos;s credits fall within established
        exemptions, not the regulated categories:
      </p>
      <ul>
        <li>Credits are <strong>not an investment</strong> — no expectation of return, no appreciation, no pooled enterprise</li>
        <li>Credits are <strong>not a risk-management product</strong> — no hedging, no insurance-like protection</li>
        <li>Credits are <strong>not a non-cash payment facility</strong> (NCPF) — they redeem only for our own services, not for third-party payments. This tracks the &quot;limited payment facility&quot; carve-out (ASIC regulatory guide 185, Corporations Regulation 7.1.07G for loyalty schemes)</li>
        <li>Credits are non-transferable, time-limited, and redeemable only for InferLane inference — the classic gift-card / loyalty-scheme profile</li>
      </ul>
      <p>
        We are not dealing in financial products, not operating a financial
        market, and not providing financial product advice. We do not hold
        or require an Australian Financial Services Licence.
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
