// ---------------------------------------------------------------------------
// API: Chain Execution (Stream D3)
// ---------------------------------------------------------------------------
// POST — Execute a multi-provider chain
// GET  — Get chain status by batchId
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/rate-limit';
import { authenticateRequest } from '@/lib/auth-api-key';
import {
  chainExecutor,
  type ChainStep,
} from '@/lib/dispatch/chain-executor';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ROUTING = ['auto', 'cheapest', 'fastest', 'quality', 'direct'] as const;
const VALID_TRANSFORMS = ['raw', 'extract_code', 'extract_json', 'summarize'] as const;
const MAX_CHAIN_STEPS = 20;

function validateChainBody(body: unknown): {
  valid: boolean;
  error?: string;
  steps?: ChainStep[];
  sessionId?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.steps) || b.steps.length === 0) {
    return { valid: false, error: 'steps must be a non-empty array' };
  }

  if (b.steps.length > MAX_CHAIN_STEPS) {
    return { valid: false, error: `Maximum ${MAX_CHAIN_STEPS} steps per chain` };
  }

  const steps: ChainStep[] = [];

  for (let i = 0; i < b.steps.length; i++) {
    const step = b.steps[i] as Record<string, unknown>;

    if (!step || typeof step !== 'object') {
      return { valid: false, error: `Step ${i} must be an object` };
    }

    if (!step.prompt || typeof step.prompt !== 'string' || (step.prompt as string).trim().length === 0) {
      return { valid: false, error: `Step ${i}: prompt is required and must be a non-empty string` };
    }

    if (step.model !== undefined && typeof step.model !== 'string') {
      return { valid: false, error: `Step ${i}: model must be a string` };
    }

    if (step.provider !== undefined && typeof step.provider !== 'string') {
      return { valid: false, error: `Step ${i}: provider must be a string` };
    }

    if (step.routing !== undefined && !VALID_ROUTING.includes(step.routing as any)) {
      return {
        valid: false,
        error: `Step ${i}: routing must be one of: ${VALID_ROUTING.join(', ')}`,
      };
    }

    if (step.maxTokens !== undefined) {
      if (typeof step.maxTokens !== 'number' || step.maxTokens < 1 || step.maxTokens > 100000) {
        return { valid: false, error: `Step ${i}: maxTokens must be between 1 and 100000` };
      }
    }

    if (step.systemPrompt !== undefined && typeof step.systemPrompt !== 'string') {
      return { valid: false, error: `Step ${i}: systemPrompt must be a string` };
    }

    if (step.transformOutput !== undefined && !VALID_TRANSFORMS.includes(step.transformOutput as any)) {
      return {
        valid: false,
        error: `Step ${i}: transformOutput must be one of: ${VALID_TRANSFORMS.join(', ')}`,
      };
    }

    steps.push({
      prompt: (step.prompt as string).trim(),
      model: step.model as string | undefined,
      provider: step.provider as string | undefined,
      routing: step.routing as string | undefined,
      maxTokens: step.maxTokens as number | undefined,
      systemPrompt: step.systemPrompt as string | undefined,
      transformOutput: step.transformOutput as ChainStep['transformOutput'],
    });
  }

  return {
    valid: true,
    steps,
    sessionId: typeof b.sessionId === 'string' ? b.sessionId : undefined,
  };
}

// ---------------------------------------------------------------------------
// POST /api/dispatch/chain
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`chain-post:${auth.userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const validation = validateChainBody(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await chainExecutor.executeChain(
      validation.steps!,
      auth.userId,
      validation.sessionId,
    );

    return NextResponse.json(result, {
      status: result.status === 'completed' ? 200 : result.status === 'failed' ? 502 : 202,
    });
  } catch (error) {
    return handleApiError(error, 'ChainPOST');
  }
}

// ---------------------------------------------------------------------------
// GET /api/dispatch/chain?batchId=...
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`chain-get:${auth.userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const batchId = req.nextUrl.searchParams.get('batchId');
    if (!batchId) {
      return NextResponse.json(
        { error: 'batchId query parameter is required' },
        { status: 400 },
      );
    }

    const result = await chainExecutor.getChainStatus(batchId);
    if (!result) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'ChainGET');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const POST = withTiming(handlePOST);
export const GET = withTiming(handleGET);
