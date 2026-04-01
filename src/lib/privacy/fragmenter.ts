// ---------------------------------------------------------------------------
// Prompt Fragmentation Engine
// ---------------------------------------------------------------------------
// Splits prompts into semantically independent fragments for Tier 1
// (Blind Routing). Each fragment is dispatched to a different node so
// no single node sees the complete context.
//
// Three fragmentation strategies:
// 1. Task decomposition: Multi-step prompts split into independent sub-tasks
// 2. Parallel extraction: Multiple questions/topics handled independently
// 3. Context isolation: System prompt + user prompt sent to different nodes,
//    with a synthesis step on InferLane's trusted infrastructure
//
// For prompts that can't be meaningfully split (single-document analysis,
// conversational context), the fragmenter returns the prompt un-split and
// flags it for Tier 0 routing or TEE-only routing.
// ---------------------------------------------------------------------------

import { randomBytes } from 'crypto';
import type {
  PromptFragment,
  FragmentParameters,
  FragmentResult,
  ReassembledResponse,
  PrivacyTier,
} from './types';

// --- Splittability Classification ---

export type SplitStrategy =
  | 'task_decomposition'    // multi-step pipeline
  | 'parallel_extraction'  // multiple independent questions
  | 'context_isolation'    // system/user prompt separation
  | 'unsplittable';        // cannot fragment without quality loss

export interface SplitAnalysis {
  strategy: SplitStrategy;
  confidence: number;          // 0.0–1.0
  suggestedFragments: number;
  reason: string;
}

/**
 * Analyse a prompt to determine if and how it can be fragmented.
 *
 * This is a heuristic classifier — not ML-based (that's a future upgrade).
 * Uses structural patterns in the prompt text to identify splittable patterns.
 */
export function analyseSplittability(
  prompt: string,
  systemPrompt?: string,
): SplitAnalysis {
  const lines = prompt.split('\n').filter((l) => l.trim().length > 0);
  const wordCount = prompt.split(/\s+/).length;

  // Pattern 1: Numbered/bulleted list of tasks or questions
  const listPatterns = [
    /^\s*\d+[\.\)]\s/,           // "1. " or "1) "
    /^\s*[-*•]\s/,               // "- " or "* " or "• "
    /^\s*[a-z][\.\)]\s/,         // "a. " or "a) "
  ];

  const listItems = lines.filter((line) =>
    listPatterns.some((p) => p.test(line)),
  );

  if (listItems.length >= 3) {
    return {
      strategy: 'parallel_extraction',
      confidence: 0.85,
      suggestedFragments: Math.min(listItems.length, 7),
      reason: `Found ${listItems.length} independent list items`,
    };
  }

  // Pattern 2: Step-by-step instructions ("first", "then", "next", "finally")
  const stepKeywords = ['first', 'then', 'next', 'after that', 'finally', 'step 1', 'step 2', 'step 3'];
  const stepCount = stepKeywords.filter((kw) =>
    prompt.toLowerCase().includes(kw),
  ).length;

  if (stepCount >= 2) {
    return {
      strategy: 'task_decomposition',
      confidence: 0.70,
      suggestedFragments: Math.min(stepCount + 1, 5),
      reason: `Found ${stepCount} step indicators`,
    };
  }

  // Pattern 3: Multiple distinct questions (sentences ending with ?)
  const questions = prompt.match(/[^.!?]*\?/g) || [];
  if (questions.length >= 2) {
    return {
      strategy: 'parallel_extraction',
      confidence: 0.80,
      suggestedFragments: Math.min(questions.length, 5),
      reason: `Found ${questions.length} distinct questions`,
    };
  }

  // Pattern 4: System prompt + user prompt can always be separated
  if (systemPrompt && systemPrompt.length > 50 && wordCount > 20) {
    return {
      strategy: 'context_isolation',
      confidence: 0.60,
      suggestedFragments: 2,
      reason: 'System prompt separable from user prompt',
    };
  }

  // Pattern 5: Very long prompts can be paragraph-split as a last resort
  if (wordCount > 500) {
    const paragraphs = prompt
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 50);
    if (paragraphs.length >= 3) {
      return {
        strategy: 'task_decomposition',
        confidence: 0.45,
        suggestedFragments: Math.min(paragraphs.length, 5),
        reason: `${paragraphs.length} distinct paragraphs (low confidence)`,
      };
    }
  }

  // Cannot split meaningfully
  return {
    strategy: 'unsplittable',
    confidence: 0.90,
    suggestedFragments: 1,
    reason: 'Single coherent context — fragmentation would degrade quality',
  };
}

