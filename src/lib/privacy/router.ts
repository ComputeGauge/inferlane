// ---------------------------------------------------------------------------
// Privacy-Aware Dispatch Router
// ---------------------------------------------------------------------------
// Determines how to route inference requests based on the user's privacy
// policy, available nodes, and the prompt's splittability. This is the
// orchestration layer that ties together:
//
//   Privacy Tiers (types.ts) → determines what protection level is needed
//   Shamir Splitting (shamir.ts) → encrypts and splits keys for Tier 1+
//   Prompt Fragmentation (fragmenter.ts) → splits prompts for multi-node dispatch
//   Node Selection → picks nodes matching privacy requirements
//
// The router makes the privacy decision BEFORE the request reaches the
// dispatch engine (Stream T). It answers: "Given this user's policy and
// this prompt, what's the safest way to route this request?"
// ---------------------------------------------------------------------------

import type {
  PrivacyTier,
  PrivacyPolicyConfig,
  NodePrivacyCapability,
  PromptFragment,
  FragmentParameters,
  EncryptedPayload,
  CanaryToken,
} from './types';
import { PRIVACY_TIER_RANK, DEFAULT_PRIVACY_POLICY } from './types';
import { encryptAndSplit } from './shamir';
import {
  analyseSplittability,
  fragmentPrompt,
  type SplitAnalysis,
} from './fragmenter';
import { randomBytes, createHash } from 'crypto';

// --- Route Decision ---

export type RouteDecision =
  | { type: 'direct'; tier: 'TRANSPORT_ONLY'; fragments: PromptFragment[] }
  | { type: 'fragmented'; tier: 'BLIND_ROUTING'; fragments: PromptFragment[]; encrypted?: EncryptedPayload; nodeAssignments: NodeAssignment[] }
  | { type: 'tee'; tier: 'TEE_PREFERRED' | 'CONFIDENTIAL'; fragments: PromptFragment[]; requiredNodes: NodePrivacyCapability[] }
  | { type: 'rejected'; reason: string };

export interface NodeAssignment {
  fragmentId: string;
  nodeId: string;
  operatorId: string;
  keyShareIndex?: number;       // which Shamir share this node gets
}

export interface RoutingContext {
  userId: string;
  prompt: string;
  systemPrompt?: string;
  model: string;
  parameters: FragmentParameters;
  policy: PrivacyPolicyConfig;
  availableNodes: NodePrivacyCapability[];
  canaryEnabled?: boolean;
}

// --- Main Router ---

/**
 * Determine how to route a request based on privacy requirements.
 *
 * Decision tree:
 * 1. Check if the policy tier is achievable with available nodes
 * 2. If BLIND_ROUTING: analyse splittability, fragment if possible
 * 3. If TEE_REQUIRED/CONFIDENTIAL: filter to TEE-capable nodes only
 * 4. If no nodes meet requirements: reject or downgrade (with user consent)
 * 5. Apply geo-fencing, diversity requirements, canary injection
 */
export function routeRequest(context: RoutingContext): RouteDecision {
  const { policy, availableNodes, prompt, systemPrompt, model, parameters } = context;

  // --- Step 1: Filter nodes by basic requirements ---
  let eligibleNodes = filterNodesByPolicy(availableNodes, policy);

  if (eligibleNodes.length === 0) {
    return {
      type: 'rejected',
      reason: `No nodes available matching privacy policy "${policy.name}". ` +
        `Required: tier=${policy.tier}` +
        (policy.allowedRegions ? `, regions=${policy.allowedRegions.join(',')}` : '') +
        (policy.requireTEE ? ', TEE required' : ''),
    };
  }

  // --- Step 2: Filter by model support ---
  eligibleNodes = eligibleNodes.filter((n) =>
    n.models.includes(model) || n.models.includes('*'),
  );

  if (eligibleNodes.length === 0) {
    return {
      type: 'rejected',
      reason: `No eligible nodes support model "${model}"`,
    };
  }

  // --- Step 3: Route based on tier ---
  switch (policy.tier) {
    case 'TRANSPORT_ONLY':
      return routeTier0(context, eligibleNodes);

    case 'BLIND_ROUTING':
      return routeTier1(context, eligibleNodes);

    case 'TEE_PREFERRED':
      return routeTier1_5(context, eligibleNodes);

    case 'CONFIDENTIAL':
      return routeTier2(context, eligibleNodes);

    default:
      return routeTier0(context, eligibleNodes);
  }
}

