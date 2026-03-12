'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProviderWrapper from '@/components/PostHogProvider';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <PostHogProviderWrapper>
          {children}
        </PostHogProviderWrapper>
      </AuthProvider>
    </SessionProvider>
  );
}
