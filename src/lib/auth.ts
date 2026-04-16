import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './db';
import { sendWelcomeEmail } from '@/lib/email';
import { cookies } from 'next/headers';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // GitHub OAuth
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),

    // Email Magic Link
    ...(process.env.EMAIL_SERVER_HOST
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT) || 587,
              auth: {
                user: process.env.EMAIL_SERVER_USER || '',
                pass: process.env.EMAIL_SERVER_PASSWORD || '',
              },
            },
            from: process.env.EMAIL_FROM || 'noreply@inferlane.dev',
          }),
        ]
      : []),
  ],

  session: {
    // ASVS V3.3.2 — tightened from 30d default to 8h idle / 30d absolute.
    // The JWT rolls on every request, so active users stay signed in as
    // long as they use the dashboard; inactive users are logged out after
    // 8 hours of idle time. updateAge triggers a token refresh 15 min
    // before the idle window expires so refreshes don't interrupt typing.
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,              // 8 hours idle
    updateAge: 15 * 60,               // refresh 15 minutes before expiry
  },

  // Cookie config: use __Secure- prefix on HTTPS (production), plain
  // prefix on HTTP (localhost). NextAuth v4 normally infers this from
  // NEXTAUTH_URL but the inference can break on Vercel's edge proxy.
  ...((() => {
    const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https://');
    const prefix = isSecure ? '__Secure-' : '';
    return {
      cookies: {
        state: {
          name: `${prefix}next-auth.state`,
          options: {
            httpOnly: true,
            sameSite: 'lax' as const,
            path: '/',
            secure: isSecure,
            maxAge: 900,
          },
        },
        pkceCodeVerifier: {
          name: `${prefix}next-auth.pkce.code_verifier`,
          options: {
            httpOnly: true,
            sameSite: 'lax' as const,
            path: '/',
            secure: isSecure,
            maxAge: 900,
          },
        },
      },
    };
  })()),

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // Fetch role + subscription tier. Wrapped in try-catch with
        // a timeout race so a Neon cold-start doesn't hang the entire
        // OAuth callback. If the DB is slow, we default to USER/free
        // and the real values get populated on the next session refresh.
        try {
          const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
          const [dbUser, sub] = await Promise.all([
            Promise.race([
              prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }),
              timeout,
            ]),
            Promise.race([
              prisma.subscription.findUnique({ where: { userId: user.id }, select: { tier: true } }),
              timeout,
            ]),
          ]);
          token.role = (dbUser as { role?: string } | null)?.role || 'USER';
          token.plan = (sub as { tier?: string } | null)?.tier?.toLowerCase() ?? 'free';
        } catch {
          token.role = 'USER';
          token.plan = 'free';
        }
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id as string;
        (session.user as Record<string, unknown>).role = token.role as string;
        (session.user as Record<string, unknown>).plan = token.plan as string || 'free';
      }
      return session;
    },

    async signIn({ user }) {
      // Create default FREE subscription for new users.
      // Fire-and-forget — don't block the OAuth callback.
      if (user.id) {
        prisma.subscription.findUnique({ where: { userId: user.id } })
          .then(async (existing) => {
            if (!existing) {
              await prisma.subscription.create({
                data: { userId: user.id!, tier: 'FREE', status: 'ACTIVE' },
              });
            }
          })
          .catch(() => { /* swallow — subscription created on next visit */ });
      }
      return true;
    },
  },

  events: {
    async createUser({ user }) {
      console.log(`[InferLane] New user created: ${user.id}`);

      // Partner attribution — read slug from cookie set by middleware
      try {
        const cookieStore = await cookies();
        const partnerSlug = cookieStore.get('il_partner')?.value;
        if (partnerSlug) {
          const partner = await prisma.partner.findUnique({
            where: { slug: partnerSlug },
          });
          if (partner) {
            await prisma.user.update({
              where: { id: user.id },
              data: { partnerId: partner.id },
            });
            console.log(`[InferLane] User ${user.id} attributed to partner: ${partner.name}`);
          }
        }
      } catch (err) {
        console.error('[Auth] Partner attribution failed:', err);
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_CREATED',
          resource: 'user',
          details: { userId: user.id },
        },
      });

      // Send welcome email (fire-and-forget — don't block signup)
      if (user.email) {
        sendWelcomeEmail(user.email, user.name || 'there').catch((err) => {
          console.error('[Auth] Failed to send welcome email:', err);
        });
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};
