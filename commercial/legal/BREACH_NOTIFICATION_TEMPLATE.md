---
document: Personal Data Breach Notification Template
regulation: GDPR Article 33 (supervisory authority) and Article 34 (data subjects)
version: 1.0.0
status: READY -- fill in [PLACEHOLDERS] during an incident
drafted_by: Claude (AI)
drafted_at: 2026-04-16
controller: InferLane, Inc.
dpo_contact: privacy@inferlane.dev
---

# Personal Data Breach Notification

## To: [SUPERVISORY AUTHORITY NAME AND ADDRESS]

**From:** InferLane, Inc.
**DPO / Privacy Contact:** privacy@inferlane.dev
**Date of notification:** [DATE]
**Reference number:** ILB-[YYYY]-[NNN]

---

## 1. Timing

| Field | Value |
|---|---|
| Date and time breach was detected | [YYYY-MM-DD HH:MM UTC] |
| Date and time breach occurred (if different or estimated) | [YYYY-MM-DD HH:MM UTC / UNKNOWN / ESTIMATED: ...] |
| Date and time of this notification | [YYYY-MM-DD HH:MM UTC] |
| Hours elapsed since detection | [N] hours |
| Is this notification within 72 hours of detection? | [YES / NO -- if NO, provide justification below] |

**Justification for late notification (if applicable):**
[EXPLAIN WHY NOTIFICATION EXCEEDED 72 HOURS]

---

## 2. Nature of the breach

| Field | Value |
|---|---|
| Breach type | [ ] Confidentiality (unauthorised disclosure or access) |
| | [ ] Integrity (unauthorised alteration) |
| | [ ] Availability (loss of access or destruction) |
| Brief description | [WHAT HAPPENED -- 2-3 sentences] |

**Detailed description:**

[PROVIDE A FACTUAL ACCOUNT OF WHAT OCCURRED. Include:
- How the breach was discovered
- What systems or services were affected
- The attack vector or root cause (if known)
- Timeline of events
- Whether the breach is ongoing or contained]

---

## 3. Data subjects affected

| Field | Value |
|---|---|
| Categories of data subjects | [ ] Users (account holders) |
| | [ ] Node operators |
| | [ ] Visitors (waitlist) |
| | [ ] Partners |
| | [ ] Employees |
| | [ ] Other: [SPECIFY] |
| Approximate number of data subjects affected | [NUMBER or RANGE] |

---

## 4. Personal data records affected

| Field | Value |
|---|---|
| Categories of personal data records | [ ] Account data (name, email) |
| | [ ] OAuth tokens / session tokens |
| | [ ] API key hashes |
| | [ ] Encrypted provider API keys |
| | [ ] Spend / usage data |
| | [ ] Scheduled prompt content |
| | [ ] Payment data (Stripe IDs) |
| | [ ] KYC session references |
| | [ ] IP addresses |
| | [ ] Notification channel credentials (webhooks, bot tokens) |
| | [ ] Wallet balances / transaction history |
| | [ ] Audit logs |
| | [ ] Node operator earnings / payout data |
| | [ ] Other: [SPECIFY] |
| Approximate number of records affected | [NUMBER or RANGE] |

---

## 5. Likely consequences

[DESCRIBE THE LIKELY CONSEQUENCES FOR DATA SUBJECTS. Consider:

- Risk of identity theft or fraud
- Risk of financial loss
- Risk of unauthorised access to third-party services (if API keys exposed)
- Risk of reputational damage
- Risk of discrimination
- Loss of confidentiality of commercially sensitive prompt content
- Loss of access to services

Rate overall risk to data subjects: [ ] LOW / [ ] MEDIUM / [ ] HIGH]

---

## 6. Measures taken to address the breach

**Containment measures (already taken):**

- [ ] [DESCRIBE IMMEDIATE ACTIONS -- e.g., revoked compromised credentials, rotated keys, blocked IPs, patched vulnerability]
- [ ] [...]
- [ ] [...]

**Remediation measures (planned):**