// --- Tier-Specific Routing ---

/**
 * Tier 0: Transport-only encryption.
 * Route to single best node. No fragmentation. Node sees full plaintext.
 */
function routeTier0(
  context: RoutingContext,
  nodes: NodePrivacyCapability[],
): RouteDecision {
  const fragments = fragmentPrompt(context.prompt, context.model, context.parameters, {
    systemPrompt: context.systemPrompt,
    strategy: 'unsplittable', // no splitting at Tier 0
  });

  // Inject canary if enabled
  if (context.canaryEnabled !== false && context.policy.canaryInjection) {
    injectCanary(fragments[0], context.userId);
  }

  return {
    type: 'direct',
    tier: 'TRANSPORT_ONLY',
    fragments,
  };
}

/**
 * Tier 1: Blind routing with prompt fragmentation.
 * Analyse splittability → fragment → encrypt → assign to diverse nodes.
 * No single node sees the complete prompt.
 */
function routeTier1(
  context: RoutingContext,
  nodes: NodePrivacyCapability[],
): RouteDecision {
  const { prompt, systemPrompt, model, parameters, policy } = context;

  // Analyse splittability
  const analysis = analyseSplittability(prompt, systemPrompt);

  if (analysis.strategy === 'unsplittable') {
    // Can't fragment — need TEE-capable nodes or downgrade with warning
    const teeNodes = nodes.filter((n) => n.teeAttested);
    if (teeNodes.length > 0) {
      // Upgrade to TEE routing for unsplittable prompts
      return routeTier2(context, teeNodes);
    }

    // No TEE nodes available — route via Tier 0 with warning
    // In production: this would require user consent to downgrade
    const fragments = fragmentPrompt(prompt, model, parameters, {
      systemPrompt,
      strategy: 'unsplittable',
    });

    return {
      type: 'direct',
      tier: 'TRANSPORT_ONLY',
      fragments,
    };
  }

  // Fragment the prompt
  const targetFragments = Math.max(
    policy.minFragments,
    Math.min(policy.maxFragments, analysis.suggestedFragments),
  );

  const fragments = fragmentPrompt(prompt, model, parameters, {
    systemPrompt,
    strategy: analysis.strategy,
    targetFragments,
    minFragments: policy.minFragments,
    maxFragments: policy.maxFragments,
  });

  // Need at least as many diverse nodes as fragments (minus synthesis)
  const workFragments = fragments.filter((f) => f.index > 0);
  const diverseNodes = selectDiverseNodes(nodes, workFragments.length);

  if (diverseNodes.length < workFragments.length) {
    return {
      type: 'rejected',
      reason: `Need ${workFragments.length} diverse nodes for fragmentation but only ${diverseNodes.length} available. ` +
        'Reduce fragment count or wait for more nodes.',
    };
  }

  // Encrypt the full prompt and split the key
  const encrypted = encryptAndSplit(prompt, {
    threshold: workFragments.length, // all nodes must cooperate to reconstruct
    totalShares: workFragments.length,
  });

  // Assign fragments to diverse nodes
  const nodeAssignments: NodeAssignment[] = workFragments.map((fragment, i) => ({
    fragmentId: fragment.fragmentId,
    nodeId: diverseNodes[i].nodeId,
    operatorId: diverseNodes[i].operatorId,
    keyShareIndex: i,
  }));

  // Inject canaries into each fragment
  if (context.policy.canaryInjection) {
    for (const fragment of workFragments) {
      injectCanary(fragment, context.userId);
    }
  }

  return {
    type: 'fragmented',
    tier: 'BLIND_ROUTING',
    fragments,
    encrypted,
    nodeAssignments,
  };
}

/**
 * Tier 1.5: TEE-preferred routing.
 * Route to TEE-capable nodes when available, fall back to Tier 1 fragmentation.
 */
function routeTier1_5(
  context: RoutingContext,
  nodes: NodePrivacyCapability[],
): RouteDecision {
  const teeNodes = nodes.filter((n) => n.teeAttested);

  if (teeNodes.length > 0) {
    // TEE nodes available — route directly (node can't see plaintext)
    return routeTier2(context, teeNodes);
  }

  // No TEE nodes — fall back to Tier 1 fragmentation
  return routeTier1(context, nodes);
}

/**
 * Tier 2: Confidential compute.
 * Require TEE-attested nodes. Verify attestation before dispatch.
 */
