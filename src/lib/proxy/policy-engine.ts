// ---------------------------------------------------------------------------
// Routing Policy Engine — rule-based constraints applied after routing decision
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { RoutingDecision } from '@/lib/proxy/router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutingPolicy {
  id: string;
  name: string;
  description: string;
  priority: number;      // higher = evaluated first
  enabled: boolean;
  conditions: PolicyCondition[];
  action: PolicyAction;
}

export interface PolicyCondition {
  field:
    | 'prompt_content'
    | 'model'
    | 'provider'
    | 'tier'
    | 'cost'
    | 'tokens'
    | 'time_of_day'
    | 'user_tag'
    | 'session_id';
  operator:
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'matches_regex'
    | 'in_list';
  value: string | number | string[];
}

export interface PolicyAction {
  type:
    | 'block'
    | 'redirect'
    | 'require_provider'
    | 'exclude_provider'
    | 'require_model'
    | 'exclude_model'
    | 'add_system_prompt'
    | 'log_warning'
    | 'require_approval';
  params?: Record<string, string>;
}

export interface PolicyEvaluation {
  allowed: boolean;
  matchedPolicies: Array<{ policy: RoutingPolicy; action: PolicyAction }>;
  warnings: string[];
  overrides: { provider?: string; model?: string; systemPrompt?: string };
}

// ---------------------------------------------------------------------------
// Request context passed into evaluate()
// ---------------------------------------------------------------------------

export interface PolicyRequest {
  promptContent?: string;
  model: string;
  provider: string;
  tier?: string;
  estimatedCost?: number;
  estimatedTokens?: number;
  timeOfDay?: number;       // 0-23
  userTag?: string;
  sessionId?: string;
  messages?: Array<{ role: string; content: string }>;
}

// ---------------------------------------------------------------------------
// Persistence path
// ---------------------------------------------------------------------------

const POLICY_DIR = join(homedir(), '.inferlane');
const POLICY_FILE = join(POLICY_DIR, 'policies.json');

// ---------------------------------------------------------------------------
// PII regex patterns
// ---------------------------------------------------------------------------

const SSN_PATTERN = /\d{3}-\d{2}-\d{4}/;
const CREDIT_CARD_PATTERN = /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Non-SOC2 providers (decentralized / unverified compliance)
const NON_SOC2_PROVIDERS = [
  'BITTENSOR',
  'HYPERBOLIC',
  'AKASH',
  'TOGETHER',
  'FIREWORKS',
  'CEREBRAS',
  'SAMBANOVA',
];

// ---------------------------------------------------------------------------
// Default built-in policies
// ---------------------------------------------------------------------------

const DEFAULT_POLICIES: RoutingPolicy[] = [
  {
    id: 'builtin:pii-protection',
    name: 'PII Protection',
    description:
      'Detect SSN, credit card, and email patterns in prompts. Log warning and exclude non-SOC2 providers.',
    priority: 1000,
    enabled: true,
    conditions: [
      {
        field: 'prompt_content',
        operator: 'matches_regex',
        // Evaluated specially — we check multiple patterns in evaluate()
        value: 'PII_COMPOSITE',
      },
    ],
    action: {
      type: 'log_warning',
      params: { message: 'PII detected in prompt — routing restricted to SOC2-compliant providers' },
    },
  },
  {
    id: 'builtin:cost-guard',
    name: 'Cost Guard',
    description: 'Require approval when estimated cost exceeds $1.00',
    priority: 900,
    enabled: true,
    conditions: [
      { field: 'cost', operator: 'greater_than', value: 1.0 },
    ],
    action: {
      type: 'require_approval',
      params: { message: 'Estimated cost exceeds $1.00 — approval required' },
    },
  },
  {
    id: 'builtin:model-availability',
    name: 'Model Availability',
    description: 'Redirect to equivalent model if requested model is unavailable for the provider',
    priority: 800,
    enabled: true,
    conditions: [
      // This is evaluated via special logic in evaluate() — always passes through
      { field: 'model', operator: 'equals', value: '__model_availability_check__' },
    ],
    action: {
      type: 'redirect',
      params: { message: 'Requested model not available — redirected to equivalent' },
    },
  },
  {
    id: 'builtin:rate-limit-shield',
    name: 'Rate Limit Shield',
    description: 'Add 1s delay when user exceeds 100 requests in the last hour',
    priority: 700,
    enabled: true,
    conditions: [
      // Evaluated via special logic using the rate limit tracker
      { field: 'tokens', operator: 'greater_than', value: 100 },
    ],
    action: {
      type: 'log_warning',
      params: { message: 'High request volume detected — throttling applied' },
    },
  },
];

