---
document: Deep Legal Review — All Drafts
version: 1.0.0
status: AI-prepared review for counsel. NOT LEGAL ADVICE.
reviewer: Claude (AI, deep second pass)
reviewed_at: 2026-04-15
audience: user + eventual engaged counsel
---

# Deep Legal Review — InferLane Commercial Build

## Disclaimer

**I am not a lawyer. This is not legal advice. You cannot use this
document as a substitute for counsel review.** Every jurisdiction
has statutes and case law that affect the specific clauses below,
and enforceability often turns on facts I don't have access to
(where you incorporate, who your customers are, which states your
operators live in, what your volume is). The purpose of this
review is to surface concrete issues so a lawyer's time is
focused on real problems, not formatting and boilerplate.

Where I cite a statute or case, you should verify the citation
independently before relying on it. I've tried to be accurate but
legal databases evolve and AI can hallucinate citations.

## Methodology

Each draft was reviewed for:

1. **Legal enforceability issues** — clauses that will be
   unenforceable in specific jurisdictions
2. **Structural completeness** — clauses that should exist but
   don't (definitions, notice, severability, etc.)
3. **Internal consistency** — the same term or percentage
   appearing differently across docs
4. **Cross-doc coherence** — whether all 10 docs tell the same
   story
5. **Regulatory alignment** — GDPR, CCPA, ACL, MSB/MTL, etc.
6. **Commercial risk** — provisions that will cost money to
   defend or enforce
7. **Tone and clarity** — overly harsh or overly soft language

Severity scale:

- 🔴 **CRITICAL** — do not ship as-is; ship → immediate legal exposure
- 🟠 **HIGH** — likely unenforceable or creates meaningful risk
- 🟡 **MEDIUM** — should be fixed before production traffic
- 🟢 **LOW** — cosmetic or stylistic

---

# 1. Terms of Service — `TERMS_OF_SERVICE.md`

## Critical issues

### 🔴 C1 — No clear assent mechanism defined

**Clause:** §1 "These Terms of Service… form a contract between
InferLane, Inc…"

**Problem:** US courts (Nguyen v. Barnes & Noble, 763 F.3d 1171
(9th Cir. 2014); Meyer v. Uber, 868 F.3d 66 (2d Cir. 2017)) are
clear that browsewrap is rarely enforceable. You need
"clickwrap" — an affirmative action by the user indicating
assent to the specific terms. The draft doesn't say how assent
is captured.

**Fix:** Add §1.1:

> "You accept these Terms by (a) clicking the 'I agree' checkbox
> during account registration, (b) accessing the InferLane API
> with a valid Bearer token, or (c) otherwise using the Service.
> Your assent is logged by us with a timestamp and your
> authentication method, and we will produce that record on
> request."

Also: **actually implement the clickwrap.** The dashboard
signup flow I shipped does NOT force the user to check an
"I agree" box referencing the ToS. Real enforceability requires
both the clause AND the UI.

### 🔴 C2 — §9 Liability cap is almost certainly void in some jurisdictions and may be unconscionable everywhere for the $100 floor

**Clause:** §9 caps aggregate liability at "the greater of (a)
amounts paid… in the 12 months, or (b) USD 100"

**Problem:** $100 is a red flag for unconscionability analysis,
especially where the user hasn't paid anything yet. Doctrine of
unconscionability (UCC § 2-302 in US contexts; common law in UK
and Australia) can void caps set below reasonable harm. For
enterprise contracts in particular, $100 is laughably low and
will be negotiated away immediately.

