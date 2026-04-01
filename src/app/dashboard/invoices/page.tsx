'use client';

import { useState, useEffect, useCallback } from 'react';

interface InvoiceSummary {
  month: string;
  totalCost: number;
  byProvider: Record<string, number>;
  requestCount: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices/export');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.months || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function handleExportPdf(month: string) {
    setExporting(month);
    try {
      const res = await fetch(`/api/invoices/pdf?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inferlane-invoice-${month}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setExporting(null);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatMonth(yyyymm: string) {
    const [year, month] = yyyymm.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monthly spend summaries with PDF export for finance teams.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No invoices yet</h3>
          <p className="text-sm text-gray-500">
            Invoices will appear once you have spend data tracked through your providers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.month}
              className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 md:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-white">
                    {formatMonth(invoice.month)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {invoice.requestCount.toLocaleString()} requests
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg md:text-xl font-bold text-white">
                    {formatCurrency(invoice.totalCost)}
                  </p>
                  <button
                    onClick={() => handleExportPdf(invoice.month)}
                    disabled={exporting === invoice.month}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                  >
                    {exporting === invoice.month ? 'Exporting...' : 'Export PDF'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(invoice.byProvider)
                  .sort(([, a], [, b]) => b - a)
                  .map(([provider, cost]) => (
                    <div
                      key={provider}
                      className="bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] px-3 py-2"
                    >
                      <p className="text-xs text-gray-500">{provider}</p>
                      <p className="text-sm font-medium text-white">
                        {formatCurrency(cost)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