- [ ] [DESCRIBE PLANNED ACTIONS -- e.g., forced password reset, infrastructure audit, enhanced monitoring]
- [ ] [...]
- [ ] [...]

---

## 7. Measures taken to mitigate adverse effects on data subjects

- [ ] [DESCRIBE WHAT YOU ARE DOING TO PROTECT AFFECTED INDIVIDUALS -- e.g., notifying users to rotate API keys, offering credit monitoring, forced session invalidation]
- [ ] [...]
- [ ] [...]

---

## 8. Data subject notification

| Field | Value |
|---|---|
| Have data subjects been notified? | [YES / NO / NOT YET -- PLANNED] |
| If yes, date of notification | [DATE] |
| Method of notification | [ ] Email / [ ] In-app notification / [ ] Public disclosure / [ ] Other: [SPECIFY] |
| If no, justification | [EXPLAIN -- e.g., risk to data subjects assessed as low, data was encrypted, breach did not result in exposure of plaintext PII] |

---

## 9. DPO and contact information

| Field | Value |
|---|---|
| Organisation | InferLane, Inc. |
| DPO / Privacy contact | privacy@inferlane.dev |
| Contact name | [NAME] |
| Contact phone | [PHONE] |
| Contact email | privacy@inferlane.dev |

---

## 10. Additional information

[ANY OTHER RELEVANT INFORMATION, INCLUDING:
- Whether law enforcement has been notified
- Whether the breach involves cross-border transfers
- Whether third-party sub-processors were involved (and which ones)
- References to related incident reports]

---

## Incident Response Checklist

Complete this checklist during the incident. Times are relative to
detection (T+0).

### Immediate (T+0 to T+1h)

- [ ] Breach detected and confirmed
- [ ] Incident commander assigned: [NAME]
- [ ] Containment measures initiated
- [ ] Initial scope assessment completed
- [ ] Internal incident channel created (Slack/Discord)
- [ ] 72-hour clock started -- deadline: [YYYY-MM-DD HH:MM UTC]

### First 24 hours (T+1h to T+24h)

- [ ] Root cause identified (or investigation ongoing)
- [ ] Affected data categories and subjects identified
- [ ] Risk assessment completed (LOW / MEDIUM / HIGH)
- [ ] Decision made on supervisory authority notification (required if risk is not low)
- [ ] Decision made on data subject notification (required if high risk)
- [ ] Legal counsel engaged
- [ ] CEO / leadership briefed

### Before 72-hour deadline (T+24h to T+72h)

- [ ] Supervisory authority notified (this template, submitted)
- [ ] Data subjects notified (if high risk)
- [ ] Sub-processors notified (if their systems were involved)
- [ ] Customer-facing status page updated (if applicable)

### Post-incident (T+72h onward)

- [ ] Internal incident report filed
- [ ] Root cause analysis completed
- [ ] Corrective actions documented and assigned
- [ ] ROPA updated if processing activities changed
- [ ] Breach register entry created (internal log)
- [ ] Follow-up notification to supervisory authority (if initial notification was incomplete)
- [ ] Post-mortem meeting held
- [ ] Lessons learned documented

---

## Supervisory Authority Quick Reference

| Jurisdiction | Authority | Portal / Email |
|---|---|---|
| Ireland (lead for EU) | Data Protection Commission (DPC) | https://forms.dataprotection.ie/report-a-breach |
| UK | Information Commissioner's Office (ICO) | https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/ |
| Australia | OAIC | https://www.oaic.gov.au/privacy/notifiable-data-breaches |
| USA (California) | California AG | https://oag.ca.gov/privacy/databreach/reporting |

---

## Internal Distribution

This template is stored at `commercial/legal/BREACH_NOTIFICATION_TEMPLATE.md`.
During an incident, copy this file, fill in the placeholders, and store
the completed version as `commercial/legal/incidents/ILB-[YYYY]-[NNN].md`.

Ensure the completed notification is reviewed by legal counsel before
submission to any supervisory authority.
