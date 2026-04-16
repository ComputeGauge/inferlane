# Data Processing Agreement Status

**Last updated:** 2026-04-16

## Sub-processor DPA Status

Each sub-processor that processes personal data on InferLane's behalf
needs an executed Data Processing Agreement (DPA) with Standard
Contractual Clauses (SCCs) for EU→US transfers.

Most major SaaS providers offer standard DPAs that can be accepted
online. Below is the current status.

| Sub-processor | What they process | DPA available? | How to execute | Status |
|---|---|---|---|---|
| **Stripe** | Payment data, KYC documents (via Identity), operator payouts (Connect) | Yes — standard | https://stripe.com/legal/dpa → sign online | [ ] TODO |
| **Neon** | All database records (users, API keys, spend, prompts, audit logs) | Yes — standard | https://neon.tech/legal/dpa → accept in dashboard | [ ] TODO |
| **Vercel** | Hosting, serverless execution, cron jobs, request logs | Yes — standard | https://vercel.com/legal/dpa → accept in dashboard | [ ] TODO |
| **PostHog** | Analytics events (no PII sent — opaque user ID + plan tier only) | Yes — standard | https://posthog.com/docs/privacy/dpa → email legal@posthog.com | [ ] TODO |
| **Resend** | Email addresses for transactional email delivery | Yes — standard | https://resend.com/legal/dpa → accept online | [ ] TODO |
| **Cloudflare** | DNS records (no PII), SSL termination | Yes — standard | https://www.cloudflare.com/gdpr/subprocessors/ → in dashboard | [ ] TODO |
| **Anthropic** | Prompts in transit (proxy forwards to their API) | Terms cover — Section 7 of their API ToS includes data processing terms | https://www.anthropic.com/api-terms → review | [ ] TODO |
| **OpenAI** | Prompts in transit (proxy forwards to their API) | Yes — DPA addendum | https://openai.com/enterprise-privacy/ → request via sales | [ ] TODO |
| **Google** (Gemini) | Prompts in transit (proxy forwards to their API) | Yes — via Cloud ToS | https://cloud.google.com/terms/data-processing-addendum → accept | [ ] TODO |

## Action items

1. **This week:** Accept the online DPAs for Stripe, Neon, Vercel, Resend, Cloudflare (all < 5 min each)
2. **This week:** Email PostHog legal for their DPA (legal@posthog.com)
3. **This week:** Review Anthropic API ToS Section 7 for adequacy
4. **Next month:** Request DPA addendum from OpenAI if proxy traffic grows
5. **Next month:** Accept Google Cloud DPA if Gemini routing is enabled

## Notes

- LLM providers (Anthropic, OpenAI, Google) process prompts in transit only — InferLane does not store prompt content after delivery (except for Scheduled Prompts which are stored in Neon, not sent to LLM providers until execution)
- PostHog receives NO PII since the fix on 2026-04-16 — only opaque user ID and plan tier. PostHog is also gated behind cookie consent.
- Stripe Identity processes KYC documents — these are stored by Stripe, not by InferLane. InferLane stores only the verification result hash.
