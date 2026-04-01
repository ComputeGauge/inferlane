import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// POST /api/nodes/register — Register as a node operator (MCP skill entry point)
// ---------------------------------------------------------------------------
// Accepts capabilities, regions, apiEndpoint, and privacyTier.
// Returns nodeId + heartbeat config for the MCP skill to begin heartbeating.
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const rl = await rateLimit(`node-register:${userId}`, 3, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Check if already registered
    const existing = await prisma.nodeOperator.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json(
        { error: 'Already registered as node operator', nodeId: existing.id },
        { status: 409 },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const {
      displayName,
      apiEndpoint,
      capabilities = {},
      regions = [],
      privacyTier,
    } = body;

    // Validate required fields
    if (!displayName || typeof displayName !== 'string' || displayName.length < 2) {
      return NextResponse.json({ error: 'displayName is required (min 2 chars)' }, { status: 400 });
    }

    if (!Array.isArray(regions) || regions.length === 0) {
      return NextResponse.json({ error: 'At least one region is required' }, { status: 400 });
    }

    if (apiEndpoint && typeof apiEndpoint !== 'string') {
      return NextResponse.json({ error: 'apiEndpoint must be a string URL' }, { status: 400 });
    }

    // Validate privacyTier if provided
    const validTiers = ['TRANSPORT_ONLY', 'BLIND_ROUTING', 'TEE_PREFERRED', 'CONFIDENTIAL'];
    const tier = privacyTier && validTiers.includes(privacyTier) ? privacyTier : 'TRANSPORT_ONLY';

    const node = await prisma.nodeOperator.create({
      data: {
        userId,
        displayName: displayName.trim(),
        apiEndpoint: apiEndpoint || null,
        capabilities: typeof capabilities === 'object' ? capabilities : {},
        regions,
        privacyTier: tier,
      },
    });

    return NextResponse.json(
      {
        nodeId: node.id,
        displayName: node.displayName,
        heartbeatUrl: '/api/nodes/heartbeat',
        heartbeatIntervalMs: 15_000,
        message: 'Node operator registered. Start heartbeating to go online.',
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'NodeRegister');
  }
}

export const POST = withTiming(handlePOST);
