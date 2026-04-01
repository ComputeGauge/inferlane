'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Compute Trading Dashboard — /dashboard/trading
// ---------------------------------------------------------------------------
// Three sections:
// 1. Compute Price Indices — IL-FRONTIER, IL-STANDARD, IL-ECONOMY, IL-OPENWEIGHT
// 2. Order Book — live bids/asks for each quality tier
// 3. Futures & Derivatives — user's open contracts + create new
// 4. Trading API Keys — manage keys for third-party platform access
// ---------------------------------------------------------------------------

interface IndexData {
  id: string;
  name: string;
  qualityTier: string;
  currentValue: number;
  previousClose: number;
  change24h: number;
  volume24h: number;
  updatedAt: string;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: number;
}

interface Order {
  id: string;
  side: string;
  orderType: string;
  status: string;
  qualityTier: string;
  quantity: number;
  pricePerUnit: number;
  filledQuantity: number;
  avgFillPrice: number | null;
  createdAt: string;
}

interface Contract {
  id: string;
  contractType: string;
  status: string;
  qualityTier: string;
  quantity: number;
  strikePrice: number;
  deliveryDate: string;
  settlementPrice: number | null;
  pnlUsd: number | null;
  marginRequired: number;
  createdAt: string;
}

interface TradingKey {
  id: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

type Tab = 'indices' | 'orderbook' | 'futures' | 'keys';

export default function TradingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('indices');
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [keys, setKeys] = useState<TradingKey[]>([]);
  const [selectedTier, setSelectedTier] = useState('FRONTIER');
  const [loading, setLoading] = useState(true);

  // Order form state
  const [orderForm, setOrderForm] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    orderType: 'LIMIT' as 'LIMIT' | 'MARKET',
    quantity: '',
    pricePerUnit: '',
    qualityTier: 'FRONTIER',
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  // Future form state
  const [futureForm, setFutureForm] = useState({
    contractType: 'FORWARD' as 'FORWARD' | 'OPTION_CALL' | 'OPTION_PUT',
    qualityTier: 'FRONTIER',
    quantity: '',
    strikePrice: '',
    deliveryDate: '',
  });
  const [futureResult, setFutureResult] = useState<string | null>(null);

