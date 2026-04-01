// ---------------------------------------------------------------------------
// Shared API Error Handler (Stream Y7)
// ---------------------------------------------------------------------------
// Consistent error wrapping for all API routes. Prevents Prisma errors
// and internal details from leaking to clients.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';

// Known Prisma error codes we can translate to user-friendly messages
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: 'A record with this value already exists' },
  P2003: { status: 400, message: 'Referenced record does not exist' },
  P2025: { status: 404, message: 'Record not found' },
};

/**
 * Handle an error in an API route and return a safe NextResponse.
 *
 * Usage:
 * ```ts
 * try { ... } catch (error) {
 *   return handleApiError(error, 'CreateOrder');
 * }
 * ```
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  console.error(`[${context}]`, error);

  // Prisma known request errors
  if (isPrismaKnownError(error)) {
    const mapped = PRISMA_ERROR_MAP[error.code];
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
  }

  // Prisma validation errors (bad input data)
  if (isPrismaValidationError(error)) {
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 },
    );
  }

  // Application-level errors (thrown with new Error('message'))
  if (error instanceof Error) {
    // Only expose message if it looks intentional (not a stack trace or internal)
    const isSafe = !error.message.includes('prisma') &&
                   !error.message.includes('ECONNREFUSED') &&
                   !error.message.includes('timeout') &&
                   error.message.length < 200;

    if (isSafe) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 },
  );
}

// ── Type guards ────────────────────────────────────────────────────────

interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
  name: string;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as PrismaKnownError).code === 'string' &&
    (error as PrismaKnownError).code.startsWith('P')
  );
}

function isPrismaValidationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'PrismaClientValidationError'
  );
}