Additionally: Australian Consumer Law (ACL § 64A) voids any
attempt to exclude, restrict, or modify statutory guarantees.
The current draft acknowledges this only vaguely ("does not
apply to liability that cannot be excluded under applicable
law").

**Fix:** Set the floor higher ($1,000 or one month's payments
minimum), and add explicit ACL carve-out language:

> "Nothing in this Section 9 limits liability that cannot be
> lawfully limited. In particular, for Australian consumers,
> nothing in this Agreement excludes, restricts, or modifies
> any right or guarantee under the Competition and Consumer
> Act 2010 or Schedule 2 (Australian Consumer Law)."

## High issues

### 🟠 H1 — §2 age minimum is 18 but GDPR Article 8 and some US state laws are different

**Clause:** §2 "You must be at least 18 years old"

**Problem:** This is actually a *safer* age than required by
most jurisdictions (GDPR Article 8 is 16 by default, US COPPA
is 13). But some state consumer protection laws have carveouts
for minors 13-17 that may require parental consent. More
importantly, declaring 18+ doesn't match GDPR — if a 17-year-old
uses the service, have they consented unlawfully or have we
simply breached our own contract?

**Fix:** Split age language into (a) minimum service age (keep
18) and (b) GDPR consent age for EEA users (16 or older per
Art. 8, subject to member state lowering to 13). Add:

> "If you are under 18 but have been authorized by a parent or
> legal guardian under applicable law, you may use the Service
> only with their written consent, which we may require you
> to produce on request."

### 🟠 H2 — §3.2 "final at dispatch time" — no statutory compliance language

**Clause:** §3.2 "Price is quoted per request and is final at
dispatch time."

**Problem:** EU Directive 2011/83/EU (Consumer Rights Directive)
requires that the total price — including all taxes and fees —
be clearly disclosed *before* the consumer is bound. "Final at
dispatch time" may not satisfy this. UK CRA 2015 has similar
requirements. Australian ACL §48 likewise.

**Fix:** Change to:

> "Before you submit a workload, we display the maximum price
> you will pay including any applicable taxes and fees. You
> commit to this price by submitting the workload. The final
> invoiced amount will not exceed this quoted maximum."

### 🟠 H3 — §4 privacy tier language conflicts with §8 warranties

**Clause:** §4 says we "will only route your workload to
Operators whose verified capabilities meet or exceed your
selected tier." §8 then disclaims everything.

**Problem:** Promising to route only to verified operators is a
*specific warranty*, not merely a service description. You
cannot promise this and then disclaim "any warranty" in §8 —
the specific warranty governs over the general disclaimer. If
an operator falsely attests and data is exposed, the §8
disclaimer won't save you from §4's promise.

**Fix:** Either (a) soften §4 to "we will use commercially
reasonable efforts to verify operator capabilities and route
accordingly" or (b) explicitly carve §4 out of the §8
disclaimer.

### 🟠 H4 — §7 "InferLane issues a determination within 7 business days" is an enforceable obligation

**Clause:** §7 lists a 7-business-day determination deadline.

**Problem:** This is a promise. If you miss it, you've breached.
High-volume disputes may outstrip the reviewer team.

**Fix:** Change to "InferLane will use commercially reasonable
efforts to issue a determination within 7 business days; where
additional evidence is needed we will notify the buyer and the
determination may take up to 14 business days."

### 🟠 H5 — §10 indemnification is unilateral

**Clause:** §10 "You agree to indemnify InferLane…"

**Problem:** Enterprise buyers will push back on this immediately
and will want mutual indemnification (InferLane indemnifies
Customer for third-party IP infringement claims arising from the
Service, etc.). Unilateral indemnification is a weak negotiating
position.

**Fix:** Add a mutual indemnification paragraph covering IP
infringement claims where InferLane or its Operators are the
alleged infringer. Include a carve-out for customer inputs.

### 🟠 H6 — §11 list of surviving sections is incomplete

**Clause:** §11 "Sections 6, 8, 9, 10, 11, 12, 13, and 14
survive termination."

**Problem:** Survives should also include §1 (parties — needed
to know who you're enforcing against), §5 (AUP — needed to
explain why you terminated), and any fee obligations up through
the termination date.

**Fix:** Add §3 (to extent fees are outstanding), §5, and
explicitly include "and any provision that by its nature should
survive."

## Medium issues

### 🟡 M1 — Missing definitions section

A real contract has a defined terms section. The draft uses
terms like "Buyer", "Operator", "Workload", "Confidential tier",
"dispute window", "reserve fund", "platform fee" without
defining them in one place. This makes cross-reference harder
for counsel and for disputes.

**Fix:** Add a §0 or §A Definitions section listing every term
that starts with a capital letter.

### 🟡 M2 — No force majeure clause

**Problem:** Standard omission. Without a force majeure clause,
unexpected outages (Vercel down, Stripe down, Neon down) could
trigger breach.

**Fix:** Add §15 Force Majeure with standard language excusing
performance during events beyond reasonable control.

### 🟡 M3 — No notice provisions

**Problem:** No section defines how formal notices are delivered
(email to registered address? certified mail? in-app?). This
matters for termination, changes, and dispute filing.

**Fix:** Add a §16 Notices section specifying email to
registered address + dashboard notification as the canonical
notice methods, with a deemed-received rule.

### 🟡 M4 — §13 Delaware law + SF arbitration may conflict with §9 CA unconscionability defenses

**Problem:** CA has strict unconscionability doctrine (Discover
Bank v. Superior Court, 36 Cal. 4th 148 (2005) was overruled by
the US Supreme Court in AT&T v. Concepcion, 563 U.S. 333 (2011),
but CA still applies unconscionability analysis to individual
clauses). A CA consumer subject to SF arbitration will likely
raise unconscionability defenses.

**Fix:** This is the kind of clause a lawyer has to decide. Don't
commit to SF without first understanding the venue strategy.

### 🟡 M5 — No "entire agreement" clause wording is slightly off

**Clause:** §14 first bullet "These Terms are the entire
agreement between you and InferLane regarding the subject
matter."

**Problem:** "Entire agreement" should typically exclude fraud
in the inducement. Without that carve-out, a plaintiff can
argue they were induced to sign by a promise that isn't in the
ToS.

**Fix:** Change to:

> "These Terms, together with our Privacy Policy, Acceptable
> Use Policy, and any order form or SOW you enter into with us,
> constitute the entire agreement between you and InferLane.
> This does not exclude liability for fraud or
> misrepresentation."

## Low issues

### 🟢 L1 — "InferLane, Inc. (a Delaware corporation…)" — placeholder

As flagged in the annotated review: replace placeholder when
entity is formed.

### 🟢 L2 — ToS references "Operator Agreement" for operators but a buyer won't have signed it

Cross-document: in §3.1 you imply operators are "independent"
but a buyer has no way to see their agreement. Consider linking
the public version of the Operator Agreement from the ToS so
buyers can see the obligations we place on operators.

### 🟢 L3 — No clear support/response commitments

Enterprise buyers will want an SLA. The ToS doesn't say
anything about uptime, response time, or credits for outage.
Consider leaving this to order forms, but add a pointer.

---

# 2. Operator Agreement — `SELLER_AGREEMENT.md`

## Critical issues

### 🔴 C3 — §2 Independent contractor classification is NOT sufficient to defeat AB5 in California

**Clause:** §2 "You are an independent contractor. Nothing in
this Agreement creates an employment…"

**Problem:** A recital that someone is "an independent
contractor" carries zero weight under California AB5 (Labor
Code § 2775). California applies the ABC test: the worker is
presumed an employee unless InferLane proves all three of:

- (A) worker is free from our control and direction
- (B) worker performs work outside the usual course of InferLane's business
- (C) worker is customarily engaged in an independently established trade

Prong (B) is where you lose. If InferLane's business is
"providing compute via a marketplace" and operators are
"providing compute via our marketplace," the operator's work
IS our usual business. Exhibit A for misclassification.

The same issue exists in Massachusetts (MGL c. 149 § 148B),
New Jersey (NJSA 43:21-19), and several other states that
have adopted ABC-style tests.

**Fix options:**

1. Add specific control-reducing language throughout the
   agreement:
   - Operator sets its own prices (within a floor/ceiling
     published by InferLane) ← requires product change
   - Operator controls its own hours and availability
   - Operator supplies its own equipment
   - No exclusivity required
   - No training or onboarding requirements beyond KYC
2. Structure the relationship as a B2B vendor contract
   (operator is a business, not an individual). Require every
   operator to have an entity (LLC, sole proprietorship with
   EIN, etc.).
3. Narrowly define InferLane's "usual course of business" in
   the recitals as "operating a technology platform that
   matches buyers of compute to providers" — not "providing
   compute" — to strengthen the prong (B) argument.
4. Cost-out a 1099 legal defense and the alternative of
   employing operators in CA.

**This issue alone could generate millions in back wages and
payroll tax liability if operators are retroactively
reclassified.** Do not ship until counsel approves.

### 🔴 C4 — §8 Reserve fund "non-refundable contribution" likely creates an escrow or a fee with unclear tax treatment

**Clause:** §8 "The 3% reserve fund contribution is a
non-refundable contribution to a pool used by InferLane…
Contributions are not individually refundable."

**Problem:** If it's non-refundable the moment it's collected,
it looks like a platform fee — which is taxable income to you
and deductible business expense to the operator. If it's
refundable in aggregate (we might give some of it back), it
looks like a deposit — which has very different tax and escrow
implications.

The current draft is ambiguous. Tax treatment drives financial
model; escrow treatment drives regulatory treatment.

**Fix options:**

1. Call it what it is: an additional platform fee. Change the
   name to "Reserve Fee". Tax: income to us at time of
   collection, expense to operator. Clean.
2. Call it a deposit held in trust for the operator class. Now
   you need a trust structure, bonded administrator, quarterly
   disclosures, etc. Expensive but regulator-friendly.

Option 1 is almost certainly the right call. Then the "reserve
fund" name is marketing only.

## High issues

### 🟠 H7 — §4 warranty language is subjective and hard to enforce

**Clause:** §4 "Latency class claims are consistent with
measured performance."