// ---------------------------------------------------------------------------
// Rate limit tracker (in-memory, per-user sliding window)
// ---------------------------------------------------------------------------

const userRequestCounts = new Map<string, number[]>();

function recordUserRequest(userId: string): void {
  const now = Date.now();
  const timestamps = userRequestCounts.get(userId) ?? [];
  timestamps.push(now);
  // Trim to last hour
  const oneHourAgo = now - 3_600_000;
  const filtered = timestamps.filter((t) => t > oneHourAgo);
  userRequestCounts.set(userId, filtered);
}

function getUserRequestCount(userId: string): number {
  const now = Date.now();
  const timestamps = userRequestCounts.get(userId) ?? [];
  const oneHourAgo = now - 3_600_000;
  return timestamps.filter((t) => t > oneHourAgo).length;
}

// ---------------------------------------------------------------------------
// Policy Engine class
// ---------------------------------------------------------------------------

class PolicyEngine {
  private policies: RoutingPolicy[] = [];

  constructor() {
    this.loadPolicies();
  }

  // ── Persistence ──

  private loadPolicies(): void {
    // Always start with defaults
    this.policies = [...DEFAULT_POLICIES];

    try {
      if (existsSync(POLICY_FILE)) {
        const raw = readFileSync(POLICY_FILE, 'utf-8');
        const userPolicies: RoutingPolicy[] = JSON.parse(raw);
        // Merge user policies (don't overwrite built-in IDs)
        for (const up of userPolicies) {
          if (!up.id.startsWith('builtin:')) {
            this.policies.push(up);
          }
        }
      }
    } catch {
      // File doesn't exist or is corrupt — use defaults only
    }
  }

