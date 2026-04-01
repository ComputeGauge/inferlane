import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncProvider } from '@/lib/provider-sync';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

/**
 * POST /api/cron/sync-usage — Sync usage data from all active provider connections.
 *
 * Runs daily via external cron. For each active ProviderConnection with an encrypted
 * API key, calls the provider's usage API and upserts SpendSnapshot + UsageRecord rows.
 *
 * Secured by CRON_SECRET header (same as digest cron).
 */
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  // Default to yesterday (completed day) unless specified
  const body = await req.json().catch(() => ({})) as { date?: string };
  const syncDate = body.date || new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  try {
    const connections = await prisma.providerConnection.findMany({
      where: {
        isActive: true,
        encryptedApiKey: { not: null },
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        encryptedApiKey: true,
      },
    });

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      if (!conn.encryptedApiKey) {
        skipped++;
        continue;
      }

      const result = await syncProvider({
        connectionId: conn.id,
        provider: conn.provider,
        encryptedApiKey: conn.encryptedApiKey,
        date: syncDate,
      });

      // Update sync status on the connection
      await prisma.providerConnection.update({
        where: { id: conn.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: result.success ? 'SUCCESS' : 'ERROR',
          syncError: result.error || null,
        },
      });

      if (!result.success) {
        failed++;
        errors.push(`${conn.provider}[${conn.id.slice(0, 8)}]: ${result.error}`);
        continue;
      }

      // Upsert SpendSnapshot for this provider + date
      if (result.totalSpend > 0 || result.lines.length > 0) {
        const modelBreakdown: Record<string, { spend: number; tokens: number; requests: number }> = {};
        let totalTokens = 0;
        let totalRequests = 0;

        for (const line of result.lines) {
          modelBreakdown[line.model] = {
            spend: line.costUsd,
            tokens: line.totalTokens,
            requests: line.requestCount,
          };
          totalTokens += line.totalTokens;
          totalRequests += line.requestCount;
        }

        // Find existing snapshot for this provider+date, update or create
        const existing = await prisma.spendSnapshot.findFirst({
          where: { providerConnectionId: conn.id, period: syncDate },
        });

        const snapshotData = {
          totalSpend: result.totalSpend,
          tokenCount: totalTokens,
          requestCount: totalRequests,
          modelBreakdown: Object.keys(modelBreakdown).length > 0 ? modelBreakdown : undefined,
        };

        if (existing) {
          await prisma.spendSnapshot.update({
            where: { id: existing.id },
            data: snapshotData,
          });
        } else {
          await prisma.spendSnapshot.create({
            data: {
              userId: conn.userId,
              providerConnectionId: conn.id,
              period: syncDate,
              periodType: 'DAILY',
              ...snapshotData,
            },
          });
        }

        // Write individual usage records
        for (const line of result.lines) {
          await prisma.usageRecord.create({
            data: {
              providerConnectionId: conn.id,
              model: line.model,
              inputTokens: line.inputTokens,
              outputTokens: line.outputTokens,
              totalTokens: line.totalTokens,
              costUsd: line.costUsd,
              requestType: 'sync',
              timestamp: new Date(`${syncDate}T23:59:59Z`),
            },
          });
        }
      }

      synced++;
    }

    return NextResponse.json({
      date: syncDate,
      connections: connections.length,
      synced,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[Sync Usage] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
