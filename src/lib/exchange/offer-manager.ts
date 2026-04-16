// ---------------------------------------------------------------------------
// Offer Manager — CRUD operations for capacity offers on the exchange
// ---------------------------------------------------------------------------
// Uses dynamic import for prisma so the module is testable without a live DB.
// All public methods are async and return structured results or throw on
// validation failures.
// ---------------------------------------------------------------------------

import {
  type CapacityOffer,
  type CreateOfferInput,
  type UpdateOfferInput,
  type OfferFilters,
  OfferStatus,
  ProviderType,
  AttestationType,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function db() {
  const { prisma } = await import('@/lib/db');
  return prisma;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateCreateInput(input: CreateOfferInput): string[] {
  const errors: string[] = [];

  if (!input.providerId || typeof input.providerId !== 'string') {
    errors.push('providerId is required');
  }
  if (!Object.values(ProviderType).includes(input.providerType)) {
    errors.push(`providerType must be one of: ${Object.values(ProviderType).join(', ')}`);
  }
  if (!input.model || typeof input.model !== 'string') {
    errors.push('model is required');
  }
  if (typeof input.maxTokensPerSec !== 'number' || input.maxTokensPerSec <= 0) {
    errors.push('maxTokensPerSec must be a positive number');
  }
  if (typeof input.maxConcurrent !== 'number' || input.maxConcurrent <= 0) {
    errors.push('maxConcurrent must be a positive integer');
  }
  if (typeof input.inputPricePerMtok !== 'number' || input.inputPricePerMtok < 0) {
    errors.push('inputPricePerMtok must be >= 0');
  }
  if (typeof input.outputPricePerMtok !== 'number' || input.outputPricePerMtok < 0) {
    errors.push('outputPricePerMtok must be >= 0');
  }

  const from = toDate(input.availableFrom);
  const until = toDate(input.availableUntil);
  if (isNaN(from.getTime())) {
    errors.push('availableFrom is not a valid date');
  }
  if (isNaN(until.getTime())) {
    errors.push('availableUntil is not a valid date');
  }
  if (!isNaN(from.getTime()) && !isNaN(until.getTime()) && until <= from) {
    errors.push('availableUntil must be after availableFrom');
  }

  if (input.attestationType && !Object.values(AttestationType).includes(input.attestationType)) {
    errors.push(`attestationType must be one of: ${Object.values(AttestationType).join(', ')}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createOffer(input: CreateOfferInput): Promise<CapacityOffer> {
  const errors = validateCreateInput(input);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const prisma = await db();

  const record = await (prisma as any).capacityOffer.create({
    data: {
      providerId: input.providerId,
      providerType: input.providerType,
      model: input.model,
      maxTokensPerSec: input.maxTokensPerSec,
      maxConcurrent: input.maxConcurrent,
      gpuType: input.gpuType ?? null,
      memoryGb: input.memoryGb ?? null,
      inputPricePerMtok: input.inputPricePerMtok,
      outputPricePerMtok: input.outputPricePerMtok,
      minimumSpend: input.minimumSpend ?? 0,
      availableFrom: toDate(input.availableFrom),
      availableUntil: toDate(input.availableUntil),
      timezone: input.timezone ?? 'UTC',
      recurringCron: input.recurringCron ?? null,
      attestationType: input.attestationType ?? null,
      attestationHash: input.attestationHash ?? null,
      lastAttestation: input.attestationType ? new Date() : null,
      status: OfferStatus.ACTIVE,
      utilizationPct: 0,
    },
  });

  return mapRecord(record);
}

// ---------------------------------------------------------------------------
// List with filters
// ---------------------------------------------------------------------------

export async function listOffers(filters: OfferFilters = {}): Promise<{
  offers: CapacityOffer[];
  total: number;
}> {
  const prisma = await db();
  const where: Record<string, unknown> = {};

  // Default: only active offers
  where.status = filters.status ?? OfferStatus.ACTIVE;

  if (filters.model) {
    where.model = { contains: filters.model, mode: 'insensitive' };
  }
  if (filters.providerType) {
    where.providerType = filters.providerType;
  }
  if (filters.providerId) {
    where.providerId = filters.providerId;
  }
  if (filters.attestedOnly) {
    where.attestationType = { not: null };
  }

  // Price range filters
  if (filters.minInputPrice !== undefined || filters.maxInputPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (filters.minInputPrice !== undefined) priceFilter.gte = filters.minInputPrice;
    if (filters.maxInputPrice !== undefined) priceFilter.lte = filters.maxInputPrice;
    where.inputPricePerMtok = priceFilter;
  }
  if (filters.minOutputPrice !== undefined || filters.maxOutputPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (filters.minOutputPrice !== undefined) priceFilter.gte = filters.minOutputPrice;
    if (filters.maxOutputPrice !== undefined) priceFilter.lte = filters.maxOutputPrice;
    where.outputPricePerMtok = priceFilter;
  }

  // Only include offers that are currently available (window check)
  const now = new Date();
  where.availableFrom = { lte: now };
  where.availableUntil = { gte: now };

  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  const [records, total] = await Promise.all([
    (prisma as any).capacityOffer.findMany({
      where,
      orderBy: { inputPricePerMtok: 'asc' },
      take: limit,
      skip: offset,
    }),
    (prisma as any).capacityOffer.count({ where }),
  ]);

  return {
    offers: records.map(mapRecord),
    total,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateOffer(
  offerId: string,
  updates: UpdateOfferInput,
): Promise<CapacityOffer> {
  const prisma = await db();

  // Verify the offer exists and is not withdrawn
  const existing = await (prisma as any).capacityOffer.findUnique({
    where: { id: offerId },
  });

  if (!existing) {
    throw new Error(`Offer not found: ${offerId}`);
  }
  if (existing.status === OfferStatus.WITHDRAWN) {
    throw new Error('Cannot update a withdrawn offer');
  }

  const data: Record<string, unknown> = {};

  if (updates.inputPricePerMtok !== undefined) data.inputPricePerMtok = updates.inputPricePerMtok;
  if (updates.outputPricePerMtok !== undefined) data.outputPricePerMtok = updates.outputPricePerMtok;
  if (updates.minimumSpend !== undefined) data.minimumSpend = updates.minimumSpend;
  if (updates.maxTokensPerSec !== undefined) data.maxTokensPerSec = updates.maxTokensPerSec;
  if (updates.maxConcurrent !== undefined) data.maxConcurrent = updates.maxConcurrent;
  if (updates.availableFrom !== undefined) data.availableFrom = toDate(updates.availableFrom);
  if (updates.availableUntil !== undefined) data.availableUntil = toDate(updates.availableUntil);
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.utilizationPct !== undefined) data.utilizationPct = updates.utilizationPct;

  const record = await (prisma as any).capacityOffer.update({
    where: { id: offerId },
    data,
  });

  return mapRecord(record);
}

// ---------------------------------------------------------------------------
// Withdraw (soft delete)
// ---------------------------------------------------------------------------

export async function withdrawOffer(offerId: string): Promise<CapacityOffer> {
  const prisma = await db();

  const existing = await (prisma as any).capacityOffer.findUnique({
    where: { id: offerId },
  });
  if (!existing) {
    throw new Error(`Offer not found: ${offerId}`);
  }

  const record = await (prisma as any).capacityOffer.update({
    where: { id: offerId },
    data: { status: OfferStatus.WITHDRAWN },
  });

  return mapRecord(record);
}

// ---------------------------------------------------------------------------
// Expire stale offers (cron-callable)
// ---------------------------------------------------------------------------

export async function expireStaleOffers(): Promise<number> {
  const prisma = await db();
  const now = new Date();

  const result = await (prisma as any).capacityOffer.updateMany({
    where: {
      status: { in: [OfferStatus.ACTIVE, OfferStatus.PAUSED] },
      availableUntil: { lt: now },
    },
    data: { status: OfferStatus.EXPIRED },
  });

  return result.count ?? 0;
}

// ---------------------------------------------------------------------------
// Record mapper — Prisma record -> CapacityOffer interface
// ---------------------------------------------------------------------------

function mapRecord(record: any): CapacityOffer {
  return {
    id: record.id,
    providerId: record.providerId,
    providerType: record.providerType as ProviderType,
    model: record.model,
    maxTokensPerSec: record.maxTokensPerSec,
    maxConcurrent: record.maxConcurrent,
    gpuType: record.gpuType ?? null,
    memoryGb: record.memoryGb ?? null,
    inputPricePerMtok: Number(record.inputPricePerMtok),
    outputPricePerMtok: Number(record.outputPricePerMtok),
    minimumSpend: Number(record.minimumSpend),
    availableFrom: new Date(record.availableFrom),
    availableUntil: new Date(record.availableUntil),
    timezone: record.timezone,
    recurringCron: record.recurringCron ?? null,
    attestationType: record.attestationType ?? null,
    lastAttestation: record.lastAttestation ? new Date(record.lastAttestation) : null,
    attestationHash: record.attestationHash ?? null,
    status: record.status as OfferStatus,
    utilizationPct: record.utilizationPct,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}
