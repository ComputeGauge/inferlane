import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';
import { withTiming } from '@/lib/api-timing';
import { sendEmail } from '@/lib/email';
import { buildSubscriptionUpgradeHtml } from '@/lib/email-templates';

const TIER_PRICING: Record<string, number> = {
  FREE: 0,
  PRO: 9,
  HYBRID: 29,
  TEAM: 49,
  ENTERPRISE: 99,
};

// Disable body parsing — Stripe needs raw body for signature verification
export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        const subscriptionType = session.metadata?.subscriptionType;

        if (userId && tier) {
          if (subscriptionType === 'supplier') {
            // Supplier (node operator) subscription checkout
            const nodeOperatorId = session.metadata?.nodeOperatorId;
            if (nodeOperatorId) {
              await prisma.supplierSubscription.upsert({
                where: { nodeOperatorId },
                create: {
                  nodeOperatorId,
                  tier: tier as 'PROFESSIONAL' | 'ENTERPRISE',
                  stripeSubscriptionId: session.subscription as string,
                  status: 'ACTIVE',
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
                update: {
                  tier: tier as 'PROFESSIONAL' | 'ENTERPRISE',
                  stripeSubscriptionId: session.subscription as string,
                  status: 'ACTIVE',
                },
              });

              await prisma.auditLog.create({
                data: {
                  userId,
                  action: 'SUPPLIER_SUBSCRIPTION_UPGRADED',
                  resource: 'supplier_subscription',
                  details: { tier, nodeOperatorId, sessionId: session.id },
                },
              });

              console.log(`[Stripe] Supplier subscription upgraded: node ${nodeOperatorId} → ${tier}`);
            }
          } else {
            // Buyer subscription checkout (existing flow)
            await prisma.subscription.update({
              where: { userId },
              data: {
                stripeSubscriptionId: session.subscription as string,
                tier: tier as 'PRO' | 'HYBRID' | 'TEAM' | 'ENTERPRISE',
                status: 'ACTIVE',
              },
            });

            await prisma.auditLog.create({
              data: {
                userId,
                action: 'SUBSCRIPTION_UPGRADED',
                resource: 'subscription',
                details: { tier, sessionId: session.id },
              },
            });

            // Send upgrade confirmation email
            const upgradeUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true, email: true },
            });
            if (upgradeUser?.email) {
              const html = buildSubscriptionUpgradeHtml(upgradeUser.name || 'there', tier);
              sendEmail({ to: upgradeUser.email, subject: `Welcome to ${tier.charAt(0) + tier.slice(1).toLowerCase()}! — InferLane`, html }).catch(() => {});
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subAny = sub as any;

        // Check if this is a supplier subscription
        const supplierSub = await prisma.supplierSubscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (supplierSub) {
          await prisma.supplierSubscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: mapStripeStatus(sub.status),
              ...(subAny.current_period_start && {
                currentPeriodStart: new Date(subAny.current_period_start * 1000),
              }),
              ...(subAny.current_period_end && {
                currentPeriodEnd: new Date(subAny.current_period_end * 1000),
              }),
            },
          });
        } else {
          // Buyer subscription
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: sub.id },
          });

          if (dbSub) {
            await prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data: {
                status: mapStripeStatus(sub.status),
                ...(subAny.current_period_start && {
                  currentPeriodStart: new Date(subAny.current_period_start * 1000),
                }),
                ...(subAny.current_period_end && {
                  currentPeriodEnd: new Date(subAny.current_period_end * 1000),
                }),
                cancelAtPeriodEnd: subAny.cancel_at_period_end ?? false,
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string | null;

        if (subscriptionId) {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });

          if (dbSub && dbSub.tier !== 'FREE') {
            const userId = dbSub.userId;
            const creditAmount = TIER_PRICING[dbSub.tier] ?? 0;

            if (creditAmount > 0) {
              const now = new Date();
              const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

              const existingBalance = await prisma.creditBalance.findUnique({
                where: { userId },
              });
              const availBefore = existingBalance ? Number(existingBalance.available) : 0;

              await prisma.creditBalance.upsert({
                where: { userId },
                create: {
                  userId,
                  totalAllocated: creditAmount,
                  available: creditAmount,
                  delegatedToPool: 0,
                  listedOnMarket: 0,
                  earned: 0,
                  autoDelegate: false,
                  autoDelegatePct: 0,
                  periodStart,
                  periodEnd,
                },
                update: {
                  totalAllocated: creditAmount,
                  available: creditAmount,
                  periodStart,
                  periodEnd,
                },
              });

              await prisma.creditTransaction.create({
                data: {
                  userId,
                  type: 'ALLOCATION',
                  amount: creditAmount,
                  balanceBefore: availBefore,
                  balanceAfter: creditAmount,
                  description: `Payment received — allocated ${creditAmount} credits for ${dbSub.tier} tier`,
                },
              });

              console.log(`[Credits] Allocated ${creditAmount} credits for user ${userId}`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        // Check if this is a supplier subscription cancellation
        const cancelledSupplierSub = await prisma.supplierSubscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (cancelledSupplierSub) {
          await prisma.supplierSubscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              tier: 'STARTER',
              status: 'CANCELED',
              stripeSubscriptionId: null,
            },
          });
          console.log(`[Stripe] Supplier subscription cancelled: node ${cancelledSupplierSub.nodeOperatorId} → STARTER`);
          break;
        }

        // Buyer subscription cancellation (existing flow)
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            tier: 'FREE',
            status: 'CANCELED',
            stripeSubscriptionId: null,
            stripePriceId: null,
          },
        });

        // Credit cleanup on cancellation
        const cancelledSub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: sub.customer as string },
        });

        if (cancelledSub) {
          const userId = cancelledSub.userId;
          const balance = await prisma.creditBalance.findUnique({ where: { userId } });

          if (balance) {
            // Cancel all active offers — return credits via MARKET_DELIST
            const activeOffers = await prisma.creditOffer.findMany({
              where: { sellerId: userId, status: { in: ['ACTIVE', 'PARTIALLY_FILLED'] } },
            });

            for (const offer of activeOffers) {
              const remaining = Number(offer.amount) - Number(offer.filledAmount);
              if (remaining > 0) {
                const currentBal = await prisma.creditBalance.findUnique({ where: { userId } });
                const availBefore = Number(currentBal!.available);

                await prisma.creditBalance.update({
                  where: { userId },
                  data: {
                    available: { increment: remaining },
                    listedOnMarket: { decrement: remaining },
                  },
                });

                await prisma.creditTransaction.create({
                  data: {
                    userId,
                    type: 'MARKET_DELIST',
                    amount: remaining,
                    balanceBefore: availBefore,
                    balanceAfter: availBefore + remaining,
                    description: `Delisted ${remaining} credits — subscription cancelled`,
                  },
                });
              }

              await prisma.creditOffer.update({
                where: { id: offer.id },
                data: { status: 'CANCELLED' },
              });
            }

            // Recall all pool delegations
            const delegations = await prisma.poolDelegation.findMany({
              where: { userId },
            });

            for (const delegation of delegations) {
              const delegatedAmount = Number(delegation.amount);
              if (delegatedAmount > 0) {
                const currentBal = await prisma.creditBalance.findUnique({ where: { userId } });
                const availBefore = Number(currentBal!.available);

                await prisma.creditBalance.update({
                  where: { userId },
                  data: {
                    available: { increment: delegatedAmount },
                    delegatedToPool: { decrement: delegatedAmount },
                  },
                });

                await prisma.creditTransaction.create({
                  data: {
                    userId,
                    type: 'POOL_RECALL',
                    amount: delegatedAmount,
                    balanceBefore: availBefore,
                    balanceAfter: availBefore + delegatedAmount,
                    poolCycleId: delegation.poolCycleId,
                    description: `Recalled ${delegatedAmount} credits from pool — subscription cancelled`,
                  },
                });
              }

              await prisma.poolDelegation.delete({ where: { id: delegation.id } });
            }

            // Expire remaining balance
            const finalBalance = await prisma.creditBalance.findUnique({ where: { userId } });
            const finalAvailable = Number(finalBalance!.available);

            if (finalAvailable > 0) {
              await prisma.creditTransaction.create({
                data: {
                  userId,
                  type: 'EXPIRY',
                  amount: finalAvailable,
                  balanceBefore: finalAvailable,
                  balanceAfter: 0,
                  description: `Expired ${finalAvailable} credits — subscription cancelled`,
                },
              });
            }

            // Delete the CreditBalance record
            await prisma.creditBalance.delete({ where: { userId } });

            console.log(`[Credits] Cleaned up credits for cancelled user ${userId}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string | null;
        if (subscriptionId) {
          // Try supplier subscription first
          const failedSupplierSub = await prisma.supplierSubscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });
          if (failedSupplierSub) {
            await prisma.supplierSubscription.update({
              where: { stripeSubscriptionId: subscriptionId },
              data: { status: 'PAST_DUE' },
            });
          } else {
            await prisma.subscription.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: { status: 'PAST_DUE' },
            });
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export const POST = withTiming(handlePOST);

function mapStripeStatus(status: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE' {
  switch (status) {
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled': return 'CANCELED';
    case 'trialing': return 'TRIALING';
    case 'incomplete': return 'INCOMPLETE';
    default: return 'ACTIVE';
  }
}
