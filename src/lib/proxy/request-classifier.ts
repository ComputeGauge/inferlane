// Adapted from ClawRouter (MIT License) — https://github.com/BlockRunAI/ClawRouter
// Original: src/router/rules.ts

import { bypassTier } from './bypass-tier';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier = 'BYPASS' | 'TRIVIAL' | 'STANDARD' | 'COMPLEX' | 'REASONING';

export interface ClassificationResult {
  tier: Tier;
  confidence: number;        // 0-1, sigmoid calibrated
  agenticScore: number;      // 0-1, how "agentic" the request is
  scores: Record<string, number>;  // per-dimension scores for explainability
  reasoning: string;         // human-readable explanation
}

// ---------------------------------------------------------------------------
// Dimension weights (14 dimensions from ClawRouter)
// ---------------------------------------------------------------------------

const DIMENSION_WEIGHTS: Record<string, number> = {
  tokenCount:          0.08,
  codePresence:        0.09,
  reasoningMarkers:    0.12,
  technicalTerms:      0.10,
  creativeMarkers:     0.05,
  simpleIndicators:    0.05,
  multiStepPatterns:   0.08,
  questionComplexity:  0.03,
  imperativeVerbs:     0.03,
  constraintIndicators:0.04,
  outputFormat:        0.05,
  referenceComplexity: 0.02,
  domainSpecificity:   0.02,
  agenticTask:         0.04,
};

// ---------------------------------------------------------------------------
// Tier boundaries
// ---------------------------------------------------------------------------

const TIER_BOUNDARIES = {
  TRIVIAL_UPPER:  -0.1,
  STANDARD_UPPER:  0.15,
  COMPLEX_UPPER:   0.35,
};

// ---------------------------------------------------------------------------
// Pattern lists
// ---------------------------------------------------------------------------

const REASONING_MARKERS = [
  'step by step', 'think through', 'reason about', 'analyze', 'let\'s think',
  'chain of thought', 'explain your reasoning', 'show your work',
  'break down', 'consider', 'evaluate', 'compare and contrast',
  'pros and cons', 'trade-offs', 'implications',
  // ZH
  '证明', '推理', '逻辑', '分析', '推导', '因此', '所以',
  // JA
  '証明', '推論', '論理', '分析', 'したがって',
  // ES
  'demostrar', 'razonar', 'lógica', 'analizar', 'por lo tanto',
  // DE
  'beweisen', 'logik', 'analysieren', 'daher', 'schlussfolgerung',
  // KO
  '증명', '추론', '논리', '분석', '따라서',
];

const TECHNICAL_TERMS = [
  'algorithm', 'function', 'variable', 'class', 'interface', 'api',
  'database', 'query', 'schema', 'middleware', 'endpoint', 'deployment',
  'infrastructure', 'architecture', 'microservice', 'container',
  'kubernetes', 'docker', 'pipeline', 'ci/cd', 'terraform',
  'protocol', 'encryption', 'authentication', 'authorization',
  'latency', 'throughput', 'scalability', 'distributed',
];

const CREATIVE_MARKERS = [
  'write a story', 'poem', 'creative', 'imagine', 'fiction',
  'narrative', 'dialogue', 'character', 'plot', 'screenplay',
  'brainstorm', 'ideate', 'innovative',
];

const SIMPLE_INDICATORS = [
  'what is', 'who is', 'define', 'list', 'name', 'yes or no',
  'true or false', 'how many', 'when was', 'where is',
  'translate', 'convert', 'calculate',
  // ZH
  '什么是', '定义', '解释',
  // JA
  'とは何', '定義', '説明して',
  // ES
  'qué es', 'definir', 'explicar',
  // DE
  'was ist', 'definiere', 'erkläre',
  // KO
  '무엇인가', '정의', '설명해',
];

const MULTI_STEP_PATTERNS = [
  'first', 'then', 'next', 'finally', 'step 1', 'step 2',
  'after that', 'followed by', 'subsequently',
  'plan', 'outline', 'workflow', 'process', 'pipeline',
  'multiple', 'several', 'series of',
];

const CONSTRAINT_INDICATORS = [
  'must', 'should', 'ensure', 'require', 'constraint', 'limit',
  'maximum', 'minimum', 'exactly', 'no more than', 'at least',
  'only', 'strictly', 'mandatory', 'forbidden',
];

const OUTPUT_FORMAT_MARKERS = [
  'json', 'yaml', 'xml', 'csv', 'markdown', 'table',
  'schema', 'format as', 'structured', 'template',
  'code block', 'bullet points', 'numbered list',
];

const AGENTIC_KEYWORDS = [
  'deploy', 'fix', 'debug', 'implement', 'refactor', 'migrate',
  'test', 'build', 'install', 'configure', 'setup', 'provision',
  'automate', 'monitor', 'optimize', 'upgrade', 'patch',
  'scaffold', 'integrate', 'ship',
  // ZH
  '部署', '修复', '调试', '实现', '重构', '迁移', '测试', '构建',
  // JA
  'デプロイ', '修正', 'デバッグ', '実装', 'リファクタ', 'テスト', 'ビルド',
  // ES
  'desplegar', 'arreglar', 'depurar', 'implementar', 'refactorizar', 'probar', 'construir',
  // DE
  'bereitstellen', 'beheben', 'debuggen', 'implementieren', 'refaktorieren', 'testen', 'bauen',
  // KO
  '배포', '수정', '디버그', '구현', '리팩토링', '테스트', '빌드',
];

