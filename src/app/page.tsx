'use client';

import { useState } from 'react';
import ComputeGauge from '@/components/ComputeGauge';
import SpendChart from '@/components/SpendChart';
import AlertPanel from '@/components/AlertPanel';
import CostComparisonTable from '@/components/CostComparisonTable';
import ProviderCard from '@/components/ProviderCard';
import TopUpBanner from '@/components/TopUpBanner';
import ConnectProvider from '@/components/ConnectProvider';
import StatsBar from '@/components/StatsBar';
import MarketplaceCard from '@/components/MarketplaceCard';
import AffiliateEarningsPanel from '@/components/AffiliateEarningsPanel';
import AuthModal from '@/components/AuthModal';
import UserMenu from '@/components/UserMenu';
import { useAuth } from '@/contexts/AuthContext';
import {
  providers,
  spendHistory,
  alerts,
  costComparisons,
  getTotalSpend,
  getTotalBudget,
  getProjectedMonthlySpend,
} from '@/lib/mock-data';
import {
  marketplaceListings,
  MarketplaceCategory,
} from '@/lib/marketplace-data';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'providers' | 'router' | 'marketplace' | 'earnings' | 'landing'>('landing');
  const [marketplaceCategory, setMarketplaceCategory] = useState<MarketplaceCategory>('all');
  const { isAuthenticated, setShowAuthModal } = useAuth();
  const totalSpend = getTotalSpend();
  const totalBudget = getTotalBudget();
  const projected = getProjectedMonthlySpend();

  const stats = [
    {
      label: 'Total Spend (MTD)',
      value: `$${totalSpend.toFixed(2)}`,
      subValue: `of $${totalBudget.toFixed(0)} budget`,
      trend: 'up' as const,
      trendValue: '12% vs last month',
    },
    {
      label: 'Projected Monthly',
      value: `$${projected.toFixed(0)}`,
      subValue: projected > totalBudget ? `$${(projected - totalBudget).toFixed(0)} over budget` : 'Within budget',
      trend: projected > totalBudget ? ('up' as const) : ('down' as const),
      trendValue: projected > totalBudget ? 'Over budget' : 'On track',
    },
    {
      label: 'Active Models',
      value: `${providers.reduce((s, p) => s + p.models.length, 0)}`,
      subValue: `Across ${providers.length} providers`,
    },
    {
      label: 'Potential Savings',
      value: '$18/mo',
      subValue: 'Switch to cloud providers',
      trend: 'down' as const,
      trendValue: '~7% reduction',
    },
  ];

  if (activeTab === 'landing') {
    return (
      <>
        <AuthModal />
        <LandingPage onGetStarted={() => {
          if (!isAuthenticated) {
            setShowAuthModal(true);
          } else {
            setActiveTab('dashboard');
          }
        }}
        onSignIn={() => setShowAuthModal(true)}
        onDashboard={() => setActiveTab('dashboard')}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button onClick={() => setActiveTab('landing')} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-bold text-white text-lg">ComputeGauge</span>
              </button>
              <div className="flex gap-1">
                {[
                  { key: 'dashboard', label: 'Dashboard' },
                  { key: 'providers', label: 'Providers' },
                  { key: 'router', label: 'Smart Router' },
                  { key: 'marketplace', label: 'Marketplace' },
                  { key: 'earnings', label: 'Earnings' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? 'bg-[#1e1e2e] text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnectProvider />
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      <AuthModal />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {activeTab === 'dashboard' && (
          <>
            <TopUpBanner providers={providers} />
            <StatsBar stats={stats} />

            {/* Fuel Gauges */}
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Compute Fuel Gauges</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {providers.map((p) => (
                  <ComputeGauge
                    key={p.id}
                    value={(p.currentSpend / p.monthlyBudget) * 100}
                    label={p.name}
                    spent={p.currentSpend.toFixed(2)}
                    budget={p.monthlyBudget.toFixed(0)}
                    color={p.color}
                    gradientFrom={p.gradientFrom}
                    gradientTo={p.gradientTo}
                  />
                ))}
              </div>
            </div>

            {/* Chart + Alerts */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SpendChart data={spendHistory} />
              </div>
              <AlertPanel alerts={alerts} />
            </div>
          </>
        )}

        {activeTab === 'providers' && (
          <div className="grid md:grid-cols-2 gap-6">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )}

        {activeTab === 'router' && (
          <div className="space-y-6">
            <CostComparisonTable comparisons={costComparisons} />

            {/* Cloud marketplace CTAs */}
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Save with Cloud Marketplaces</h3>
              <p className="text-sm text-gray-500 mb-6">
                Access the same AI models through cloud providers. Consolidate billing, get volume discounts, and use committed spend credits.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  {
                    name: 'AWS Bedrock',
                    description: 'Claude, Llama, Mistral models. Pay-as-you-go or provisioned throughput.',
                    savings: 'Up to 20% with Savings Plans',
                    color: '#ff9900',
                    url: 'https://aws.amazon.com/bedrock/',
                    logo: '🟠',
                  },
                  {
                    name: 'Azure OpenAI',
                    description: 'GPT-4o, DALL-E models. Enterprise security and compliance.',
                    savings: 'Up to 15% with Reserved Capacity',
                    color: '#0078d4',
                    url: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
                    logo: '🔷',
                  },
                  {
                    name: 'GCP Vertex AI',
                    description: 'Gemini, Claude, PaLM models. Integrated with BigQuery.',
                    savings: 'Up to 10% with Committed Use',
                    color: '#4285f4',
                    url: 'https://cloud.google.com/vertex-ai',
                    logo: '🔵',
                  },
                ].map((cloud) => (
                  <a
                    key={cloud.name}
                    href={cloud.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl border border-[#1a1a2a] hover:border-[#3a3a4a] transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{cloud.logo}</span>
                      <h4 className="font-semibold text-white text-sm group-hover:text-amber-400 transition-colors">
                        {cloud.name}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{cloud.description}</p>
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">
                      {cloud.savings}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
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
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <AffiliateEarningsPanel />

            {/* How it works */}
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">How You Earn</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-white mb-1">1. Signup Bonus</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Earn $5-$50 per new user who signs up through your ComputeGauge dashboard.
                    Attribution via cookie tracking (30-90 day window).
                  </p>
                  <p className="text-lg font-bold text-blue-400 font-mono mt-2">$5 - $50</p>
                  <p className="text-[10px] text-gray-600">per signup</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-white mb-1">2. Recurring Commission</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Earn 8-18% of your referral's monthly spend for 12-24 months or lifetime.
                    The more they use, the more you earn — passively.
                  </p>
                  <p className="text-lg font-bold text-green-400 font-mono mt-2">8% - 18%</p>
                  <p className="text-[10px] text-gray-600">of monthly spend, recurring</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-white mb-1">3. Top-Up Commission</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Every time a referred user tops up credits or renews their plan,
                    you earn 5-12% of that top-up. Low fuel = your payday.
                  </p>
                  <p className="text-lg font-bold text-amber-400 font-mono mt-2">5% - 12%</p>
                  <p className="text-[10px] text-gray-600">on every top-up & renewal</p>
                </div>
              </div>
            </div>

            {/* Revenue projection */}
            <div className="bg-gradient-to-r from-green-500/5 via-[#12121a] to-amber-500/5 rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Revenue Projection</h3>
              <p className="text-sm text-gray-500 mb-4">Based on current growth rate</p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { period: 'This Month', amount: '$5,814', trend: 'current' },
                  { period: '3 Months', amount: '$9,200', trend: 'up' },
                  { period: '6 Months', amount: '$18,500', trend: 'up' },
                  { period: '12 Months', amount: '$42,000', trend: 'up' },
                ].map((proj) => (
                  <div key={proj.period} className="bg-[#0a0a0f] rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider">{proj.period}</p>
                    <p className="text-xl font-bold text-white font-mono mt-1">{proj.amount}</p>
                    {proj.trend === 'up' && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[10px] text-green-400">projected</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LandingPage({ onGetStarted, onSignIn, onDashboard }: { onGetStarted: () => void; onSignIn?: () => void; onDashboard?: () => void }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Hero nav */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg">ComputeGauge</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
          {isAuthenticated ? (
            <button
              onClick={onDashboard}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={onSignIn}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={onGetStarted}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Get Started Free
              </button>
            </>
          )}
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 text-center relative">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 text-xs font-medium px-3 py-1 rounded-full mb-6 border border-amber-500/20">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
            The cost intelligence layer for AI agents
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Make every AI agent
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              cost-aware.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            ComputeGauge MCP gives any AI agent instant cost intelligence. Model selection, spend tracking, credibility scoring, and local-to-cloud routing. Install once, save 40-70%.
          </p>

          {/* Install snippet */}
          <div className="max-w-lg mx-auto mb-10">
            <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 font-mono text-sm text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs">Add to your MCP config:</span>
                <button
                  onClick={() => navigator.clipboard.writeText('{\n  "mcpServers": {\n    "computegauge": {\n      "command": "npx",\n      "args": ["-y", "@computegauge/mcp"]\n    }\n  }\n}')}
                  className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-green-400 whitespace-pre overflow-x-auto"><code>{`{
  "mcpServers": {
    "computegauge": {
      "command": "npx",
      "args": ["-y", "@computegauge/mcp"]
    }
  }
}`}</code></pre>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.npmjs.com/package/@computegauge/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
            >
              Install from npm
            </a>
            <a
              href="https://github.com/ComputeGauge/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-[#12121a] border border-[#1e1e2e] text-white font-medium rounded-xl text-lg hover:border-[#3a3a4a] transition-all"
            >
              View on GitHub
            </a>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
            {['Works with Claude, Cursor & Windsurf', '18 tools, zero config', 'Apache-2.0 open source'].map((text) => (
              <span key={text} className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            18 tools your agent gets automatically
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Install once. Every session is cost-aware and credibility-building.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: 'M13 10V3L4 14h7v7l9-11h-7z',
              title: 'pick_model',
              description: 'Scores every model on quality, cost, and speed for 14 task types. Returns the optimal model for any request. Saves 40-70% on average.',
              color: '#f59e0b',
            },
            {
              icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              title: 'log_request + session_cost',
              description: 'Real-time spend tracking per session. Know exactly what every API call costs. Budget alerts before you overshoot.',
              color: '#3b82f6',
            },
            {
              icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
              title: 'Agent Credibility',
              description: 'Build a 0-1000 reputation score. Earn points for smart routing, honest reporting, and task success. Compete on a leaderboard.',
              color: '#8b5cf6',
            },
            {
              icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
              title: 'Local-to-Cloud Routing',
              description: 'Auto-detect Ollama, vLLM, and 5 other local endpoints. Route to cloud only when local quality falls short. Earn credibility for smart decisions.',
              color: '#10a37f',
            },
            {
              icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
              title: 'Model Ratings & Integrity',
              description: 'Rate model performance. Anti-spam filters ensure honest data. Community-driven quality scores improve recommendations for everyone.',
              color: '#ef4444',
            },
            {
              icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              title: 'Cost Intelligence',
              description: 'Spend summaries, budget alerts, usage trends, and savings recommendations. Real pricing across 8 providers and 20+ models.',
              color: '#06b6d4',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 hover:border-[#2a2a3a] transition-all"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Open source core. Pro dashboard.</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            The MCP server is free forever. Upgrade for team dashboards and advanced analytics.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: 'MCP Server',
              price: '$0',
              period: '/forever',
              description: 'Open source — Apache 2.0',
              features: ['18 agent tools via MCP', 'pick_model optimization', 'Session cost tracking', 'Agent credibility scoring', 'Local cluster detection', 'Budget guardrails', 'Works with any MCP client'],
              cta: 'Install Free',
              highlighted: false,
            },
            {
              name: 'Pro Dashboard',
              price: '$9',
              period: '/month',
              description: 'For power users and teams',
              features: ['Everything in MCP Server', 'Web dashboard with analytics', 'Cross-session spend history', 'Team cost breakdowns', 'Provider comparison tools', 'Export & reporting', 'Priority support'],
              cta: 'Start Pro Trial',
              highlighted: true,
            },
            {
              name: 'Enterprise',
              price: 'Custom',
              period: '',
              description: 'For organizations at scale',
              features: ['Everything in Pro', 'SSO & SAML', 'On-prem deployment', 'Custom routing policies', 'SLA & dedicated support', 'Audit logs', 'Volume discounts'],
              cta: 'Contact Sales',
              highlighted: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-amber-500/10 to-[#12121a] border-amber-500/30 relative'
                  : 'bg-[#12121a] border-[#1e1e2e]'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="font-semibold text-white text-lg">{plan.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onGetStarted}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110'
                    : 'bg-[#1e1e2e] text-white hover:bg-[#2a2a3a]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-3xl border border-amber-500/20 p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 pulse-glow" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              One install. Every agent is cost-aware.
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-8">
              Add ComputeGauge MCP to your config. Your agents start saving 40-70% immediately — and build visible credibility while doing it.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.npmjs.com/package/@computegauge/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl text-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
              >
                npm install @computegauge/mcp
              </a>
              <a
                href="https://github.com/ComputeGauge/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-[#12121a] border border-[#1e1e2e] text-white font-medium rounded-xl text-lg hover:border-[#3a3a4a] transition-all"
              >
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm text-gray-500">ComputeGauge</span>
            </div>
            <p className="text-xs text-gray-600">The cost intelligence layer for AI agents</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
