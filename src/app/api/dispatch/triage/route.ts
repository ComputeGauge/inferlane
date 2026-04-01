// ---------------------------------------------------------------------------
// API: Prompt Triage — Auto-assess, auto-route, auto-schedule
// ---------------------------------------------------------------------------
// POST — Triage a prompt (optionally auto-execute)
// GET  — Get default triage preferences
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/rate-limit';
import { authenticateRequest } from '@/lib/auth-api-key';
import { triageEngine, type TriagePreferences } from '@/lib/dispatch/triage-engine';

// ---------------------------------------------------------------------------
// POST /api/dispatch/triage
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`triage-post:${auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();

    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    const preferences: Partial<TriagePreferences> = {};
    if (body.preferences && typeof body.preferences === 'object') {
      const p = body.preferences;
      if (p.mode && ['manual', 'auto_triage', 'auto_full'].includes(p.mode)) {
        preferences.mode = p.mode;
      }
      if (p.costSensitivity && ['minimum', 'balanced', 'quality_first'].includes(p.costSensitivity)) {
        preferences.costSensitivity = p.costSensitivity;
      }
      if (typeof p.preferDecentralized === 'boolean') {
        preferences.preferDecentralized = p.preferDecentralized;
      }
      if (typeof p.allowBatchDefer === 'boolean') {
        preferences.allowBatchDefer = p.allowBatchDefer;
      }
      if (typeof p.maxCostPerPrompt === 'number') {
        preferences.maxCostPerPrompt = p.maxCostPerPrompt;
      }
      if (typeof p.quietHoursStart === 'number') {
        preferences.quietHoursStart = p.quietHoursStart;
      }
      if (typeof p.quietHoursEnd === 'number') {
        preferences.quietHoursEnd = p.quietHoursEnd;
      }
      if (Array.isArray(p.priorityKeywords)) {
        preferences.priorityKeywords = p.priorityKeywords;
      }
      if (Array.isArray(p.batchKeywords)) {
        preferences.batchKeywords = p.batchKeywords;
      }
    }

    const autoExecute = body.autoExecute === true;

    if (autoExecute) {
      // Triage and dispatch in one call
      const result = await triageEngine.triageAndDispatch(
        {
          prompt: body.prompt.trim(),
          systemPrompt: body.systemPrompt,
          maxTokens: body.maxTokens,
          userPreferences: Object.keys(preferences).length > 0 ? preferences as TriagePreferences : undefined,
          sessionId: body.sessionId,
        },
        auth.userId,
      );

      return NextResponse.json(result);
    }

    // Triage only — user reviews before executing
    const result = await triageEngine.triage({
      prompt: body.prompt.trim(),
      systemPrompt: body.systemPrompt,
      maxTokens: body.maxTokens,
      userPreferences: Object.keys(preferences).length > 0 ? preferences as TriagePreferences : undefined,
      sessionId: body.sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'TriagePOST');
  }
}

// ---------------------------------------------------------------------------
// GET /api/dispatch/triage — return default preferences
// ---------------------------------------------------------------------------

async function handleGET() {
  return NextResponse.json(triageEngine.getDefaultPreferences());
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const POST = withTiming(handlePOST);
export const GET = withTiming(handleGET);
