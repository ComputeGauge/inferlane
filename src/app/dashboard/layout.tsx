'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ConnectProvider from '@/components/ConnectProvider';
import UserMenu from '@/components/UserMenu';
import AuthModal from '@/components/AuthModal';
import OnboardingWizard from '@/components/OnboardingWizard';
import FeedbackWidget from '@/components/FeedbackWidget';
import PromotionBanner from '@/components/scheduler/PromotionBanner';

// ---------------------------------------------------------------------------
// Navigation Data — grouped by domain
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Setup',
    items: [
      { href: '/dashboard/onboarding', label: 'Onboarding' },
    ],
  },
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/providers', label: 'Providers' },
      { href: '/dashboard/compare', label: 'Compare' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/dashboard/dispatch', label: 'Dispatch' },
      { href: '/dashboard/sessions', label: 'Sessions' },
      { href: '/dashboard/router', label: 'Smart Router' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/savings', label: 'Savings' },
      { href: '/dashboard/invoices', label: 'Invoices' },
      { href: '/dashboard/credits', label: 'Credits' },
      { href: '/dashboard/earnings', label: 'Earnings' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/dashboard/teams', label: 'Teams' },
      { href: '/dashboard/gpu', label: 'GPU Clusters' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/dashboard/privacy', label: 'Privacy' },
      { href: '/dashboard/compute-intel', label: 'Compute Intel' },
      { href: '/dashboard/nodes', label: 'Nodes' },
    ],
  },
  {
    label: 'Trading',
    items: [
      { href: '/dashboard/trading', label: 'Trading' },
      { href: '/dashboard/marketplace', label: 'Marketplace' },
      { href: '/dashboard/scheduler', label: 'Scheduler' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/dashboard/settings', label: 'Settings' },
    ],
  },
];

// Flat list for tablet scroll view
const allNavItems = navGroups.flatMap((g) => g.items);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isItemActive(item.href, pathname));
}

// ---------------------------------------------------------------------------
// Desktop: Dropdown Group
// ---------------------------------------------------------------------------

function DesktopNavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = isGroupActive(group, pathname);

  // Single-item groups render as direct links
  if (group.items.length === 1) {
    const item = group.items[0];
    const isOnboarding = item.href === '/dashboard/onboarding';
    return (
      <Link
        href={item.href}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isOnboarding
            ? isItemActive(item.href, pathname)
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20'
            : isItemActive(item.href, pathname)
              ? 'bg-[#1e1e2e] text-white'
              : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {isOnboarding && <span className="mr-1">&#128640;</span>}
        {item.label}
      </Link>
    );
  }

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
          active
            ? 'bg-[#1e1e2e] text-white'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {group.label}
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#12121a] border border-[#1e1e2e] rounded-xl shadow-xl py-1 z-50">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                isItemActive(item.href, pathname)
                  ? 'text-white bg-[#1e1e2e]'
                  : 'text-gray-400 hover:text-white hover:bg-[#1e1e2e]/50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile: Slide-out Drawer
// ---------------------------------------------------------------------------

function MobileDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-[#0a0a0f] border-r border-[#1e1e2e] z-50 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[#1e1e2e] shrink-0">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg">InferLane</span>
          </Link>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-4 space-y-6 px-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2 font-semibold">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isOnboarding = item.href === '/dashboard/onboarding';
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isOnboarding
                          ? isItemActive(item.href, pathname)
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'text-amber-400 hover:bg-amber-500/10 border border-transparent'
                          : isItemActive(item.href, pathname)
                            ? 'bg-[#1e1e2e] text-white'
                            : 'text-gray-400 hover:text-white hover:bg-[#1e1e2e]/50'
                      }`}
                    >
                      {isOnboarding && <span className="mr-1">&#128640;</span>}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-[#1e1e2e] p-4 space-y-3 shrink-0">
          <ConnectProvider />
          <UserMenu />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollNavRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Tablet: scroll active item into view
  const scrollActiveIntoView = useCallback(() => {
    if (!scrollNavRef.current) return;
    const activeEl = scrollNavRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  useEffect(() => {
    scrollActiveIntoView();
  }, [pathname, scrollActiveIntoView]);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 lg:gap-8 min-w-0">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-bold text-white text-lg hidden sm:block">InferLane</span>
              </Link>

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMenuOpen(true)}
                className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg"
                aria-label="Open navigation menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Tablet: horizontal scroll nav */}
              <div
                ref={scrollNavRef}
                className="hidden md:flex lg:hidden gap-1 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {allNavItems.map((item) => {
                  const active = isItemActive(item.href, pathname);
                  const isOnboarding = item.href === '/dashboard/onboarding';
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-active={active}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                        isOnboarding
                          ? active
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-amber-400 hover:bg-amber-500/10'
                          : active
                            ? 'bg-[#1e1e2e] text-white'
                            : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {isOnboarding && <span className="mr-1">&#128640;</span>}
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              {/* Desktop: grouped dropdowns */}
              <div className="hidden lg:flex items-center gap-1">
                {navGroups.map((group) => (
                  <DesktopNavGroup key={group.label} group={group} pathname={pathname} />
                ))}
              </div>
            </div>

            {/* Right side — hidden on mobile (moved to drawer) */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <ConnectProvider />
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />

      <AuthModal />
      <OnboardingWizard />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <PromotionBanner />
        {children}
      </main>

      <FeedbackWidget />
    </div>
  );
}
