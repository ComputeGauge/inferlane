// ---------------------------------------------------------------------------
// API: Batch & Chain Management (Stream Z2)
// ---------------------------------------------------------------------------
// GET  — List user's batches with status summary
// POST — Create a batch of prompts or a chain of ordered steps
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { findModelPrice } from '@/lib/pricing/model-prices';
import { createChain, getChainStatus, cancelChain } from '@/lib/scheduler/chains';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// GET /api/scheduler/batches
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all distinct batchIds for this user
    const batchPrompts = await prisma.scheduledPrompt.findMany({
      where: {
        userId: session.user.id,
        batchId: { not: null },
      },
      select: {
        batchId: true,
        status: true,
        chainIndex: true,
        costCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by batchId
    const batchMap = new Map<string, {
      batchId: string;
      total: number;
      completed: number;
      failed: number;
      running: number;
      queued: number;
      cancelled: number;
      isChain: boolean;
      totalCostCents: number;
      createdAt: Date;
    }>();

    for (const p of batchPrompts) {
      if (!p.batchId) continue;

      let batch = batchMap.get(p.batchId);
      if (!batch) {
        batch = {
          batchId: p.batchId,
          total: 0,
          completed: 0,
          failed: 0,
          running: 0,
          queued: 0,
          cancelled: 0,
          isChain: false,
          totalCostCents: 0,
          createdAt: p.createdAt,
        };
        batchMap.set(p.batchId, batch);
      }

      batch.total++;
      if (p.status === 'COMPLETED') batch.completed++;
      else if (p.status === 'FAILED') batch.failed++;
      else if (p.status === 'RUNNING') batch.running++;
      else if (p.status === 'QUEUED' || p.status === 'SCHEDULED') batch.queued++;
      else if (p.status === 'CANCELLED') batch.cancelled++;

      if (p.chainIndex != null) batch.isChain = true;
      if (p.costCents) batch.totalCostCents += p.costCents;
    }

    const batches = Array.from(batchMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return NextResponse.json({ batches });
  } catch (error) {
    return handleApiError(error, 'SchedulerBatchesGET');
  }
}

// ---------------------------------------------------------------------------
// POST /api/scheduler/batches
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`scheduler-batches-post:${session.user.id}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { type, prompts } = body;

    if (!type || !['batch', 'chain'].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'batch' or 'chain'" },
        { status: 400 },
      );
    }

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: 'prompts must be a non-empty array' },
        { status: 400 },
      );
    }

    if (prompts.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 prompts per batch' },
        { status: 400 },
      );
    }

    // Check queue limit
    const queuedCount = await prisma.scheduledPrompt.count({
      where: {
        userId: session.user.id,
        status: { in: ['QUEUED', 'SCHEDULED'] },
      },
    });

    if (queuedCount + prompts.length > 100) {
      return NextResponse.json(
        { error: `Adding ${prompts.length} prompts would exceed the 100 queued prompt limit (current: ${queuedCount})` },
        { status: 400 },
      );
    }

    // Validate each prompt spec
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      const errors = validatePromptSpec(p, i);
      if (errors) {
        return NextResponse.json({ error: errors }, { status: 400 });
      }
    }

    if (type === 'chain') {
      const batchId = await createChain(session.user.id, prompts);
      return NextResponse.json({ batchId, type: 'chain', count: prompts.length }, { status: 201 });
    }

    // type === 'batch' — create all with same batchId, no dependencies
    const batchId = `batch_${randomBytes(12).toString('hex')}`;

    await prisma.$transaction(
      prompts.map((p: any) =>
        prisma.scheduledPrompt.create({
          data: {
            userId: session.user.id,
            title: p.title || 'Batch prompt',
            model: p.model,
            systemPrompt: p.systemPrompt || null,
            messages: p.messages,
            parameters: p.parameters,
            scheduleType: p.scheduleType || 'IMMEDIATE',
            scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
            cronExpression: p.cronExpression || null,
            promotionFilter: p.promotionFilter || null,
            priceThreshold: p.priceThreshold || null,
            priority: p.priority || 'medium',
            batchId,
            status: 'QUEUED',
          },
        }),
      ),
    );

    return NextResponse.json({ batchId, type: 'batch', count: prompts.length }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'SchedulerBatchesPOST');
  }
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

function validatePromptSpec(p: any, index: number): string | null {
  if (!p.model || typeof p.model !== 'string') {
    return `prompts[${index}].model is required`;
  }
  if (!findModelPrice(p.model)) {
    return `prompts[${index}].model "${p.model}" is not a known model`;
  }
  if (!Array.isArray(p.messages) || p.messages.length === 0) {
    return `prompts[${index}].messages must be a non-empty array`;
  }
  if (!p.parameters || typeof p.parameters !== 'object') {
    return `prompts[${index}].parameters is required`;
  }
  const maxTokens = p.parameters.maxTokens;
  if (typeof maxTokens !== 'number' || maxTokens < 1 || maxTokens > 100000) {
    return `prompts[${index}].parameters.maxTokens must be between 1 and 100000`;
  }
  const temp = p.parameters.temperature;
  if (temp !== undefined && (typeof temp !== 'number' || temp < 0 || temp > 2)) {
    return `prompts[${index}].parameters.temperature must be between 0 and 2`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DELETE /api/scheduler/batches?batchId=xxx — cancel all pending steps in a chain/batch
// ---------------------------------------------------------------------------

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success } = await rateLimit(`scheduler-batches-delete:${session.user.id}`, 10, 60_000);
  if (!success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const batchId = req.nextUrl.searchParams.get('batchId');
    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    // Verify batch belongs to user
    const first = await prisma.scheduledPrompt.findFirst({
      where: { batchId, userId: session.user.id },
    });
    if (!first) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const cancelled = await cancelChain(batchId);
    const status = await getChainStatus(batchId);

    return NextResponse.json({ cancelled, status });
  } catch (error) {
    return handleApiError(error, 'CancelBatch');
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const DELETE = withTiming(handleDELETE);
