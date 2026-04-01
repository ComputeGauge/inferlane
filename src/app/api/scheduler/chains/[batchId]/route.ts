// ---------------------------------------------------------------------------
// API: Single Chain by batchId (Stream Z2)
// ---------------------------------------------------------------------------
// GET    — Get chain status with all steps
// DELETE — Cancel all pending steps in the chain
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { getChainStatus, cancelChain } from '@/lib/scheduler/chains';

// ---------------------------------------------------------------------------
// GET /api/scheduler/chains/[batchId]
// ---------------------------------------------------------------------------

async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { batchId } = await params;

    // Verify chain belongs to user
    const first = await prisma.scheduledPrompt.findFirst({
      where: { batchId, userId: session.user.id },
      select: { id: true },
    });

    if (!first) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const status = await getChainStatus(batchId);

    return NextResponse.json({ chain: status });
  } catch (error) {
    return handleApiError(error, 'SchedulerChainGET');
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/scheduler/chains/[batchId]
// ---------------------------------------------------------------------------

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { batchId } = await params;

    // Verify chain belongs to user
    const first = await prisma.scheduledPrompt.findFirst({
      where: { batchId, userId: session.user.id },
      select: { id: true },
    });

    if (!first) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const cancelledCount = await cancelChain(batchId);
    const status = await getChainStatus(batchId);

    return NextResponse.json({ cancelled: cancelledCount, chain: status });
  } catch (error) {
    return handleApiError(error, 'SchedulerChainDELETE');
  }
}

export const GET = withTiming(handleGET);
export const DELETE = withTiming(handleDELETE);