**Problem:** "Consistent" is subjective. Operators will argue
measurement variance. You need to define how "consistent" is
measured (e.g., "p95 latency over any rolling 7-day window
must not exceed 150% of the declared latency class").

**Fix:** Replace subjective language with measurable SLAs.

### 🟠 H8 — §5 heartbeat requirement doesn't match product

**Clause:** §5 "Uptime: You must respond to heartbeat checks
within 5 minutes during declared availability windows."

**Problem:** 5 minutes is tight for consumer hardware operators
(especially Mac operators per Darkbloom's model). Users close
laptops, update, play games. A 5-minute breach every day is
grounds for termination under this draft.

**Fix:** Allow 3 consecutive missed heartbeats before counting
as a breach, and only count heartbeats during declared
availability windows that the operator has not paused.

### 🟠 H9 — §6 payout terms conflict with the ATTESTED tier

**Clause:** §6 "You are paid 87% of the quoted buyer price"

**Problem:** The code now supports a 92/5/3 ATTESTED tier split
(shipped in turn 8). The contract still says 87% flat.
Contract and code must match.

**Fix:** Change to:

> "You are paid a percentage of the quoted buyer price based on
> your operator tier, as published at [URL]. The standard
> tier is 87%; the attested tier is 92%. Tier assignment is
> updated monthly based on your attestation status."

### 🟠 H10 — §8 reserve fund "operated transparently" is a promise you must keep

**Problem:** Committing to publish aggregate balances
("operated transparently; aggregate balances are disclosed in
the operator dashboard") is a meaningful commitment. If you
don't actually ship a dashboard showing this within launch
window, operators have a breach claim.

**Fix:** Either remove the transparency commitment, or make it
a "reasonable efforts" commitment with timeline flexibility.

### 🟠 H11 — §10 "Sybil detection" is described as a prohibition but enforcement would require tracking operators across accounts

**Clause:** §10 "Sybil the reputation system with multiple
unlinked operator accounts."

**Problem:** Enforcing this requires cross-account behavioral
matching — which then has to be disclosed in the Privacy Policy
as a category of processing under GDPR Article 13. Currently the
Privacy Policy doesn't mention it.

**Fix:** Add a Privacy Policy disclosure of the fraud-detection
behavioral matching category, and specifically mention that
operator accounts are subject to device fingerprinting and
cross-account correlation.

## Medium issues

### 🟡 M6 — §12 references the DPA that operators haven't signed

**Clause:** §12 "You will sign the InferLane Data Processing
Addendum…"

**Problem:** The DPA is a separate document. Unless the
Operator Agreement explicitly incorporates it by reference, the
DPA obligations are floating. Also, the DPA is written from the
perspective of the Controller (buyer) to the Processor
(us) — but operators are a third layer of processor that the
DPA should cascade to.

**Fix:** Explicitly incorporate the DPA as an exhibit to the
Operator Agreement, and add a clause stating operators
acknowledge they are sub-processors subject to GDPR Art. 28(4).

### 🟡 M7 — §13 termination notice asymmetry

**Clause:** §13 Operator must give 7 days notice; InferLane can
terminate "for breach, fraud, repeated disputes, or as required
by law" with no notice period specified.

**Problem:** Asymmetric termination is standard but pushes the
edge of unconscionability for small operators. Also "repeated
disputes" is not defined.

**Fix:** Define "repeated disputes" (e.g., three or more in
90 days resolved against the operator) and add a cure period
for curable breaches.

### 🟡 M8 — No background check consent

**Problem:** KYC via Stripe Identity covers identity
verification but not criminal background checks. Some
jurisdictions (especially for high-value or sensitive
workloads) may expect these. No consent is captured.

**Fix:** Add §3.1 consent to future background checks if
InferLane deems them necessary, with operator right to decline
and withdraw.

### 🟡 M9 — No operator insurance requirement

**Problem:** Standard marketplace contracts require operators
to carry their own commercial liability insurance. InferLane
doesn't require this, which means if an operator causes harm
(data breach, cyber claim) you're the deep pocket.

**Fix:** Add §6.1 Insurance requirement: operators must carry
general liability insurance with minimum $1M coverage for
operations serving Confidential-tier workloads. Waive for
smaller tiers.

---

# 3. Privacy Policy — `PRIVACY_POLICY.md`

## Critical issues

### 🔴 C5 — §2 contradicts itself on workload retention

**Clause:** §2 "Confidential-tier workloads: never visible to
InferLane in plaintext; only metadata is recorded." BUT also:
"Transport-only workloads: may be recorded (hashed or redacted)
for up to 7 days for abuse detection"

**Problem:** A careful reader (i.e., a regulator or a suing
plaintiff) will notice that the two bullets use different
commitment strengths. The Confidential-tier commitment is
absolute ("never visible in plaintext"). The Transport-only
commitment is conditional ("may be recorded… for abuse
detection"). But both describe the same parent category:
"Workload inputs and outputs we transiently process".

If a Confidential-tier workload somehow ends up in logs
because of a bug, you've breached an absolute commitment. If a
Transport-only workload is recorded without any abuse
detection happening, you've exceeded the stated purpose (data
minimization violation under GDPR Art. 5(1)(c)).

**Fix:** Reframe both commitments in terms of policy, not
absolutes:

> "**Confidential-tier workloads**: we do not log or retain
> inputs or outputs. The Trusted Execution Environment is
> designed to prevent both us and the Operator from reading
> Workload data outside the TEE boundary.
>
> **Transport-only workloads**: we may retain a hashed or
> redacted copy of inputs and outputs for up to 7 days for
> abuse detection. If we have not used the copy for abuse
> detection within 7 days it is automatically deleted.
> Individual items are not retained longer without a dispute or
> legal hold."

### 🔴 C6 — §5 sharing with "Operators" is probably not a "share" under CCPA but it matters

**Clause:** §5 "Operators — routed workload data, at the
privacy tier you selected."

**Problem:** CCPA/CPRA distinguishes "sale" from "share" from
"service provider disclosure". Routing data to an Operator for
them to execute the workload is a *service provider disclosure*
(because operators process data on behalf of the buyer, under a
written contract — DPA). CCPA allows this without triggering
"Do Not Sell / Do Not Share" obligations *only if* the operator
is contractually bound as a service provider under Cal. Civ.
Code § 1798.140(ag).

The current Privacy Policy says operators "are contractually
bound not to retain or repurpose your data" — but the Operator
Agreement doesn't actually incorporate CCPA service provider
language. That gap means a California buyer could argue our
data flow *is* a "share" for cross-context behavioral
advertising, triggering full CCPA compliance we haven't
implemented.

**Fix:** Add CCPA service provider language to the Operator
Agreement explicitly. Something like:

> "Operator is a 'service provider' within the meaning of Cal.
> Civ. Code § 1798.140(ag)(1) and agrees to process Personal
> Information only as necessary to perform the services
> described in this Agreement. Operator shall not retain, use,
> or disclose the Personal Information for any purpose other
> than the specific purpose of performing the services, nor for
> any commercial purpose."

## High issues

### 🟠 H12 — §4 "legitimate interests" basis is not documented as required by GDPR Art. 13(1)(d)

**Clause:** §4 lists legitimate interests as a basis for
processing.

**Problem:** GDPR Article 13(1)(d) requires the Controller to
disclose the "legitimate interests pursued" for every instance
of legitimate-interest-based processing. Saying "legitimate
interests — fraud prevention, service security, analytics" is
too generic. Regulators expect specifics like "preventing
unauthorized access via failed-attempt rate monitoring" and
"measuring aggregate API usage for capacity planning."

**Fix:** Replace the bullet with a table of specific
legitimate-interest-based processing activities, each with a
clear purpose statement.

### 🟠 H13 — §7 "respond within 30 days" is correct for GDPR but not CCPA

**Clause:** §7 "We respond within 30 days."

**Problem:** CCPA requires response within 45 days (extendable
by an additional 45 on notice). 30 days is tighter than CCPA
requires so you can commit to it, BUT CPRA requires you to
confirm receipt within 10 business days. The current draft
doesn't commit to the confirmation step.

**Fix:** Add:

> "For CCPA / CPRA requests, we confirm receipt within 10
> business days and respond within 30 days of receipt
> (extendable to 45 with notice for complex requests)."

### 🟠 H14 — §8 SCCs without "supplementary measures" specifics

**Clause:** §8 "For transfers out of the EEA/UK, we rely on
Standard Contractual Clauses (SCCs) with supplementary
measures as required."

**Problem:** Post-Schrems II (Case C-311/18), the EDPB requires
"supplementary measures" where US law enforcement surveillance
risk exists. "As required" is insufficient — you must document
*which* supplementary measures you apply.

**Fix:** List the specific measures. For InferLane those are
(a) encryption in transit and at rest, (b) strong key
management (HKDF-derived + envelope encryption), (c) logging of
any law enforcement access requests, (d) contractual
commitment not to voluntarily disclose beyond legal
requirement, (e) commitment to challenge overbroad law
enforcement requests.

### 🟠 H15 — §10 children's age should match GDPR Art. 8 flexibility

**Clause:** §10 "children under 16 (EEA) or 13 (US)"

**Problem:** GDPR Art. 8 is 16 by default but member states can
lower to as low as 13. The UK, Ireland, Spain, and Sweden all
have different thresholds.

**Fix:** Change to "the minimum age specified by applicable
law in your jurisdiction" with a list of known thresholds in a
footnote, or simply commit to 16+ for all EEA users as a
conservative baseline.

## Medium issues

### 🟡 M10 — Missing "sensitive personal information" category under CPRA

CPRA added a "sensitive personal information" category (SSN,
precise geolocation, racial/ethnic origin, religion, mail
contents, biometrics). Even if we don't collect these, the
policy should state that we don't, and that users have the
right to limit processing of SPI.

### 🟡 M11 — No disclosure of automated decision-making

GDPR Art. 13(2)(f) and Art. 22 require disclosure of automated
decision-making, including routing decisions that have a
significant effect. The InferLane router classifies and routes
workloads automatically — arguably a "significant" decision.

**Fix:** Add a section:

> "**Automated routing decisions**: Our router automatically
> classifies each workload by complexity and privacy needs
> and selects an Operator based on price, quality, latency,
> and your stated privacy tier. This is not a fully automated
> decision in the sense of GDPR Article 22 because humans can
> override via routing preferences, but we disclose it for
> transparency. You can set routing preferences at
> [/dashboard/settings/routing]."

### 🟡 M12 — DPO appointment unclear

The draft names a "Data Protection Officer" at `privacy@` but
doesn't confirm whether a DPO has been formally appointed
(GDPR Art. 37 requires a formal appointment). If we do not
actually have a DPO, calling one implicit is a gap.

**Fix:** Either formally appoint someone (even if it's the CEO
for a small company) or rename the contact "Privacy Contact"
to avoid the DPO implication.

---

# 4. Data Processing Addendum — `DATA_PROCESSING_ADDENDUM.md`

## High issues

### 🟠 H16 — §8 breach notification timeline is stricter than GDPR requires

**Clause:** §8 "within 48 hours"

**Problem:** GDPR Art. 33 requires Processor to notify
Controller "without undue delay" (no specific hours). Your
draft commits to 48 hours. This is stricter than required and
could create breach exposure if you ever miss it.

**Fix:** Change to "without undue delay and in any event no
later than 48 hours" — the safety valve matters.

### 🟠 H17 — §7 SCC Module Two assumes a Controller-to-Processor relationship but buyers may also be Processors

**Problem:** Some of our buyers are themselves data processors
for their own customers (e.g., a SaaS company using InferLane
to run inference on their own customers' data). When they
transfer data to us, we're a sub-processor, not a direct
processor to them. This requires Module Three SCCs (Processor
to Sub-Processor), not Module Two.

**Fix:** Add an alternative Module Three path for buyers who
are themselves data processors, or commit to negotiating that
with specific customers.

### 🟠 H18 — §11 Audit rights are too narrow for enterprise

**Clause:** §11 "Once per year, on 30 days' written notice,
during business hours"

**Problem:** Enterprise customers will demand more. Regulated
industries (financial services, healthcare) may have specific
audit rights under their own regulations.

**Fix:** Expand the audit clause to allow incident-driven audits
in addition to the annual cadence, and commit to "cooperation
with regulatory audits as required."

## Medium issues

### 🟡 M13 — Annex II (TOMs) is complete but needs dates

The technical measures should be timestamped so we can
demonstrate we maintained them as of a specific date. Add "as
of [current date]" to the annex and commit to updating
quarterly.

### 🟡 M14 — Sub-processors in Annex III include "Operators" as a category

That's technically correct but operators are dynamic and
numerous. Either (a) commit to maintaining the live operator
list in the dashboard with a link, or (b) clarify that
operators are a category of sub-processor and the identity of
each can be disclosed on request.

---

# 5. Acceptable Use Policy — `ACCEPTABLE_USE_POLICY.md`

## High issues

### 🟠 H19 — §3 missing critical regulated categories

Draft mentions medical, legal, financial, employment, biometric,
and elections. Missing:

- **Housing / tenant screening** — subject to Fair Housing Act
  in the US and multiple state laws
- **Credit scoring** — subject to Fair Credit Reporting Act
- **Insurance underwriting** — subject to state insurance
  regulators + anti-discrimination law
- **Criminal justice / sentencing / parole** — subject to
  specific state laws (e.g., NY Local Law 144 for hiring)

**Fix:** Add these as regulated categories with specific
requirements.

### 🟠 H20 — §8 Forfeiture of operator balances may be unenforceable as a penalty

**Clause:** §8 "Forfeiture of pending operator balances (to
fund dispute refunds)"

**Problem:** Most jurisdictions void contract clauses that are
"penalties" (disproportionate to actual damages) rather than
"liquidated damages" (reasonable estimate of actual damages).
Forfeiting an entire pending balance for any breach is the
paradigm of a penalty.

**Fix:** Reframe as "forfeiture up to the amount reasonably
necessary to cover dispute refunds, investigation costs, and
damages caused by the breach." Tie forfeiture to specific harm.

## Medium issues

### 🟡 M15 — §6 sanctions list missing Australia

Draft references OFAC (US), HMT (UK), EU. Missing:

- **DFAT (Australia)** — equivalent list
- **Canada's Office of the Superintendent of Financial
  Institutions** (OSFI) list
- **Japan METI** sanctions

**Fix:** Add these.

### 🟡 M16 — §4 operator-specific prohibitions duplicate the Operator Agreement

This isn't wrong but creates two sources of truth. Consider
whether AUP should incorporate the Operator Agreement by
reference for operator-specific rules.

---

# 6. Dispute Resolution Policy — `DISPUTE_RESOLUTION_POLICY.md`

## High issues

### 🟠 H21 — §6 Reviewer independence rules need specificity

**Clause:** §6 lists independence rules but they're vague (e.g.,
"no commercial relationship").

**Problem:** Courts and regulators look for procedural fairness.
"Commercial relationship" should be defined: financial interest
in the operator, employment relationship, family relationship,
etc.

**Fix:** Enumerate the prohibited relationships explicitly.

### 🟠 H22 — §11 Transparency commitment is a binding promise

**Clause:** §11 "we publish aggregate dispute metrics
quarterly"

**Problem:** If you commit to publishing and then don't, that's
a breach. Many well-intentioned transparency promises fail due
to operational friction.

**Fix:** Either make it a commitment you will actually keep
(with a specific URL and publication schedule) or soften to
"we endeavor to publish."

## Medium issues

### 🟡 M17 — §7 Burden of proof language could be clearer

"Balance of probabilities" is correct civil standard but
shouldn't be assumed. Cite the specific standard in the clause.

---

# 7. Refund Policy — `REFUND_POLICY.md`

## High issues

### 🟠 H23 — §3 EU withdrawal right exception is not clearly stated

**Clause:** §3 "The right does NOT apply to digital services
you have already consumed (executed workloads)"

**Problem:** The EU Consumer Rights Directive Art. 16(m)
actually requires explicit user consent to waive the withdrawal
right for digital content "not supplied on a tangible medium."
The current wording assumes the exception applies automatically.

**Fix:** Add:

> "By requesting immediate dispatch of a workload and
> acknowledging that you will lose your right of withdrawal for
> that workload, you provide the explicit consent required by
> the Consumer Rights Directive for this exception to apply."

And actually capture that consent in the UI.

### 🟠 H24 — §2 Subscription pro-rata refunds may conflict with EU "change of mind" rights

**Clause:** §2 "refundable on a pro-rated basis for the unused
portion"

**Problem:** For EU consumers, pro-rated refunds on a
subscription are actually a separate statutory right (change
of mind / Widerrufsrecht) — but only within the 14-day
withdrawal window. Outside that window, you generally aren't
required to offer pro-rated refunds.

**Fix:** Distinguish the two cases: withdrawal right within 14
days (pro-rated), and post-withdrawal period (no pro-rata
refund unless you choose to offer one).

## Medium issues

### 🟡 M18 — §5 Non-refundable items need clarity on "already paid to operators"

If we've paid an operator but the operator refund was pulled
from their pending balance, is the buyer refunded or not? The
current language could go either way.

---

# 8. Cookie Policy — `COOKIE_POLICY.md`

## Medium issues

### 🟡 M19 — PostHog categorisation as "analytics" requires EU opt-in

PostHog tracks personal data (session replays, event counts
tied to user ID). Under ePrivacy it requires opt-in consent
for EEA users. The draft says "consent-gated in EEA" — verify
this is actually implemented in the UI.

### 🟡 M20 — Cookie list accuracy

Run a dev session and compare the declared cookies to what
actually gets set. Auditors will do this.

---

# 9. Subprocessor List — `SUBPROCESSORS.md`

## Low issues

### 🟢 L4 — Planned subprocessors listed in the main table create customer confusion

Fireblocks, GCP Confidential Space, etc. are listed as
"Planned — Phase F4" in the main table. Enterprise customers
may read this as "already active" despite the note. Move to a
clearly separated "Planned" section.

### 🟢 L5 — Missing subprocessor locations in some rows

Some rows say "Global" without specifying the primary data
centers. GDPR transfer analysis requires knowing where data
actually lives.

---

# Cross-document consistency issues

## Numbered findings affecting multiple docs

### 🔴 X1 — Platform fee percentage conflicts with code

- ToS §3.2: "10%" + "3%" (13% total)
- Operator Agreement §6: "87%" (13% total)
- FLOAT_MODEL.md: 10/3/87
- `splitWorkloadPayment` STANDARD tier: 10/3/87 (1000/300/8700 bps)
- **BUT** the new ATTESTED tier is 92/5/3

The Operator Agreement §6 says flat 87% with no mention of the
ATTESTED tier. Documents must agree.

### 🟠 X2 — Dispute window inconsistency

- ToS §3.3: "up to 168 hours"
- Operator Agreement §6: "default: 168 hours"
- Dispute Resolution Policy §2: "168 hours (7 days)"
- Code in `src/lib/disputes/engine.ts`: `DISPUTE_WINDOW_HOURS = 168`

"Up to" vs exactly is the issue. Code is exactly 168. Contracts
should match.

### 🟠 X3 — Entity name placeholder everywhere

"InferLane, Inc." appears throughout but you haven't
incorporated. Must be replaced after formation.

### 🟠 X4 — Email addresses not set up

- `privacy@inferlane.dev`
- `security@inferlane.dev`
- `billing@inferlane.dev`
- `abuse@inferlane.dev`
- `disputes@inferlane.dev`
- `ops@inferlane.dev`
- `legal@inferlane.dev`

All are referenced but none are set up. Must be reachable
before the policies can be said to be in force.

### 🟡 X5 — "Confidential" tier description varies

Different docs use slightly different phrasing for the same
concept. Pick one description and propagate.

### 🟡 X6 — Reserve fund characterization drifts

- ToS §3.2: "reserve fund contribution" (neutral)
- Operator Agreement §8: "non-refundable contribution" (fee)
- Privacy Policy: doesn't mention
- FLOAT_MODEL.md: treats reserve as a pool we own

Pick one characterization and propagate.

---

# Structural issues (applies to all contracts)

## 🔴 S1 — No definitions section

None of the contracts have a proper "Definitions" section.
Defined terms are scattered throughout. Every capital-letter
term should be defined once.

## 🔴 S2 — No integration with incorporation documents

The contracts don't reference the certificate of incorporation,
bylaws, or stockholder agreements. Standard enterprise
contracts do. Get counsel guidance on whether this matters.

## 🟠 S3 — No execution / signature block

The drafts are markdown without signature blocks. When they
become live contracts, they need clickwrap acceptance logging
or written signature blocks for enterprise agreements.

## 🟠 S4 — No notice of material changes mechanism

Each document says "material changes will be notified 30 days
in advance" but none specify HOW. "Via email and the dashboard"
is the right answer but it's only in some docs.

## 🟠 S5 — Jurisdiction conflicts

ToS says Delaware governing law. DPA § 7 says "Ireland"
(because Module Two SCC Clause 17 defaults to Ireland). These
don't conflict but the interaction should be explained.

---

# Regulatory alignment

## US federal

- **FinCEN / BSA (MSB)** — covered separately in
  `msb-determination.md`. Legal advice needed.
- **CCPA / CPRA** — Privacy Policy gaps flagged (C6, H13, M10,
  M11).
- **FTC Section 5** — deceptive practices risk: §3.2 "final at
  dispatch time" + §4 "will only route to verified operators"
  + §8 disclaimer create conflict that FTC could characterize
  as deceptive.
- **COPPA** — §10 children's age handled.
- **ECPA / SCA** — Privacy Policy covers intercept and storage.
  Good.
- **HIPAA** — AUP addresses medical use and requires BAA. Good,
  but the policy should explicitly say we don't sign BAAs
  unless a specific enterprise agreement is in place.

## US state

- **California CCPA/CPRA** — biggest gap is C6 service provider
  language
- **California AB5** — operator classification (C3)
- **California DFAL (AB 39)** — digital financial asset
  business activity; covered in MSB memo
- **NY BitLicense** — covered in MSB memo
- **Washington WSBA** — separate state MTL regime
- **Texas Money Services Act** — separate regime

## EU / UK

- **GDPR** — multiple findings in Privacy Policy + DPA
- **ePrivacy Directive / PECR** — Cookie Policy (M19)
- **Consumer Rights Directive** — Refund Policy (H23, H24)
- **Digital Services Act (DSA)** — platform obligations;
  depends on user count but AUP is close to compliant
- **AI Act** — prohibited practices list is mostly aligned;
  high-risk application definition needs review

## Australia

- **Australian Consumer Law (ACL)** — Refund Policy §4 handles
  statutory guarantees correctly
- **Privacy Act 1988 + APPs** — Privacy Policy needs explicit
  APPs statement
- **SPAM Act** — not directly covered; applies if we send
  marketing emails to Australian users

## Canada

- **PIPEDA** — Privacy Policy rights section mostly covers
- **Quebec Law 25** — tighter than PIPEDA; needs Quebec-specific
  mention

## Brazil

- **LGPD** — Privacy Policy is mostly aligned; rights section
  needs LGPD-specific wording

---

# Missing documents

## 🔴 Missing terms of service for operators (separate from Operator Agreement)

The Operator Agreement is the master contract but there should
be a separate "Operator Terms of Service" that operates as a
day-to-day usage agreement. Similar to how employment contracts
have both an offer letter and an employee handbook.

## 🟠 Missing SLA / support policy

No service level agreement document. Enterprise customers will
demand one.

## 🟠 Missing Business Associate Agreement template

For HIPAA, we need a BAA template even if we only sign one for
enterprise customers who request it. Having a template shows
preparedness.

## 🟠 Missing vendor Data Processing Agreement template

The DPA we have is for us as Processor. We also need DPAs
we SIGN with OUR processors (Stripe, Neon, Vercel). Most of
those are off-the-shelf from the vendor, but we should have a
catalog.

## 🟡 Missing responsible disclosure policy (separate from security.txt)

`security.txt` is good but most companies also have a
`/security/responsible-disclosure` page with more detail. Minor.

## 🟡 Missing data retention schedule as a separate artifact

Currently retention is in the Privacy Policy §6. A separate
"Data Retention Schedule" document is a SOC 2 best practice.

---

# What's strong

Positive findings — things the drafts get right:

- **Privacy-tier architecture is coherent** across ToS §4,
  Privacy Policy §2, DPA §3, AUP. Same taxonomy, same
  enforcement.
- **Australian Consumer Law carve-out** is present (Refund
  Policy §4). Many US-centric drafts miss this.
- **SCC Module Two implementation** (DPA §7) correctly
  identifies the clauses and annexes. Shows awareness of the
  current framework.
- **Reviewer independence** in Dispute Policy §6 is better than
  most marketplaces. Good.
- **Appeal process** with panel of 2-3 exceeds industry norm.
- **Transparency commitment** in the Dispute Policy §11 and
  Transparency page is genuinely differentiating.
- **Subprocessor list** with clear categories and statuses is
  clean.
- **Security.txt** with RFC 9116 compliance shows maturity.
- **Incident runbook + tabletop scenarios** are more than most
  startups have.

---

# Priority order for counsel engagement

If you have limited lawyer budget, spend it on:

1. **AB5 / operator classification** — §2 of the Operator
   Agreement. This is the highest-dollar risk in the whole
   package. Counsel must either certify the structure or
   restructure to survive an ABC test.
2. **C1 assent mechanism + C2 liability cap + C3 classification
   bundle** — these three combined represent the legal core of
   whether the platform can operate.
3. **MSB / MTL determination** — already has a separate memo;
   combine with this review for a full regulatory package.
4. **C5/C6 Privacy Policy contradiction + CCPA service provider
   language** — regulatory exposure for US customers.
5. **Platform fee and dispute window consistency** — cross-doc
   alignment with code.
6. **Reserve fund tax characterisation** — lawyer + accountant
   combined question.
7. **Arbitration + venue selection** — strategic; counsel can
   advise.
8. **Everything else** — polish and consistency.

## Suggested lawyer timeline

| Week | Activity |
|---|---|
| 1 | Lawyer reads this memo + all drafts |
| 2 | Lawyer prepares question list + initial edits |
| 3 | Joint review meeting with you |
| 4 | Lawyer prepares revised drafts |
| 5 | You review and approve |
| 6 | Lawyer finalizes + removes DRAFT banners |

Budget: **40–80 lawyer hours total** for the full package,
possibly more if AB5 restructuring is needed. At $500–$1000/hr
that's $20K–$80K.

## What to NOT waste lawyer time on

- Cookie Policy — mostly boilerplate
- Subprocessor List — a factual table
- Security.txt — RFC 9116 compliance, no debate
- Refund Policy basic structure — just needs §3 H23 fix and
  §2 H24 fix
- Definitions in general — AI can draft these from the existing
  usage for lawyer polish

---

# Summary tally

**Findings:**
- 🔴 Critical: 6 (C1-C6)
- 🟠 High: 24 (H1-H24)
- 🟡 Medium: 20 (M1-M20)
- 🟢 Low: 5 (L1-L5)
- Cross-doc: 6 (X1-X6)
- Structural: 5 (S1-S5)
- **Total: 66 findings**

**Documents:**
- 10 drafts reviewed (8 policies + subprocessors + annotated
  review)
- ~1,800 lines of legal text
- No draft is production-ready as-is
- No draft has a fatal flaw that can't be fixed in review

**Assessment:** The structural work is done. The drafts provide
a lawyer a meaningful head start — they cover the right topics
in the right order, reference the right statutes, and
anticipate most of the issues they need to resolve. A lawyer
should be able to get these production-ready in 40–80 hours.

This memo gives them a map.

---

**Prepared by Claude (AI). Not legal advice. Requires counsel
review before any document in `commercial/legal/` is used in
production.**
