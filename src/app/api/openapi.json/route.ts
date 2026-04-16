// GET /api/openapi.json — publish the OpenAPI 3.1 spec as JSON.
//
// ASVS V14.5.1 (API documented). Served from the spec module so
// there's a single source of truth.

import { NextResponse } from 'next/server';
import { OPENAPI_SPEC } from '@/lib/openapi/spec';

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
