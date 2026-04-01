import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Developer Documentation | InferLane',
  description:
    'InferLane Trading API documentation. Build synthetic trading platforms, arbitrage bots, and prediction markets on compute price indices.',
};

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Minimal top bar */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-bold text-white">InferLane</span>
              </Link>
              <span className="text-sm text-gray-500 hidden sm:block">Developer Documentation</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/trading"
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-lg hover:brightness-110 transition-all"
              >
                Get API Key
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
