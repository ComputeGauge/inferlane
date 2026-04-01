// ---------------------------------------------------------------------------
// API: Prompt Chains (Stream Z2)
// ---------------------------------------------------------------------------
// POST — Create a multi-step prompt chain
// GET  — List user's chains (distinct batchIds)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { findModelPrice } from '@/lib/pricing/model-prices';
import { createChain } from '@/lib/scheduler/chains';

// ---------------------------------------------------------------------------
// GET /api/scheduler/chains
// ---------------------------------------------------------------------------

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all prompts that belong to chains (have batchId + chainIndex)
    const chainPrompts = await prisma.scheduledPrompt.findMany({
      where: {
        userId: session.user.id,
        batchId: { not: null },
        chainIndex: { not: null },
      },
      select: {
        batchId: true,
        chainIndex: true,
        title: true,
        status: true,
        model: true,
        costCents: true,
        executedAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { chainIndex: 'asc' }],
    });

    // Group by batchId
    const chainMap = new Map<string, {
      batchId: string;
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
      totalCostCents: number;
      createdAt: Date;
    }>();

    for (const p of chainPrompts) {
      if (!p.batchId) continue;

      let chain = chainMap.get(p.batchId);
      if (!chain) {
        chain = {
          batchId: p.batchId,
          totalSteps: 0,
          completedSteps: 0,
          failedSteps: 0,
          status: 'pending',
          totalCostCents: 0,
          createdAt: p.createdAt,
        };
        chainMap.set(p.batchId, chain);
      }

      chain.totalSteps++;
      if (p.status === 'COMPLETED') chain.completedSteps++;
      if (p.status === 'FAILED') chain.failedSteps++;
      if (p.costCents) chain.totalCostCents += p.costCents;
    }

    // Derive overall status for each chain
    for (const chain of chainMap.values()) {
      if (chain.completedSteps === chain.totalSteps) {
        chain.status = 'completed';
      } else if (chain.failedSteps > 0) {
        chain.status = 'failed';
      } else if (chain.completedSteps > 0) {
        chain.status = 'running';
      }
    }

    const chains = Array.from(chainMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return NextResponse.json({ chains });
  } catch (error) {
    return handleApiError(error, 'SchedulerChainsGET');
  }
}

// ---------------------------------------------------------------------------
// POST /api/scheduler/chains
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`scheduler-chains-post:${session.user.id}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { steps, scheduleType, scheduledAt } = body;

    // --- Validation ---
    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'steps must be a non-empty array' },
        { status: 400 },
      );
    }

    if (steps.length > 50) {
      return NextResponse.json(
        { error: 'Chain cannot exceed 50 steps' },
        { status: 400 },
      );
    }

    // Validate each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (!step.prompt || typeof step.prompt !== 'string') {
        return NextResponse.json(
          { error: `steps[${i}].prompt is required` },
          { status: 400 },
        );
      }

      if (!step.model || typeof step.model !== 'string') {
        return NextResponse.json(
          { error: `steps[${i}].model is required` },
          { status: 400 },
        );
      }

      if (!findModelPrice(step.model)) {
        return NextResponse.json(
          { error: `steps[${i}].model "${step.model}" is not a known model` },
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

    if (queuedCount + steps.length > 100) {
      return NextResponse.json(
        { error: `Adding ${steps.length} steps would exceed the 100 queued prompt limit (current: ${queuedCount})` },
        { status: 400 },
      );
    }

    // Map steps to the ChainStep format expected by createChain
    const chainSteps = steps.map((step: any) => ({
      title: step.title || step.prompt.slice(0, 80),
      model: step.model,
      systemPrompt: step.systemPrompt,
      messages: [{ role: 'user', content: step.prompt }],
      parameters: {
        maxTokens: step.maxTokens || 4096,
        temperature: step.temperature,
      },
      scheduleType: scheduleType || 'IMMEDIATE',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    }));

    const batchId = await createChain(session.user.id, chainSteps);

    return NextResponse.json(
      { batchId, steps: steps.length },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'SchedulerChainsPOST');
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
