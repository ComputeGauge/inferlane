---
document: WebAuthn / Passkey Integration Plan
version: 1.0.0
status: Design — gated on Auth.js v5 upgrade (see auth-js-v5-upgrade.md)
drafted_by: Claude (AI)
drafted_at: 2026-04-15
covers: ASVS V2.7.1 (OOB channel for MFA)
---

# WebAuthn / Passkey Integration

## Why

ASVS V2.7.1 requires an out-of-band channel for multi-factor
authentication. Today we have:

- Email magic-link (via NextAuth Email provider) — OOB via email
- Google / GitHub OAuth — the identity provider handles MFA

We do NOT have phishing-resistant MFA for users who sign in via
email + password. Email magic links are OOB but can be proxied by a
well-placed phishing site. Passkeys (WebAuthn) eliminate that class
of attack because the browser cryptographically binds the credential
to the origin.

Enterprise customers expect passkeys. Several SOC 2 auditors now
list them as a "should have".

## Target users

1. **Enterprise dashboard users.** Required to enroll at least one
   passkey. Fallback: TOTP + recovery codes.
2. **High-value buyer accounts.** Prompted on first load after
   hitting a $1000/month spend threshold.
3. **Operators** managing payouts. Required to enroll before
   enabling USDT or Stripe Connect payouts.
4. **Retail Pro users.** Optional; nudged on the security page.

## Chosen library

**`@simplewebauthn/server` + `@simplewebauthn/browser`.** The
de-facto TypeScript WebAuthn implementations, MIT licensed, well
maintained, compatible with Auth.js v5 adapters.

Alternatives considered:
- Rolling our own via the `WebAuthn` browser API directly — too
  much attestation format handling for the value.
- Auth0 / WorkOS hosted WebAuthn — adds a third-party dependency
  on the critical auth path.
- Hanko — neat but narrower ecosystem.

## Schema additions (new Prisma models)

```prisma
model WebAuthnCredential {
  id                String   @id @default(cuid())
  userId            String
  credentialId      Bytes    @unique
  publicKey         Bytes
  counter           Int      @default(0)
  transports        String[]
  deviceType        String?
  backupEligible    Boolean  @default(false)
  backupState       Boolean  @default(false)
  nickname          String?
  lastUsedAt        DateTime?
  createdAt         DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("webauthn_credentials")
}

model WebAuthnChallenge {
  id         String   @id @default(cuid())
  userId     String?
  challenge  String   @unique
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@index([challenge])
  @@map("webauthn_challenges")
}
```

## API routes

- `POST /api/auth/webauthn/register/options` — generate registration
  options, store a challenge row. Requires an authenticated session.
- `POST /api/auth/webauthn/register/verify` — verify the attestation
  response and persist the WebAuthnCredential row.
- `POST /api/auth/webauthn/authenticate/options` — generate
  authentication options.
- `POST /api/auth/webauthn/authenticate/verify` — verify the
  assertion and issue a step-up token (see step-up.ts).
- `DELETE /api/auth/webauthn/credentials/:id` — remove a credential.
  Requires step-up re-auth.

## Sign-in flow

1. User enters email on the sign-in page.
2. Server looks up whether the user has any registered passkeys.
3. If yes, show a "Sign in with passkey" button. Click → browser
   `navigator.credentials.get()` with the server-generated options.
4. Browser returns an assertion. Server verifies signature + counter
   + userHandle.
5. Server creates a session (or, if this is a step-up flow,
   returns a StepUpToken with the requested scope).

## Step-up flow

Same as sign-in but the server does not issue a new session — it
issues a scope-bound StepUpToken to the existing session. The token
is returned in JSON and the client stores it in memory (never in
localStorage) until it's used.

## Recovery

Passkeys are device-bound. If a user loses all their devices:

1. They can still sign in via email magic link (still enabled).
2. The magic link flow triggers a **recovery mode** that lets them
   add a new passkey.
3. Recovery mode imposes a 24-hour cooling-off period before any
   sensitive operation is allowed.
4. We notify all previously-registered passkey holders by email.

## Rollout stages

- **Stage 0 (code ready):** models + routes land behind a feature
  flag `NEXT_PUBLIC_WEBAUTHN_ENABLED`. No UI.
- **Stage 1 (internal):** dogfooding with InferLane staff. Enroll
  one passkey each, use daily.
- **Stage 2 (opt-in beta):** Pro+ users can enroll in settings.
- **Stage 3 (enterprise default):** new enterprise accounts
  required to enroll during onboarding.
- **Stage 4 (high-value nudge):** users crossing $1000/month spend
  get a banner.
- **Stage 5 (universal nudge):** Free users prompted after 3rd
  session.

## Hard gates

- [ ] Auth.js v5 upgrade complete (see `auth-js-v5-upgrade.md`) —
      simplewebauthn integrates more cleanly with v5 adapters
- [ ] Decision on whether to require passkeys for operator payouts
      (recommended yes for Confidential tier operators)
- [ ] Enterprise SOC 2 auditor approval of the recovery flow

## Open questions

1. Do we allow multiple passkeys per user? (Yes — encouraged.)
2. Do we allow roaming authenticators (YubiKey) and platform
   authenticators (Touch ID)? (Yes — both.)
3. Do we require attestation? (No — it's opt-in and noisy; we don't
   need it for the threat model we're defending against.)
4. Do we store user-visible names for credentials? (Yes —
   `nickname` field above.)
5. How do we handle cross-device credentials (iCloud Keychain)?
   (Natively — we set `backupEligible: true` when the browser
   reports it and explain the tradeoff to enterprise users.)

## References

- [simplewebauthn docs](https://simplewebauthn.dev)
- `src/lib/security/step-up.ts` — step-up token contract we'll
  return after successful passkey assertion
- `commercial/memos/auth-js-v5-upgrade.md` — dependency gate
- `commercial/security/asvs-l2.md` — tracks V2.7.1
