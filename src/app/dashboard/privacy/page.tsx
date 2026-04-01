'use client';

import PrivacyPolicyEditor from '@/components/privacy/PrivacyPolicyEditor';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Privacy & Routing</h1>
        <p className="text-gray-400 mt-1">
          Control how your inference requests are routed through the decentralised compute network.
          Higher privacy tiers use prompt fragmentation and hardware enclaves to protect your data.
        </p>
      </div>

      <PrivacyPolicyEditor />
    </div>
  );
}
