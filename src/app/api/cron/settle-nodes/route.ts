import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPayoutTier } from '@/lib/nodes/dispatch';
import { sendEmail } from '@/lib/email';
import { buildPayoutConfirmationHtml } from '@/lib/email-templates';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';
import { payoutToOperator } from '@/lib/stripe-connect';
import { sanctionsScreener } from '@/lib/compliance/sanctions';

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
  let frozen = 0;

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
        // Sanctions compliance check — freeze payouts to sanctioned regions
        const operatorUser = await prisma.user.findUnique({
          where: { id: node.userId },
          select: { email: true },
        });
        if (operatorUser?.email) {
          const emailCheck = sanctionsScreener.checkEmail(operatorUser.email);
          if (!emailCheck.allowed) {
            console.warn(`[SettleNodes] FROZEN payout for node ${node.id}: ${emailCheck.reason}`);
            await prisma.nodePayout.create({
              data: {
                nodeOperatorId: node.id,
                amount: balance,
                status: 'FROZEN' as any,
                periodStart: node.createdAt,
                periodEnd: now,
                requestCount: 0,
              },
            });
            frozen++;
            continue;
          }
        }
        // Check node regions against sanctions list
        if (node.regions && node.regions.length > 0) {
          const sanctionedRegion = node.regions.find(
            (r: string) => !sanctionsScreener.checkCountry(r).allowed,
          );
          if (sanctionedRegion) {
            console.warn(`[SettleNodes] FROZEN payout for node ${node.id}: sanctioned region ${sanctionedRegion}`);
            await prisma.nodePayout.create({
              data: {
                nodeOperatorId: node.id,
                amount: balance,
                status: 'FROZEN' as any,
                periodStart: node.createdAt,
                periodEnd: now,
                requestCount: 0,
              },
            });
            frozen++;
            continue;
          }
        }

        // Create payout record and attempt Stripe transfer
        let stripeTransferId: string | null = null;
        let payoutStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' = 'PENDING';

        // Attempt Stripe Connect transfer if operator has a connected account
        if (node.stripeAccountId) {
          try {
            const amountCents = Math.round(balance * 100);
            const transfer = await payoutToOperator(
              node.stripeAccountId,
              amountCents,
              `InferLane node payout — ${balance.toFixed(2)} USD`
            );
            stripeTransferId = transfer.id;
            payoutStatus = 'COMPLETED';
          } catch (stripeErr) {
            console.error(`[SettleNodes] Stripe transfer failed for node ${node.id}:`, stripeErr);
            // Fall through to create PENDING payout — operator can withdraw later
            payoutStatus = 'PENDING';
          }
        }
        // If no Connect account, earnings accumulate as PENDING (withdraw later via credit system)

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
              status: payoutStatus,
              stripeTransferId,
              periodStart,
              periodEnd: now,
              requestCount,
              ...(payoutStatus === 'COMPLETED' ? { processedAt: now } : {}),
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
              description: `Payout of $${balance.toFixed(2)} for ${requestCount} requests${stripeTransferId ? ` (Stripe: ${stripeTransferId})` : ' (pending withdrawal)'}`,
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
      frozen,
      operatorsChecked: operators.length,
    });
  } catch (err) {
    console.error('[SettleNodes] Cron error:', err);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}
