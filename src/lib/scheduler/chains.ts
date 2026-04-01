// ---------------------------------------------------------------------------
// Prompt Scheduler — Chain Builder & Executor (Stream Z2)
// ---------------------------------------------------------------------------
// Creates multi-step prompt chains where each step depends on the previous
// step's output. Manages chain lifecycle and response injection.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

// -- Inline types --

interface ChainStep {
  title: string;
  model: string;
  systemPrompt?: string;
  messages: any[];
  parameters: { maxTokens: number; temperature?: number };
  scheduleType?: string;
  scheduledAt?: Date;
  cronExpression?: string;
}

interface ChainStatus {
  batchId: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: {
    id: string;
    chainIndex: number;
    title: string;
    status: string;
    model: string;
    executedAt: Date | null;
    costCents: number | null;
  }[];
}

// ---------------------------------------------------------------------------
// 1. Create a multi-step prompt chain
// ---------------------------------------------------------------------------

export async function createChain(
  userId: string,
  steps: ChainStep[],
): Promise<string> {
  if (steps.length === 0) throw new Error('Chain must have at least one step');
  if (steps.length > 50) throw new Error('Chain cannot exceed 50 steps');

  const batchId = `chain_${randomBytes(12).toString('hex')}`;

  // Create all steps in a transaction
  await prisma.$transaction(async (tx: any) => {
    let previousId: string | null = null;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const prompt: { id: string } = await tx.scheduledPrompt.create({
        data: {
          userId,
          title: step.title || `Chain step ${i + 1}`,
          model: step.model,
          systemPrompt: step.systemPrompt || null,
          messages: step.messages,
          parameters: step.parameters,
          scheduleType: step.scheduleType || 'IMMEDIATE',
          scheduledAt: step.scheduledAt || null,
          cronExpression: step.cronExpression || null,
          batchId,
          chainIndex: i,
          dependsOn: previousId ? [previousId] : [],
          status: i === 0 ? 'QUEUED' : 'SCHEDULED',
        },
      });

      previousId = prompt.id;
    }
  });

  return batchId;
}

// ---------------------------------------------------------------------------
// 2. Get chain status
// ---------------------------------------------------------------------------

export async function getChainStatus(batchId: string): Promise<ChainStatus> {
  const steps = await prisma.scheduledPrompt.findMany({
    where: { batchId },
    orderBy: { chainIndex: 'asc' },
    select: {
      id: true,
      chainIndex: true,
      title: true,
      status: true,
      model: true,
      executedAt: true,
      costCents: true,
    },
  });

  if (steps.length === 0) {
    throw new Error('Chain not found');
  }

  const completedSteps = steps.filter((s: any) => s.status === 'COMPLETED').length;
  const failedSteps = steps.filter((s: any) => s.status === 'FAILED').length;
  const cancelledSteps = steps.filter((s: any) => s.status === 'CANCELLED').length;
  const runningStep = steps.find((s: any) => s.status === 'RUNNING');

  let status: ChainStatus['status'] = 'pending';
  if (completedSteps === steps.length) status = 'completed';
  else if (failedSteps > 0) status = 'failed';
  else if (cancelledSteps > 0) status = 'cancelled';
  else if (runningStep) status = 'running';

  return {
    batchId,
    totalSteps: steps.length,
    completedSteps,
    currentStep: runningStep ? (runningStep.chainIndex as number) : null,
    status,
    steps: steps.map((s: any) => ({
      id: s.id,
      chainIndex: s.chainIndex ?? 0,
      title: s.title,
      status: s.status,
      model: s.model,
      executedAt: s.executedAt,
      costCents: s.costCents,
    })),
  };
}

// ---------------------------------------------------------------------------
// 3. Inject previous step's response into current messages
// ---------------------------------------------------------------------------

export function injectPreviousResponse(
  messages: any[],
  previousResponse: string,
): any[] {
  return [
    ...messages,
    {
      role: 'user',
      content: `Here is the output from the previous step:\n\n${previousResponse}\n\nNow proceed with the current task.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 4. Cancel all pending steps in a chain
// ---------------------------------------------------------------------------

export async function cancelChain(batchId: string): Promise<number> {
  const result = await prisma.scheduledPrompt.updateMany({
    where: {
      batchId,
      status: { in: ['QUEUED', 'SCHEDULED'] },
    },
    data: { status: 'CANCELLED' },
  });

  return result.count;
}
