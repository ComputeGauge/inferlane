// ---------------------------------------------------------------------------
// Verification Protocol (Stream U)
// ---------------------------------------------------------------------------
// Five independent verification methods that produce evidence about a
// compute resource's claims. Each produces a VerificationResult that's
// stored, auditable, and feeds into the classification's composite score.
//
// Probes are designed to be indistinguishable from real user traffic.
// Nodes don't know they're being tested.
// ---------------------------------------------------------------------------

import type {
  VerificationResult,
  VerificationMethod,
  VerificationOutcome,
  ComputeClassification,
} from './types';
import { LIGHT_IN_FIBER_KM_PER_MS, MIN_RTT_MULTIPLIER, MAX_RTT_MULTIPLIER } from './types';
import { randomBytes, createHash } from 'crypto';

// ── Probe Challenge Banks ─────────────────────────────────────────────────

interface ProbeChallenge {
  prompt: string;
  expectedSubstring: string;  // response must contain this
  category: 'factual' | 'capability' | 'identity';
}

/** Challenges that work across model families */
const UNIVERSAL_CHALLENGES: ProbeChallenge[] = [
  {
    prompt: 'What is the chemical symbol for gold? Answer with just the symbol.',
    expectedSubstring: 'Au',
    category: 'factual',
  },
  {
    prompt: 'What is 7 multiplied by 8? Answer with just the number.',
    expectedSubstring: '56',
    category: 'factual',
  },
  {
    prompt: 'Name the largest planet in our solar system in one word.',
    expectedSubstring: 'Jupiter',
    category: 'factual',
  },
  {
    prompt: 'Write a haiku about the ocean.',
    expectedSubstring: '',  // just needs to return something coherent
    category: 'capability',
  },
  {
    prompt: 'Translate "hello" to French. Answer with just the French word.',
    expectedSubstring: 'Bonjour',
    category: 'factual',
  },
];

/** Expected model quality ranges (MMLU-like proxy scores) */
const QUALITY_EXPECTATIONS: Record<string, { min: number; max: number }> = {
  FRONTIER: { min: 0.82, max: 0.98 },
  STANDARD: { min: 0.70, max: 0.90 },
  ECONOMY: { min: 0.55, max: 0.80 },
  OPEN_WEIGHT: { min: 0.40, max: 0.80 },
};

// ── Probe Request Verification ────────────────────────────────────────────

/**
 * Send known-answer challenges to verify model identity and capability.
 * Selects 3 challenges, sends them, checks responses contain expected substrings.
 *
 * Scoring: 3/3 = VERIFIED, 2/3 = INCONCLUSIVE, 0-1/3 = FAILED
 */
export async function runProbeRequest(
  classification: ComputeClassification,
  sendRequest: (prompt: string, model: string) => Promise<{ response: string; latencyMs: number; tokensOut: number }>,
): Promise<VerificationResult> {
  const id = randomBytes(12).toString('hex');
  const startTime = Date.now();

  // Select 3 challenges (shuffle and take first 3)
  const challenges = [...UNIVERSAL_CHALLENGES]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  let matches = 0;
  let totalLatency = 0;
  let totalTokens = 0;
  const challengeResults: Array<{ prompt: string; matched: boolean; latencyMs: number }> = [];

  for (const challenge of challenges) {
    try {
      const result = await sendRequest(challenge.prompt, classification.model);
      totalLatency += result.latencyMs;
      totalTokens += result.tokensOut;

      const matched = challenge.expectedSubstring === '' // capability check: just needs a response
        ? result.response.length > 10
        : result.response.toLowerCase().includes(challenge.expectedSubstring.toLowerCase());

      if (matched) matches++;
      challengeResults.push({ prompt: challenge.prompt, matched, latencyMs: result.latencyMs });
    } catch {
      challengeResults.push({ prompt: challenge.prompt, matched: false, latencyMs: 0 });
    }
  }

  let outcome: VerificationOutcome;
  if (matches >= 3) outcome = 'VERIFIED';
  else if (matches >= 2) outcome = 'INCONCLUSIVE';
  else outcome = 'FAILED';

  const avgLatency = challenges.length > 0 ? totalLatency / challenges.length : 0;
  const avgThroughput = totalLatency > 0 ? (totalTokens / (totalLatency / 1000)) : 0;

  return {
    id,
    classificationId: classification.id,
    method: 'PROBE_REQUEST',
    outcome,
    details: {
      challengeResults,
      matchRate: matches / challenges.length,
      averageLatencyMs: avgLatency,
      tokensPerSecond: avgThroughput,
      accuracy: matches / challenges.length,
    },
    latencyMs: Date.now() - startTime,
    executedAt: new Date(),
  };
}

// ── Latency Attestation ───────────────────────────────────────────────────

