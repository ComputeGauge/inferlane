'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import PostHogProviderWrapper from '@/components/PostHogProvider';
import SentryProvider from '@/components/SentryProvider';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <SentryProvider>
          <PostHogProviderWrapper>
            {children}
          </PostHogProviderWrapper>
        </SentryProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
