# Acceptable Use Policy

_Effective: 2026-04-22 · Last updated: 2026-04-22_

This policy covers what you can and cannot do when using InferLane — whether
you're a consumer running inference, an operator serving inference, or a
contributor shipping components. It applies alongside our Terms of Service.

**Not legal advice.** This document describes our operational policy, not a
legal opinion. Final interpretation sits with our legal counsel and, where
applicable, the courts.

## Binding principle

You may not use InferLane to generate, transmit, store, or solicit content or
activity that violates applicable law in your jurisdiction or ours (Australia,
United States, European Union, United Kingdom, and any other jurisdiction
where we operate or where users are located).

## Prohibited content and uses

### Absolutely prohibited (zero tolerance, immediate termination + reporting)

1. **Child sexual abuse material (CSAM)** — generating, analysing, transmitting,
   or soliciting any sexualised depiction of minors, including AI-generated
   imagery, text, or code. Reported to NCMEC (US) and AU eSafety Commissioner.
2. **Terrorism content** — planning, recruitment, glorification, or operational
   support for acts of terrorism (as defined by US/UK/EU/AU lists of designated
   terrorist organisations).
3. **Incitement to violence** — targeted incitement, threats, or planning of
   violence against identifiable individuals or groups.
4. **Weapons of mass destruction** — bioweapons, chemical weapons, nuclear
   weapons: synthesis routes, acquisition guides, targeting advice.
5. **Non-consensual intimate imagery** — including synthetic/deepfake imagery
   of real people.
6. **Human trafficking** — facilitation, recruitment, or operational support.

### Prohibited (termination + potential reporting)

7. **Illegal drug synthesis or trafficking** — synthesis instructions,
   acquisition routes, evasion of drug-enforcement authorities.
8. **Firearms trafficking or illegal modifications** — including 3D-printable
   firearms in jurisdictions where illegal.
9. **Fraud / identity theft** — generating false identity documents, phishing
   kits, instructions for financial fraud, impersonation at scale.
10. **Malware / cyberweapons** — creating, distributing, or configuring
    malicious software designed to harm systems without authorisation.
11. **Sanctions evasion** — using our service from or on behalf of entities in
    OFAC-sanctioned jurisdictions (Iran, North Korea, Syria, Cuba, Crimea /
    Donetsk / Luhansk), or for entities on OFAC / UN sanctions lists.
12. **Mass copyright infringement** — automated scraping of paywalled content,
    redistribution of copyrighted material at scale.
13. **Automated abuse** — spam, coordinated inauthentic behaviour, bulk account
    creation, CAPTCHA-bypass operations.
14. **Privacy violations** — doxxing, unauthorised collection of personal data,
    surveillance of individuals without lawful basis.

### Restricted (requires disclaimers or additional agreements)

15. **Medical, legal, or financial advice** — allowed for educational and
    research purposes but must not be presented as professional advice to
    end-users without appropriate disclaimers and professional involvement.
16. **Adult content (legal)** — allowed on specific opt-in tiers only; not
    served on default tiers. Never involving depictions of minors or
    non-consenting parties.
17. **Security research** — penetration testing, vulnerability research, and
    red-teaming are permitted with written authorisation from the target and
    compliance with responsible disclosure norms.

## How we enforce

1. **Pre-inference moderation gate** — every request passes through automated
   classifiers (OpenAI Moderation API, Anthropic Moderation API, regex rules,
   and our own classifier). Requests matching prohibited categories are
   rejected before they reach an operator.
2. **Post-response moderation** — outputs from models are scanned. Abusive
   completions are blocked before delivery.
3. **Account-level pattern detection** — repeated attempts, jailbreak
   patterns, and off-platform signals trigger review.
4. **Community reports** — operators, contributors, and other users can flag
   abuse via Discord / email (`abuse@inferlane.dev`).
5. **Law-enforcement cooperation** — we respond to valid legal process
   (subpoenas, court orders) through our designated agent. Published
   annually in our transparency report.

## Consequences of violation

- **First offence, minor**: warning + education.
- **First offence, serious**: account termination + kT forfeiture + permanent ban.
- **CSAM / terrorism / WMD categories**: immediate termination + report to
  NCMEC / eSafety / FBI / relevant authority + preservation of evidence per
  legal requirement.
- **Operator violations**: termination of operator status + forfeiture of
  pending payouts + deletion of operator profile. Revoked credits are
  reallocated to a reserve for abuse-response costs.

## For operators specifically

Operators agree not to:

- Log, store, analyse, or transmit prompts or responses passing through their
  node (beyond ephemeral RAM during inference)
- Modify the approved inference binary
- Refuse routed requests based on their personal content judgment (the
  moderation gate at our coordinator is the single policy surface)
- Use operator status to collect data on users or other operators

Operator violations result in permanent termination, loss of pending payouts,
and potential civil liability under the Operator Agreement.

## Reporting abuse

- Email: `abuse@inferlane.dev`
- Discord: `#report-abuse` (private channel; visible only to moderators)
- Urgent (CSAM, imminent violence): include "URGENT" in the subject line;
  we respond within 4 hours

## Changes to this policy

We update this policy as law and operational experience evolve. Material
changes are announced 30 days in advance in our monthly transparency report
and on Discord. Continued use after a change constitutes acceptance.

## Questions

- General: `support@inferlane.dev`
- Legal process / law enforcement: `legal@inferlane.dev`
- Privacy / data requests: `privacy@inferlane.dev`
