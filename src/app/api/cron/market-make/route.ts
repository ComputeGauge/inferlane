import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// POST /api/cron/market-make — Synthetic demand bootstrap
// ---------------------------------------------------------------------------
// Dispatches lightweight inference requests through the exchange to ensure
// early supply-side providers receive traffic. Runs during the bootstrap
// phase (first 30 days post-launch) to solve the cold-start problem.
//
// Cost: ~$5-10/day in real inference. Requests are genuine workloads
// (classification, summarization, embedding) — not fake traffic.
// ---------------------------------------------------------------------------

const BOOTSTRAP_TASKS = [
  {
    model: 'gemma-4-12b',
    prompt: 'Classify the following text as POSITIVE, NEGATIVE, or NEUTRAL: "The quarterly earnings exceeded analyst expectations by 12%, driven by strong cloud revenue growth."',
    maxTokens: 32,
    taskType: 'classification',
  },
  {
    model: 'gemma-4-27b',
    prompt: 'Summarize the key differences between REST and GraphQL APIs in exactly 3 bullet points.',
    maxTokens: 256,
    taskType: 'summarization',
  },
  {
    model: 'gemma-4-12b',
    prompt: 'Extract the company name, revenue, and growth rate from: "Acme Corp reported $2.3B in revenue, up 18% year-over-year in Q3 2026."',
    maxTokens: 128,
    taskType: 'extraction',
  },
  {
    model: 'gemma-4-27b',
    prompt: 'Write a one-paragraph product description for a developer tool that optimizes AI inference costs across multiple providers.',
    maxTokens: 256,
    taskType: 'creative_writing',
  },
  {
    model: 'gemma-4-12b',
    prompt: 'Is the following code snippet a potential SQL injection vulnerability? Answer YES or NO with a one-sentence explanation: `query = f"SELECT * FROM users WHERE id = {user_id}"`',
    maxTokens: 64,
    taskType: 'code_review',
  },
];

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorizedResponse();

  const started = Date.now();

  // Check if bootstrap is still active (first 30 days)
  const bootstrapEndDate = process.env.BOOTSTRAP_END_DATE;
  if (bootstrapEndDate && new Date() > new Date(bootstrapEndDate)) {
    return NextResponse.json({
      ok: true,
      message: 'Bootstrap period ended, skipping market-making',
      dispatched: 0,
      durationMs: Date.now() - started,
    });
  }

  // Pick 2-3 random tasks per run to vary demand patterns
  const shuffled = [...BOOTSTRAP_TASKS].sort(() => Math.random() - 0.5);
  const tasksToRun = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

  const results: Array<{
    model: string;
    taskType: string;
    status: 'dispatched' | 'failed';
    error?: string;
  }> = [];

  for (const task of tasksToRun) {
    try {
      // Route through the exchange — prefer decentralized providers
      const dispatchRes = await fetch(
        `${process.env.APP_URL || 'http://localhost:3000'}/api/dispatch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': process.env.CRON_SECRET || '',
          },
          body: JSON.stringify({
            prompt: task.prompt,
            model: task.model,
            maxTokens: task.maxTokens,
            routing: 'auto',
            priority: 'batch',
            metadata: {
              source: 'market-maker',
              taskType: task.taskType,
              bootstrapRun: true,
            },
          }),
        },
      );

      if (dispatchRes.ok) {
        results.push({ model: task.model, taskType: task.taskType, status: 'dispatched' });
      } else {
        const errText = await dispatchRes.text().catch(() => '');
        results.push({
          model: task.model,
          taskType: task.taskType,
          status: 'failed',
          error: `HTTP ${dispatchRes.status}: ${errText.slice(0, 100)}`,
        });
      }
    } catch (err) {
      results.push({
        model: task.model,
        taskType: task.taskType,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Log to audit for cost tracking
  try {
    await prisma.auditLog.create({
      data: {
        userId: 'system',
        action: 'MARKET_MAKE_RUN',
        resource: 'cron',
        details: {
          dispatched: results.filter((r) => r.status === 'dispatched').length,
          failed: results.filter((r) => r.status === 'failed').length,
          tasks: results,
        },
      },
    });
  } catch {
    // Non-critical — don't fail the cron
  }

  return NextResponse.json({
    ok: true,
    message: `Market-making: dispatched ${results.filter((r) => r.status === 'dispatched').length} tasks`,
    dispatched: results.filter((r) => r.status === 'dispatched').length,
    failed: results.filter((r) => r.status === 'failed').length,
    details: results,
    durationMs: Date.now() - started,
  });
}
