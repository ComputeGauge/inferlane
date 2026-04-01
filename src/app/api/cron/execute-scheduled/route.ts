// ---------------------------------------------------------------------------
// Cron: Execute Scheduled Prompts (Stream Z2)
// ---------------------------------------------------------------------------
// Called every 5 minutes by external cron. Checks for executable prompts
// and runs up to 10 per tick to avoid timeout.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { checkExecutablePrompts, executePrompt } from '@/lib/scheduler/engine';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

const MAX_PER_RUN = 10;

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    // Find prompts ready to execute
    const executable = await checkExecutablePrompts();

    if (executable.length === 0) {
      return NextResponse.json({
        executed: 0,
        total_eligible: 0,
        results: [],
      });
    }

    // Execute up to MAX_PER_RUN prompts (avoid function timeout)
    const toRun = executable.slice(0, MAX_PER_RUN);
    const results: {
      id: string;
      title: string;
      model: string;
      success: boolean;
      error?: string;
      costCents?: number;
      savingsCents?: number;
    }[] = [];

    for (const prompt of toRun) {
      const result = await executePrompt(prompt.id);
      results.push({
        id: prompt.id,
        title: prompt.title,
        model: prompt.model,
        success: result.success,
        error: result.error,
        costCents: result.costCents,
        savingsCents: result.savingsCents,
      });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      executed: results.length,
      succeeded,
      failed,
      total_eligible: executable.length,
      remaining: Math.max(0, executable.length - MAX_PER_RUN),
      results,
    });
  } catch (err) {
    console.error('[Cron: execute-scheduled] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
