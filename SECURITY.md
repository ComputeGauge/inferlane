# Security Policy

_Last updated: 2026-04-22_

This document describes how to report security issues to us, what's in
scope, and how we respond. For data privacy questions, see the
[Privacy Policy](./PRIVACY_POLICY.md). For legal terms, see the
[Terms of Service](./TERMS_OF_SERVICE.md).

## Reporting a vulnerability

Email `security@inferlane.dev` with:

- A description of the issue
- Steps to reproduce (proof of concept welcome)
- Impact assessment (what data/systems are affected)
- Your preferred credit (name, handle, or anonymous)

**Please do not:**

- Disclose the issue publicly before we've had a chance to fix it
- Access, modify, or exfiltrate data beyond what's needed to prove the
  issue
- Use social engineering or physical attacks against staff or operators
- Test on accounts that aren't yours without explicit authorisation
- Attack operator nodes directly — operators are third parties and our
  safe harbour doesn't extend to testing their systems

We commit to:

- Acknowledging your report within 72 hours
- Investigating and confirming (or rejecting) within 7 days
- Fixing confirmed issues within 30 days for high-severity, 90 days for
  medium, 180 days for low — faster for anything being actively exploited
- Coordinating disclosure with you before publicly announcing
- Crediting you in our fix advisory (unless you prefer anonymous)

## Scope

### In scope

- `inferlane.dev`, `inferlane.com.au`, `*.inferlane.dev` subdomains we
  operate
- `@inferlane/mcp` npm package (MCP server)
- Claude Code plugin for InferLane
- Official node daemon (`@inferlane/node-daemon`)
- Our Next.js application source (when open-sourced)
- Smart contracts (if/when we deploy any)

### Out of scope

- Third-party integrations (Stripe, Anthropic, OpenAI, Google, Discord,
  Cloudflare) — report directly to the vendor
- Operator-run nodes — those are independent parties
- Rate-limiting, captcha-bypass, or DoS reports we already publicly
  document as trade-off decisions (unless a denial-of-wallet attack is
  demonstrable)
- Social engineering staff without explicit prior authorisation
- Physical attacks
- Theoretical/speculative issues without a working proof of concept

## Rewards

We don't run a paid bug bounty programme yet. Post-launch we plan one
with clear severity tiers and reward ranges. In the meantime:

- **Critical / high severity** reports earn contribution-kT credits at
  the `help-wanted:large` rate (150,000 kT), plus public credit if
  wanted
- **Medium** reports earn `help-wanted` rate (50,000 kT)
- **Low** reports earn the bug-fix rate (10,000 kT)
- A "Hall of Fame" page credits researchers who want public
  acknowledgement

See [CONTRIBUTING.md](./CONTRIBUTING.md) for what kT is worth and how
to redeem.

## Our security practices

- **TLS 1.3+** enforced for all public endpoints
- **HSTS preload** for `inferlane.dev`
- **CSP headers** restricting script sources; `'unsafe-inline'` avoided
  except where necessary (iframe-sandboxed marketplace widgets)
- **Authentication**: passwordless (magic-link + OAuth); TOTP-2FA
  available; SSO for enterprise tier
- **Authorization**: role-based; every API call authorises against the
  subject resource; we don't rely on object IDs being unguessable
- **Secrets management**: no secrets in git; Vercel environment
  variables + Cloudflare Workers KV; rotated quarterly
- **Dependency scanning**: Dependabot on all repos; critical CVEs
  patched within 7 days
- **Code review**: two-person review for any change touching
  authentication, billing, or moderation
- **Audit logs**: every admin action and cross-tenant data access logged;
  2-year retention
- **Penetration testing**: annual third-party test (post-launch); findings
  published in summary to the transparency report

## Known trade-offs we have documented

- **Local MCP plugin runs with user privileges** on the user's machine.
  We don't sandbox it because it's designed to read the user's Claude
  Code transcripts — that's the point of the fuel gauge.
- **Operator nodes are untrusted by design** (except for the TEE tier).
  We don't attempt to prevent a malicious operator from reading prompts
  routed to their node on T0; we rely on network crypto + AUP + reputation
  + termination. Users who need stronger protection use TEE-tier routing.
- **Rate limits are published**; if a sophisticated attacker coordinates
  around them, we act case-by-case rather than pretending we can block
  all abuse.

## Contact

- Reports: `security@inferlane.dev` (PGP key available on request)
- General: `support@inferlane.dev`
- Legal process: `legal@inferlane.dev`
