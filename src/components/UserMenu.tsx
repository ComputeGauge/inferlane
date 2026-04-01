'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function UserMenu() {
  const { user, isAuthenticated, logout, setShowAuthModal } = useAuth();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAuthModal(true)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={() => setShowAuthModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
        >
          Get Started
        </button>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    free: 'bg-gray-500/20 text-gray-400',
    pro: 'bg-amber-500/20 text-amber-400',
    hybrid: 'bg-blue-500/20 text-blue-400',
    team: 'bg-purple-500/20 text-purple-400',
    enterprise: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[#1e1e2e] transition-all"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-8 h-8 rounded-lg" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black text-xs font-bold">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-white leading-tight">{user.name}</p>
          <p className="text-[10px] text-gray-500 leading-tight">{user.email}</p>
        </div>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#12121a] rounded-2xl border border-[#1e1e2e] shadow-xl shadow-black/30 overflow-hidden z-50">
          {/* User info */}
          <div className="p-4 border-b border-[#1e1e2e]">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-10 h-10 rounded-xl" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${planColors[user.plan]}`}>
                {user.plan} Plan
              </span>
              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                via {user.provider === 'email' ? 'Email' : user.provider.charAt(0).toUpperCase() + user.provider.slice(1)}
              </span>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-2">
            {[
              { label: 'Account Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
              { label: 'API Keys', href: '/dashboard/settings', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
              { label: 'Billing & Plans', href: '/dashboard/settings', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
              { label: 'Providers', href: '/dashboard/providers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
              { label: 'Earnings', href: '/dashboard/earnings', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { router.push(item.href); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-[#1a1a2a] hover:text-white transition-all"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-[#1e1e2e]">
            <button
              onClick={() => {
                logout();
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
