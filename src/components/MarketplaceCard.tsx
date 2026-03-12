'use client';

import { useState } from 'react';
import { MarketplaceListing } from '@/lib/marketplace-data';

interface MarketplaceCardProps {
  listing: MarketplaceListing;
}

export default function MarketplaceCard({ listing }: MarketplaceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const tierStyles = {
    featured: 'border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-[#12121a]',
    partner: 'border-purple-500/20 bg-[#12121a]',
    standard: 'border-[#1e1e2e] bg-[#12121a]',
  };

  const tierBadge = {
    featured: { text: 'FEATURED', bg: 'bg-amber-500/20 text-amber-400' },
    partner: { text: 'PARTNER', bg: 'bg-purple-500/20 text-purple-400' },
    standard: { text: '', bg: '' },
  };

  const categoryColors: Record<string, string> = {
    compute: 'bg-blue-500/15 text-blue-400',
    platform: 'bg-purple-500/15 text-purple-400',
    tooling: 'bg-cyan-500/15 text-cyan-400',
    inference: 'bg-green-500/15 text-green-400',
    'fine-tuning': 'bg-orange-500/15 text-orange-400',
  };

  const commissionLabel = {
    'one-time': 'One-time',
    'recurring': 'Recurring',
    'hybrid': 'Hybrid',
  };

  return (
    <div className={`rounded-2xl border p-5 transition-all hover:border-opacity-60 ${tierStyles[listing.tier]}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: `${listing.color}15` }}
          >
            {listing.logo}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white text-sm">{listing.name}</h4>
              {listing.isNew && (
                <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">NEW</span>
              )}
              {listing.isTrending && (
                <span className="text-[9px] font-bold bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  HOT
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{listing.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tierBadge[listing.tier].text && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${tierBadge[listing.tier].bg}`}>
              {tierBadge[listing.tier].text}
            </span>
          )}
          <span className={`text-[9px] font-medium px-2 py-0.5 rounded capitalize ${categoryColors[listing.category]}`}>
            {listing.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mb-3">{listing.description}</p>

      {/* Promo */}
      {listing.promoOffer && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 110 6 1 1 0 100 2 5 5 0 000-10H8.414l1.293-1.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-medium text-green-400">{listing.promoOffer}</p>
              {listing.promoExpiry && (
                <p className="text-[10px] text-green-600">Expires {listing.promoExpiry}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commission info */}
      <div className="bg-[#0a0a0f] rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">Your Commission</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
            listing.affiliateCommission.type === 'recurring' ? 'bg-green-500/15 text-green-400' :
            listing.affiliateCommission.type === 'hybrid' ? 'bg-purple-500/15 text-purple-400' :
            'bg-blue-500/15 text-blue-400'
          }`}>
            {commissionLabel[listing.affiliateCommission.type]}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-sm font-bold text-white font-mono">${listing.affiliateCommission.signupBonus}</p>
            <p className="text-[10px] text-gray-500">per signup</p>
          </div>
          <div>
            <p className="text-sm font-bold text-green-400 font-mono">{listing.affiliateCommission.recurringPercent}%</p>
            <p className="text-[10px] text-gray-500">recurring</p>
          </div>
          <div>
            <p className="text-sm font-bold text-amber-400 font-mono">{listing.affiliateCommission.topUpPercent}%</p>
            <p className="text-[10px] text-gray-500">on top-ups</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5">
          {listing.affiliateCommission.recurringDuration} recurring &middot; {listing.affiliateCommission.cookieDays}-day cookie
        </p>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="space-y-3 mb-3 animate-fade-in-up">
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {listing.stats.users && <span>{listing.stats.users} users</span>}
            {listing.stats.rating && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {listing.stats.rating}
              </span>
            )}
            {listing.stats.uptime && <span>{listing.stats.uptime} uptime</span>}
          </div>
          {/* Features */}
          <div className="flex flex-wrap gap-1.5">
            {listing.features.map((f) => (
              <span key={f} className="text-[10px] bg-[#1a1a2a] text-gray-400 px-2 py-0.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
          {/* Pricing */}
          <p className="text-xs text-gray-500">
            <span className="text-gray-400 font-medium">Pricing:</span> {listing.pricing}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            backgroundColor: `${listing.color}20`,
            color: listing.color,
          }}
        >
          Get Started
        </a>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 rounded-xl text-xs text-gray-400 bg-[#1a1a2a] hover:bg-[#2a2a3a] hover:text-white transition-all"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>
    </div>
  );
}
