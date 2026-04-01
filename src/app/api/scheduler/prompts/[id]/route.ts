// ---------------------------------------------------------------------------
// API: Single Scheduled Prompt (Stream Z2)
// ---------------------------------------------------------------------------
// GET    — Get a single prompt by ID (with execution result)
// DELETE — Cancel a prompt (set status to FAILED with note)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET /api/scheduler/prompts/[id]
// ---------------------------------------------------------------------------

async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const prompt = await prisma.scheduledPrompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    if (prompt.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    return handleApiError(error, 'SchedulerPromptGET');
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/scheduler/prompts/[id]
// ---------------------------------------------------------------------------

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

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
        { error: `Cannot cancel prompt with status ${prompt.status}. Only QUEUED or SCHEDULED prompts can be cancelled.` },
        { status: 400 },
      );
    }

    await prisma.scheduledPrompt.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: 'Cancelled by user',
      },
    });

    return NextResponse.json({ cancelled: true, id });
  } catch (error) {
    return handleApiError(error, 'SchedulerPromptDELETE');
  }
}

export const GET = withTiming(handleGET);
export const DELETE = withTiming(handleDELETE);
