'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Preferences {
  alertEmails: boolean;
  slackWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  discordWebhookUrl: string;
  webhookUrl: string;
}

type ChannelKey = 'email' | 'slack' | 'telegram' | 'discord' | 'webhook';

interface ChannelStatus {
  saving: boolean;
  testing: boolean;
  result: { ok: boolean; message: string } | null;
}

const EMPTY_PREFS: Preferences = {
  alertEmails: false,
  slackWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  discordWebhookUrl: '',
  webhookUrl: '',
};

// ---------------------------------------------------------------------------
// Toggle (matches settings page style)
// ---------------------------------------------------------------------------

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
        enabled ? 'bg-amber-500' : 'bg-[#1e1e2e]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        } mt-0.5`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Channel icons (inline SVG)
// ---------------------------------------------------------------------------

const icons: Record<ChannelKey, React.ReactNode> = {
  email: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  slack: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.163 0a2.528 2.528 0 012.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.163 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.527 2.527 0 012.52-2.52h6.315A2.528 2.528 0 0124 15.163a2.528 2.528 0 01-2.522 2.523h-6.315z" />
    </svg>
  ),
  telegram: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  discord: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
  webhook: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Input field
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFS);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const blankStatus = (): Record<ChannelKey, ChannelStatus> => ({
    email: { saving: false, testing: false, result: null },
    slack: { saving: false, testing: false, result: null },
    telegram: { saving: false, testing: false, result: null },
    discord: { saving: false, testing: false, result: null },
    webhook: { saving: false, testing: false, result: null },
  });
  const [status, setStatus] = useState<Record<ChannelKey, ChannelStatus>>(blankStatus);

  // -- Fetch on mount --
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/account/notifications');
        if (!res.ok) throw new Error('Failed to load preferences');
        const data = await res.json();
        setPrefs({
          alertEmails: data.alertEmails ?? false,
          slackWebhookUrl: data.slackWebhookUrl ?? '',
          telegramBotToken: data.telegramBotToken ?? '',
          telegramChatId: data.telegramChatId ?? '',
          discordWebhookUrl: data.discordWebhookUrl ?? '',
          webhookUrl: data.webhookUrl ?? '',
        });
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // -- Helpers --
  const patchStatus = useCallback(
    (ch: ChannelKey, patch: Partial<ChannelStatus>) =>
      setStatus((s) => ({ ...s, [ch]: { ...s[ch], ...patch } })),
    [],
  );

  const save = useCallback(
    async (channel: ChannelKey) => {
      patchStatus(channel, { saving: true, result: null });
      try {
        const res = await fetch('/api/account/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefs),
        });
        if (!res.ok) throw new Error('Save failed');
        patchStatus(channel, { saving: false, result: { ok: true, message: 'Saved' } });
      } catch {
        patchStatus(channel, { saving: false, result: { ok: false, message: 'Save failed' } });
      }
    },
    [prefs, patchStatus],
  );

  const test = useCallback(
    async (channel: ChannelKey) => {
      patchStatus(channel, { testing: true, result: null });
      try {
        const res = await fetch('/api/account/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Test failed');
        patchStatus(channel, { testing: false, result: { ok: true, message: data.message || 'Test sent' } });
      } catch (err: unknown) {
        patchStatus(channel, {
          testing: false,
          result: { ok: false, message: err instanceof Error ? err.message : 'Test failed' },
        });
      }
    },
    [patchStatus],
  );

  const isConfigured = (ch: ChannelKey): boolean => {
    switch (ch) {
      case 'email': return prefs.alertEmails;
      case 'slack': return !!prefs.slackWebhookUrl;
      case 'telegram': return !!prefs.telegramBotToken && !!prefs.telegramChatId;
      case 'discord': return !!prefs.discordWebhookUrl;
      case 'webhook': return !!prefs.webhookUrl;
    }
  };

  // -- Render helpers --
  const StatusBadge = ({ ch }: { ch: ChannelKey }) => {
    const configured = isConfigured(ch);
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-lg ${
          configured ? 'text-green-400 bg-green-400/10' : 'text-gray-500 bg-gray-500/10'
        }`}
      >
        {configured ? 'Configured' : 'Not configured'}
      </span>
    );
  };

  const ResultMessage = ({ ch }: { ch: ChannelKey }) => {
    const r = status[ch].result;
    if (!r) return null;
    return (
      <p className={`text-xs mt-2 ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
        {r.message}
      </p>
    );
  };

  const ActionButtons = ({ ch, showTest = true }: { ch: ChannelKey; showTest?: boolean }) => (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => save(ch)}
        disabled={status[ch].saving}
        className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors disabled:opacity-50"
      >
        {status[ch].saving ? 'Saving...' : 'Save'}
      </button>
      {showTest && (
        <button
          onClick={() => test(ch)}
          disabled={status[ch].testing || !isConfigured(ch)}
          className="px-3 py-1.5 text-xs font-medium border border-[#1e1e2e] text-gray-300 hover:text-white hover:border-gray-600 rounded-lg transition-colors disabled:opacity-40"
        >
          {status[ch].testing ? 'Sending...' : 'Test'}
        </button>
      )}
    </div>
  );

  // -- Loading / error --
  if (loading) {
    return (
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-[#1e1e2e] rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-[#1e1e2e] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-[#12121a] rounded-2xl border border-red-500/30 p-6">
        <p className="text-red-400 text-sm">Failed to load notification preferences: {fetchError}</p>
      </div>
    );
  }

  // -- Main render --
  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold mb-1 text-white">Notifications</h3>
      <p className="text-xs md:text-sm text-gray-500 mb-5">
        Configure how you receive alerts for spend thresholds, routing failures, and weekly digests.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ---- Email ---- */}
        <div className="p-4 rounded-xl border border-[#1a1a2a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">{icons.email}<span className="text-sm font-medium text-white">Email</span></div>
            <StatusBadge ch="email" />
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#0a0a0f]">
            <span className="text-sm text-gray-400">Alert emails</span>
            <Toggle
              enabled={prefs.alertEmails}
              onToggle={() => setPrefs((p) => ({ ...p, alertEmails: !p.alertEmails }))}
              label="Toggle alert emails"
            />
          </div>
          <ActionButtons ch="email" showTest={false} />
          <ResultMessage ch="email" />
        </div>

        {/* ---- Slack ---- */}
        <div className="p-4 rounded-xl border border-[#1a1a2a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">{icons.slack}<span className="text-sm font-medium text-white">Slack</span></div>
            <StatusBadge ch="slack" />
          </div>
          <Field
            label="Webhook URL"
            value={prefs.slackWebhookUrl}
            onChange={(v) => setPrefs((p) => ({ ...p, slackWebhookUrl: v }))}
            placeholder="https://hooks.slack.com/services/..."
          />
          <ActionButtons ch="slack" />
          <ResultMessage ch="slack" />
        </div>

        {/* ---- Telegram ---- */}
        <div className="p-4 rounded-xl border border-[#1a1a2a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">{icons.telegram}<span className="text-sm font-medium text-white">Telegram</span></div>
            <StatusBadge ch="telegram" />
          </div>
          <Field
            label="Bot Token"
            value={prefs.telegramBotToken}
            onChange={(v) => setPrefs((p) => ({ ...p, telegramBotToken: v }))}
            placeholder="123456:ABC-DEF..."
          />
          <Field
            label="Chat ID"
            value={prefs.telegramChatId}
            onChange={(v) => setPrefs((p) => ({ ...p, telegramChatId: v }))}
            placeholder="-1001234567890"
          />
          <p className="text-xs text-gray-600">
            Create a bot via{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 underline underline-offset-2">
              @BotFather
            </a>
            , then add it to your group and send a message to get your Chat ID.
          </p>
          <ActionButtons ch="telegram" />
          <ResultMessage ch="telegram" />
        </div>

        {/* ---- Discord ---- */}
        <div className="p-4 rounded-xl border border-[#1a1a2a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">{icons.discord}<span className="text-sm font-medium text-white">Discord</span></div>
            <StatusBadge ch="discord" />
          </div>
          <Field
            label="Webhook URL"
            value={prefs.discordWebhookUrl}
            onChange={(v) => setPrefs((p) => ({ ...p, discordWebhookUrl: v }))}
            placeholder="https://discord.com/api/webhooks/..."
          />
          <ActionButtons ch="discord" />
          <ResultMessage ch="discord" />
        </div>

        {/* ---- Webhook ---- */}
        <div className="p-4 rounded-xl border border-[#1a1a2a] space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">{icons.webhook}<span className="text-sm font-medium text-white">Custom Webhook</span></div>
            <StatusBadge ch="webhook" />
          </div>
          <Field
            label="Endpoint URL"
            value={prefs.webhookUrl}
            onChange={(v) => setPrefs((p) => ({ ...p, webhookUrl: v }))}
            placeholder="https://your-server.com/webhooks/inferlane"
          />
          <p className="text-xs text-gray-600">
            We&apos;ll POST a JSON payload with <code className="text-gray-400 bg-[#0a0a0f] px-1 rounded">{'{ type, message, timestamp }'}</code> to this URL.
          </p>
          <ActionButtons ch="webhook" />
          <ResultMessage ch="webhook" />
        </div>
      </div>
    </div>
  );
}
