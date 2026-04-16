'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types (matching snake_case API responses)
// ---------------------------------------------------------------------------

interface Offer {
  id: string;
  provider_id: string;
  provider_type: 'CENTRALIZED' | 'DECENTRALIZED' | 'HYBRID';
  model: string;
  max_tokens_per_sec: number;
  gpu_type: string | null;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  utilization_pct: number;
  attestation_type: string | null;
  status: string;
}

interface OffersResponse {
  offers: Offer[];
  total: number;
}

interface SpotCandidate {
  offer_id: string;
  provider_type: string;
  model: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  estimated_cost_usd: number;
  reliability_score: number;
  gpu_type: string | null;
  attestation_type: string | null;
  composite_score: number;
}

interface SpotResponse {
  model: string;
  candidates: SpotCandidate[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const providerBadge: Record<string, { bg: string; text: string }> = {
  CENTRALIZED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  DECENTRALIZED: { bg: 'bg-green-500/20', text: 'text-green-400' },
  HYBRID: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

function fmt(n: number, digits = 2) {
  return n.toFixed(digits);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExchangePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // spot calculator
  const [spotModel, setSpotModel] = useState('');
  const [inputTok, setInputTok] = useState(2000);
  const [outputTok, setOutputTok] = useState(500);
  const [spotResult, setSpotResult] = useState<SpotResponse | null>(null);
  const [spotLoading, setSpotLoading] = useState(false);

  // ------ data fetching ------

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange/offers?limit=100');
      if (res.ok) {
        const data: OffersResponse = await res.json();
        setOffers(data.offers);
      }
    } catch {
      // silent for now
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
    const iv = setInterval(fetchOffers, 30_000);
    return () => clearInterval(iv);
  }, [fetchOffers]);

  // ------ derived stats ------

  const activeOffers = offers.filter((o) => o.status === 'ACTIVE');
  const totalCapacity = activeOffers.reduce((s, o) => s + o.max_tokens_per_sec, 0);
  const cheapest = activeOffers.length
    ? Math.min(...activeOffers.map((o) => o.input_price_per_mtok))
    : 0;
  const providerCounts = activeOffers.reduce<Record<string, number>>((m, o) => {
    m[o.provider_type] = (m[o.provider_type] || 0) + 1;
    return m;
  }, {});

  const uniqueModels = Array.from(new Set(offers.map((o) => o.model))).sort();

  // ------ filtered + sorted table ------

  const filtered = offers
    .filter((o) => o.model.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortAsc
        ? a.input_price_per_mtok - b.input_price_per_mtok
        : b.input_price_per_mtok - a.input_price_per_mtok,
    );

  // ------ spot calculator ------

  async function handleSpot() {
    if (!spotModel) return;
    setSpotLoading(true);
    setSpotResult(null);
    try {
      const qs = new URLSearchParams({
        model: spotModel,
        inputTokens: String(inputTok),
        outputTokens: String(outputTok),
      });
      const res = await fetch(`/api/exchange/spot?${qs}`);
      if (res.ok) {
        setSpotResult(await res.json());
      }
    } catch {
      // silent
    } finally {
      setSpotLoading(false);
    }
  }

  // ------ render ------

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compute Exchange</h1>
          <p className="text-gray-500 text-sm mt-1">Live order book for inference capacity</p>
        </div>
        <Link
          href="/dashboard/operator/offers"
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:brightness-110 transition"
        >
          List Your Capacity
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Offers', value: String(activeOffers.length) },
          { label: 'Total Capacity', value: `${totalCapacity.toLocaleString()} tok/s` },
          { label: 'Cheapest Input', value: cheapest ? `$${fmt(cheapest)}/Mtok` : '--' },
          {
            label: 'Provider Types',
            value: Object.entries(providerCounts)
              .map(([k, v]) => `${v} ${k.slice(0, 3)}`)
              .join(' / ') || '--',
          },
        ].map((s) => (
          <div key={s.label} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Order Book */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <h2 className="text-lg font-semibold text-white">Order Book</h2>
          <input
            type="text"
            placeholder="Filter by model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 w-56"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
            Loading order book...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
            No offers found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-[#1e1e2e]">
                  <th className="text-left px-5 py-3">Model</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-left px-3 py-3">GPU</th>
                  <th
                    className="text-right px-3 py-3 cursor-pointer select-none hover:text-amber-400"
                    onClick={() => setSortAsc((p) => !p)}
                  >
                    Input $/Mtok {sortAsc ? '\u25B2' : '\u25BC'}
                  </th>
                  <th className="text-right px-3 py-3">Output $/Mtok</th>
                  <th className="text-right px-3 py-3">Max tok/s</th>
                  <th className="text-left px-3 py-3">Util</th>
                  <th className="text-center px-3 py-3">Attest</th>
                  <th className="text-center px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const badge = providerBadge[o.provider_type] ?? providerBadge.CENTRALIZED;
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/30 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-white whitespace-nowrap">
                        {o.model}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`${badge.bg} ${badge.text} text-xs px-2 py-0.5 rounded-full`}>
                          {o.provider_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                        {o.gpu_type ?? '--'}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300">
                        ${fmt(o.input_price_per_mtok)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300">
                        ${fmt(o.output_price_per_mtok)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300">
                        {o.max_tokens_per_sec.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{ width: `${Math.min(o.utilization_pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{o.utilization_pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {o.attestation_type ? (
                          <svg
                            className="w-4 h-4 text-green-400 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            o.status === 'ACTIVE'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Spot Price Calculator */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Spot Price Calculator</h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <select
              value={spotModel}
              onChange={(e) => setSpotModel(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">Select model</option>
              {uniqueModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Input tokens</label>
            <input
              type="number"
              value={inputTok}
              onChange={(e) => setInputTok(Number(e.target.value) || 0)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Output tokens</label>
            <input
              type="number"
              value={outputTok}
              onChange={(e) => setOutputTok(Number(e.target.value) || 0)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSpot}
              disabled={!spotModel || spotLoading}
              className="w-full px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm font-medium hover:bg-amber-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {spotLoading ? 'Checking...' : 'Get Spot Price'}
            </button>
          </div>
        </div>

        {spotResult && spotResult.candidates.length > 0 && (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-[#1e1e2e]">
                  <th className="text-left px-4 py-2">Rank</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">GPU</th>
                  <th className="text-right px-3 py-2">Est. Cost</th>
                  <th className="text-right px-3 py-2">In $/Mtok</th>
                  <th className="text-right px-3 py-2">Out $/Mtok</th>
                  <th className="text-right px-3 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {spotResult.candidates.map((c, i) => (
                  <tr
                    key={c.offer_id}
                    className="border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/30"
                  >
                    <td className="px-4 py-2 text-amber-400 font-mono">#{i + 1}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          (providerBadge[c.provider_type] ?? providerBadge.CENTRALIZED).bg
                        } ${(providerBadge[c.provider_type] ?? providerBadge.CENTRALIZED).text}`}
                      >
                        {c.provider_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{c.gpu_type ?? '--'}</td>
                    <td className="px-3 py-2 text-right text-white font-medium">
                      ${c.estimated_cost_usd.toFixed(6)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      ${fmt(c.input_price_per_mtok)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      ${fmt(c.output_price_per_mtok)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {fmt(c.composite_score, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {spotResult && spotResult.candidates.length === 0 && (
          <p className="text-gray-500 text-sm">No candidates available for this model.</p>
        )}
      </div>
    </div>
  );
}
