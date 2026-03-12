'use client';

import ProviderCard from '@/components/ProviderCard';
import { useProviders } from '@/hooks/useProviders';

export default function ProvidersPage() {
  const { providers, loading } = useProviders();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Connected Providers</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your AI provider connections and monitor usage across all platforms.
        </p>
      </div>
      {providers.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      ) : (
        <div className="bg-[#12121a] rounded-2xl border border-dashed border-[#2a2a3a] p-10 text-center">
          <p className="text-gray-400 mb-2">No providers connected</p>
          <p className="text-sm text-gray-600">
            Connect your first AI provider to start monitoring usage and spend.
          </p>
        </div>
      )}
    </div>
  );
}