function routeTier2(
  context: RoutingContext,
  nodes: NodePrivacyCapability[],
): RouteDecision {
  const teeNodes = nodes.filter((n) => n.teeAttested);

  if (teeNodes.length === 0) {
    return {
      type: 'rejected',
      reason: 'No TEE-attested nodes available. Confidential tier requires hardware enclaves (Intel SGX, AMD SEV, NVIDIA CC).',
    };
  }

  // For TEE routing, we don't need to fragment — the hardware protects the prompt
  const fragments = fragmentPrompt(context.prompt, context.model, context.parameters, {
    systemPrompt: context.systemPrompt,
    strategy: 'unsplittable',
  });

  return {
    type: 'tee',
    tier: context.policy.tier === 'CONFIDENTIAL' ? 'CONFIDENTIAL' : 'TEE_PREFERRED',
    fragments,
    requiredNodes: teeNodes,
  };
}

// --- Node Selection ---

/**
 * Filter nodes by privacy policy requirements.
 */
function filterNodesByPolicy(
  nodes: NodePrivacyCapability[],
  policy: PrivacyPolicyConfig,
): NodePrivacyCapability[] {
  return nodes.filter((node) => {
    // Check privacy tier capability
    if (PRIVACY_TIER_RANK[node.supportedTier] < PRIVACY_TIER_RANK[policy.tier]) {
      return false;
    }

    // Check geo-fencing
    if (policy.allowedRegions && policy.allowedRegions.length > 0) {
      const nodeInAllowedRegion = node.regions.some((r) =>
        policy.allowedRegions!.includes(r),
      );
      if (!nodeInAllowedRegion) return false;
    }

    // Check TEE requirement
    if (policy.requireTEE && !node.teeAttested) {
      return false;
    }

    return true;
  });
}

/**
 * Select diverse nodes for fragment distribution.
 *
 * Diversity requirements (anti-collusion):
 * - No two fragments to the same operator
 * - No two fragments to nodes in the same /24 IP range
 * - Prefer geographic diversity when possible
 *
 * Returns nodes sorted by diversity score (most diverse set first).
 */
function selectDiverseNodes(
  nodes: NodePrivacyCapability[],
  count: number,
): NodePrivacyCapability[] {
  if (nodes.length <= count) return nodes;

  const selected: NodePrivacyCapability[] = [];
  const usedOperators = new Set<string>();
  const usedIpRanges = new Set<string>();
  const usedRegions = new Set<string>();

  // Sort by least-used region first (geographic diversity)
  const regionCounts = new Map<string, number>();
  for (const node of nodes) {
    for (const region of node.regions) {
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    }
  }

  const sortedNodes = [...nodes].sort((a, b) => {
    const aMinRegionCount = Math.min(
      ...a.regions.map((r) => regionCounts.get(r) || 0),
    );
    const bMinRegionCount = Math.min(
      ...b.regions.map((r) => regionCounts.get(r) || 0),
    );
    return aMinRegionCount - bMinRegionCount;
  });

  for (const node of sortedNodes) {
    if (selected.length >= count) break;

    // Skip if same operator already selected
    if (usedOperators.has(node.operatorId)) continue;

    // Skip if same IP range already selected
    const ipRange = node.ipRange?.split('.').slice(0, 3).join('.') || '';
    if (ipRange && usedIpRanges.has(ipRange)) continue;

    selected.push(node);
    usedOperators.add(node.operatorId);
    if (ipRange) usedIpRanges.add(ipRange);
    for (const region of node.regions) {
      usedRegions.add(region);
    }
  }

  // If diversity constraints were too strict, relax and fill remaining
  if (selected.length < count) {
    for (const node of sortedNodes) {
      if (selected.length >= count) break;
      if (selected.includes(node)) continue;
      if (usedOperators.has(node.operatorId)) continue; // at minimum, different operators
      selected.push(node);
      usedOperators.add(node.operatorId);
    }
  }

  return selected;
}

// --- Canary Injection ---

/**
 * Inject a canary token into a fragment for exfiltration detection.
 *
 * The canary is a unique, seemingly-natural phrase that InferLane
 * monitors for in external contexts (web scraping, API calls, etc.).
 * If a canary appears outside the expected response path, the node
 * that received it is flagged for prompt exfiltration.
 *
 * Canary design principles:
 * - Must look natural (not obviously a tracking token)
 * - Must be unique per fragment per request
 * - Must not significantly alter the prompt's semantics
 * - Must be detectable via exact string match
 */
