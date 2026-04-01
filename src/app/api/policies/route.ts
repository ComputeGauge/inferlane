import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTiming } from '@/lib/api-timing';
import { rateLimit } from '@/lib/rate-limit';
import { policyEngine, type RoutingPolicy } from '@/lib/proxy/policy-engine';

// ---------------------------------------------------------------------------
// GET /api/policies — list all routing policies
// ---------------------------------------------------------------------------

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const policies = policyEngine.listPolicies();
  return NextResponse.json({ policies });
}

// ---------------------------------------------------------------------------
// POST /api/policies — add a new routing policy
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 10 per minute
  const rl = await rateLimit(`policies:${session.user.id}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  let body: RoutingPolicy;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.id || !body.name || !body.action || !Array.isArray(body.conditions)) {
    return NextResponse.json(
      { error: 'Missing required fields: id, name, action, conditions' },
      { status: 400 },
    );
  }

  // Prevent builtin: prefix
  if (body.id.startsWith('builtin:')) {
    return NextResponse.json(
      { error: 'Cannot create policies with builtin: prefix' },
      { status: 400 },
    );
  }

  // Ensure defaults
  const policy: RoutingPolicy = {
    id: body.id,
    name: body.name,
    description: body.description ?? '',
    priority: body.priority ?? 100,
    enabled: body.enabled ?? true,
    conditions: body.conditions,
    action: body.action,
  };

  try {
    policyEngine.addPolicy(policy);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add policy' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, policy }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/policies — remove a policy by id (passed as query param)
// ---------------------------------------------------------------------------

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 });
  }

  try {
    policyEngine.removePolicy(id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove policy' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, removed: id });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const DELETE = withTiming(handleDELETE);
