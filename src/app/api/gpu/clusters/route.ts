import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import crypto from 'crypto';

// GET /api/gpu/clusters — list user's GPU clusters with latest metrics
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id as string;

  const clusters = await prisma.gpuCluster.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      metrics: {
        orderBy: { timestamp: 'desc' },
        take: 1, // latest metric per cluster (one row — we aggregate per-GPU below)
        distinct: ['gpuIndex'],
      },
    },
  });

  // For each cluster, fetch the latest metric per GPU to compute averages
  const enriched = await Promise.all(
    clusters.map(async (cluster) => {
      const latestPerGpu = await prisma.gpuMetric.findMany({
        where: { clusterId: cluster.id },
        orderBy: { timestamp: 'desc' },
        distinct: ['gpuIndex'],
      });

      const avgUtilization =
        latestPerGpu.length > 0
          ? latestPerGpu.reduce((sum, m) => sum + Number(m.utilization), 0) / latestPerGpu.length
          : null;

      const latestCostPerToken =
        latestPerGpu.length > 0 && latestPerGpu[0].costPerToken
          ? Number(latestPerGpu[0].costPerToken)
          : null;

      const now = new Date();
      const heartbeatThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const isOnline = cluster.lastHeartbeat ? cluster.lastHeartbeat > heartbeatThreshold : false;

      return {
        id: cluster.id,
        name: cluster.name,
        gpuCount: cluster.gpuCount,
        gpuModel: cluster.gpuModel,
        totalVramGb: cluster.totalVramGb,
        location: cluster.location,
        isOnline,
        lastHeartbeat: cluster.lastHeartbeat,
        avgUtilization: avgUtilization !== null ? Math.round(avgUtilization * 100) / 100 : null,
        costPerToken: latestCostPerToken,
        createdAt: cluster.createdAt,
      };
    })
  );

  return NextResponse.json(enriched);
}

// POST /api/gpu/clusters — register a new GPU cluster
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id as string;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, gpuCount, gpuModel, totalVramGb, electricityCostPerKwh, hardwareCostUsd, amortizationMonths, location } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!gpuCount || typeof gpuCount !== 'number' || gpuCount < 1) {
    return NextResponse.json({ error: 'gpuCount must be a positive integer' }, { status: 400 });
  }

  // Limit clusters per user
  const clusterCount = await prisma.gpuCluster.count({ where: { userId } });
  if (clusterCount >= 50) {
    return NextResponse.json({ error: 'Maximum 50 GPU clusters per account' }, { status: 400 });
  }

  const agentToken = crypto.randomBytes(32).toString('hex');

  const cluster = await prisma.gpuCluster.create({
    data: {
      userId,
      name,
      agentToken,
      gpuCount,
      gpuModel: gpuModel || null,
      totalVramGb: totalVramGb || null,
      electricityCostPerKwh: electricityCostPerKwh ?? null,
      hardwareCostUsd: hardwareCostUsd ?? null,
      amortizationMonths: amortizationMonths ?? 36,
      location: location || null,
    },
  });

  return NextResponse.json(
    {
      id: cluster.id,
      name: cluster.name,
      agentToken, // returned once at creation
      gpuCount: cluster.gpuCount,
      gpuModel: cluster.gpuModel,
      location: cluster.location,
      createdAt: cluster.createdAt,
    },
    { status: 201 }
  );
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