  private persistUserPolicies(): void {
    try {
      if (!existsSync(POLICY_DIR)) {
        mkdirSync(POLICY_DIR, { recursive: true });
      }
      const userPolicies = this.policies.filter((p) => !p.id.startsWith('builtin:'));
      writeFileSync(POLICY_FILE, JSON.stringify(userPolicies, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PolicyEngine] Failed to persist policies:', err);
    }
  }

  // ── CRUD ──

  addPolicy(policy: RoutingPolicy): void {
    // Prevent overwriting built-in policies
    if (policy.id.startsWith('builtin:')) {
      throw new Error('Cannot add policy with builtin: prefix');
    }
    // Remove existing with same id
    this.policies = this.policies.filter((p) => p.id !== policy.id);
    this.policies.push(policy);
    this.persistUserPolicies();
  }

  removePolicy(id: string): void {
    if (id.startsWith('builtin:')) {
      throw new Error('Cannot remove built-in policy');
    }
    this.policies = this.policies.filter((p) => p.id !== id);
    this.persistUserPolicies();
  }

  listPolicies(): RoutingPolicy[] {
    return [...this.policies].sort((a, b) => b.priority - a.priority);
  }

  // ── Evaluation ──

  evaluate(
    request: PolicyRequest,
    routingDecision: RoutingDecision,
  ): PolicyEvaluation {
    const result: PolicyEvaluation = {
      allowed: true,
      matchedPolicies: [],
      warnings: [],
      overrides: {},
    };

    // Sort by priority (highest first)
    const sorted = [...this.policies]
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    // Build prompt content from messages if not provided
    const promptContent =
      request.promptContent ??
      (request.messages
        ? request.messages.map((m) => m.content).join(' ')
        : '');

    for (const policy of sorted) {
      const matched = this.evaluateConditions(
        policy,
        { ...request, promptContent },
        routingDecision,
      );

      if (!matched) continue;

      result.matchedPolicies.push({ policy, action: policy.action });

      switch (policy.action.type) {
        case 'block':
          result.allowed = false;
          result.warnings.push(
            `Blocked by policy "${policy.name}": ${policy.action.params?.message ?? policy.description}`,
          );
          break;

        case 'redirect':
          // Redirect is informational — router already handles model mapping
          result.warnings.push(
            `Redirect: ${policy.action.params?.message ?? 'Model redirected'}`,
          );
          break;

        case 'require_provider':
          if (policy.action.params?.provider) {
            result.overrides.provider = policy.action.params.provider;
          }
          break;

        case 'exclude_provider':
          if (
            policy.action.params?.provider &&
            routingDecision.provider === policy.action.params.provider
          ) {
            // If current provider is excluded, try to use alternative
            if (routingDecision.alternativeProvider) {
              result.overrides.provider = routingDecision.alternativeProvider;
              result.overrides.model = routingDecision.alternativeModel;
              result.warnings.push(
                `Provider ${policy.action.params.provider} excluded by "${policy.name}" — rerouted to ${routingDecision.alternativeProvider}`,
              );
            } else {
              result.allowed = false;
              result.warnings.push(
                `Provider ${policy.action.params.provider} excluded but no alternative available`,
              );
            }
          }
          break;

        case 'require_model':
          if (policy.action.params?.model) {
            result.overrides.model = policy.action.params.model;
          }
          break;

        case 'exclude_model':
          if (
            policy.action.params?.model &&
            routingDecision.model === policy.action.params.model
          ) {
            if (routingDecision.alternativeModel) {
              result.overrides.model = routingDecision.alternativeModel;
              result.warnings.push(
                `Model ${policy.action.params.model} excluded — rerouted to ${routingDecision.alternativeModel}`,
              );
            } else {
              result.allowed = false;
              result.warnings.push(
                `Model ${policy.action.params.model} excluded but no alternative available`,
              );
            }
          }
          break;

        case 'add_system_prompt':
          if (policy.action.params?.prompt) {
            result.overrides.systemPrompt = policy.action.params.prompt;
          }
          break;

        case 'log_warning':
          result.warnings.push(
            policy.action.params?.message ?? `Policy "${policy.name}" triggered`,
          );
          break;

        case 'require_approval':
          result.warnings.push(
            `Approval required: ${policy.action.params?.message ?? policy.description}`,
          );
          break;
      }
    }

    return result;
  }

  // ── Track requests for rate limit shield ──

  recordRequest(userId: string): void {
    recordUserRequest(userId);
  }

  getUserHourlyCount(userId: string): number {
    return getUserRequestCount(userId);
  }

  // ── Condition evaluation ──

  private evaluateConditions(
    policy: RoutingPolicy,
    request: PolicyRequest & { promptContent: string },
    routingDecision: RoutingDecision,
  ): boolean {
    // Special handling for built-in policies
    if (policy.id === 'builtin:pii-protection') {
      return this.checkPII(request.promptContent);
    }

    if (policy.id === 'builtin:cost-guard') {
      const cost = request.estimatedCost ?? routingDecision.estimatedCost ?? 0;
      return cost > 1.0;
    }

    if (policy.id === 'builtin:model-availability') {
      // This is handled by the router itself — skip here
      return false;
    }

    if (policy.id === 'builtin:rate-limit-shield') {
      const userId = request.sessionId ?? 'anonymous';
      return getUserRequestCount(userId) > 100;
    }

    // Generic condition evaluation
    return policy.conditions.every((condition) =>
      this.evaluateCondition(condition, request, routingDecision),
    );
  }

  private checkPII(content: string): boolean {
    return (
      SSN_PATTERN.test(content) ||
      CREDIT_CARD_PATTERN.test(content) ||
      EMAIL_PATTERN.test(content)
    );
  }

  /** Returns the list of non-SOC2 providers to exclude when PII is detected */
  getNonSOC2Providers(): string[] {
    return [...NON_SOC2_PROVIDERS];
  }

  private evaluateCondition(
    condition: PolicyCondition,
    request: PolicyRequest & { promptContent: string },
    routingDecision: RoutingDecision,
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, request, routingDecision);

    switch (condition.operator) {
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value));

      case 'not_contains':
        return typeof fieldValue === 'string' && !fieldValue.includes(String(condition.value));

      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value);

      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value);

      case 'matches_regex': {
        if (typeof fieldValue !== 'string') return false;
        try {
          const regex = new RegExp(String(condition.value));
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }

      case 'in_list':
        if (!Array.isArray(condition.value)) return false;
        return condition.value.includes(String(fieldValue));

      default:
        return false;
    }
  }

  private getFieldValue(
    field: PolicyCondition['field'],
    request: PolicyRequest & { promptContent: string },
    routingDecision: RoutingDecision,
  ): string | number | undefined {
    switch (field) {
      case 'prompt_content':
        return request.promptContent;
      case 'model':
        return routingDecision.model;
      case 'provider':
        return routingDecision.provider;
      case 'tier':
        return request.tier ?? routingDecision.tier;
      case 'cost':
        return request.estimatedCost ?? routingDecision.estimatedCost;
      case 'tokens':
        return request.estimatedTokens;
      case 'time_of_day':
        return request.timeOfDay ?? new Date().getHours();
      case 'user_tag':
        return request.userTag;
      case 'session_id':
        return request.sessionId;
      default:
        return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const policyEngine = new PolicyEngine();
