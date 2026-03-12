'use client';

import { useState } from 'react';
import MarketplaceCard from '@/components/MarketplaceCard';
import {
  marketplaceListings,
  MarketplaceCategory,
} from '@/lib/marketplace-data';

export default function MarketplacePage() {
  const [marketplaceCategory, setMarketplaceCategory] = useState<MarketplaceCategory>('all');

  return (
    <div className="space-y-6">
      {/* Marketplace header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Marketplace</h2>
          <p className="text-sm text-gray-500 mt-1">
            Discover AI platforms, earn commission on every signup, renewal, and top-up
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs text-green-400 font-medium">Earn on every click</p>
            <p className="text-[10px] text-green-600">Signup + recurring + top-up commissions</p>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Platforms' },
          { key: 'compute', label: 'Cloud Compute' },
          { key: 'inference', label: 'Inference' },
          { key: 'platform', label: 'Platforms' },
          { key: 'fine-tuning', label: 'Fine-tuning' },
        ].map((cat) => (
          <button
            key={cat.key}
            onClick={() => setMarketplaceCategory(cat.key as MarketplaceCategory)}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              marketplaceCategory === cat.key
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-[#12121a] text-gray-400 border border-[#1e1e2e] hover:text-gray-200'
            }`}
          >
            {cat.label}
            <span className="ml-1.5 text-gray-600">
              ({cat.key === 'all'
                ? marketplaceListings.length
                : marketplaceListings.filter(l => l.category === cat.key).length
              })
            </span>
          </button>
        ))}
      </div>

      {/* Featured banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-purple-500/10 rounded-2xl border border-amber-500/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h3 className="font-semibold text-white">Partner Program</h3>
            </div>
            <p className="text-sm text-gray-400">
              Earn recurring revenue on every user you refer. Commission on signups, monthly renewals, AND top-ups.
              Your users save money, you earn passively.
            </p>
          </div>
          <div className="flex-shrink-0 ml-6 text-right">
            <p className="text-2xl font-bold text-amber-400 font-mono">8-18%</p>
            <p className="text-xs text-gray-500">recurring commission</p>
          </div>
        </div>
      </div>

      {/* Listings grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {marketplaceListings
          .filter(l => marketplaceCategory === 'all' || l.category === marketplaceCategory)
          .sort((a, b) => {
            const tierOrder = { featured: 0, partner: 1, standard: 2 };
            return tierOrder[a.tier] - tierOrder[b.tier];
          })
          .map((listing) => (
            <MarketplaceCard key={listing.id} listing={listing} />
          ))}
      </div>

      {/* Become a listed provider CTA */}
      <div className="bg-[#12121a] rounded-2xl border border-dashed border-[#2a2a3a] p-8 text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Are you an AI platform?</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
          List your platform on ComputeGauge Marketplace. Reach thousands of AI-powered teams actively looking for compute.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button className="px-5 py-2 rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium border border-purple-500/30 hover:bg-purple-500/30 transition-all">
            Apply for Featured Listing
          </button>
          <button className="px-5 py-2 rounded-xl bg-[#1e1e2e] text-gray-300 text-sm font-medium hover:bg-[#2a2a3a] transition-all">
            Standard Listing (Free)
          </button>
        </div>
      </div>
    </div>
  );
}
