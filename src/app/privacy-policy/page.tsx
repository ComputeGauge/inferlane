import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — InferLane',
  description: 'InferLane Privacy Policy',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-zinc-400">Effective date: April 16, 2026</p>

      <h2>1. Data We Collect</h2>
      <ul>
        <li><strong>Account data:</strong> Email address, name, and OAuth profile information when you sign up.</li>
        <li><strong>Usage data:</strong> API request metadata (model, provider, token counts, cost, latency, timestamps).</li>
        <li>
          <strong>Prompt content:</strong> Scheduled prompts and prompt templates store user-provided
          prompt content for deferred execution. Proxy requests that transit through InferLane are
          forwarded to the selected LLM provider and are <strong>not</strong> stored by InferLane
          after delivery. Confidential-tier workloads use architecture designed to prevent InferLane
          from accessing prompt content in transit.
        </li>
        <li><strong>Payment data:</strong> Processed by Stripe. We store Stripe customer IDs and subscription status but never store full credit card numbers.</li>
        <li><strong>Technical data:</strong> IP address (for compliance screening and abuse prevention), user agent, and request headers.</li>
        <li><strong>Analytics:</strong> Usage analytics via PostHog, collected only with your explicit consent. No personally identifiable information is sent to PostHog.</li>
      </ul>

      <h2>2. Lawful Basis for Processing</h2>
      <p>Under GDPR Article 6, we process your data on the following legal bases:</p>
      <table>
        <thead>
          <tr><th>Data category</th><th>Lawful basis</th></tr>
        </thead>
        <tbody>
          <tr><td>Account data (name, email, OAuth profile)</td><td>Contract — necessary to provide the Service</td></tr>
          <tr><td>Usage and spend data</td><td>Legitimate interest — service improvement, fraud prevention, and cost optimization</td></tr>
          <tr><td>Payment and billing data</td><td>Contract (providing the Service) and Legal obligation (tax and financial record-keeping)</td></tr>
          <tr><td>IP addresses and audit logs</td><td>Legal obligation — compliance with sanctions/export controls, fraud prevention</td></tr>
          <tr><td>Analytics cookies</td><td>Consent — opt-in via cookie banner; not placed until you consent</td></tr>
          <tr><td>Marketing emails</td><td>Consent — opt-in only, disabled by default</td></tr>
        </tbody>
      </table>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To process payments and manage subscriptions.</li>
        <li>To enforce acceptable-use policies and comply with sanctions/export controls.</li>
        <li>To send transactional emails (welcome, payout confirmations, subscription changes).</li>
        <li>To detect and prevent fraud and abuse.</li>
        <li>To make automated routing decisions (see Section 11).</li>
      </ul>

      <h2>4. Data Retention</h2>
      <ul>
        <li><strong>Account data:</strong> Retained while your account is active. Deleted within 30 days of account deletion request.</li>
        <li><strong>Usage and spend data:</strong> 1 year, then aggregated and anonymized.</li>
        <li><strong>Proxy request logs:</strong> 90 days.</li>
        <li><strong>Audit logs:</strong> 7 years (compliance).</li>
        <li><strong>Financial records:</strong> 7 years (tax and regulatory compliance).</li>
        <li><strong>Waitlist entries:</strong> 12 months, then deleted unless you create an account.</li>
      </ul>

      <h2>5. Your Rights</h2>
      <p>Under GDPR, CCPA, and similar regulations, you have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of all personal data we hold about you (via <code>/api/account/export</code>).</li>
        <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
        <li><strong>Portability:</strong> Export your data in a machine-readable JSON format.</li>
        <li><strong>Rectification:</strong> Correct inaccurate personal data.</li>
        <li><strong>Objection:</strong> Object to processing of your data for specific purposes.</li>
        <li><strong>Withdraw consent:</strong> Withdraw consent for analytics cookies or marketing emails at any time without affecting the lawfulness of prior processing.</li>
        <li><strong>Restrict processing:</strong> Request restriction of processing in certain circumstances.</li>
      </ul>

      <h2>6. Sub-Processors</h2>
      <p>We use the following third-party services to operate InferLane:</p>
      <table>
        <thead>
          <tr><th>Service</th><th>Purpose</th><th>Data processed</th></tr>
        </thead>
        <tbody>
          <tr><td>Stripe</td><td>Payments, KYC (Stripe Identity), operator payouts (Stripe Connect)</td><td>Payment info, identity verification data, subscription status, payout details</td></tr>
          <tr><td>Neon (PostgreSQL)</td><td>Primary database (US region)</td><td>Account, usage, and transaction data</td></tr>
          <tr><td>Vercel</td><td>Hosting and serverless functions (US East)</td><td>Application data in transit, server-side logs</td></tr>
          <tr><td>PostHog</td><td>Product analytics (only with user consent)</td><td>Anonymized usage events; no PII sent</td></tr>
          <tr><td>Resend</td><td>Transactional email delivery</td><td>Email address, email content</td></tr>
          <tr><td>LLM providers (Anthropic, OpenAI, Google)</td><td>AI model inference</td><td>Prompt content in transit (forwarded, not stored by InferLane)</td></tr>
          <tr><td>Cloudflare</td><td>DNS</td><td>DNS query data</td></tr>
        </tbody>
      </table>

      <h2>7. Cookies</h2>
      <p>InferLane uses the following cookies:</p>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Type</th><th>Purpose</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr><td><code>next-auth.session-token</code></td><td>Essential</td><td>Authentication — identifies your logged-in session</td><td>Session</td></tr>
          <tr><td><code>next-auth.csrf-token</code></td><td>Essential</td><td>CSRF protection</td><td>Session</td></tr>
          <tr><td><code>il_demo</code></td><td>Essential</td><td>Demo mode indicator</td><td>Session</td></tr>
          <tr><td><code>il_partner</code></td><td>Functional</td><td>Referral attribution</td><td>90 days</td></tr>
          <tr><td><code>il_analytics_consent</code></td><td>Essential</td><td>Records your cookie consent preference</td><td>1 year</td></tr>
          <tr><td>PostHog cookies</td><td>Analytics</td><td>Anonymous product analytics</td><td>1 year</td></tr>
        </tbody>
      </table>
      <p>
        Analytics cookies (PostHog) are only placed after you give explicit consent via the cookie
        banner. You can withdraw consent at any time through your account settings. We do not use
        third-party advertising cookies.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        Data may be processed in the United States. We rely on Standard Contractual Clauses (SCCs)
        for transfers from the EU/EEA. Our sub-processors maintain appropriate safeguards.
      </p>

      <h2>9. Security</h2>
      <p>
        We employ encryption at rest and in transit, role-based access controls, and regular
        security audits. Provider API keys are AES-encrypted before storage.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy from time to time. Material changes will be communicated via
        email. The &quot;Effective date&quot; at the top reflects the latest revision.
      </p>

      <h2>11. Automated Decision-Making</h2>
      <p>
        InferLane uses automated routing logic to select AI model providers for your requests. This
        routing considers factors such as cost, latency, model quality scores, and your configured
        preferences. These decisions determine which provider processes your request and at what
        cost, but do not involve profiling or produce legal effects.
      </p>
      <p>
        You can override automated routing decisions at any time by setting explicit provider
        preferences in your account settings or by specifying a provider directly in your API
        requests. You also have the right to request human review of any routing decision by
        contacting us at{' '}
        <a href="mailto:privacy@inferlane.dev" className="text-blue-400 hover:underline">
          privacy@inferlane.dev
        </a>.
      </p>

      <h2>12. Contact</h2>
      <p>
        For privacy inquiries, data export requests, or deletion requests, contact us at{' '}
        <a href="mailto:privacy@inferlane.dev" className="text-blue-400 hover:underline">
          privacy@inferlane.dev
        </a>.
      </p>
    </main>
  );
}
