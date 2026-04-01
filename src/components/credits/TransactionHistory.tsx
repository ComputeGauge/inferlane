'use client';

import { useState, useEffect, useCallback } from 'react';

type TransactionType =
  | 'POOL_EARNING'
  | 'MARKET_SALE'
  | 'POOL_DELEGATE'
  | 'POOL_RECALL'
  | 'MARKET_LIST'
  | 'MARKET_DELIST'
  | 'MARKET_PURCHASE'
  | 'ALLOCATION'
  | 'EXPIRY';

interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

const TYPE_STYLES: Record<string, string> = {
  POOL_EARNING: 'bg-green-500/10 text-green-400 border-green-500/20',
  MARKET_SALE: 'bg-green-500/10 text-green-400 border-green-500/20',
  POOL_DELEGATE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  POOL_RECALL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  MARKET_LIST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  MARKET_DELIST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  MARKET_PURCHASE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ALLOCATION: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  EXPIRY: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

function formatType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export default function TransactionHistory() {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/credits/transactions?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 space-y-4">
      <h3 className="text-white font-semibold text-lg">Transaction History</h3>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : !data || data.transactions.length === 0 ? (
        <p className="text-gray-600 text-sm py-8 text-center">No transactions yet</p>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-[#1e1e2e]">
                  <th className="text-left py-3 pr-4 font-medium">Date</th>
                  <th className="text-left py-3 pr-4 font-medium">Type</th>
                  <th className="text-right py-3 pr-4 font-medium">Amount</th>
                  <th className="text-right py-3 pr-4 font-medium">Balance</th>
                  <th className="text-left py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/20 transition-colors">
                    <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${
                          TYPE_STYLES[tx.type] || TYPE_STYLES.ALLOCATION
                        }`}
                      >
                        {formatType(tx.type)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-white font-medium whitespace-nowrap">
                      {tx.amount >= 0 ? '+' : ''}
                      {tx.amount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-400 whitespace-nowrap">
                      {tx.balanceAfter.toLocaleString()}
                    </td>
                    <td className="py-3 text-gray-500 max-w-[200px] truncate">{tx.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-1.5 rounded-lg border border-[#1e1e2e] text-gray-400 text-sm font-medium hover:bg-[#1e1e2e] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              Previous
            </button>
            <span className="text-gray-500 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-1.5 rounded-lg border border-[#1e1e2e] text-gray-400 text-sm font-medium hover:bg-[#1e1e2e] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
