import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

// GET /api/gpu/clusters/[clusterId] — cluster detail with recent metrics (last 24h)
async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id as string;
  const { clusterId } = await params;

  const cluster = await prisma.gpuCluster.findUnique({
    where: { id: clusterId },
  });

  if (!cluster || cluster.userId !== userId) {
    return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentMetrics = await prisma.gpuMetric.findMany({
    where: {
      clusterId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'desc' },
  });

  // Group metrics by gpuIndex for the latest snapshot
  const latestByGpu = new Map<number, typeof recentMetrics[0]>();
  for (const m of recentMetrics) {
    if (!latestByGpu.has(m.gpuIndex)) {
      latestByGpu.set(m.gpuIndex, m);
    }
  }

  const heartbeatThreshold = new Date(Date.now() - 5 * 60 * 1000);
  const isOnline = cluster.lastHeartbeat ? cluster.lastHeartbeat > heartbeatThreshold : false;

  // TCO calculations
  const electricityCostPerKwh = cluster.electricityCostPerKwh ? Number(cluster.electricityCostPerKwh) : 0;
  const hardwareCostUsd = cluster.hardwareCostUsd ? Number(cluster.hardwareCostUsd) : 0;
  const amortizationMonths = cluster.amortizationMonths || 36;

  // Estimate monthly electricity from current power draw
  const totalPowerWatts = Array.from(latestByGpu.values()).reduce(
    (sum, m) => sum + (m.powerDrawWatts ? Number(m.powerDrawWatts) : 0),
    0
  );
  const monthlyKwh = (totalPowerWatts / 1000) * 24 * 30; // ~720 hours/month
  const monthlyElectricityCost = monthlyKwh * electricityCostPerKwh;
  const monthlyAmortizedHardware = hardwareCostUsd / amortizationMonths;

  // Total inferences in last 24h
  const totalInferences24h = recentMetrics.reduce(
    (sum, m) => sum + (m.inferenceCount || 0),
    0
  );

  return NextResponse.json({
    id: cluster.id,
    name: cluster.name,
    gpuCount: cluster.gpuCount,
    gpuModel: cluster.gpuModel,
    totalVramGb: cluster.totalVramGb,
    location: cluster.location,
    isOnline,
    lastHeartbeat: cluster.lastHeartbeat,
    agentToken: cluster.agentToken, // full token for agent setup
    electricityCostPerKwh,
    hardwareCostUsd,
    amortizationMonths,
    createdAt: cluster.createdAt,
    tco: {
      monthlyElectricityCost: Math.round(monthlyElectricityCost * 100) / 100,
      monthlyAmortizedHardware: Math.round(monthlyAmortizedHardware * 100) / 100,
      monthlyTotal: Math.round((monthlyElectricityCost + monthlyAmortizedHardware) * 100) / 100,
      totalPowerWatts: Math.round(totalPowerWatts * 100) / 100,
    },
    totalInferences24h,
    gpus: Array.from(latestByGpu.entries()).map(([gpuIndex, m]) => ({
      gpuIndex,
      utilization: Number(m.utilization),
      memoryUsedGb: m.memoryUsedGb ? Number(m.memoryUsedGb) : null,
      memoryTotalGb: m.memoryTotalGb ? Number(m.memoryTotalGb) : null,
      powerDrawWatts: m.powerDrawWatts ? Number(m.powerDrawWatts) : null,
      temperatureC: m.temperatureC ? Number(m.temperatureC) : null,
      inferenceCount: m.inferenceCount,
      costPerToken: m.costPerToken ? Number(m.costPerToken) : null,
      timestamp: m.timestamp,
    })),
    metricsHistory: recentMetrics.map((m) => ({
      gpuIndex: m.gpuIndex,
      utilization: Number(m.utilization),
      powerDrawWatts: m.powerDrawWatts ? Number(m.powerDrawWatts) : null,
      temperatureC: m.temperatureC ? Number(m.temperatureC) : null,
      timestamp: m.timestamp,
    })),
  });
}

// PUT /api/gpu/clusters/[clusterId] — update cluster config
async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id as string;
  const { clusterId } = await params;

  const cluster = await prisma.gpuCluster.findUnique({
    where: { id: clusterId },
  });

  if (!cluster || cluster.userId !== userId) {
    return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowedFields = [
    'name', 'gpuCount', 'gpuModel', 'totalVramGb',
    'electricityCostPerKwh', 'hardwareCostUsd', 'amortizationMonths', 'location',
  ] as const;

  const data: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.gpuCluster.update({
    where: { id: clusterId },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    gpuCount: updated.gpuCount,
    gpuModel: updated.gpuModel,
    totalVramGb: updated.totalVramGb,
    location: updated.location,
    electricityCostPerKwh: updated.electricityCostPerKwh ? Number(updated.electricityCostPerKwh) : null,
    hardwareCostUsd: updated.hardwareCostUsd ? Number(updated.hardwareCostUsd) : null,
    amortizationMonths: updated.amortizationMonths,
  });
}

// DELETE /api/gpu/clusters/[clusterId] — remove cluster and all its metrics
async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id as string;
  const { clusterId } = await params;

  const cluster = await prisma.gpuCluster.findUnique({
    where: { id: clusterId },
  });

  if (!cluster || cluster.userId !== userId) {
    return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
  }

  // Cascade delete handles metrics via onDelete: Cascade in schema
  await prisma.gpuCluster.delete({ where: { id: clusterId } });

  return NextResponse.json({ success: true });
}

export const GET = withTiming(handleGET);
export const PUT = withTiming(handlePUT);
export const DELETE = withTiming(handleDELETE);
