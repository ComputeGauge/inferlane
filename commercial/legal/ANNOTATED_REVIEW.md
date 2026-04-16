---
document: Annotated Legal Review — Pass 2
version: 1.0.0
status: Authoritative — AI second-pass review, ready for lawyer
reviewer: Claude (AI, second pass)
reviewed_at: 2026-04-15
---

# Annotated Legal Review — Second Pass

First-pass drafts live in `commercial/legal/`. This document
annotates each draft with risk factors, enforceability concerns,
jurisdiction-specific footnotes, and open questions flagged for the
eventual lawyer review. The goal is to make the lawyer engagement
faster and cheaper by surfacing the issues up front.

## Terms of Service (`TERMS_OF_SERVICE.md`)

### Clause-level notes

**§1 Parties** — Placeholder "Delaware corporation" assumes
entity choice. If we incorporate elsewhere (PBC, LLC, C-corp in
another state), every occurrence needs updating. Flag for
find-replace.

**§3.1 Routing** — "You authorize InferLane to route your
workload accordingly" is broad. A careful buyer may want more
granular control — e.g., "not to specific providers" or "only
within my declared privacy tier." The router code already
supports this; the contract should mirror it. **Suggested
addition:** a sentence pointing to `/dashboard/settings/routing`
for the user's routing preferences.

**§3.3 Settlement** — 168h dispute window mentioned as "up to."
Should be exactly 168 hours to match the code enforcement.
Inconsistency between marketing copy and contract text is a
regulator red flag.