// --- Fragment Generation ---

/**
 * Fragment a prompt into independent sub-tasks for multi-node dispatch.
 *
 * Each fragment gets:
 * - A unique ID (for reassembly)
 * - A generic system prompt (no user context leaks to the node)
 * - Its portion of the work
 * - Parameters matching the original request
 *
 * The synthesis fragment (index 0) is ALWAYS processed on InferLane's
 * trusted infrastructure — it's the "reassembly brain" that combines
 * fragment responses into a coherent final output.
 */
export function fragmentPrompt(
  prompt: string,
  model: string,
  params: FragmentParameters,
  options: {
    systemPrompt?: string;
    strategy?: SplitStrategy;
    targetFragments?: number;
    minFragments?: number;
    maxFragments?: number;
  } = {},
): PromptFragment[] {
  const {
    systemPrompt,
    minFragments = 3,
    maxFragments = 5,
  } = options;

  const analysis = options.strategy
    ? { strategy: options.strategy, suggestedFragments: options.targetFragments || 3 }
    : analyseSplittability(prompt, systemPrompt);

  const targetCount = Math.max(
    minFragments,
    Math.min(maxFragments, options.targetFragments || analysis.suggestedFragments),
  );

  const requestId = randomBytes(8).toString('hex');

  switch (analysis.strategy) {
    case 'parallel_extraction':
      return fragmentParallel(prompt, model, params, targetCount, requestId);

    case 'task_decomposition':
      return fragmentPipeline(prompt, model, params, targetCount, requestId);

    case 'context_isolation':
      return fragmentContextIsolation(
        prompt,
        systemPrompt || '',
        model,
        params,
        requestId,
      );

    case 'unsplittable':
    default:
      // Return single fragment — caller should route to Tier 0 or TEE
      return [
        {
          fragmentId: `${requestId}-0`,
          index: 0,
          totalFragments: 1,
          content: prompt,
          systemPrompt: systemPrompt || 'You are a helpful assistant.',
          model,
          parameters: params,
        },
      ];
  }
}

// --- Strategy Implementations ---

/**
 * Parallel extraction: Split list items or questions into independent fragments.
 * Each fragment handles one item/question. A synthesis fragment combines results.
 */
function fragmentParallel(
  prompt: string,
  model: string,
  params: FragmentParameters,
  targetCount: number,
  requestId: string,
): PromptFragment[] {
  const fragments: PromptFragment[] = [];
  const lines = prompt.split('\n').filter((l) => l.trim().length > 0);

  // Extract list items or questions
  const listPatterns = [
    /^\s*\d+[\.\)]\s/,
    /^\s*[-*•]\s/,
    /^\s*[a-z][\.\)]\s/,
  ];

  const items: string[] = [];
  let currentItem = '';
  let preamble = '';
  let foundFirstItem = false;

  for (const line of lines) {
    const isListItem = listPatterns.some((p) => p.test(line));

    if (isListItem) {
      if (currentItem) items.push(currentItem.trim());
      currentItem = line;
      foundFirstItem = true;
    } else if (foundFirstItem) {
      currentItem += '\n' + line;
    } else {
      preamble += line + '\n';
    }
  }
  if (currentItem) items.push(currentItem.trim());

  // If we couldn't extract items, fall back to question splitting
  if (items.length < 2) {
    const questions = prompt.match(/[^.!?]*\?/g) || [];
    if (questions.length >= 2) {
      items.length = 0;
      items.push(...questions.map((q) => q.trim()));
      preamble = '';
    }
  }

  // Distribute items across target fragment count
  const itemsPerFragment = Math.ceil(items.length / Math.min(targetCount - 1, items.length));

  for (let i = 0; i < items.length; i += itemsPerFragment) {
    const chunk = items.slice(i, i + itemsPerFragment);
    const fragmentIndex = fragments.length + 1; // reserve 0 for synthesis

    fragments.push({
      fragmentId: `${requestId}-${fragmentIndex}`,
      index: fragmentIndex,
      totalFragments: 0, // set after loop
      content: preamble
        ? `Context: ${preamble.trim()}\n\nPlease address the following:\n${chunk.join('\n')}`
        : `Please address the following:\n${chunk.join('\n')}`,
      systemPrompt: 'You are a helpful assistant. Answer the questions or complete the tasks provided. Be thorough and specific.',
      model,
      parameters: {
        ...params,
        maxTokens: Math.ceil(params.maxTokens / Math.max(1, Math.ceil(items.length / itemsPerFragment))),
      },
    });
  }

  // Synthesis fragment (index 0) — processed on trusted infrastructure
  const synthesisPrompt = buildSynthesisPrompt(fragments.length, 'parallel');
  fragments.unshift({
    fragmentId: `${requestId}-0`,
    index: 0,
    totalFragments: fragments.length + 1,
    content: synthesisPrompt,
    systemPrompt: 'You are a synthesis assistant. Combine the provided partial results into a single coherent response.',
    model,
    parameters: params,
  });

  // Update totalFragments on all
  for (const f of fragments) {
    f.totalFragments = fragments.length;
  }

  return fragments;
}

