import { NextRequest, NextResponse } from 'next/server';
import { proofOfExecution } from '@/lib/nodes/proof-of-execution';

// ---------------------------------------------------------------------------
// GET /api/nodes/proofs — List execution proofs (public, no auth required)
// ---------------------------------------------------------------------------
// Query params:
//   nodeId  — filter proofs by node (optional)
//   limit   — max proofs to return (default 50, max 200)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get('nodeId') ?? undefined;
  const limitStr = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 200);

  const proofs = proofOfExecution.getProofs(nodeId, limit);

  return NextResponse.json({
    proofs: proofs.map((p) => ({
      proofId: p.proofId,
      nodeId: p.nodeId,
      requestHash: p.requestHash,
      responseHash: p.responseHash,
      modelClaimed: p.modelClaimed,
      timestamp: p.timestamp.toISOString(),
      latencyMs: p.latencyMs,
      tokensGenerated: p.tokensGenerated,
      challengeResponse: p.challengeResponse,
      fingerprintScore: p.fingerprintScore,
      consistencyScore: p.consistencyScore,
      previousProofHash: p.previousProofHash,
      proofHash: p.proofHash,
      signature: p.signature,
    })),
    count: proofs.length,
    nodeId: nodeId ?? null,
  });
}
