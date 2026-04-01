// ---------------------------------------------------------------------------
// API: Universal Dispatch (Stream D1)
// ---------------------------------------------------------------------------
// POST — Submit a dispatch request (sync or async)
// GET  — Poll for task status by taskId query param
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/rate-limit';
import { authenticateRequest } from '@/lib/auth-api-key';
import {
  universalDispatcher,
  type DispatchRequest,
} from '@/lib/dispatch/universal-dispatch';
import { isAllowedWebhookUrl } from '@/lib/security/ssrf-guard';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ROUTING = [
  'auto',
  'cheapest',
  'fastest',
  'quality',
  'decentralized_only',
  'centralized_only',
] as const;

const VALID_PRIORITY = ['realtime', 'standard', 'batch'] as const;
const VALID_DELIVERY = ['sync', 'webhook', 'poll'] as const;

function validateBody(body: unknown): {
  valid: boolean;
  error?: string;
  request?: DispatchRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const b = body as Record<string, unknown>;

  if (!b.prompt || typeof b.prompt !== 'string' || b.prompt.trim().length === 0) {
    return { valid: false, error: 'prompt is required and must be a non-empty string' };
  }

  if (b.model !== undefined && typeof b.model !== 'string') {
    return { valid: false, error: 'model must be a string' };
  }

  if (b.systemPrompt !== undefined && typeof b.systemPrompt !== 'string') {
    return { valid: false, error: 'systemPrompt must be a string' };
  }

  if (b.maxTokens !== undefined) {
    if (typeof b.maxTokens !== 'number' || b.maxTokens < 1 || b.maxTokens > 100000) {
      return { valid: false, error: 'maxTokens must be between 1 and 100000' };
    }
  }

  if (b.temperature !== undefined) {
    if (typeof b.temperature !== 'number' || b.temperature < 0 || b.temperature > 2) {
      return { valid: false, error: 'temperature must be between 0 and 2' };
    }
  }

  if (b.routing !== undefined && !VALID_ROUTING.includes(b.routing as any)) {
    return {
      valid: false,
      error: `routing must be one of: ${VALID_ROUTING.join(', ')}`,
    };
  }

  if (b.priority !== undefined && !VALID_PRIORITY.includes(b.priority as any)) {
    return {
      valid: false,
      error: `priority must be one of: ${VALID_PRIORITY.join(', ')}`,
    };
  }

  if (b.deliveryMethod !== undefined && !VALID_DELIVERY.includes(b.deliveryMethod as any)) {
    return {
      valid: false,
      error: `deliveryMethod must be one of: ${VALID_DELIVERY.join(', ')}`,
    };
  }

  if (b.deliveryMethod === 'webhook') {
    if (!b.webhookUrl || typeof b.webhookUrl !== 'string') {
      return { valid: false, error: 'webhookUrl is required when deliveryMethod is webhook' };
    }
    try {
      new URL(b.webhookUrl as string);
    } catch {
      return { valid: false, error: 'webhookUrl must be a valid URL' };
    }
    if (!isAllowedWebhookUrl(b.webhookUrl as string)) {
      return { valid: false, error: 'webhookUrl must be a public HTTPS URL (private/internal addresses are blocked)' };
    }
  }

  return {
    valid: true,
    request: {
      prompt: (b.prompt as string).trim(),
      model: b.model as string | undefined,
      systemPrompt: b.systemPrompt as string | undefined,
      maxTokens: b.maxTokens as number | undefined,
      temperature: b.temperature as number | undefined,
      sessionId: b.sessionId as string | undefined,
      routing: b.routing as DispatchRequest['routing'],
      priority: b.priority as DispatchRequest['priority'],
      deliveryMethod: b.deliveryMethod as DispatchRequest['deliveryMethod'],
      webhookUrl: b.webhookUrl as string | undefined,
      metadata: b.metadata as Record<string, unknown> | undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /api/dispatch
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`dispatch-post:${auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const validation = validateBody(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await universalDispatcher.dispatch(
      validation.request!,
      auth.userId,
    );

    return NextResponse.json(result, {
      status: result.status === 'completed' ? 200 : 202,
    });
  } catch (error) {
    return handleApiError(error, 'DispatchPOST');
  }
}

// ---------------------------------------------------------------------------
// GET /api/dispatch?taskId=...
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`dispatch-get:${auth.userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const taskId = req.nextUrl.searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId query parameter is required' },
        { status: 400 },
      );
    }

    const result = await universalDispatcher.getTaskStatus(taskId, auth.userId);
    if (!result) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'DispatchGET');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const POST = withTiming(handlePOST);
export const GET = withTiming(handleGET);