/**
 * Task decomposition: Split a multi-step prompt into pipeline stages.
 * Each stage can be processed independently, with results flowing forward.
 */
function fragmentPipeline(
  prompt: string,
  model: string,
  params: FragmentParameters,
  targetCount: number,
  requestId: string,
): PromptFragment[] {
  const fragments: PromptFragment[] = [];

  // Split on step indicators
  const stepKeywords = [
    /first[,:]?\s/i,
    /then[,:]?\s/i,
    /next[,:]?\s/i,
    /after that[,:]?\s/i,
    /finally[,:]?\s/i,
    /step\s+\d+[.:]\s/i,
  ];

  // Find split points
  const splitPoints: number[] = [0];
  for (const pattern of stepKeywords) {
    const match = prompt.match(pattern);
    if (match && match.index !== undefined && !splitPoints.includes(match.index)) {
      splitPoints.push(match.index);
    }
  }
  splitPoints.sort((a, b) => a - b);

  // Create fragments from split points
  for (let i = 0; i < splitPoints.length; i++) {
    const start = splitPoints[i];
    const end = i + 1 < splitPoints.length ? splitPoints[i + 1] : prompt.length;
    const chunk = prompt.slice(start, end).trim();

    if (chunk.length > 10) {
      const fragmentIndex = fragments.length + 1;
      fragments.push({
        fragmentId: `${requestId}-${fragmentIndex}`,
        index: fragmentIndex,
        totalFragments: 0,
        content: `Complete the following task step:\n\n${chunk}`,
        systemPrompt: 'You are a helpful assistant completing one step of a multi-step process. Focus only on this step.',
        model,
        parameters: {
          ...params,
          maxTokens: Math.ceil(params.maxTokens / Math.max(1, splitPoints.length)),
        },
      });
    }
  }

  // If we didn't get enough fragments, fall back to paragraph splitting
  if (fragments.length < 2) {
    return fragmentByParagraphs(prompt, model, params, targetCount, requestId);
  }

  // Synthesis fragment
  const synthesisPrompt = buildSynthesisPrompt(fragments.length, 'pipeline');
  fragments.unshift({
    fragmentId: `${requestId}-0`,
    index: 0,
    totalFragments: fragments.length + 1,
    content: synthesisPrompt,
    systemPrompt: 'You are a synthesis assistant. Combine the step results into a single coherent response, maintaining logical flow.',
    model,
    parameters: params,
  });

  for (const f of fragments) {
    f.totalFragments = fragments.length;
  }

  return fragments;
}

/**
 * Context isolation: System prompt and user prompt go to different nodes.
 * A synthesis node combines the perspectives.
 */
function fragmentContextIsolation(
  userPrompt: string,
  systemPrompt: string,
  model: string,
  params: FragmentParameters,
  requestId: string,
): PromptFragment[] {
  const fragments: PromptFragment[] = [];

  // Fragment 1: Process with system context but anonymized user prompt
  fragments.push({
    fragmentId: `${requestId}-1`,
    index: 1,
    totalFragments: 3,
    content: `Given the following context, what would be the key considerations?\n\nContext: ${systemPrompt}`,
    systemPrompt: 'You are an analyst. Identify key considerations from the provided context.',
    model,
    parameters: {
      ...params,
      maxTokens: Math.ceil(params.maxTokens * 0.4),
    },
  });

  // Fragment 2: Process user prompt without system context
  fragments.push({
    fragmentId: `${requestId}-2`,
    index: 2,
    totalFragments: 3,
    content: userPrompt,
    systemPrompt: 'You are a helpful assistant. Address the user\'s request directly.',
    model,
    parameters: {
      ...params,
      maxTokens: Math.ceil(params.maxTokens * 0.6),
    },
  });

  // Synthesis fragment (index 0)
  fragments.unshift({
    fragmentId: `${requestId}-0`,
    index: 0,
    totalFragments: 3,
    content: buildSynthesisPrompt(2, 'context_isolation'),
    systemPrompt: 'You are a synthesis assistant. Combine the contextual analysis with the direct response into a unified, coherent answer.',
    model,
    parameters: params,
  });

  return fragments;
}

