import { NextResponse } from 'next/server';
import { subnetManager, ALL_SUBNET_TYPES } from '@/lib/nodes/subnets';

// ---------------------------------------------------------------------------
// GET /api/nodes/subnets — List all subnets with health data (public)
// ---------------------------------------------------------------------------

export async function GET() {
  const health = await subnetManager.getSubnetHealth();

  const subnets = ALL_SUBNET_TYPES.map((type) => ({
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1) + ' Subnet',
    ...health[type],
  }));

  return NextResponse.json({ subnets });
}
