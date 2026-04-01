// ---------------------------------------------------------------------------
// API: Scheduled Prompts (Stream Z2)
// ---------------------------------------------------------------------------
// GET  — List user's scheduled prompts (paginated, filterable)
// POST — Create a new scheduled prompt
// DELETE — Cancel a prompt by id
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { findModelPrice } from '@/lib/pricing/model-prices';

const VALID_SCHEDULE_TYPES = [
  'IMMEDIATE',
  'TIME_BASED',
  'PROMOTION_TRIGGERED',
  'PRICE_TRIGGERED',
  'RECURRING',
  'OPTIMAL_WINDOW',
];

const VALID_STATUSES = [
  'QUEUED',
  'SCHEDULED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
];

// ---------------------------------------------------------------------------
// GET /api/scheduler/prompts
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`scheduler-prompts-get:${session.user.id}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status');
    const scheduleType = searchParams.get('scheduleType');
    const batchId = searchParams.get('batchId');

    const where: any = { userId: session.user.id };
    if (status && VALID_STATUSES.includes(status)) where.status = status;
    if (scheduleType && VALID_SCHEDULE_TYPES.includes(scheduleType)) where.scheduleType = scheduleType;
    if (batchId) where.batchId = batchId;

    const [prompts, total] = await Promise.all([
      prisma.scheduledPrompt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.scheduledPrompt.count({ where }),
    ]);

    return NextResponse.json({
      prompts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, 'SchedulerPromptsGET');
  }
}

// ---------------------------------------------------------------------------
// POST /api/scheduler/prompts
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`scheduler-prompts-post:${session.user.id}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const {
      title,
      model,
      systemPrompt,
      messages,
      parameters,
      scheduleType,
      scheduledAt,
      cronExpression,
      promotionFilter,
      priceThreshold,
      priority,
    } = body;

    // --- Validation ---
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    const knownModel = findModelPrice(model);
    if (!knownModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 });
    }

    if (!parameters || typeof parameters !== 'object') {
      return NextResponse.json({ error: 'parameters is required' }, { status: 400 });
    }

    const maxTokens = parameters.maxTokens;
    if (typeof maxTokens !== 'number' || maxTokens < 1 || maxTokens > 100000) {
      return NextResponse.json(
        { error: 'parameters.maxTokens must be between 1 and 100000' },
        { status: 400 },
      );
    }

    const temperature = parameters.temperature;
    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: 'parameters.temperature must be between 0 and 2' },
        { status: 400 },
      );
    }

    if (!scheduleType || !VALID_SCHEDULE_TYPES.includes(scheduleType)) {
      return NextResponse.json(
        { error: `scheduleType must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (scheduleType === 'TIME_BASED' && !scheduledAt) {
      return NextResponse.json(
        { error: 'scheduledAt is required for TIME_BASED schedule' },
        { status: 400 },
      );
    }

    if (scheduleType === 'RECURRING') {
      if (!cronExpression) {
        return NextResponse.json(
          { error: 'cronExpression is required for RECURRING schedule' },
          { status: 400 },
        );
      }
      // Validate cron format: 5 space-separated fields
      const cronParts = cronExpression.trim().split(/\s+/);
      if (cronParts.length !== 5 || !cronParts.every((p: string) => /^[\d*,\-\/]+$/.test(p))) {
        return NextResponse.json(
          { error: 'cronExpression must be a valid 5-field cron (min hour dom month dow)' },
          { status: 400 },
        );
      }
    }

    if (scheduleType === 'PROMOTION_TRIGGERED') {
      if (!promotionFilter) {
        return NextResponse.json(
          { error: 'promotionFilter is required for PROMOTION_TRIGGERED schedule' },
          { status: 400 },
        );
      }
      if (typeof promotionFilter !== 'object') {
        return NextResponse.json(
          { error: 'promotionFilter must be an object with optional provider, minMultiplier, promotionTypes' },
          { status: 400 },
        );
      }
    }

    if (scheduleType === 'PRICE_TRIGGERED') {
      if (!priceThreshold) {
        return NextResponse.json(
          { error: 'priceThreshold is required for PRICE_TRIGGERED schedule' },
          { status: 400 },
        );
      }
      if (typeof priceThreshold !== 'object') {
        return NextResponse.json(
          { error: 'priceThreshold must be an object with maxInputPerMToken and/or maxOutputPerMToken' },
          { status: 400 },
        );
      }
    }

    // Check queue limit
    const queuedCount = await prisma.scheduledPrompt.count({
      where: {
        userId: session.user.id,
        status: { in: ['QUEUED', 'SCHEDULED'] },
      },
    });

    if (queuedCount >= 100) {
      return NextResponse.json(
        { error: 'Maximum of 100 queued prompts per user. Cancel existing prompts first.' },
        { status: 400 },
      );
    }

    // Create the prompt
    const prompt = await prisma.scheduledPrompt.create({
      data: {
        userId: session.user.id,
        title,
        model,
        systemPrompt: systemPrompt || null,
        messages,
        parameters,
        scheduleType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        cronExpression: cronExpression || null,
        promotionFilter: promotionFilter || null,
        priceThreshold: priceThreshold || null,
        priority: priority || 'medium',
        status: scheduleType === 'IMMEDIATE' ? 'QUEUED' : 'SCHEDULED',
      },
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'SchedulerPromptsPOST');
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/scheduler/prompts?id=...
// ---------------------------------------------------------------------------

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    // Find the prompt and verify ownership
    const prompt = await prisma.scheduledPrompt.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    if (prompt.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['QUEUED', 'SCHEDULED'].includes(prompt.status)) {
      return NextResponse.json(
        { error: `Cannot cancel prompt with status ${prompt.status}` },
        { status: 400 },
      );
    }

    await prisma.scheduledPrompt.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ cancelled: true, id });
  } catch (error) {
    return handleApiError(error, 'SchedulerPromptsDELETE');
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const DELETE = withTiming(handleDELETE);