  // Key form state
  const [keyForm, setKeyForm] = useState({ name: '', permissions: ['read', 'trade'] });
  const [newKey, setNewKey] = useState<string | null>(null);

  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/indices');
      if (res.ok) {
        const data = await res.json();
        setIndices(data.indices || []);
      }
    } catch { /* skip */ }
  }, []);

  const fetchOrderBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/trading/orders?tier=${selectedTier}&mine=true`);
      if (res.ok) {
        const data = await res.json();
        setOrderBook(data.orderBook || null);
        setMyOrders(data.myOrders || []);
      }
    } catch { /* skip */ }
  }, [selectedTier]);

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/futures');
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch { /* skip */ }
  }, []);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchIndices(), fetchOrderBook(), fetchContracts(), fetchKeys()])
      .finally(() => setLoading(false));
  }, [fetchIndices, fetchOrderBook, fetchContracts, fetchKeys]);

  useEffect(() => {
    if (activeTab === 'orderbook') fetchOrderBook();
  }, [selectedTier, activeTab, fetchOrderBook]);

  async function submitOrder() {
    setSubmitting(true);
    setOrderResult(null);
    try {
      const res = await fetch('/api/trading/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: orderForm.side,
          orderType: orderForm.orderType,
          qualityTier: orderForm.qualityTier,
          quantity: parseFloat(orderForm.quantity),
          pricePerUnit: parseFloat(orderForm.pricePerUnit),
          expiresInHours: 24,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrderResult(`Order placed. Filled: ${data.filledQuantity}, Remaining: ${data.remainingQuantity}`);
        fetchOrderBook();
      } else {
        setOrderResult(data.error || 'Order failed');
      }
    } catch {
      setOrderResult('Order submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFuture() {
    setSubmitting(true);
    setFutureResult(null);
    try {
      const res = await fetch('/api/trading/futures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractType: futureForm.contractType,
          qualityTier: futureForm.qualityTier,
          quantity: parseFloat(futureForm.quantity),
          strikePrice: parseFloat(futureForm.strikePrice),
          deliveryDate: futureForm.deliveryDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFutureResult(`Contract created. Margin: $${data.marginRequired?.toFixed(2)}`);
        fetchContracts();
      } else {
        setFutureResult(data.error || 'Contract creation failed');
      }
    } catch {
      setFutureResult('Contract creation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function createKey() {
    setSubmitting(true);
    setNewKey(null);
    try {
      const res = await fetch('/api/trading/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyForm.name,
          permissions: keyForm.permissions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setKeyForm({ name: '', permissions: ['read', 'trade'] });
        fetchKeys();
      }
    } catch { /* skip */ }
    finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'indices', label: 'Price Indices' },
    { id: 'orderbook', label: 'Order Book' },
    { id: 'futures', label: 'Futures' },
    { id: 'keys', label: 'API Keys' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Compute Trading</h1>
        <p className="text-gray-500 mt-1">
          Trade compute credits, view price indices, manage futures contracts, and configure API access for third-party platforms.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1e1e2e] pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-[#12121a] text-white border border-[#1e1e2e] border-b-[#12121a] -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Indices Tab */}
      {activeTab === 'indices' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(indices.length > 0 ? indices : [
              { id: '1', name: 'IL-FRONTIER', qualityTier: 'FRONTIER', currentValue: 0.95, previousClose: 0.95, change24h: 0, volume24h: 0, updatedAt: new Date().toISOString() },
              { id: '2', name: 'IL-STANDARD', qualityTier: 'STANDARD', currentValue: 0.75, previousClose: 0.75, change24h: 0, volume24h: 0, updatedAt: new Date().toISOString() },
              { id: '3', name: 'IL-ECONOMY', qualityTier: 'ECONOMY', currentValue: 0.50, previousClose: 0.50, change24h: 0, volume24h: 0, updatedAt: new Date().toISOString() },
              { id: '4', name: 'IL-OPENWEIGHT', qualityTier: 'OPEN_WEIGHT', currentValue: 0.35, previousClose: 0.35, change24h: 0, volume24h: 0, updatedAt: new Date().toISOString() },
              { id: '5', name: 'IL-DECODE', qualityTier: 'FRONTIER', currentValue: 0.15, previousClose: 0.15, change24h: 0, volume24h: 0, updatedAt: new Date().toISOString() },
              { id: '6', name: 'IL-MEMORY', qualityTier: 'STANDARD', currentValue: 0.08, previousClose: 0.08, change24h: 0, volume24h: 0, updatedAt: new Date().toISOString() },
            ]).map((idx) => {
              const changeColor = idx.change24h > 0 ? 'text-emerald-400' : idx.change24h < 0 ? 'text-red-400' : 'text-gray-400';

              // Color mappings by index name, with fallback to quality tier
              const colorMap: Record<string, string> = {
                'IL-DECODE': 'from-orange-400 to-red-500',
                'IL-MEMORY': 'from-purple-400 to-violet-500',
              };
              const tierColorMap: Record<string, string> = {
                FRONTIER: 'from-emerald-400 to-emerald-500',
                STANDARD: 'from-amber-400 to-amber-500',
                ECONOMY: 'from-gray-400 to-gray-500',
                OPEN_WEIGHT: 'from-blue-400 to-blue-500',
              };
              const tierColor = colorMap[idx.name] || tierColorMap[idx.qualityTier] || 'from-blue-400 to-blue-500';

              // Descriptions for decode/memory indices
              const descriptionMap: Record<string, string> = {
                'IL-DECODE': 'Decode throughput capacity (tokens/sec)',
                'IL-MEMORY': 'Memory bandwidth capacity (GB/s)',
              };

              return (
                <div key={idx.id} className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 hover:border-[#2e2e3e] transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${tierColor}`} />
                      <span className="text-sm font-semibold text-white">{idx.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{idx.qualityTier.replace('_', ' ')}</span>
                  </div>
                  {descriptionMap[idx.name] && (
                    <p className="text-[10px] text-gray-600 mb-1">{descriptionMap[idx.name]}</p>
                  )}
                  <p className="text-3xl font-bold text-white mb-1">${idx.currentValue.toFixed(4)}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${changeColor}`}>
                      {idx.change24h > 0 ? '+' : ''}{idx.change24h.toFixed(2)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      Vol: {idx.volume24h.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-3">About Compute Price Indices</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              IL indices track the volume-weighted average price (VWAP) of compute credits traded on the
              InferLane marketplace, segmented by quality tier. Indices update every time the settlement
              cron runs, using the last 24 hours of order fills. Futures and options settle against these
              index values at delivery date.
            </p>
          </div>
        </div>
      )}

      {/* Order Book Tab */}
      {activeTab === 'orderbook' && (
        <div className="space-y-6">
          {/* Tier Selector */}
          <div className="flex gap-2">
            {['FRONTIER', 'STANDARD', 'ECONOMY', 'OPEN_WEIGHT'].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedTier === tier
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-[#1e1e2e]'
                }`}
              >
                {tier.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Bids */}
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
              <div className="p-4 border-b border-[#1e1e2e]">
                <h3 className="text-sm font-semibold text-emerald-400">Bids (Buy)</h3>
              </div>
              {(orderBook?.bids?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">No bids</div>
              ) : (
                <div className="divide-y divide-[#1e1e2e]">
                  {orderBook?.bids.map((level, i) => (
                    <div key={i} className="px-4 py-2 flex justify-between text-xs">
                      <span className="text-emerald-400 font-mono">${level.price.toFixed(4)}</span>
                      <span className="text-gray-400">{level.quantity.toLocaleString()}</span>
                      <span className="text-gray-500">{level.orderCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Place Order */}
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Place Order</h3>
              <div className="flex gap-1">
                {(['BUY', 'SELL'] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setOrderForm({ ...orderForm, side })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      orderForm.side === side
                        ? side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'text-gray-500 border border-[#1e1e2e]'
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['LIMIT', 'MARKET'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderForm({ ...orderForm, orderType: type })}
                    className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                      orderForm.orderType === type
                        ? 'bg-[#1e1e2e] text-white'
                        : 'text-gray-500 border border-[#1e1e2e]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                <input
                  type="number"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  placeholder="1000"
                  className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Price per Unit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={orderForm.pricePerUnit}
                  onChange={(e) => setOrderForm({ ...orderForm, pricePerUnit: e.target.value })}
                  placeholder="0.85"
                  className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              {orderResult && (
                <p className={`text-xs ${orderResult.includes('failed') || orderResult.includes('error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {orderResult}
                </p>
              )}
              <button
                onClick={submitOrder}
                disabled={submitting || !orderForm.quantity || !orderForm.pricePerUnit}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                  orderForm.side === 'BUY'
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                    : 'bg-red-500 text-white hover:bg-red-400'
                }`}
              >
                {submitting ? 'Placing...' : `${orderForm.side} ${selectedTier.replace('_', ' ')}`}
              </button>
            </div>

            {/* Asks */}
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
              <div className="p-4 border-b border-[#1e1e2e]">
                <h3 className="text-sm font-semibold text-red-400">Asks (Sell)</h3>
              </div>
              {(orderBook?.asks?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">No asks</div>
              ) : (
                <div className="divide-y divide-[#1e1e2e]">
                  {orderBook?.asks.map((level, i) => (
                    <div key={i} className="px-4 py-2 flex justify-between text-xs">
                      <span className="text-red-400 font-mono">${level.price.toFixed(4)}</span>
                      <span className="text-gray-400">{level.quantity.toLocaleString()}</span>
                      <span className="text-gray-500">{level.orderCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* My Orders */}
          {myOrders.length > 0 && (
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
              <div className="p-5 border-b border-[#1e1e2e]">
                <h3 className="text-sm font-semibold text-white">My Active Orders</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Side</th>
                      <th className="text-left px-5 py-3 font-medium">Type</th>
                      <th className="text-left px-5 py-3 font-medium">Qty</th>
                      <th className="text-left px-5 py-3 font-medium">Price</th>
                      <th className="text-left px-5 py-3 font-medium">Filled</th>
                      <th className="text-left px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e2e]">
                    {myOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#1a1a24]">
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {o.side}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400">{o.orderType}</td>
                        <td className="px-5 py-3 text-xs text-white font-mono">{o.quantity.toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs text-white font-mono">${o.pricePerUnit.toFixed(4)}</td>
                        <td className="px-5 py-3 text-xs text-gray-400">{o.filledQuantity.toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-medium text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Futures Tab */}
      {activeTab === 'futures' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Create Contract */}
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Create Contract</h3>
              <div className="flex gap-1">
                {(['FORWARD', 'OPTION_CALL', 'OPTION_PUT'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFutureForm({ ...futureForm, contractType: type })}
                    className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                      futureForm.contractType === type
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-gray-500 border border-[#1e1e2e]'
                    }`}
                  >
                    {type.replace('OPTION_', '').replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quality Tier</label>
                <select
                  value={futureForm.qualityTier}
                  onChange={(e) => setFutureForm({ ...futureForm, qualityTier: e.target.value })}
                  className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="FRONTIER">Frontier</option>
                  <option value="STANDARD">Standard</option>
                  <option value="ECONOMY">Economy</option>
                  <option value="OPEN_WEIGHT">Open Weight</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                  <input
                    type="number"
                    value={futureForm.quantity}
                    onChange={(e) => setFutureForm({ ...futureForm, quantity: e.target.value })}
                    placeholder="1000"
                    className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Strike Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={futureForm.strikePrice}
                    onChange={(e) => setFutureForm({ ...futureForm, strikePrice: e.target.value })}
                    placeholder="0.85"
                    className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Delivery Date</label>
                <input
                  type="date"
                  value={futureForm.deliveryDate}
                  onChange={(e) => setFutureForm({ ...futureForm, deliveryDate: e.target.value })}
                  className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              {futureResult && (
                <p className={`text-xs ${futureResult.includes('failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {futureResult}
                </p>
              )}
              <button
                onClick={submitFuture}
                disabled={submitting || !futureForm.quantity || !futureForm.strikePrice || !futureForm.deliveryDate}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Contract'}
              </button>
              <p className="text-[10px] text-gray-600">
                Margin: 10% of notional value (qty × strike). Contracts settle against IL index at delivery date.
              </p>
            </div>

            {/* Contract Info */}
            <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">How Compute Futures Work</h3>
              <div className="space-y-3 text-xs text-gray-500 leading-relaxed">
                <div className="p-3 rounded-lg bg-[#0a0a0f]">
                  <span className="text-amber-400 font-semibold">FORWARD</span>
                  <p className="mt-1">Binding agreement to buy/sell compute at a fixed price. PnL = (settlement − strike) × quantity. Both sides have exposure.</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0a0f]">
                  <span className="text-emerald-400 font-semibold">CALL OPTION</span>
                  <p className="mt-1">Right (not obligation) to buy compute at strike price. Buyer profits if settlement &gt; strike. Max loss = margin.</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0a0f]">
                  <span className="text-red-400 font-semibold">PUT OPTION</span>
                  <p className="mt-1">Right (not obligation) to sell compute at strike price. Buyer profits if settlement &lt; strike. Hedging tool.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contracts Table */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
            <div className="p-5 border-b border-[#1e1e2e]">
              <h3 className="text-sm font-semibold text-white">My Contracts</h3>
            </div>
            {contracts.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No contracts yet. Create a forward or option above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Type</th>
                      <th className="text-left px-5 py-3 font-medium">Tier</th>
                      <th className="text-left px-5 py-3 font-medium">Qty</th>
                      <th className="text-left px-5 py-3 font-medium">Strike</th>
                      <th className="text-left px-5 py-3 font-medium">Delivery</th>
                      <th className="text-left px-5 py-3 font-medium">Margin</th>
                      <th className="text-left px-5 py-3 font-medium">PnL</th>
                      <th className="text-left px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e2e]">
                    {contracts.map((c) => (
                      <tr key={c.id} className="hover:bg-[#1a1a24]">
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold ${
                            c.contractType === 'FORWARD' ? 'text-amber-400' :
                            c.contractType === 'OPTION_CALL' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {c.contractType.replace('OPTION_', '')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400">{c.qualityTier}</td>
                        <td className="px-5 py-3 text-xs text-white font-mono">{c.quantity.toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs text-white font-mono">${c.strikePrice.toFixed(4)}</td>
                        <td className="px-5 py-3 text-xs text-gray-400">
                          {new Date(c.deliveryDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400 font-mono">${c.marginRequired.toFixed(2)}</td>
                        <td className="px-5 py-3">
                          {c.pnlUsd !== null ? (
                            <span className={`text-xs font-mono ${c.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {c.pnlUsd >= 0 ? '+' : ''}${c.pnlUsd.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            c.status === 'OPEN' ? 'text-amber-400 bg-amber-500/15' :
                            c.status === 'SETTLED' ? 'text-emerald-400 bg-emerald-500/15' :
                            c.status === 'CANCELLED' ? 'text-gray-400 bg-gray-500/15' :
                            'text-blue-400 bg-blue-500/15'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Create Key */}
          <div className="max-w-lg rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Create Trading API Key</h3>
            <p className="text-xs text-gray-500">
              Trading API keys (ilt_ prefix) allow third-party platforms to submit orders, query indices,
              and manage contracts programmatically on your behalf.
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Key Name</label>
              <input
                type="text"
                value={keyForm.name}
                onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })}
                placeholder="My Trading Bot"
                className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Permissions</label>
              <div className="flex gap-2">
                {['read', 'trade', 'settle'].map((perm) => (
                  <button
                    key={perm}
                    onClick={() => {
                      const perms = keyForm.permissions.includes(perm)
                        ? keyForm.permissions.filter((p) => p !== perm)
                        : [...keyForm.permissions, perm];
                      setKeyForm({ ...keyForm, permissions: perms });
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      keyForm.permissions.includes(perm)
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-gray-500 border border-[#1e1e2e]'
                    }`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={createKey}
              disabled={submitting || !keyForm.name || keyForm.permissions.length === 0}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Key'}
            </button>

            {newKey && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-xs text-emerald-400 font-semibold mb-1">Key Created — Save it now!</p>
                <code className="text-xs text-emerald-300 font-mono break-all">{newKey}</code>
                <p className="text-[10px] text-emerald-400/70 mt-1">This key will not be shown again.</p>
              </div>
            )}
          </div>

          {/* Existing Keys */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
            <div className="p-5 border-b border-[#1e1e2e]">
              <h3 className="text-sm font-semibold text-white">Your Trading API Keys</h3>
            </div>
            {keys.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No trading API keys yet. Create one above to enable programmatic access.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Name</th>
                      <th className="text-left px-5 py-3 font-medium">Permissions</th>
                      <th className="text-left px-5 py-3 font-medium">Status</th>
                      <th className="text-left px-5 py-3 font-medium">Last Used</th>
                      <th className="text-left px-5 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e2e]">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-[#1a1a24]">
                        <td className="px-5 py-3 text-sm text-white font-medium">{k.name}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            {k.permissions.map((p) => (
                              <span key={p} className="text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium ${k.isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {k.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
