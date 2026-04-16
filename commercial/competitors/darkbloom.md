---
document: Competitor analysis — Darkbloom (Eigen Labs)
version: 1.0.0
status: Monitoring — update weekly
drafted_by: Claude (AI)
drafted_at: 2026-04-15
repo: https://github.com/Layr-Labs/d-inference
site: https://darkbloom.dev
paper: https://darkbloom.dev/ (linked from thread)
launched: X thread 2026-04-14
---

# Darkbloom — competitor analysis

## 30-second summary

Private inference network routing OpenAI-compatible API calls to
**idle Apple Silicon Macs**. Uses Apple's Secure Enclave + hardened
runtime + Managed Device Attestation as the trust root (the same
chain Apple uses for Private Cloud Compute). Claims ~50% cheaper than
OpenRouter because the operator's marginal cost is only electricity.
9 nodes live, 600+ GB unified memory, 95% revenue split to operators.
Research preview, public code + paper, Eigen Labs backed.

## Structural strengths

1. **Apple Silicon as the latent supply curve.** 100M+ Macs with
   Apple Silicon, most idle most of the day. Zero capex for each
   operator — the hardware is already bought. This is a real
   structural price advantage that can't be beaten by a data-center
   approach.

2. **Apple's security primitives as the TEE.** Rather than building
   Intel TDX / AMD SEV-SNP / NVIDIA CC verifiers from scratch, they
   lean on the infrastructure Apple has already productised (Secure
   Enclave, Managed Device Attestation, hardened runtime, SIP). Same
   threat model as Private Cloud Compute.

3. **Tight price story.** ~50% cheaper than OpenRouter on Qwen,
   Gemma, MiniMax. Not promotional — structural.

4. **Operator economics.** 95% to operators, 5% platform. Most
   generous split in the space.

5. **Eigen Labs pedigree.** Brand strength in the crypto/compute
   category; affiliated with EigenLayer re-staking team.

6. **Paper-first credibility.** Published technical paper alongside
   code and live demo. RouteLLM / Chatbot Arena pattern.

## Weaknesses

1. **9 nodes is lab scale.** Real marketplaces need hundreds to
   absorb demand swings.

2. **Apple-only is a ceiling.** Excludes all NVIDIA/AMD consumer GPUs,
   data center H100/A100, TPU, Chinese silicon, Linux/Windows.

3. **Single attestation trust root.** Apple is the only counterparty
   in their chain. If Apple changes MDM flow, breaks, or declines the
   use case, Darkbloom has no fallback.

4. **Pricing arbitrage compresses.** As data-center compute
   commoditizes, the ~50% gap will close.

5. **Consumer Mac ops risk.** Lids close, reboots for updates, kids
   play games. Server-grade reliability on a consumer device is a
   hard distributed-systems problem.

6. **"Apple's servers vouch for the hardware"** means Apple is in
   the trust chain. For users distrustful of Apple specifically,
   this isn't zero-trust — it's Apple-trust.

7. **5% take rate with full marketplace responsibilities** is thin.
   They'll need volume to make money.

8. **"Same threat model as Private Cloud Compute" is their claim.**
   Apple's PCC has been externally audited. Darkbloom has not been.
   Paper + open code is necessary but not sufficient.

## What Darkbloom has that InferLane doesn't

- Real working Apple Silicon attestation path (Managed Device
  Attestation)
- Published paper
- Tighter product focus (one supply curve, one customer story)
- Better tagline ("wake the world's sleeping compute")
- Solana payout rail (simpler than our dual Stripe/Fireblocks setup)

## What InferLane has that Darkbloom doesn't

| Capability | Darkbloom | InferLane |
|---|---|---|
| Hardware coverage | Apple Silicon only | TDX, SEV-SNP, NVIDIA CC, Azure CCVM, GCP Confidential Space, Apple MDM, centralized providers |
| Revenue model | Fee-only (5%) | Float + rebates + futures + SaaS |
| Hybrid routing | Decentralised only | Hybrid with fallback |
| Compute futures | Not in scope | Shipped |
| Dispute engine | Paper mentions reputation | Full FSM + appeals |
| Settlement compliance | Solana | Stripe Treasury + Connect + Fireblocks + MSB plan |
| Legal docs | None public | ToS, DPA, AUP, Privacy, Seller, DRP |
| OpenAPI + versioning | Not seen | Shipped |
| ASVS L2 self-audit | Not seen | Shipped + FAILs closed |
| STRIDE threat model | Likely in paper | Shipped |
| Cross-LLM persistence | Out of scope | Shipped |

## What we should steal

1. **Add Apple Silicon operator support.** New attestation type
   `APPLE_SILICON_MDM` in the facade, verifier stub, Phase 4.3 does
   the real Apple DeviceCheck + MDM chain validation. **Done —
   schema + facade stub shipped 2026-04-15.**

2. **Publish a paper.** 8-page architecture paper on the four-leg
   model, router-commercial tiebreaker, attestation facade,
   double-entry ledger. Gives enterprise security teams something
   to read before they engage.

3. **"Bring your own attested hardware" pricing tier.** 92/5/3
   split for Confidential-tier operators who pass attestation and
   accept dispute risk. Preserves our 87/10/3 default while matching
   Darkbloom's generosity for high-trust operators.

4. **Solana payout path as a third adapter.** Alongside Stripe
   Connect and Fireblocks USDT. Covers operators in jurisdictions
   neither of the first two reach.

5. **"Wake the sleeping compute" framing.** Better hook than "cost
   intelligence for Claude Code". Rewrite the landing page topline
   around latent supply and the Inference Tax.

6. **Lead with privacy.** We've built the attestation facade, the
   Confidential-tier gate, and router-commercial. Surface it in the
   marketing copy instead of burying it.

## What we should NOT copy

1. **Single-vendor attestation trust root.** We diversify across TEE
   vendors; don't backslide.

2. **95% default take rate.** Unsustainable for a full-feature
   marketplace.

3. **Single-chain crypto payout.** Solana alone is a compliance
   headache for enterprise.

4. **Research-preview posture.** They get away with "rough edges
   included" because they're a lab. We're building for commercial
   use.

## Action items (priority order)

| # | Action | Est. | Status |
|---|---|---|---|
| 1 | Add `APPLE_SILICON_MDM` to attestation enum + facade stub | 1h | ✅ done |
| 2 | Read dginf-private-inference.pdf in detail and update this memo | 2h | pending |
| 3 | Rewrite landing page topline around "idle compute" | 4h | pending |
| 4 | Ship InferLane architecture paper | 1-2 days | pending |
| 5 | "Bring your own attested hardware" 92/5/3 tier | 1 day | pending |
| 6 | Solana payout adapter stub | 1 day | pending |
| 7 | Weekly watch on github.com/Layr-Labs/d-inference commits | ongoing | pending |

## Monitoring

- `gh api repos/Layr-Labs/d-inference/commits?per_page=10`
- `gh api repos/Layr-Labs/d-inference/releases`
- X thread follow-ups from @gajesh and @eigen_labs
- darkbloom.dev changelog (if they publish one)

## References

- X thread: https://x.com/gajesh/status/2044067343480066480
- Repo: https://github.com/Layr-Labs/d-inference
- Paper: https://darkbloom.dev/ (dginf-private-inference.pdf)
- Console: https://console.darkbloom.dev/
- Provider setup: `curl -fsSL https://api.darkbloom.dev/install.sh | bash`
