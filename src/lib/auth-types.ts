// Extend NextAuth types for InferLane
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
      provider?: string;
      plan?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    provider?: string;
  }
}
