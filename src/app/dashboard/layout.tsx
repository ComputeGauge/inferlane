'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ConnectProvider from '@/components/ConnectProvider';
import UserMenu from '@/components/UserMenu';
import AuthModal from '@/components/AuthModal';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/providers', label: 'Providers' },
  { href: '/dashboard/router', label: 'Smart Router' },
  { href: '/dashboard/marketplace', label: 'Marketplace' },
  { href: '/dashboard/earnings', label: 'Earnings' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-bold text-white text-lg">ComputeGauge</span>
              </Link>
              <div className="flex gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-[#1e1e2e] text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnectProvider />
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      <AuthModal />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