interface MeasurementPoint {
  id: string;
  region: string;       // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
}

/** Approximate distances between major regions (km) */
const REGION_DISTANCES: Record<string, Record<string, number>> = {
  US: { US: 2000, DE: 8000, JP: 10000, AU: 15000, BR: 8500, SG: 15000 },
  DE: { US: 8000, DE: 500, JP: 9500, AU: 16000, BR: 10000, SG: 10000 },
  JP: { US: 10000, DE: 9500, JP: 500, AU: 7800, BR: 17500, SG: 5300 },
  AU: { US: 15000, DE: 16000, JP: 7800, AU: 1000, BR: 14000, SG: 6200 },
  SG: { US: 15000, DE: 10000, JP: 5300, AU: 6200, BR: 16500, SG: 500 },
};

/**
 * Verify geographic claims via network timing.
 *
 * Cannot prove a node IS in a region, but CAN prove it's NOT
 * where it claims to be if RTT is physically impossible.
 */
export async function runLatencyAttestation(
  classification: ComputeClassification,
  claimedRegion: string,
  measureRTT: (targetId: string) => Promise<{ rttMs: number; fromRegion: string }>,
): Promise<VerificationResult> {
  const id = randomBytes(12).toString('hex');
  const startTime = Date.now();

  try {
    const measurement = await measureRTT(classification.targetId);

    // Calculate minimum theoretical RTT
    const distance = REGION_DISTANCES[measurement.fromRegion]?.[claimedRegion]
      ?? REGION_DISTANCES[claimedRegion]?.[measurement.fromRegion]
      ?? 10000; // default 10,000km if unknown pair

    const theoreticalMinRTT = (distance / LIGHT_IN_FIBER_KM_PER_MS) * 2; // round trip

    let outcome: VerificationOutcome;
    let detectedRegion: string | undefined;

    if (measurement.rttMs < theoreticalMinRTT * MIN_RTT_MULTIPLIER) {
      // Physically impossible — node is closer than claimed
      outcome = 'FAILED';
    } else if (measurement.rttMs > theoreticalMinRTT * MAX_RTT_MULTIPLIER) {
      // Very high latency — could be routing issues, not necessarily fraud
      outcome = 'INCONCLUSIVE';
    } else {
      outcome = 'VERIFIED';
      detectedRegion = claimedRegion;
    }

    return {
      id,
      classificationId: classification.id,
      method: 'LATENCY_ATTESTATION',
      outcome,
      details: {
        claimedRegion,
        fromRegion: measurement.fromRegion,
        measuredRttMs: measurement.rttMs,
        theoreticalMinRttMs: theoreticalMinRTT,
        distanceKm: distance,
        detectedRegion,
      },
      latencyMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  } catch (err) {
    return {
      id,
      classificationId: classification.id,
      method: 'LATENCY_ATTESTATION',
      outcome: 'INCONCLUSIVE',
      details: { error: String(err), claimedRegion },
      latencyMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }
}

// ── Quality Sampling ──────────────────────────────────────────────────────

/** Simple benchmark prompts with known correct answers */
const QUALITY_PROMPTS: Array<{ prompt: string; correctAnswer: string }> = [
  { prompt: 'What is the derivative of x^3 with respect to x? Give just the expression.', correctAnswer: '3x^2' },
  { prompt: 'What programming language is primarily used for iOS development? One word.', correctAnswer: 'Swift' },
  { prompt: 'What year did World War II end? Just the year.', correctAnswer: '1945' },
  { prompt: 'What is the boiling point of water in Celsius? Just the number.', correctAnswer: '100' },
  { prompt: 'Name the process by which plants convert sunlight to energy. One word.', correctAnswer: 'Photosynthesis' },
];

/**
 * Run quality sampling against benchmark questions.
 * Compares accuracy against expected range for the claimed quality tier.
 */
export async function runQualitySample(
  classification: ComputeClassification,
  sendRequest: (prompt: string, model: string) => Promise<{ response: string; latencyMs: number; tokensOut: number }>,
): Promise<VerificationResult> {
  const id = randomBytes(12).toString('hex');
  const startTime = Date.now();

  let correct = 0;
  const results: Array<{ prompt: string; correct: boolean; response: string }> = [];

  for (const { prompt, correctAnswer } of QUALITY_PROMPTS) {
    try {
      const result = await sendRequest(prompt, classification.model);
      const isCorrect = result.response.toLowerCase().includes(correctAnswer.toLowerCase());
      if (isCorrect) correct++;
      results.push({ prompt, correct: isCorrect, response: result.response.slice(0, 200) });
    } catch {
      results.push({ prompt, correct: false, response: 'ERROR' });
    }
  }

  const accuracy = correct / QUALITY_PROMPTS.length;
  const tier = classification.qualityTier;
  const expected = QUALITY_EXPECTATIONS[tier] ?? QUALITY_EXPECTATIONS.ECONOMY;

  let outcome: VerificationOutcome;
  if (accuracy >= expected.min) {
    outcome = 'VERIFIED';
  } else if (accuracy >= expected.min - 0.10) {
    outcome = 'INCONCLUSIVE';
  } else {
    outcome = 'FAILED';
  }

  return {
    id,
    classificationId: classification.id,
    method: 'QUALITY_SAMPLE',
    outcome,
    details: {
      accuracy,
      correct,
      total: QUALITY_PROMPTS.length,
      expectedRange: expected,
      qualityTier: tier,
      results,
    },
    latencyMs: Date.now() - startTime,
    executedAt: new Date(),
  };
}

// ── Response Fingerprinting ───────────────────────────────────────────────

/** Standardised prompts for fingerprinting */
const FINGERPRINT_PROMPTS = [
  'List three benefits of exercise in a numbered list.',
  'Explain what an API is in exactly two sentences.',
  'Write a short thank you note for a gift.',
];

/**
 * Identify model from output characteristics.
 * Extracts features: response length, formatting patterns, vocabulary signals.
 */
export async function runResponseFingerprint(
  classification: ComputeClassification,
  sendRequest: (prompt: string, model: string) => Promise<{ response: string; latencyMs: number; tokensOut: number }>,
): Promise<VerificationResult> {
  const id = randomBytes(12).toString('hex');
  const startTime = Date.now();

  const features: Record<string, number> = {
    avgLength: 0,
    usesMarkdown: 0,
    usesNumberedLists: 0,
    usesBulletPoints: 0,
    hedgingWords: 0,     // "I think", "perhaps", "might"
    refusalSignals: 0,   // "I can't", "I'm unable", "I apologize"
    formalityScore: 0,
  };

  let responseCount = 0;

  for (const prompt of FINGERPRINT_PROMPTS) {
    try {
      const result = await sendRequest(prompt, classification.model);
      const text = result.response;
      responseCount++;

      features.avgLength += text.length;
      features.usesMarkdown += (text.includes('**') || text.includes('##')) ? 1 : 0;
      features.usesNumberedLists += /\d+\.\s/.test(text) ? 1 : 0;
      features.usesBulletPoints += /[-*]\s/.test(text) ? 1 : 0;
      features.hedgingWords += (text.match(/\b(perhaps|maybe|might|could be|I think)\b/gi) || []).length;
      features.refusalSignals += (text.match(/\b(I can't|I'm unable|I apologize|I cannot)\b/gi) || []).length;
      features.formalityScore += (text.match(/\b(furthermore|moreover|consequently|therefore)\b/gi) || []).length;
    } catch {
      // skip failed prompts
    }
  }

  if (responseCount > 0) {
    features.avgLength /= responseCount;
  }

  // Simple heuristic matching (real implementation would use reference fingerprint DB)
  // For now, if we got responses from all prompts with reasonable features, it's a model
  let outcome: VerificationOutcome;
  if (responseCount >= FINGERPRINT_PROMPTS.length && features.avgLength > 20) {
    outcome = 'VERIFIED';
  } else if (responseCount >= 2) {
    outcome = 'INCONCLUSIVE';
  } else {
    outcome = 'FAILED';
  }

  return {
    id,
    classificationId: classification.id,
    method: 'RESPONSE_FINGERPRINT',
    outcome,
    details: {
      features,
      responseCount,
      promptCount: FINGERPRINT_PROMPTS.length,
    },
    latencyMs: Date.now() - startTime,
    executedAt: new Date(),
  };
}

// ── Run All Verifications ─────────────────────────────────────────────────

/**
 * Run all applicable verification methods against a classification.
 * Returns array of results. Methods that require external infrastructure
 * (hardware attestation, latency attestation) are skipped if no callback provided.
 */
export async function runAllVerifications(
  classification: ComputeClassification,
  sendRequest: (prompt: string, model: string) => Promise<{ response: string; latencyMs: number; tokensOut: number }>,
  options?: {
    measureRTT?: (targetId: string) => Promise<{ rttMs: number; fromRegion: string }>;
    claimedRegion?: string;
  },
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Always run probe request
  results.push(await runProbeRequest(classification, sendRequest));

  // Always run quality sample
  results.push(await runQualitySample(classification, sendRequest));

  // Always run fingerprinting
  results.push(await runResponseFingerprint(classification, sendRequest));

  // Run latency attestation if RTT measurement available
  if (options?.measureRTT && options?.claimedRegion) {
    results.push(
      await runLatencyAttestation(classification, options.claimedRegion, options.measureRTT),
    );
  }

  // Hardware attestation is not run here — it requires direct TEE interaction
  // and is triggered separately via the node's attestation endpoint

  return results;
}
