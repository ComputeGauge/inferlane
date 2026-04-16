import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — InferLane',
  description: 'InferLane Terms of Service',
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
      <h1>Terms of Service</h1>
      <p className="text-sm text-zinc-400">Effective date: April 2, 2026</p>

      <h2>1. Acceptance</h2>
      <p>
        By accessing or using InferLane (&quot;the Service&quot;), you agree to be bound by these
        Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        InferLane provides an AI compute routing platform that proxies requests to third-party
        AI model providers on your behalf. We optimize for cost, latency, and quality across
        multiple providers.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
        <li>Transmit content that is harmful, threatening, abusive, or otherwise objectionable.</li>
        <li>Attempt to circumvent rate limits, spend caps, or security controls.</li>
        <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
        <li>Use the Service to generate content that violates the acceptable-use policies of
            the underlying AI providers (Anthropic, OpenAI, Google, etc.).</li>
        <li>Resell or redistribute access to the Service without written permission.</li>
      </ul>

      <h2>4. Intellectual Property</h2>
      <p>
        <strong>Your content:</strong> You retain all rights to prompts, inputs, and outputs
        generated through the Service. InferLane claims no ownership of your content.
      </p>
      <p>
        <strong>Our service:</strong> InferLane owns all rights to the routing engine, platform
        software, algorithms, and documentation. The Service is licensed, not sold.
      </p>

      <h2>5. Credits &amp; Billing</h2>
      <p>
        Credits are consumed based on actual token usage routed through the platform. Unused
        credits expire upon subscription cancellation. All purchases are final unless required
        by law.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
        OF ANY KIND, EXPRESS OR IMPLIED. INFERLANE SHALL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
        REVENUE, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY SHALL NOT EXCEED
        THE AMOUNT YOU PAID TO INFERLANE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
      </p>

      <h2>7. Termination</h2>
      <p>
        We may suspend or terminate your account at any time for violation of these Terms or for
        any reason with 30 days notice. You may terminate your account at any time through your
        dashboard settings. Upon termination, your remaining credits will be forfeited.
      </p>

      <h2>8. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the State
        of Delaware, United States, without regard to its conflict-of-law provisions. Any disputes
        shall be resolved in the state or federal courts located in Delaware.
      </p>

      <h2>9. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes via
        email or a prominent notice on the Service. Continued use after changes constitutes
        acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{' '}
        <a href="mailto:legal@inferlane.dev" className="text-blue-400 hover:underline">
          legal@inferlane.dev
        </a>.
      </p>
    </main>
  );
}
