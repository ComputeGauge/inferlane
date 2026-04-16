export const metadata = {
  title: 'Subprocessors — InferLane',
  description: 'Third-party services InferLane uses to process customer data.',
};

export default function SubprocessorsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-200">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Subprocessors</h1>
      <p className="text-gray-400 mb-8">
        InferLane uses the following third-party services to process customer
        data. We give 14-day notice of changes to customers on enterprise
        contracts.
      </p>

      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e] text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Service</th>
              <th className="text-left px-5 py-3 font-medium">Purpose</th>
              <th className="text-left px-5 py-3 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {[
              { service: 'Vercel', purpose: 'Application hosting, edge functions, cron jobs', location: 'US (iad1)' },
              { service: 'Neon', purpose: 'PostgreSQL database (serverless)', location: 'US East' },
              { service: 'Upstash', purpose: 'Rate limiting (Redis)', location: 'US East' },
              { service: 'Resend', purpose: 'Transactional email (waitlist, digests)', location: 'US (via AWS SES ap-northeast-1)' },
              { service: 'Stripe', purpose: 'Payment processing, billing', location: 'US' },
              { service: 'PostHog', purpose: 'Product analytics (consent-gated, no PII)', location: 'US' },
              { service: 'Anthropic', purpose: 'AI inference (proxied on behalf of users)', location: 'US' },
              { service: 'OpenAI', purpose: 'AI inference (proxied on behalf of users)', location: 'US' },
              { service: 'Google', purpose: 'AI inference (proxied on behalf of users)', location: 'US' },
            ].map((row) => (
              <tr key={row.service} className="border-b border-[#1e1e2e]/50">
                <td className="px-5 py-3 font-medium text-white">{row.service}</td>
                <td className="px-5 py-3 text-gray-400">{row.purpose}</td>
                <td className="px-5 py-3 text-gray-500">{row.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        AI inference providers are only contacted when a user explicitly sends
        a request through the InferLane proxy. We do not send data to
        inference providers proactively. Users choose which providers to
        connect via their dashboard or environment variables.
      </p>

      <footer className="pt-10 mt-12 border-t border-[#1e1e2e] text-sm text-gray-500">
        Last updated: 2026-04-17.
      </footer>
    </div>
  );
}
