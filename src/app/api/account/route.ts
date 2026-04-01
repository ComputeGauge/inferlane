import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { sendEmail } from '@/lib/email';
import { buildAccountDeletedHtml } from '@/lib/email-templates';

// ---------------------------------------------------------------------------
// GET  /api/account — Get account profile
// PATCH /api/account — Update account settings
// DELETE /api/account — Soft-delete account + cleanup
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        subscription: {
          select: { tier: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
        },
        notificationPrefs: true,
        nodeOperator: {
          select: {
            id: true,
            displayName: true,
            supplierSubscription: {
              select: { tier: true, status: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'GetAccount');
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const rl = await rateLimit(`account-update:${userId}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { name } = body as { name?: string };

    // Only allow updating name for now
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 100) {
        return NextResponse.json({ error: 'Name must be a string under 100 characters' }, { status: 400 });
      }
      updateData.name = name.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ACCOUNT_UPDATED',
        resource: 'account',
        details: updateData as Record<string, string | null>,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'UpdateAccount');
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const rl = await rateLimit(`account-delete:${userId}`, 2, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Confirmation check
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body?.confirm !== 'DELETE_MY_ACCOUNT') {
      return NextResponse.json(
        { error: 'Must send { "confirm": "DELETE_MY_ACCOUNT" } to proceed' },
        { status: 400 },
      );
    }

    // Cancel all active trading orders
    await prisma.computeOrder.updateMany({
      where: { userId, status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      data: { status: 'CANCELLED' },
    });

    // Cancel all open futures
    await prisma.computeFuture.updateMany({
      where: { creatorId: userId, status: { in: ['OPEN'] } },
      data: { status: 'CANCELLED' },
    });

    // Deactivate all API keys
    await prisma.apiKey.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    await prisma.tradingApiKey.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Cancel credit offers + recall pool delegations
    const creditBalance = await prisma.creditBalance.findUnique({ where: { userId } });
    if (creditBalance) {
      await prisma.creditOffer.updateMany({
        where: { sellerId: userId, status: { in: ['ACTIVE', 'PARTIALLY_FILLED'] } },
        data: { status: 'CANCELLED' },
      });

      await prisma.poolDelegation.deleteMany({ where: { userId } });

      await prisma.creditBalance.delete({ where: { userId } });
    }

    // Delete notification preferences
    await prisma.notificationPreferences.deleteMany({ where: { userId } });

    // Send account deletion confirmation email BEFORE anonymizing
    const deletingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (deletingUser?.email) {
      const html = buildAccountDeletedHtml(deletingUser.name || 'there');
      sendEmail({ to: deletingUser.email, subject: 'Account Deleted — InferLane', html }).catch(() => {});
    }

    // Soft-delete: anonymize and mark as deleted
    const anonymizedEmail = `deleted_${userId}@inferlane.ai`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: anonymizedEmail,
        image: null,
        deletedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ACCOUNT_DELETED',
        resource: 'account',
        details: { softDeleted: true },
      },
    });

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'DeleteAccount');
  }
}

export const GET = withTiming(handleGET);
export const PATCH = withTiming(handlePATCH);
export const DELETE = withTiming(handleDELETE);
