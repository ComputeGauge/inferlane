import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — InferLane',
  description: 'InferLane Privacy Policy',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-zinc-400">Effective date: April 2, 2026</p>

      <h2>1. Data We Collect</h2>
      <ul>
        <li><strong>Account data:</strong> Email address, name, and OAuth profile information when you sign up.</li>
        <li><strong>Usage data:</strong> API request metadata (model, provider, token counts, cost, latency, timestamps). We do not store prompt content or model responses.</li>
        <li><strong>Payment data:</strong> Processed by Stripe. We store Stripe customer IDs and subscription status but never store full credit card numbers.</li>
        <li><strong>Technical data:</strong> IP address (for compliance screening and abuse prevention), user agent, and request headers.</li>
        <li><strong>Analytics:</strong> Anonymized usage analytics via PostHog (page views, feature usage).</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To process payments and manage subscriptions.</li>
        <li>To enforce acceptable-use policies and comply with sanctions/export controls.</li>
        <li>To send transactional emails (welcome, payout confirmations, subscription changes).</li>
        <li>To detect and prevent fraud and abuse.</li>
      </ul>

      <h2>3. Data Retention</h2>
      <ul>
        <li><strong>Financial records:</strong> 7 years (tax and regulatory compliance).</li>
        <li><strong>Audit logs:</strong> 2 years.</li>
        <li><strong>Usage data:</strong> 1 year, then aggregated and anonymized.</li>
        <li><strong>Account data:</strong> Retained while your account is active. Deleted within 30 days of account deletion request.</li>
      </ul>

      <h2>4. Your Rights</h2>
      <p>Under GDPR, CCPA, and similar regulations, you have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of all personal data we hold about you (via <code>/api/account/export</code>).</li>
        <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
        <li><strong>Portability:</strong> Export your data in a machine-readable JSON format.</li>
        <li><strong>Rectification:</strong> Correct inaccurate personal data.</li>
        <li><strong>Objection:</strong> Object to processing of your data for specific purposes.</li>
      </ul>

      <h2>5. Sub-Processors</h2>
      <p>We use the following third-party services to operate InferLane:</p>
      <table>
        <thead>
          <tr><th>Service</th><th>Purpose</th><th>Data processed</th></tr>
        </thead>
        <tbody>
          <tr><td>Stripe</td><td>Payments &amp; billing</td><td>Payment info, subscription status</td></tr>
          <tr><td>Neon (PostgreSQL)</td><td>Primary database</td><td>Account, usage, and transaction data</td></tr>
          <tr><td>Vercel / Railway</td><td>Hosting &amp; compute</td><td>Application data in transit</td></tr>
          <tr><td>PostHog</td><td>Product analytics</td><td>Anonymized usage events</td></tr>
        </tbody>
      </table>

      <h2>6. Cookies</h2>
      <ul>
        <li><strong>Essential cookies:</strong> Session authentication (next-auth), CSRF protection. Required for the Service to function.</li>
        <li><strong>Attribution cookie:</strong> Partner referral tracking (<code>il_partner</code>, 90-day expiry). First-party, HttpOnly.</li>
        <li><strong>Analytics cookies:</strong> PostHog anonymous analytics. Can be opted out via browser settings.</li>
      </ul>
      <p>We do not use third-party advertising cookies.</p>

      <h2>7. International Transfers</h2>
      <p>
        Data may be processed in the United States. We rely on Standard Contractual Clauses (SCCs)
        for transfers from the EU/EEA. Our sub-processors maintain appropriate safeguards.
      </p>

      <h2>8. Security</h2>
      <p>
        We employ encryption at rest and in transit, role-based access controls, and regular
        security audits. Provider API keys are AES-encrypted before storage.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy from time to time. Material changes will be communicated via
        email. The &quot;Effective date&quot; at the top reflects the latest revision.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy inquiries, data export requests, or deletion requests, contact us at{' '}
        <a href="mailto:privacy@inferlane.dev" className="text-blue-400 hover:underline">
          privacy@inferlane.dev
        </a>.
      </p>
    </main>
  );
}