**§4 Privacy tiers** — The Transport-only tier says "plaintext at
Operator memory." True but scary. Lawyer may want softer phrasing
(e.g., "visible to the executing Operator's process memory under
standard TLS termination"). Tradeoff: honest but abrasive vs.
polished but less informative.

**§5 Acceptable Use** — Item 4 (hate speech, misinformation) is
the clause most likely to generate disputes. Historical precedent:
platforms that enforce this unevenly face §230 and §512 challenges.
Consider moving this to the AUP and leaving only the hard
regulatory prohibitions in the ToS.

**§8 Disclaimers** — "AS IS" is standard but in consumer-facing
contexts may be voided by Magnuson-Moss (US) or Australian
Consumer Law statutory guarantees. **Cross-reference:** Refund
Policy handles this correctly but ToS should acknowledge.

**§9 Limitation of Liability** — Cap at "greater of $100 or 12
months of fees" is standard but may be too low for enterprise
buyers who routinely negotiate for "actual damages up to $X". We
should allow enterprise contracts to override this via schedule.

**§13 Governing Law** — Placeholder Delaware law + JAMS arbitration
in SF. Real lawyer tailoring required. Class waiver + arbitration
may be unenforceable in CA consumer contexts post-2024.

### Risk ranking

| Clause | Risk | Likelihood |
|---|---|---|
| §4 privacy tier phrasing | Misunderstanding by non-technical buyers | High |
| §9 liability cap | Unenforceable under some jurisdictions | Medium |
| §13 arbitration | Class waiver pushback | Medium |
| §5 content moderation | §230 exposure | Low |

### Suggested additions

- Paragraph on data location (US-only by default, with opt-in
  EU routing for EEA customers)
- Acknowledgment that routing uses a classifier and buyers can
  opt out of automated routing with a fee
- Explicit statement on zero model training on buyer inputs

## Operator Agreement (`SELLER_AGREEMENT.md`)

### Clause-level notes

**§3 Independent contractor** — "You are responsible for your
own taxes" is important but insufficient. California AB5 and
similar misclassification laws can deem operators employees if
we exercise control over their work. Must strengthen with
specific clauses that reduce control indicia:
- Operator sets their own prices (within a floor/ceiling)
- Operator sets their own availability
- Operator supplies their own equipment
- No exclusivity requirement

**§4 Onboarding** — KYC + Stripe Identity is good. Add a clause
noting we retain right to re-verify at any time with 14-day
notice.

**§5 Capability declarations** — The "misrepresentation is a
material breach" language is strong. Good. Lawyer may want to
add a cure period for good-faith mistakes (e.g., operator
declared H100 but delivered A100 due to a supply swap).

**§6 Service standards** — 5 min heartbeat is tight. Real-world
consumer Mac operators will occasionally miss a heartbeat due
to sleep/wake. Consider a "3 consecutive missed heartbeats" rule
rather than "any missed."

**§8 Reserve fund** — "Non-refundable contribution" is the line
most likely to attract regulator attention. If the reserve is
truly non-refundable, it may count as fees (taxable as income
to us) or as a deposit (subject to escrow rules). Lawyer must
confirm how Delaware treats this.

**§9 Disputes and slashing** — "Slashing" is crypto slang; a
lawyer may ask us to use "monetary penalty" or similar legally-
defined terms.

**§10 Prohibited activities** — Sybil enforcement via account
linking may trip CCPA / GDPR rules if it involves matching
across accounts without user consent. Need to explicitly
disclose the behavioral matching.

**§12 Data protection** — Reference to "DPA" is correct but the
DPA is itself a draft. Circular reference — both documents will
be signed together.

### Risk ranking

| Clause | Risk | Likelihood |
|---|---|---|
| §3 independent contractor | AB5 / worker misclassification | High |
| §8 reserve fund | Tax / escrow treatment | High |
| §9 slashing language | Legally ambiguous | Medium |
| §6 5-min heartbeat | Realistic enforcement | Medium |
| §10 Sybil detection | Privacy exposure | Low |

### Suggested additions

- Right of first refusal on buyback if we terminate an operator
- Tax form collection (W-9 for US, W-8BEN for non-US) explicitly
- Operator data retention: they must keep logs for 30 days for
  disputes

## Privacy Policy (`PRIVACY_POLICY.md`)

### Clause-level notes

**§2 Information we collect** — "Workload inputs and outputs"
section needs to be unambiguous about Confidential tier. The
current wording says "may be recorded (hashed or redacted) for
up to 7 days" which contradicts the Confidential tier's zero-
logging guarantee. Must distinguish.

**§4 Legal bases (GDPR)** — "Legitimate interests" is the most
litigated basis in GDPR. Must pass the balancing test. Fraud
prevention typically clears it; analytics sometimes doesn't.

**§5 Sharing** — "Operators are contractually bound not to retain
or repurpose your data" — this is a promise we make on behalf
of third parties. Under GDPR Art. 28 we must have a DPA with
every processor. The Operator Agreement should incorporate DPA
terms by reference.

**§6 Data retention** — The 7-year financial record retention is
correct for US tax. EU GDPR favors shorter retention; we may
need region-specific retention for EEA customers.

**§7 Your rights** — All good. We ship `/api/privacy/export` and
`/api/privacy/delete` which fulfill Art. 15 and Art. 17. **Gap:**
P5.2 correction right is not yet implemented in a structured
route. SOC 2 readiness memo flagged this.

**§8 International transfers** — SCCs are current version. Good.
Note that Schrems III is expected and may invalidate SCCs again;
the DPA should include "supplementary measures" language.

**§10 Children** — GDPR 16 / UK 13 / US 13 is the standard. We
explicitly don't serve minors. Fine.

### Risk ranking

| Clause | Risk | Likelihood |
|---|---|---|
| §2 Confidential tier contradiction | Reviewer catches inconsistency | High |
| §4 legitimate interest basis | Balancing test | Medium |
| §6 retention periods | Region-specific conflict | Medium |
| §8 Schrems III SCC invalidation | Future risk | Low (but high impact) |

## Data Processing Addendum (`DATA_PROCESSING_ADDENDUM.md`)

### Clause-level notes

**§5 Controller instructions** — Very thorough. Good.

**§6 Sub-processors** — 14-day notice is standard but enterprise
customers often demand 30-day minimum. Flag for negotiation.

**§7 International transfers** — SCC Module Two, Clause 7 (docking)
and Clause 17 (governing law) are both correctly addressed. The
Swiss FADP reference is current.

**§8 Breach notification** — 48 hours is tight. GDPR Art. 33
requires 72 hours to the supervisory authority; our 48-hour
commitment to the customer gives them a 24-hour buffer to
evaluate. Good. Note: data subject notification is "without
undue delay" and only when "high risk" — we commit to "material
breach" which may be stricter than required.

**§10 Return or deletion** — 30-day delete + 90-day backup expiry
is standard. Confirm alignment with Vercel's backup policies.

### Annex II (TOMs)

All measures listed are actually implemented in the code (I
verified). The auditor-friendly detail is good — most competitors
just say "industry-standard" which is legally weak.

### Annex III (Sub-processors)

Fireblocks and Google Cloud are marked "Planned — Phase F4." This
is important transparency but customers on a current contract
may object. **Suggestion:** move planned subprocessors to a
separate section so they don't look like fait accompli.

### Risk ranking

| Clause | Risk | Likelihood |
|---|---|---|
| §8 breach notification timing | Stricter than required | Low |
| Annex III planned subprocessors | Customer objection | Medium |

## Acceptable Use Policy (`ACCEPTABLE_USE_POLICY.md`)

### Clause-level notes

**§1 Prohibited content** — CSAM, violence, CBRN, malware — all
standard. Complete and unambiguous.

**§2 Prohibited uses** — Training on Workload data is banned.
Good. Explicit "no extraction of model weights" is forward-
looking.

**§3 Regulated applications** — Medical / legal / financial /
employment — all correctly called out. **Missing:**
housing/tenant screening (California SB 1047 / NYC Local Law 144
also covers this). Add.

**§4 Operator prohibitions** — Sybil enforcement again — needs
to be disclosed in the Privacy Policy to be compliant.

**§5 Security research safe harbor** — Our clause is
well-structured. Good.

**§6 Export controls** — US OFAC + UK HMT + EU list references
are correct. Consider adding Australian DFAT and Japanese METI
for those jurisdictions.

**§7 Reporting** — Abuse email + SLA is clear.

**§8 Enforcement** — Termination without notice is strong. Add a
reservation of rights to pursue civil remedies.

### Risk ranking

| Clause | Risk | Likelihood |
|---|---|---|
| §3 missing housing category | Regulatory gap | Medium |
| §6 export control completeness | Jurisdictional gap | Low |

## Dispute Resolution Policy (`DISPUTE_RESOLUTION_POLICY.md`)

### Clause-level notes

**§2 Scope** — Clear list of in/out-of-scope disputes. Good.

**§3 Opening a dispute** — Matches the API and dashboard.

**§4 Evidence** — Acceptable evidence list is comprehensive.

**§6 Reviewer independence** — Two-reviewer requirement for
disputes over $10K matches the code. Good.

**§7 Standard of proof** — "Balance of probabilities" is the
right civil standard.

**§8 Possible outcomes** — Reputation adjustment + capability
revocation are documented. Good.

**§9 Appeals** — 7-day window matches the code.

**§11 Transparency** — We commit to quarterly aggregate metrics.
This is a real commitment — we must actually publish them.

### Risk ranking

| Clause | Risk | Likelihood |
|---|---|---|
| §11 transparency commitment | We don't follow through | Medium |

## Cookie Policy + Refund Policy + Subprocessor List

All three are tight. Minor edits needed but no structural risks.
Cookie Policy could add a CCPA-specific "Do Not Sell" link even
though we don't sell data (regulator safe harbor). Refund Policy
could specify withholding tax for non-US operators.

## Cross-document consistency checks

| Check | Status |
|---|---|
| Entity name consistent across all docs | ⚠️ All placeholders |
| "InferLane, Inc." vs "InferLane" usage | Mixed — standardize |
| Defined terms capitalized consistently | Mostly OK |
| Section numbers consistent | OK |
| Cross-references valid | Mostly OK |
| Email addresses reachable | Need to set up `privacy@` `security@` `billing@` `abuse@` `legal@` |

## What the lawyer should spend their time on

Ranked by impact:

1. **Governing law / arbitration clauses** — needs jurisdiction-
   specific tailoring
2. **Operator independent-contractor classification** — AB5 risk
3. **Reserve fund tax / escrow characterization**
4. **MSB determination questions** — see separate memo
5. **Entity-specific placeholder replacement** — after
   incorporation
6. **Limitation of liability caps** — enterprise negotiation
7. **Privacy tier language** — balance honesty with polish

## What the lawyer should NOT spend their time on

Spare their hours (and your money):

1. Cookie Policy — mostly boilerplate
2. Refund Policy — straightforward
3. Subprocessor List — a table of facts
4. Privacy Policy §§ 1-3, 7 — standard
5. AUP §§ 5-7 — standard

## Delivery format

When you engage the lawyer, send them:
1. This annotated review
2. The full drafts in `commercial/legal/`
3. The MSB determination memo
4. A one-page summary of the business model

Budget: 40-80 lawyer hours for the complete first review, which
at $500-$1000/hr is $20K-$80K. Most of that is replacing
placeholder clauses and tailoring limitations of liability;
the structural work is done.
