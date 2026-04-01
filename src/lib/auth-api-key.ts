/**
 * Shared API key authentication for InferLane API routes.
 * Supports both NextAuth sessions AND Bearer token auth (il_ prefixed keys).
 * MCP server and SDK clients use Bearer tokens; dashboard uses sessions.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createHash } from 'crypto';

export interface AuthResult {
  userId: string;
  authMethod: 'session' | 'api_key';
  apiKeyId?: string;
}

/**
 * Authenticate a request via session OR Bearer API key.
 * Returns null if neither method succeeds.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult | null> {
  // Try Bearer token first (MCP server, SDK, external integrations)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer il_')) {
    const rawKey = authHeader.slice(7); // Remove "Bearer "
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
    });

    if (!apiKey) return null;

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {}); // Don't block on this

    return { userId: apiKey.userId, authMethod: 'api_key', apiKeyId: apiKey.id };
  }

  // Fall back to NextAuth session (dashboard)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return { userId: session.user.id, authMethod: 'session' };
  }

  return null;
}
