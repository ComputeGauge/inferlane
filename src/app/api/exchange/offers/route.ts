import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createOffer,
  listOffers,
} from '@/lib/exchange/offer-manager';
import {
  type CapacityOffer,
  type CreateOfferInput,
  type OfferFilters,
  ProviderType,
  OfferStatus,
  AttestationType,
} from '@/lib/exchange/types';

// ---------------------------------------------------------------------------
// GET /api/exchange/offers — list active offers (public order book)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    const filters: OfferFilters = {};

    if (params.has('model')) filters.model = params.get('model')!;
    if (params.has('providerType')) {
      const pt = params.get('providerType')!.toUpperCase();
      if (Object.values(ProviderType).includes(pt as ProviderType)) {
        filters.providerType = pt as ProviderType;
      }
    }
    if (params.has('status')) {
      const st = params.get('status')!.toUpperCase();
      if (Object.values(OfferStatus).includes(st as OfferStatus)) {
        filters.status = st as OfferStatus;
      }
    }
    if (params.has('minInputPrice')) {
      filters.minInputPrice = Number(params.get('minInputPrice'));
    }
    if (params.has('maxInputPrice')) {
      filters.maxInputPrice = Number(params.get('maxInputPrice'));
    }
    if (params.has('minOutputPrice')) {
      filters.minOutputPrice = Number(params.get('minOutputPrice'));
    }
    if (params.has('maxOutputPrice')) {
      filters.maxOutputPrice = Number(params.get('maxOutputPrice'));
    }
    if (params.get('attestedOnly') === 'true') {
      filters.attestedOnly = true;
    }
    if (params.has('providerId')) {
      filters.providerId = params.get('providerId')!;
    }
    if (params.has('limit')) {
      filters.limit = Math.min(Number(params.get('limit')) || 50, 100);
    }
    if (params.has('offset')) {
      filters.offset = Number(params.get('offset')) || 0;
    }

    const result = await listOffers(filters);

    return NextResponse.json({
      offers: result.offers.map(serializeOffer),
      total: result.total,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/exchange/offers — create a capacity offer (auth required)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate provider type
    const providerType = (body.provider_type as string || '').toUpperCase();
    if (!Object.values(ProviderType).includes(providerType as ProviderType)) {
      return NextResponse.json(
        { error: `provider_type must be one of: ${Object.values(ProviderType).join(', ')}` },
        { status: 400 },
      );
    }

    // Validate attestation type if provided
    if (body.attestation_type) {
      const at = (body.attestation_type as string).toUpperCase();
      if (!Object.values(AttestationType).includes(at as AttestationType)) {
        return NextResponse.json(
          { error: `attestation_type must be one of: ${Object.values(AttestationType).join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Look up the operator record for this user
    const { prisma } = await import('@/lib/db');
    const operator = await (prisma as any).nodeOperator.findUnique({
      where: { userId: session.user.id },
    });

    if (!operator) {
      return NextResponse.json(
        { error: 'You must be a registered operator to create offers. Register at /api/nodes/register first.' },
        { status: 403 },
      );
    }

    const input: CreateOfferInput = {
      providerId: operator.id,
      providerType: providerType as ProviderType,
      model: body.model as string,
      maxTokensPerSec: Number(body.max_tokens_per_sec),
      maxConcurrent: Number(body.max_concurrent),
      gpuType: body.gpu_type as string | undefined,
      memoryGb: body.memory_gb ? Number(body.memory_gb) : undefined,
      inputPricePerMtok: Number(body.input_price_per_mtok),
      outputPricePerMtok: Number(body.output_price_per_mtok),
      minimumSpend: body.minimum_spend ? Number(body.minimum_spend) : undefined,
      availableFrom: body.available_from as string,
      availableUntil: body.available_until as string,
      timezone: body.timezone as string | undefined,
      recurringCron: body.recurring_cron as string | undefined,
      attestationType: body.attestation_type
        ? (body.attestation_type as string).toUpperCase() as AttestationType
        : undefined,
      attestationHash: body.attestation_hash as string | undefined,
    };

    const offer = await createOffer(input);

    return NextResponse.json(
      { offer: serializeOffer(offer) },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.startsWith('Validation failed') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ---------------------------------------------------------------------------
// Serialize offer to snake_case JSON for API response
// ---------------------------------------------------------------------------

function serializeOffer(offer: CapacityOffer) {
  return {
    id: offer.id,
    provider_id: offer.providerId,
    provider_type: offer.providerType,
    model: offer.model,
    max_tokens_per_sec: offer.maxTokensPerSec,
    max_concurrent: offer.maxConcurrent,
    gpu_type: offer.gpuType,
    memory_gb: offer.memoryGb,
    input_price_per_mtok: offer.inputPricePerMtok,
    output_price_per_mtok: offer.outputPricePerMtok,
    minimum_spend: offer.minimumSpend,
    available_from: offer.availableFrom.toISOString(),
    available_until: offer.availableUntil.toISOString(),
    timezone: offer.timezone,
    recurring_cron: offer.recurringCron,
    attestation_type: offer.attestationType,
    last_attestation: offer.lastAttestation?.toISOString() ?? null,
    attestation_hash: offer.attestationHash,
    status: offer.status,
    utilization_pct: offer.utilizationPct,
    created_at: offer.createdAt.toISOString(),
    updated_at: offer.updatedAt.toISOString(),
  };
}
