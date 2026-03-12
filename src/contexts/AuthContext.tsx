'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'apple' | 'github' | 'microsoft' | 'email' | 'demo';
  plan: 'free' | 'pro' | 'hybrid' | 'team' | 'enterprise';
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: string, email?: string) => Promise<void>;
  logout: () => void;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Bridge NextAuth session into our User type
  const [realUser, setRealUser] = useState<User | null>(null);

  useEffect(() => {
    if (session?.user) {
      setRealUser({
        id: (session.user as Record<string, string>).id || 'unknown',
        name: session.user.name || 'User',
        email: session.user.email || '',
        avatar: session.user.image || undefined,
        provider: ((session.user as Record<string, string>).provider as User['provider']) || 'google',
        plan: ((session.user as Record<string, string>).plan as User['plan']) || 'free',
        role: ((session.user as Record<string, string>).role as User['role']) || 'USER',
        createdAt: new Date(),
      });
      setDemoUser(null); // Clear demo if real session exists
    } else {
      setRealUser(null);
    }
  }, [session]);

  const user = realUser || demoUser;
  const isDemo = !!demoUser && !realUser;

  const login = useCallback(async (provider: string, email?: string) => {
    // If NextAuth providers are configured, use real OAuth
    const hasRealAuth = !!(
      process.env.NEXT_PUBLIC_HAS_GOOGLE_AUTH ||
      process.env.NEXT_PUBLIC_HAS_GITHUB_AUTH
    );

    if (hasRealAuth && provider !== 'demo') {
      // Real NextAuth sign in
      await signIn(provider, {
        callbackUrl: '/',
        ...(email ? { email } : {}),
      });
      return;
    }

    // Demo mode fallback — works without database
    await new Promise((resolve) => setTimeout(resolve, 800));

    const demoName = provider === 'email' ? (email?.split('@')[0] || 'Demo User') : 'Demo User';
    const demoEmail = email || 'demo@computegauge.ai';
    const initials = demoName.split(' ').map(n => n[0] || '').join('') || 'DU';
    const mockUser: User = {
      id: 'demo_' + Math.random().toString(36).slice(2, 10),
      name: demoName,
      email: demoEmail,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${initials}&backgroundColor=f59e0b`,
      provider: 'demo',
      plan: 'pro',
      role: 'USER',
      createdAt: new Date(),
    };

    setDemoUser(mockUser);
    setShowAuthModal(false);
    // Set demo cookie so middleware allows dashboard access
    document.cookie = 'cg_demo=1; path=/; max-age=86400; SameSite=Lax';
  }, []);

  const logout = useCallback(async () => {
    if (realUser) {
      await signOut({ callbackUrl: '/' });
    }
    setDemoUser(null);
    setRealUser(null);
    // Clear demo cookie
    document.cookie = 'cg_demo=; path=/; max-age=0';
  }, [realUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: status === 'loading',
        login,
        logout,
        showAuthModal,
        setShowAuthModal,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
