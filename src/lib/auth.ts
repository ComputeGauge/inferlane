import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './db';

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
            from: process.env.EMAIL_FROM || 'noreply@computegauge.ai',
          }),
        ]
      : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // Fetch role from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role || 'USER';
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
      }
      return session;
    },

    async signIn({ user }) {
      // Create default FREE subscription for new users
      if (user.id) {
        const existingSub = await prisma.subscription.findUnique({
          where: { userId: user.id },
        });
        if (!existingSub) {
          await prisma.subscription.create({
            data: {
              userId: user.id,
              tier: 'FREE',
              status: 'ACTIVE',
            },
          });
        }
      }
      return true;
    },
  },

  events: {
    async createUser({ user }) {
      console.log(`[ComputeGauge] New user created: ${user.email}`);
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_CREATED',
          resource: 'user',
          details: { email: user.email },
        },
      });
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};