export function injectCanary(
  fragment: PromptFragment,
  userId: string,
): CanaryToken {
  const canaryId = randomBytes(8).toString('hex');

  // Generate a natural-looking canary phrase
  // Uses a hash-based approach to create deterministic but unique phrases
  const seed = createHash('sha256')
    .update(`${canaryId}:${userId}:${Date.now()}`)
    .digest('hex')
    .slice(0, 8);

  // Canary phrases that look like natural additions to any prompt
  const templates = [
    `Please reference ID:${seed} in your response metadata.`,
    `Note: session marker ${seed} for internal tracking.`,
    `[Context ref: ${seed}]`,
  ];

  const template = templates[parseInt(seed.slice(0, 2), 16) % templates.length];

  // Append canary to fragment content (after main content, before closing)
  fragment.content = fragment.content + `\n\n${template}`;

  return {
    id: canaryId,
    token: seed,
    nodeId: '', // set during dispatch
    injectedAt: new Date(),
    status: 'active',
  };
}

/**
 * Check if a canary token has been detected in external content.
 * Called by monitoring systems that scan for leaked canaries.
 */
export function checkCanaryLeak(
  content: string,
  activeCanaries: CanaryToken[],
): CanaryToken[] {
  const triggered: CanaryToken[] = [];

  for (const canary of activeCanaries) {
    if (canary.status !== 'active') continue;
    if (content.includes(canary.token)) {
      canary.status = 'triggered';
      canary.detectedAt = new Date();
      triggered.push(canary);
    }
  }

  return triggered;
}

// --- PII Stripping ---

/**
 * Strip common PII patterns from prompt text before dispatch.
 * Applied when policy.piiStripping is true.
 *
 * This is a best-effort heuristic — not a guarantee. Users with
 * strict PII requirements should use Tier 2 (TEE) routing.
 */
export function stripPII(text: string): { stripped: string; redactions: PIIRedaction[] } {
  const redactions: PIIRedaction[] = [];
  let stripped = text;

  const patterns: Array<{ name: string; regex: RegExp; replacement: string }> = [
    // Email addresses
    {
      name: 'email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[EMAIL_REDACTED]',
    },
    // Phone numbers (US format)
    {
      name: 'phone_us',
      regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      replacement: '[PHONE_REDACTED]',
    },
    // SSN
    {
      name: 'ssn',
      regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      replacement: '[SSN_REDACTED]',
    },
    // Credit card numbers (basic Luhn-plausible patterns)
    {
      name: 'credit_card',
      regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      replacement: '[CARD_REDACTED]',
    },
    // IP addresses (v4)
    {
      name: 'ipv4',
      regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      replacement: '[IP_REDACTED]',
    },
    // Dates of birth (common formats)
    {
      name: 'dob',
      regex: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
      replacement: '[DOB_REDACTED]',
    },
  ];

  for (const pattern of patterns) {
    const matches = stripped.match(pattern.regex);
    if (matches) {
      for (const match of matches) {
        redactions.push({
          type: pattern.name,
          original: match,
          position: stripped.indexOf(match),
        });
      }
      stripped = stripped.replace(pattern.regex, pattern.replacement);
    }
  }

  return { stripped, redactions };
}

export interface PIIRedaction {
  type: string;
  original: string;
  position: number;
}

/**
 * Restore PII into a response after synthesis.
 * Used to re-inject redacted values into the final response when
 * the response references the redacted fields.
 */
export function restorePII(
  response: string,
  redactions: PIIRedaction[],
): string {
  let restored = response;

  // Map redaction types to their placeholder patterns
  const placeholderMap: Record<string, string> = {
    email: '[EMAIL_REDACTED]',
    phone_us: '[PHONE_REDACTED]',
    ssn: '[SSN_REDACTED]',
    credit_card: '[CARD_REDACTED]',
    ipv4: '[IP_REDACTED]',
    dob: '[DOB_REDACTED]',
  };

  // Group redactions by type to handle multiple of the same type
  const byType = new Map<string, PIIRedaction[]>();
  for (const r of redactions) {
    const existing = byType.get(r.type) || [];
    existing.push(r);
    byType.set(r.type, existing);
  }

  // Replace placeholders with originals (in order of appearance)
  for (const [type, items] of byType) {
    const placeholder = placeholderMap[type];
    if (!placeholder) continue;

    for (const item of items) {
      // Replace one occurrence at a time
      restored = restored.replace(placeholder, item.original);
    }
  }

  return restored;
}