/**
 * Fallback: Split by paragraphs when other strategies don't apply.
 */
function fragmentByParagraphs(
  prompt: string,
  model: string,
  params: FragmentParameters,
  targetCount: number,
  requestId: string,
): PromptFragment[] {
  const paragraphs = prompt
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 20);

  if (paragraphs.length < 2) {
    // Truly unsplittable
    return [
      {
        fragmentId: `${requestId}-0`,
        index: 0,
        totalFragments: 1,
        content: prompt,
        model,
        parameters: params,
      },
    ];
  }

  const fragments: PromptFragment[] = [];
  const parasPerFragment = Math.ceil(paragraphs.length / (targetCount - 1));

  for (let i = 0; i < paragraphs.length; i += parasPerFragment) {
    const chunk = paragraphs.slice(i, i + parasPerFragment).join('\n\n');
    const fragmentIndex = fragments.length + 1;

    fragments.push({
      fragmentId: `${requestId}-${fragmentIndex}`,
      index: fragmentIndex,
      totalFragments: 0,
      content: `Analyze and respond to the following:\n\n${chunk}`,
      systemPrompt: 'You are a helpful assistant. Analyze the provided text section.',
      model,
      parameters: {
        ...params,
        maxTokens: Math.ceil(params.maxTokens / Math.max(1, Math.ceil(paragraphs.length / parasPerFragment))),
      },
    });
  }

  const synthesisPrompt = buildSynthesisPrompt(fragments.length, 'parallel');
  fragments.unshift({
    fragmentId: `${requestId}-0`,
    index: 0,
    totalFragments: fragments.length + 1,
    content: synthesisPrompt,
    systemPrompt: 'You are a synthesis assistant. Combine the partial analyses into a single coherent response.',
    model,
    parameters: params,
  });

  for (const f of fragments) {
    f.totalFragments = fragments.length;
  }

  return fragments;
}

// --- Synthesis ---

function buildSynthesisPrompt(
  fragmentCount: number,
  strategy: string,
): string {
  return `You will receive ${fragmentCount} partial responses from different processing nodes. ` +
    `These were generated by splitting a user request using the "${strategy}" strategy. ` +
    `Your task is to:\n` +
    `1. Read all partial responses\n` +
    `2. Identify overlaps, contradictions, or gaps\n` +
    `3. Synthesize a single, coherent, complete response\n` +
    `4. Maintain the tone and detail level of the original request\n` +
    `5. Do not mention that the response was assembled from parts\n\n` +
    `Partial responses will be provided in order.`;
}

/**
 * Reassemble fragment results into a final response.
 *
 * For parallel/pipeline strategies: feed fragment responses into the
 * synthesis fragment's model call for coherent combination.
 *
 * For single-fragment (unsplittable): return as-is.
 */
export function buildSynthesisInput(
  synthesisFragment: PromptFragment,
  fragmentResults: FragmentResult[],
): string {
  // Sort by index to ensure correct order
  const sorted = [...fragmentResults]
    .filter((r) => r.index > 0) // exclude synthesis fragment itself
    .sort((a, b) => a.index - b.index);

  let input = synthesisFragment.content + '\n\n';

  for (const result of sorted) {
    input += `--- Response from Part ${result.index} ---\n`;
    input += result.response + '\n\n';
  }

  return input;
}

/**
 * Create the final reassembled response from all fragment results.
 */
export function reassembleResponse(
  fragmentResults: FragmentResult[],
  synthesisResponse: string | null,
  privacyTier: PrivacyTier,
): ReassembledResponse {
  const totalInputTokens = fragmentResults.reduce(
    (sum, r) => sum + r.tokenUsage.inputTokens,
    0,
  );
  const totalOutputTokens = fragmentResults.reduce(
    (sum, r) => sum + r.tokenUsage.outputTokens,
    0,
  );

  // Wall-clock latency is max of parallel fragments (not sum)
  const totalLatencyMs = Math.max(...fragmentResults.map((r) => r.latencyMs));

  const uniqueNodes = new Set(fragmentResults.map((r) => r.nodeId));

  return {
    fullResponse: synthesisResponse || fragmentResults[0]?.response || '',
    fragments: fragmentResults,
    totalInputTokens,
    totalOutputTokens,
    totalLatencyMs,
    privacyTier,
    nodeCount: uniqueNodes.size,
  };
}
