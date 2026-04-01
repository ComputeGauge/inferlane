'use client';

import { useState, useEffect, useCallback } from 'react';

interface OfferDecay {
  decayPct: number;
  suggestedPrice: number;
  urgency: 'low' | 'moderate' | 'high' | 'critical';
  daysRemaining: number;
  valueRetained: number;
  isGoodDeal: boolean;
  discountPct: number;
}

interface Offer {
  id: string;
  sellerName: string;
  amount: number;
  pricePerUnit: number;
  totalCost: number;
  expiresAt: string;
  isMine: boolean;
  decay?: OfferDecay;
}

interface PriceBounds {
  floor: number;
  ceiling: number;
  suggested: number;
  decayPct: number;
  urgency: string;
  daysRemaining: number;
}

const EXPIRY_OPTIONS = [
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Amount ↓', value: 'amount_desc' },
];

function urgencyColor(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    case 'moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    default: return 'text-green-400 bg-green-500/10 border-green-500/20';
  }
}

function valueRetainedColor(pct: number): string {
  if (pct >= 80) return 'text-green-400';
  if (pct >= 50) return 'text-amber-400';
  if (pct >= 25) return 'text-orange-400';
  return 'text-red-400';
}

export default function MarketplaceOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [minDaysFilter, setMinDaysFilter] = useState(0);

  // Create form state
  const [newAmount, setNewAmount] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMinPurchase, setNewMinPurchase] = useState(false);
  const [newExpiry, setNewExpiry] = useState('24h');
  const [newAutoReprice, setNewAutoReprice] = useState(true);
  const [creating, setCreating] = useState(false);
  const [priceBounds, setPriceBounds] = useState<PriceBounds | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch(`/api/credits/offers?sortBy=${sortBy}`);
      if (!res.ok) throw new Error('Failed to fetch offers');
      const json = await res.json();
      setOffers(json.offers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  // Fetch price bounds when create form opens
  const fetchPriceBounds = useCallback(async () => {
    try {
      const res = await fetch('/api/credits/pricing');
      if (!res.ok) return;
      const json = await res.json();
      if (json.bounds) {
        setPriceBounds(json.bounds);
        // Auto-fill suggested price
        if (!newPrice) {
          setNewPrice(json.bounds.suggested.toFixed(2));
        }
      }
    } catch {
      // Non-critical — just won't show suggested price
    }
  }, [newPrice]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    if (showCreateForm) {
      fetchPriceBounds();
    }
  }, [showCreateForm, fetchPriceBounds]);

  function timeRemaining(expiresAt: string): { text: string; urgent: boolean; expired: boolean } {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', urgent: true, expired: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const urgent = hours < 6;
    if (hours >= 24) return { text: `${Math.floor(hours / 24)}d ${hours % 24}h`, urgent: false, expired: false };
    if (hours > 0) return { text: `${hours}h ${minutes}m`, urgent, expired: false };
    return { text: `${minutes}m`, urgent: true, expired: false };
  }

  async function handleBuy(offerId: string) {
    setActionLoading(offerId);
    try {
      const res = await fetch(`/api/credits/offers/${offerId}/buy`, { method: 'POST' });
      if (!res.ok) throw new Error('Purchase failed');
      await fetchOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(offerId: string) {
    setActionLoading(offerId);
    try {
      const res = await fetch(`/api/credits/offers/${offerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Cancel failed');
      await fetchOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreate() {
    const amount = parseInt(newAmount, 10);
    if (!amount || amount <= 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/credits/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          pricePerUnit: parseFloat(newPrice),
          minPurchase: newMinPurchase,
          expiry: newExpiry,
          autoReprice: newAutoReprice,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to create offer');
      }
      setNewAmount('');
      setNewPrice('');
      setNewMinPurchase(false);
      setNewExpiry('24h');
      setNewAutoReprice(true);
      setShowCreateForm(false);
      await fetchOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  // Apply client-side filters
  const browseOffers = offers
    .filter((o) => !o.isMine)
    .filter((o) => {
      if (minDaysFilter <= 0) return true;
      return (o.decay?.daysRemaining ?? 0) >= minDaysFilter;
    });
  const myOffers = offers.filter((o) => o.isMine);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-4 md:p-6 flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Marketplace Offers</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ Create Offer'}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between">
          <p className="text-red-400 text-xs">{error}</p>
          <button onClick={() => setError(null)} className="text-gray-600 text-xs hover:text-gray-400">dismiss</button>
        </div>
      )}

      {/* Create offer form */}
      {showCreateForm && (
        <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] p-4 space-y-3">
          <p className="text-gray-400 text-sm font-medium">New Offer</p>

          {/* Dynamic price bounds indicator */}
          {priceBounds && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${urgencyColor(priceBounds.urgency)}`}>
              <div className="flex items-center justify-between">
                <span>
                  Time value: <span className="font-semibold">{100 - priceBounds.decayPct}%</span> of face value
                </span>
                <span>{priceBounds.daysRemaining.toFixed(1)} days remaining</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] opacity-80">
                <span>Floor: ${priceBounds.floor.toFixed(2)}</span>
                <span>&middot;</span>
                <span>Suggested: ${priceBounds.suggested.toFixed(2)}</span>
                <span>&middot;</span>
                <span>Ceiling: ${priceBounds.ceiling.toFixed(2)}</span>
              </div>
              {/* Decay visualization bar */}
              <div className="mt-2 h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500"
                  style={{ width: `${100 - priceBounds.decayPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Amount</label>
              <input
                type="number"
                placeholder="Credits"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full rounded-lg bg-[#12121a] border border-[#1e1e2e] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">
                Price / Unit
                {priceBounds && (
                  <button
                    onClick={() => setNewPrice(priceBounds.suggested.toFixed(2))}
                    className="ml-2 text-amber-500 hover:text-amber-400"
                  >
                    use suggested
                  </button>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min={priceBounds?.floor ?? 0.10}
                max={priceBounds?.ceiling ?? 1.00}
                placeholder={priceBounds ? `$${priceBounds.suggested.toFixed(2)}` : '$0.75'}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full rounded-lg bg-[#12121a] border border-[#1e1e2e] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newMinPurchase}
                  onChange={(e) => setNewMinPurchase(e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-gray-400 text-xs">Min purchase</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newAutoReprice}
                  onChange={(e) => setNewAutoReprice(e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-gray-400 text-xs" title="Automatically reduce price as credits approach expiry">
                  Auto-reprice
                </span>
              </div>
            </div>
            <select
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              className="rounded-lg bg-[#12121a] border border-[#1e1e2e] px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500/50"
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newAmount || !newPrice}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {creating ? 'Listing...' : 'List Offer'}
          </button>
        </div>
      )}

      {/* Filters & sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500/50"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600 text-[10px]">Min days:</span>
            <input
              type="range"
              min={0}
              max={30}
              value={minDaysFilter}
              onChange={(e) => setMinDaysFilter(parseInt(e.target.value, 10))}
              className="w-16 accent-amber-500"
            />
            <span className="text-gray-500 text-[10px] w-4">{minDaysFilter}</span>
          </div>
        </div>
        <span className="text-gray-600 text-[10px]">{browseOffers.length} offers</span>
      </div>

      {/* Browse offers */}
      <div className="space-y-3">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Browse Offers</p>
        {browseOffers.length === 0 ? (
          <p className="text-gray-600 text-sm py-4 text-center">No offers available right now</p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {browseOffers.map((offer) => {
              const time = timeRemaining(offer.expiresAt);
              const decay = offer.decay;

              return (
                <div
                  key={offer.id}
                  className="flex items-center justify-between rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-4 py-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">
                        {offer.amount.toLocaleString()} credits
                      </p>
                      {/* Value retained badge */}
                      {decay && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${urgencyColor(decay.urgency)}`}>
                          {decay.valueRetained}% value
                        </span>
                      )}
                      {/* Good deal badge */}
                      {decay?.isGoodDeal && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                          {decay.discountPct}% below suggested
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">
                        ${offer.pricePerUnit.toFixed(2)}/unit &middot; ${offer.totalCost.toFixed(2)} total
                      </span>
                      {/* Buyer: usable days */}
                      {decay && (
                        <span className={`${valueRetainedColor(decay.valueRetained)}`}>
                          &middot; {decay.daysRemaining.toFixed(1)}d usable
                        </span>
                      )}
                    </div>
                    <span className={`text-xs ${time.urgent ? 'text-red-400' : 'text-gray-600'}`}>
                      {time.expired ? 'Expired' : `Expires in ${time.text}`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleBuy(offer.id)}
                    disabled={actionLoading === offer.id || time.expired}
                    className="ml-3 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-xs disabled:opacity-50 transition-opacity flex-shrink-0"
                  >
                    {actionLoading === offer.id ? '...' : 'Buy'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My offers */}
      <div className="space-y-3 border-t border-[#1e1e2e] pt-4">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">My Offers</p>
        {myOffers.length === 0 ? (
          <p className="text-gray-600 text-sm py-4 text-center">You have no active offers</p>
        ) : (
          <div className="space-y-2">
            {myOffers.map((offer) => {
              const time = timeRemaining(offer.expiresAt);
              const decay = offer.decay;

              return (
                <div
                  key={offer.id}
                  className="flex items-center justify-between rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">
                        {offer.amount.toLocaleString()} credits
                      </p>
                      {decay && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${urgencyColor(decay.urgency)}`}>
                          {decay.valueRetained}% value
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs">
                      ${offer.pricePerUnit.toFixed(2)}/unit
                      {decay && decay.suggestedPrice !== offer.pricePerUnit && (
                        <span className="text-gray-600 ml-1">(suggested: ${decay.suggestedPrice.toFixed(2)})</span>
                      )}
                    </p>
                    <span className={`text-xs ${time.urgent ? 'text-red-400' : 'text-gray-600'}`}>
                      {time.expired ? 'Expired' : `Expires in ${time.text}`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCancel(offer.id)}
                    disabled={actionLoading === offer.id}
                    className="px-4 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 disabled:opacity-50 transition-all"
                  >
                    {actionLoading === offer.id ? '...' : 'Cancel'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
