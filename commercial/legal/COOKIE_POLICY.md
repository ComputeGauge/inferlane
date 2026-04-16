---
document: Cookie Policy
version: 1.0.0-draft
status: DRAFT — REQUIRES LAWYER REVIEW BEFORE PRODUCTION USE
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# InferLane Cookie Policy

> **DRAFT — NOT YET IN FORCE.** AI-generated first draft. Counsel
> should verify that the classification and disclosure language
> meets ePrivacy (EU), PECR (UK), and CCPA requirements, and that
> our actual runtime matches the list below.

## 1. What cookies are

Cookies are small text files a website stores on your device. We
use a small number of cookies to operate the InferLane service and
to remember your preferences. We do NOT use cookies for cross-site
behavioral advertising or sell any cookie data.

## 2. Cookies we set

### Strictly necessary (no consent required)

| Cookie | Purpose | Lifetime |
|---|---|---|
| `next-auth.session-token` | Authenticate your dashboard session | 8 hours (rolling) |
| `next-auth.callback-url` | Remember where to return after sign-in | Session |
| `next-auth.csrf-token` | CSRF protection on auth forms | Session |
| `il-onboarding-step` | Remember your place in onboarding flow | 7 days |

### Functional (no consent required)

| Cookie | Purpose | Lifetime |
|---|---|---|
| `il-theme` | Remember your dark/light mode preference | 365 days |
| `il-timezone` | Display times in your local timezone | 90 days |

### Analytics (consent-gated in the EU / UK)

| Cookie | Purpose | Lifetime |
|---|---|---|
| `ph_*` (PostHog) | Anonymous page view + event tracking | 365 days |

Analytics is opt-out-by-default in jurisdictions that require
opt-in consent (EEA, UK, Switzerland). You can opt out at any time
via the cookie banner or your privacy settings.

## 3. What we do NOT set

- Cross-site advertising cookies
- Third-party trackers beyond PostHog
- Fingerprinting cookies
- Marketing automation pixels

## 4. Managing cookies

You can:

- Accept or decline analytics in the cookie banner.
- Clear cookies via your browser settings.
- Use your browser's "Do Not Track" signal — we honor it for
  analytics.
- Opt out via `/privacy/settings` in your dashboard.

## 5. Changes

Material changes to this policy are announced via the CHANGELOG
at least 30 days in advance.

## 6. Contact

privacy@inferlane.dev

---

## Review checklist (for counsel)

- [ ] List matches actual runtime cookies (run a dev session and
      compare)
- [ ] PostHog categorised correctly for ePrivacy
- [ ] CCPA "Do Not Sell" link present if we enable any sharing
- [ ] Cookie banner language compliant with Article 7 GDPR consent
- [ ] UK PECR amendments from 2024 reviewed
- [ ] DNT honoring commitment matches implementation
