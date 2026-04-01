// Prisma client singleton for Next.js
// Deferred initialization — only connects when a query is actually made
// This prevents build-time connection failures on Vercel

import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  _prismaInstance: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || '';
  const logConfig = process.env.NODE_ENV === 'development' ? ['query' as const] : [];

  // Accelerate URL
  if (dbUrl.startsWith('prisma+postgres://') || dbUrl.startsWith('prisma://')) {
    return new PrismaClient({
      accelerateUrl: dbUrl,
      log: logConfig,
    });
  }

  // Neon serverless adapter
  if (dbUrl) {
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const adapter = new PrismaNeon({ connectionString: dbUrl });
    return new PrismaClient({
      adapter,
      log: logConfig,
    }) as unknown as PrismaClient;
  }

  // No URL — will throw on first query, but allows build to complete
  throw new Error('DATABASE_URL not configured');
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma._prismaInstance) {
    globalForPrisma._prismaInstance = createClient();
  }
  return globalForPrisma._prismaInstance;
}

// Export a proxy that defers all access to runtime
// During build, the proxy object exists but never triggers createClient()
export const prisma: PrismaClient = new Proxy(
  Object.create(null) as PrismaClient,
  {
    get(_target, prop) {
      // toString/valueOf/Symbol.toPrimitive — return safe defaults for build-time inspection
      if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
        return () => '[PrismaClient Proxy]';
      }
      if (prop === Symbol.toStringTag) return 'PrismaClient';
      if (prop === 'then') return undefined; // Prevent treating as thenable

      const client = getPrisma();
      const value = (client as any)[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  },
);

export default prisma;