const IMPERATIVE_VERBS = [
  'create', 'make', 'generate', 'produce', 'design', 'develop',
  'construct', 'compose', 'draft', 'prepare', 'formulate',
  'modify', 'update', 'change', 'transform', 'rewrite',
];

const CODE_MARKERS = [
  '```', 'function ', 'class ', 'const ', 'let ', 'var ',
  'import ', 'export ', 'return ', 'if (', 'for (', 'while (',
  '=>', '===', '!==', '&&', '||',
  'def ', 'self.', 'print(', 'lambda ',
  // Universal multilingual code terms
  'función', 'funktion', '関数', '함수', '函数',
  'classe', 'klasse', 'クラス', '클래스', '类',
];

const REFERENCE_COMPLEXITY_MARKERS = [
  'according to', 'based on', 'as described in', 'referring to',
  'in the context of', 'given that', 'assuming', 'considering',
  'with respect to', 'documentation',
];

const DOMAIN_SPECIFICITY_MARKERS = [
  'medical', 'legal', 'financial', 'scientific', 'academic',
  'regulatory', 'compliance', 'clinical', 'pharmaceutical',
  'litigation', 'patent', 'genomic', 'quantum',
];

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function countMatches(text: string, patterns: string[]): number {
  const lower = text.toLowerCase();
  return patterns.filter((p) => lower.includes(p.toLowerCase())).length;
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function sigmoid(x: number, steepness: number = 2.0): number {
  return 1 / (1 + Math.exp(-steepness * x));
}

function scoreDimension(name: string, text: string, estimatedTokens: number): number {
  const lower = text.toLowerCase();

  switch (name) {
    case 'tokenCount': {
      // Normalize: 0-100 tokens → -1, 100-500 → 0, 500-2000 → 0.5, 2000+ → 1
      if (estimatedTokens < 100) return -1;
      if (estimatedTokens < 500) return 0;
      if (estimatedTokens < 2000) return 0.5;
      return 1;
    }

    case 'codePresence': {
      const matches = countMatches(text, CODE_MARKERS);
      if (matches === 0) return -0.5;
      if (matches <= 2) return 0.3;
      if (matches <= 5) return 0.7;
      return 1;
    }

    case 'reasoningMarkers': {
      const matches = countMatches(text, REASONING_MARKERS);
      if (matches === 0) return -0.5;
      if (matches === 1) return 0.5;
      return 1;
    }

    case 'technicalTerms': {
      const matches = countMatches(text, TECHNICAL_TERMS);
      if (matches === 0) return -0.5;
      if (matches <= 2) return 0.2;
      if (matches <= 5) return 0.6;
      return 1;
    }

    case 'creativeMarkers': {
      const matches = countMatches(text, CREATIVE_MARKERS);
      if (matches === 0) return -0.3;
      if (matches <= 2) return 0.3;
      return 0.7;
    }

    case 'simpleIndicators': {
      const matches = countMatches(text, SIMPLE_INDICATORS);
      if (matches === 0) return 0;
      if (matches === 1) return -0.5;
      return -1; // More simple indicators → lower complexity
    }

    case 'multiStepPatterns': {
      const matches = countMatches(text, MULTI_STEP_PATTERNS);
      if (matches === 0) return -0.3;
      if (matches <= 2) return 0.3;
      return 0.8;
    }

    case 'questionComplexity': {
      const questionMarks = (text.match(/\?/g) || []).length;
      if (questionMarks === 0) return 0;
      if (questionMarks === 1) return -0.2;
      return 0.4; // Multiple questions → more complex
    }

    case 'imperativeVerbs': {
      const matches = countMatches(text, IMPERATIVE_VERBS);
      if (matches === 0) return -0.2;
      if (matches <= 2) return 0.2;
      return 0.6;
    }

    case 'constraintIndicators': {
      const matches = countMatches(text, CONSTRAINT_INDICATORS);
      if (matches === 0) return -0.3;
      if (matches <= 2) return 0.3;
      return 0.8;
    }

    case 'outputFormat': {
      const matches = countMatches(text, OUTPUT_FORMAT_MARKERS);
      if (matches === 0) return -0.2;
      if (matches <= 2) return 0.4;
      return 0.8;
    }

    case 'referenceComplexity': {
      const matches = countMatches(text, REFERENCE_COMPLEXITY_MARKERS);
      if (matches === 0) return -0.2;
      return 0.5;
    }

    case 'domainSpecificity': {
      const matches = countMatches(text, DOMAIN_SPECIFICITY_MARKERS);
      if (matches === 0) return -0.2;
      return 0.6;
    }

    case 'agenticTask': {
      const matches = countMatches(text, AGENTIC_KEYWORDS);
      if (matches === 0) return -0.3;
      if (matches <= 2) return 0.3;
      return 0.8;
    }

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Tier determination
// ---------------------------------------------------------------------------

function scoresToTier(weightedScore: number): Tier {
  if (weightedScore < TIER_BOUNDARIES.TRIVIAL_UPPER) return 'TRIVIAL';
  if (weightedScore < TIER_BOUNDARIES.STANDARD_UPPER) return 'STANDARD';
  if (weightedScore < TIER_BOUNDARIES.COMPLEX_UPPER) return 'COMPLEX';
  return 'REASONING';
}

function nearestBoundaryDistance(score: number): number {
  const boundaries = [
    TIER_BOUNDARIES.TRIVIAL_UPPER,
    TIER_BOUNDARIES.STANDARD_UPPER,
    TIER_BOUNDARIES.COMPLEX_UPPER,
  ];

  let minDist = Infinity;
  for (const b of boundaries) {
    const dist = Math.abs(score - b);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function computeConfidence(score: number): number {
  const dist = nearestBoundaryDistance(score);
  // Map distance through sigmoid to [0.5, 1.0]
  const raw = sigmoid(dist, 2.0);
  return 0.5 + (raw - 0.5);
}

// ---------------------------------------------------------------------------
// Agentic score (separate from tier)
// ---------------------------------------------------------------------------

function computeAgenticScore(text: string): number {
  const matches = countMatches(text, AGENTIC_KEYWORDS);
  if (matches >= 4) return 1.0;
  if (matches === 3) return 0.6;
  if (matches >= 1) return 0.2;
  return 0.0;
}

// ---------------------------------------------------------------------------
// RequestClassifier
// ---------------------------------------------------------------------------

export class RequestClassifier {
  classify(prompt: string, estimatedTokens?: number, messages?: Array<{ role: string; content: string }>): ClassificationResult {
    // Tier 0: check if this can be answered without any LLM
    const bypassCheck = bypassTier.canBypass(
      messages ?? [{ role: 'user', content: prompt }],
    );
    if (bypassCheck.bypass) {
      return {
        tier: 'BYPASS',
        confidence: 1.0,
        agenticScore: 0,
        scores: {},
        reasoning: `Bypass: ${bypassCheck.reason ?? 'deterministic response'}`,
      };
    }

    const tokens = estimatedTokens ?? estimateTokens(prompt);

    // Score each dimension
    const scores: Record<string, number> = {};
    let weightedScore = 0;

    for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      const raw = scoreDimension(dim, prompt, tokens);
      scores[dim] = raw;
      weightedScore += raw * weight;
    }

    // Base tier from weighted score
    let tier = scoresToTier(weightedScore);
    let confidence = computeConfidence(weightedScore);
    const agenticScore = computeAgenticScore(prompt);

    // Reasoning parts for explanation
    const reasoningParts: string[] = [];

    // ------------------------------------
    // Override rules
    // ------------------------------------

    // Rule 1: 2+ reasoning markers → force REASONING
    const reasoningCount = countMatches(prompt, REASONING_MARKERS);
    if (reasoningCount >= 2) {
      tier = 'REASONING';
      confidence = Math.max(confidence, 0.85);
      reasoningParts.push(`${reasoningCount} reasoning markers detected — forced REASONING`);
    }

    // Rule 2: Large input (>8000 estimated tokens) → minimum COMPLEX
    if (tokens > 8000) {
      if (tier === 'TRIVIAL' || tier === 'STANDARD') {
        tier = 'COMPLEX';
        reasoningParts.push(`Large input (~${tokens} tokens) — upgraded to COMPLEX minimum`);
      }
    }

    // Rule 3: JSON/schema output requested → upgrade one tier
    const jsonRequested = countMatches(prompt, ['json', 'schema']) > 0;
    if (jsonRequested) {
      if (tier === 'TRIVIAL') {
        tier = 'STANDARD';
        reasoningParts.push('JSON/schema output requested — upgraded from TRIVIAL');
      } else if (tier === 'STANDARD') {
        tier = 'COMPLEX';
        reasoningParts.push('JSON/schema output requested — upgraded from STANDARD');
      } else if (tier === 'COMPLEX') {
        tier = 'REASONING';
        reasoningParts.push('JSON/schema output requested — upgraded from COMPLEX');
      }
    }

    // Build reasoning string
    if (reasoningParts.length === 0) {
      // Find top contributing dimensions
      const sorted = Object.entries(scores)
        .map(([dim, score]) => ({ dim, contribution: score * (DIMENSION_WEIGHTS[dim] ?? 0) }))
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 3);

      const topDims = sorted
        .map((s) => `${s.dim}=${s.contribution.toFixed(3)}`)
        .join(', ');

      reasoningParts.push(`Weighted score ${weightedScore.toFixed(3)} → ${tier} (top: ${topDims})`);
    }

    return {
      tier,
      confidence,
      agenticScore,
      scores,
      reasoning: reasoningParts.join('; '),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const requestClassifier = new RequestClassifier();
