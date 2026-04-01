import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

interface GpuMetricPayload {
  gpuIndex: number;
  utilization: number;
  memoryUsedGb?: number;
  memoryTotalGb?: number;
  powerDrawWatts?: number;
  temperatureC?: number;
  inferenceCount?: number;
}

// POST /api/gpu/metrics — ingest GPU metrics from Docker agent
// Auth: agentToken in Authorization header (Bearer <token>)
async function handlePOST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const agentToken = authHeader.slice(7);
  if (!agentToken || agentToken.length < 32) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 });
  }

  // Look up cluster by agentToken
  const cluster = await prisma.gpuCluster.findUnique({
    where: { agentToken },
  });

  if (!cluster) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { metrics } = body;
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return NextResponse.json({ error: 'metrics array is required' }, { status: 400 });
  }
  if (metrics.length > 256) {
    return NextResponse.json({ error: 'Maximum 256 GPU metrics per request' }, { status: 400 });
  }

  // Cost calculation inputs
  const electricityCostPerKwh = cluster.electricityCostPerKwh ? Number(cluster.electricityCostPerKwh) : 0;
  const hardwareCostUsd = cluster.hardwareCostUsd ? Number(cluster.hardwareCostUsd) : 0;
  const amortizationMonths = cluster.amortizationMonths || 36;
  // Amortized hardware cost per hour per GPU
  const hardwareCostPerHourPerGpu =
    cluster.gpuCount > 0 ? hardwareCostUsd / amortizationMonths / 720 / cluster.gpuCount : 0;

  const created: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i] as GpuMetricPayload;

    if (typeof m.gpuIndex !== 'number' || m.gpuIndex < 0) {
      errors.push(`metrics[${i}]: gpuIndex must be a non-negative integer`);
      continue;
    }
    if (typeof m.utilization !== 'number' || m.utilization < 0 || m.utilization > 100) {
      errors.push(`metrics[${i}]: utilization must be between 0 and 100`);
      continue;
    }

    // Calculate cost per token
    // Total cost/hour for this GPU = electricity + amortized hardware
    const powerKw = (m.powerDrawWatts || 0) / 1000;
    const electricityCostPerHour = powerKw * electricityCostPerKwh;
    const totalCostPerHour = electricityCostPerHour + hardwareCostPerHourPerGpu;

    // Cost per token: total_cost_per_second / tokens_per_second
    // We approximate tokens/sec from inferenceCount (assumed per reporting interval ~60s)
    let costPerToken: number | null = null;
    if (m.inferenceCount && m.inferenceCount > 0) {
      // Assume each inference ~= 1 token output for cost approximation
      // Cost per second / inferences per second (assuming 60s interval)
      const costPerSecond = totalCostPerHour / 3600;
      const tokensPerSecond = m.inferenceCount / 60;
      costPerToken = tokensPerSecond > 0 ? costPerSecond / tokensPerSecond : null;
    }

    const metric = await prisma.gpuMetric.create({
      data: {
        clusterId: cluster.id,
        gpuIndex: m.gpuIndex,
        utilization: m.utilization,
        memoryUsedGb: m.memoryUsedGb ?? null,
        memoryTotalGb: m.memoryTotalGb ?? null,
        powerDrawWatts: m.powerDrawWatts ?? null,
        temperatureC: m.temperatureC ?? null,
        inferenceCount: m.inferenceCount ?? null,
        costPerToken: costPerToken,
      },
    });

    created.push(metric.id);
  }

  // Update cluster heartbeat and online status
  await prisma.gpuCluster.update({
    where: { id: cluster.id },
    data: {
      lastHeartbeat: new Date(),
      isOnline: true,
    },
  });

  return NextResponse.json({
    accepted: created.length,
    rejected: errors.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}

export const POST = withTiming(handlePOST);
