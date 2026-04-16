'use client';

import { useState, useEffect, useCallback } from 'react';
import PromptAdvisor from '@/components/scheduler/PromptAdvisor';
import { Skeleton } from '@/components/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'promotions' | 'queue' | 'suggestions' | 'history';

interface Promotion {
  id: string;
  provider: string;
  title: string;
  type: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  eligiblePlans: string[];
  offPeakOnly: boolean;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  status: string;
  confidence: number;
}

interface ScheduledPrompt {
  id: string;
  title: string;
  model: string;
  status: string;
  scheduleType: string;
  scheduledAt: string | null;
  executedAt: string | null;
  response: string | null;
  tokensUsed: { input?: number; output?: number } | null;
  costCents: number | null;
  savingsCents: number | null;
  error: string | null;
  priority: string;
  createdAt: string;
}

interface Suggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  model: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  estimatedTokens: number;
  estimatedCostCents: number;
  whyDuringBonus: string;
  chainSteps?: {
    index: number;
    title: string;
    model: string;
    systemPrompt: string;
    userPromptTemplate: string;
    estimatedTokens: number;
  }[];
  tags: string[];
  savings?: {
    normalCostCents: number;
    bonusCostCents: number;
    savingsCents: number;
    savingsPercent: number;
  };
  activePromotion?: {
    id: string;
    provider: string;
    title: string;
    multiplier: number;
    endsAt: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'promotions', label: 'Active Promotions' },
  { id: 'queue', label: 'Prompt Queue' },
  { id: 'suggestions', label: 'AI Suggestions' },
  { id: 'history', label: 'History' },
];

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  QUEUED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  SCHEDULED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RUNNING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  EXPIRED: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
  UPCOMING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  IMMEDIATE: 'Immediate',
  TIME_BASED: 'Time-based',
  PROMOTION_TRIGGERED: 'Promo trigger',
  PRICE_TRIGGERED: 'Price trigger',
  RECURRING: 'Recurring',
  OPTIMAL_WINDOW: 'Optimal window',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  critical: 'text-red-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.CANCELLED;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style}`}>
      {status === 'RUNNING' && (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4 mb-4" />
      <Skeleton className="h-8 w-24 rounded-xl" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4 flex gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Prompt Form
// ---------------------------------------------------------------------------

interface NewPromptFormProps {
  onClose: () => void;
  onSubmit: () => void;
}

function NewPromptForm({ onClose, onSubmit }: NewPromptFormProps) {
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [scheduleType, setScheduleType] = useState('OPTIMAL_WINDOW');
  const [scheduledAt, setScheduledAt] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        title,
        model,
        systemPrompt: systemPrompt || null,
        messages: [{ role: 'user', content: userMessage }],
        scheduleType,
        priority,
      };

      if (scheduleType === 'TIME_BASED' && scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }
      if (scheduleType === 'RECURRING' && cronExpression) {
        body.cronExpression = cronExpression;
      }

      const res = await fetch('/api/scheduler/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSubmit();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create prompt:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">New Scheduled Prompt</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Daily security scan"
            className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="claude-opus-4-20250514">Claude Opus</option>
            <option value="claude-sonnet-4-5">Claude Sonnet</option>
            <option value="claude-haiku-3-20240307">Claude Haiku</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
          </select>
        </div>

        {/* System prompt */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">System Prompt (optional)</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="Set the AI's role and behaviour..."
            className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-none"
          />
        </div>

        {/* User message */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">User Message</label>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            required
            rows={4}
            placeholder="Your prompt..."
            className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-none"
          />
        </div>

        {/* Schedule type */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Schedule Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: 'TIME_BASED', label: 'Time-based' },
              { value: 'PROMOTION_TRIGGERED', label: 'Promo trigger' },
              { value: 'OPTIMAL_WINDOW', label: 'Optimal window' },
              { value: 'RECURRING', label: 'Recurring' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScheduleType(opt.value)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  scheduleType === opt.value
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-[#0a0a0f] text-gray-400 border-[#1e1e2e] hover:border-[#2e2e3e]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional fields */}
        {scheduleType === 'TIME_BASED' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Scheduled At</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>
        )}

        {scheduleType === 'RECURRING' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cron Expression</label>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="0 9 * * 1-5 (weekdays at 9am)"
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Priority</label>
          <div className="flex gap-2">
            {['low', 'medium', 'high', 'critical'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                  priority === p
                    ? `${PRIORITY_STYLES[p]} bg-[#1e1e2e] border-[#2e2e3e]`
                    : 'text-gray-500 bg-[#0a0a0f] border-[#1e1e2e] hover:border-[#2e2e3e]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !title || !userMessage}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
          >
            {submitting ? 'Scheduling...' : 'Schedule Prompt'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Active Promotions
// ---------------------------------------------------------------------------

function PromotionsTab({
  promotions,
  loading,
}: {
  promotions: Promotion[];
  loading: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Suppress unused var warning — we need now for re-renders
  void now;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (promotions.length === 0) {
    return (
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-[#1e1e2e] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm mb-1">No active promotions detected</p>
        <p className="text-gray-600 text-xs">
          We scan provider announcements every 30 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {promotions.map((promo) => (
        <div
          key={promo.id}
          className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5 hover:border-amber-500/20 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                {promo.provider.slice(0, 2)}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{promo.provider}</p>
                <p className="text-gray-500 text-xs">{promo.type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {promo.multiplier}x
            </span>
          </div>

          <p className="text-gray-300 text-sm mb-3">{promo.title}</p>

          {/* Date range + countdown */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDate(promo.startsAt)} &ndash; {formatDate(promo.endsAt)}</span>
            <span className="text-amber-400 font-medium">{formatCountdown(promo.endsAt)}</span>
          </div>

          {/* Off-peak indicator */}
          {promo.offPeakOnly && promo.peakHoursStart && promo.peakHoursEnd && (
            <p className="text-xs text-gray-500 mb-3">
              Off-peak only: outside {promo.peakHoursStart} &ndash; {promo.peakHoursEnd}
            </p>
          )}

          {/* Eligible plans */}
          {promo.eligiblePlans.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {promo.eligiblePlans.map((plan) => (
                <span
                  key={plan}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-[#1e1e2e] text-gray-400"
                >
                  {plan}
                </span>
              ))}
            </div>
          )}

          {/* Status + CTA */}
          <div className="flex items-center justify-between">
            <StatusBadge status={promo.status} />
            <button className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all">
              Queue Prompts
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Prompt Queue
// ---------------------------------------------------------------------------

function QueueTab({
  prompts,
  loading,
  onRefresh,
}: {
  prompts: ScheduledPrompt[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/scheduler/prompts?id=${id}`, {
        method: 'DELETE',
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to cancel prompt:', err);
    }
  };

  const handleRerun = async (prompt: ScheduledPrompt) => {
    try {
      await fetch('/api/scheduler/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${prompt.title} (re-run)`,
          model: prompt.model,
          scheduleType: 'IMMEDIATE',
          priority: prompt.priority,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to re-run prompt:', err);
    }
  };

  // Filter to queued/scheduled/running
  const queued = prompts.filter((p) =>
    ['QUEUED', 'SCHEDULED', 'RUNNING'].includes(p.status),
  );

  if (loading) return <TableSkeleton />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm">
          {queued.length} prompt{queued.length !== 1 ? 's' : ''} in queue
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all"
        >
          + New Prompt
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <NewPromptForm onClose={() => setShowForm(false)} onSubmit={onRefresh} />
      )}

      {queued.length === 0 && !showForm ? (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
          <p className="text-gray-400 text-sm mb-1">No prompts in queue</p>
          <p className="text-gray-600 text-xs">
            Create a new prompt or queue one from AI Suggestions.
          </p>
        </div>
      ) : (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_100px_110px_90px_130px_100px_80px] gap-2 px-4 py-3 border-b border-[#1e1e2e] text-xs text-gray-500 font-medium">
            <span>Title</span>
            <span>Model</span>
            <span>Schedule</span>
            <span>Status</span>
            <span>Scheduled For</span>
            <span>Cost/Savings</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          {queued.map((prompt) => (
            <div
              key={prompt.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_100px_110px_90px_130px_100px_80px] gap-2 px-4 py-3 border-b border-[#1e1e2e] last:border-b-0 items-center hover:bg-[#1e1e2e]/30 transition-colors"
            >
              <div>
                <p className="text-white text-sm font-medium truncate">{prompt.title}</p>
                <p className={`text-xs capitalize ${PRIORITY_STYLES[prompt.priority] ?? 'text-gray-500'}`}>
                  {prompt.priority}
                </p>
              </div>
              <span className="text-xs text-gray-400 truncate">
                {prompt.model.split('-').slice(0, 2).join(' ')}
              </span>
              <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES.SCHEDULED}`}>
                {SCHEDULE_TYPE_LABELS[prompt.scheduleType] ?? prompt.scheduleType}
              </span>
              <StatusBadge status={prompt.status} />
              <span className="text-xs text-gray-400">
                {formatDate(prompt.scheduledAt)}
              </span>
              <div className="text-xs">
                {prompt.costCents != null && (
                  <span className="text-gray-400">{prompt.costCents.toFixed(1)}c</span>
                )}
                {prompt.savingsCents != null && prompt.savingsCents > 0 && (
                  <span className="text-green-400 ml-1">-{prompt.savingsCents.toFixed(1)}c</span>
                )}
                {prompt.costCents == null && <span className="text-gray-600">—</span>}
              </div>
              <div className="flex gap-1">
                {['QUEUED', 'SCHEDULED'].includes(prompt.status) && (
                  <button
                    onClick={() => handleCancel(prompt.id)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    title="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {prompt.status === 'COMPLETED' && (
                  <button
                    onClick={() => handleRerun(prompt)}
                    className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
                    title="Re-run"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: AI Suggestions (wraps PromptAdvisor)
// ---------------------------------------------------------------------------

function SuggestionsTab({
  suggestions,
  loading,
}: {
  suggestions: Suggestion[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return <PromptAdvisor suggestions={suggestions} />;
}

// ---------------------------------------------------------------------------
// Tab 4: History
// ---------------------------------------------------------------------------

function HistoryTab({
  prompts,
  loading,
  onRerun,
}: {
  prompts: ScheduledPrompt[];
  loading: boolean;
  onRerun: (prompt: ScheduledPrompt) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completed = prompts.filter((p) =>
    ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(p.status),
  );

  if (loading) return <TableSkeleton />;

  if (completed.length === 0) {
    return (
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
        <p className="text-gray-400 text-sm mb-1">No prompt history yet</p>
        <p className="text-gray-600 text-xs">
          Completed and failed prompts will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[1fr_100px_130px_100px_80px_80px_80px_60px] gap-2 px-4 py-3 border-b border-[#1e1e2e] text-xs text-gray-500 font-medium">
        <span>Title</span>
        <span>Model</span>
        <span>Executed At</span>
        <span>Tokens</span>
        <span>Cost</span>
        <span>Savings</span>
        <span>Status</span>
        <span></span>
      </div>

      {completed.map((prompt) => (
        <div key={prompt.id}>
          <div
            className="grid grid-cols-1 md:grid-cols-[1fr_100px_130px_100px_80px_80px_80px_60px] gap-2 px-4 py-3 border-b border-[#1e1e2e] items-center hover:bg-[#1e1e2e]/30 transition-colors cursor-pointer"
            onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
          >
            <p className="text-white text-sm font-medium truncate">{prompt.title}</p>
            <span className="text-xs text-gray-400 truncate">
              {prompt.model.split('-').slice(0, 2).join(' ')}
            </span>
            <span className="text-xs text-gray-400">{formatDate(prompt.executedAt)}</span>
            <span className="text-xs text-gray-400">
              {prompt.tokensUsed
                ? `${prompt.tokensUsed.input ?? 0}/${prompt.tokensUsed.output ?? 0}`
                : '—'}
            </span>
            <span className="text-xs text-gray-400">
              {prompt.costCents != null ? `${prompt.costCents.toFixed(1)}c` : '—'}
            </span>
            <span className="text-xs text-green-400">
              {prompt.savingsCents != null && prompt.savingsCents > 0
                ? `-${prompt.savingsCents.toFixed(1)}c`
                : '—'}
            </span>
            <StatusBadge status={prompt.status} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRerun(prompt);
              }}
              className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
              title="Re-run"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Expanded response */}
          {expandedId === prompt.id && (
            <div className="px-4 py-3 border-b border-[#1e1e2e] bg-[#0a0a0f]">
              {prompt.response ? (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                  {prompt.response}
                </pre>
              ) : prompt.error ? (
                <p className="text-xs text-red-400">{prompt.error}</p>
              ) : (
                <p className="text-xs text-gray-600">No response data available.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SchedulerPage() {
  const [activeTab, setActiveTab] = useState<TabId>('promotions');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [prompts, setPrompts] = useState<ScheduledPrompt[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const fetchPromotions = useCallback(async () => {
    setLoadingPromotions(true);
    try {
      const res = await fetch('/api/promotions');
      if (res.ok) {
        const data = await res.json();
        setPromotions(Array.isArray(data.promotions) ? data.promotions : []);
      }
    } catch {
      // fail silently
    } finally {
      setLoadingPromotions(false);
    }
  }, []);

  const fetchPrompts = useCallback(async () => {
    setLoadingPrompts(true);
    try {
      const res = await fetch('/api/scheduler/prompts');
      if (res.ok) {
        const data = await res.json();
        setPrompts(Array.isArray(data.prompts) ? data.prompts : Array.isArray(data) ? data : []);
      }
    } catch {
      // fail silently
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/scheduler/suggestions');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      }
    } catch {
      // fail silently
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
    fetchPrompts();
    fetchSuggestions();
  }, [fetchPromotions, fetchPrompts, fetchSuggestions]);

  const handleRerun = async (prompt: ScheduledPrompt) => {
    try {
      await fetch('/api/scheduler/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${prompt.title} (re-run)`,
          model: prompt.model,
          scheduleType: 'IMMEDIATE',
          priority: prompt.priority,
        }),
      });
      fetchPrompts();
    } catch (err) {
      console.error('Failed to re-run prompt:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Prompt Scheduler</h1>
        <p className="text-gray-500 text-sm mt-1">
          Queue prompts during promotions, schedule recurring tasks, and get AI-powered suggestions.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-[#12121a] rounded-xl p-1 border border-[#1e1e2e] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#1e1e2e] text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'promotions' && (
        <PromotionsTab promotions={promotions} loading={loadingPromotions} />
      )}

      {activeTab === 'queue' && (
        <QueueTab
          prompts={prompts}
          loading={loadingPrompts}
          onRefresh={fetchPrompts}
        />
      )}

      {activeTab === 'suggestions' && (
        <SuggestionsTab suggestions={suggestions} loading={loadingSuggestions} />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          prompts={prompts}
          loading={loadingPrompts}
          onRerun={handleRerun}
        />
      )}
    </div>
  );
}
