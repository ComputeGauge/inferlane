'use client';

import CreditBalanceCard from '@/components/credits/CreditBalanceCard';
import PoolDelegation from '@/components/credits/PoolDelegation';
import MarketplaceOffers from '@/components/credits/MarketplaceOffers';
import TransactionHistory from '@/components/credits/TransactionHistory';

export default function CreditsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Credits</h1>
        <p className="text-gray-500 mt-1">
          Manage your compute credits &mdash; delegate to the pool, trade on the marketplace, and track your history.
        </p>
      </header>

      <CreditBalanceCard />

      <div className="grid md:grid-cols-2 gap-6">
        <PoolDelegation />
        <MarketplaceOffers />
      </div>

      <TransactionHistory />
    </div>
  );
}
