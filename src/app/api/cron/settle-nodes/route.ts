import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPayoutTier } from '@/lib/nodes/dispatch';
import { sendEmail } from '@/lib/email';
import { buildPayoutConfirmationHtml } from '@/lib/email-templates';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// POST /api/cron/settle-nodes — Batch settlement for node operators
// ---------------------------------------------------------------------------
// Converts pendingBalance to NodePayout records.
// In production, each payout triggers a Stripe Connect transfer.
//
// Settlement frequency:
//   < $100 lifetime:   weekly payouts, $5 minimum
//   $100–$1000:        daily payouts,  $1 minimum
//   > $1000:           daily payouts,  $1 minimum
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...

  let payoutsCreated = 0;
  let totalPaidOut = 0;
  let errors = 0;

  try {
    // Find all node operators with pending balance
    const operators = await prisma.nodeOperator.findMany({
      where: {
        payoutEnabled: true,
        pendingBalance: { gt: 0 },
      },
    });

    for (const node of operators) {
      const balance = Number(node.pendingBalance);
      const lifetime = Number(node.lifetimeEarned);
      const tier = getPayoutTier(lifetime);

      // Check frequency eligibility
      if (tier.frequency === 'weekly' && dayOfWeek !== 1) {
        // Weekly payouts only on Monday
        continue;
      }

      // Check minimum
      if (balance < tier.minimumUsd) {
        continue;
      }

      try {
        // Create payout record
        await prisma.$transaction(async (tx) => {
          // Get period for this payout
          const lastPayout = await tx.nodePayout.findFirst({
            where: { nodeOperatorId: node.id, status: 'COMPLETED' },
            orderBy: { periodEnd: 'desc' },
          });

          const periodStart = lastPayout?.periodEnd ?? node.createdAt;

          // Count requests in this period
          const requestCount = await tx.nodeTransaction.count({
            where: {
              nodeOperatorId: node.id,
              type: 'NODE_EARNING',
              createdAt: { gte: periodStart, lte: now },
            },
          });

          // Create payout
          await tx.nodePayout.create({
            data: {
              nodeOperatorId: node.id,
              amount: balance,
              status: 'PENDING', // Would be PROCESSING after Stripe transfer
              periodStart,
              periodEnd: now,
              requestCount,
            },
          });

          // Deduct from pending balance
          const balanceBefore = balance;
          await tx.nodeOperator.update({
            where: { id: node.id },
            data: { pendingBalance: 0 },
          });

          // Create transaction record
          await tx.nodeTransaction.create({
            data: {
              nodeOperatorId: node.id,
              type: 'NODE_PAYOUT',
              amount: balance,
              balanceBefore,
              balanceAfter: 0,
              description: `Payout of $${balance.toFixed(2)} for ${requestCount} requests`,
            },
          });
        });

        payoutsCreated++;
        totalPaidOut += balance;

        // Send payout confirmation email (non-blocking)
        const payoutUser = await prisma.user.findUnique({
          where: { id: node.userId },
          select: { name: true, email: true },
        });
        if (payoutUser?.email) {
          // Check notification preferences
          const prefs = await prisma.notificationPreferences.findUnique({
            where: { userId: node.userId },
            select: { payoutNotifs: true },
          });
          if (!prefs || prefs.payoutNotifs !== false) {
            const requestCount = await prisma.nodeTransaction.count({
              where: { nodeOperatorId: node.id, type: 'NODE_EARNING' },
            });
            const html = buildPayoutConfirmationHtml(payoutUser.name || 'Operator', balance, requestCount);
            sendEmail({ to: payoutUser.email, subject: `Payout Sent: $${balance.toFixed(2)} — InferLane`, html }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[SettleNodes] Failed for node ${node.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      payoutsCreated,
      totalPaidOut: totalPaidOut.toFixed(2),
      errors,
      operatorsChecked: operators.length,
    });
  } catch (err) {
    console.error('[SettleNodes] Cron error:', err);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}
