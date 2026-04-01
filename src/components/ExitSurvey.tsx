'use client';

import { useState, useCallback } from 'react';

interface ExitSurveyProps {
  open: boolean;
  onClose: () => void;
  onConfirmCancel: (reason: string, feedback: string) => void;
  loading?: boolean;
}

const REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_enough_value', label: "Didn't get enough value" },
  { id: 'missing_features', label: 'Missing features I need' },
  { id: 'switched_competitor', label: 'Switched to another tool' },
  { id: 'project_ended', label: 'Project ended / no longer need it' },
  { id: 'technical_issues', label: 'Technical issues' },
  { id: 'other', label: 'Other' },
];

export default function ExitSurvey({ open, onClose, onConfirmCancel, loading = false }: ExitSurveyProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const handleConfirm = useCallback(() => {
    if (!selectedReason) return;
    onConfirmCancel(selectedReason, feedback);
  }, [selectedReason, feedback, onConfirmCancel]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setSelectedReason(null);
    setFeedback('');
    onClose();
  }, [loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#12121a] border border-[#1e1e2e] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1e1e2e]">
          <h3 className="text-lg font-semibold text-white">We&apos;re sorry to see you go</h3>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-400">
            Please let us know why you&apos;re cancelling so we can improve.
          </p>

          {/* Reasons */}
          <div className="space-y-2">
            {REASONS.map((reason) => (
              <button
                key={reason.id}
                type="button"
                onClick={() => setSelectedReason(reason.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all ${
                  selectedReason === reason.id
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                    : 'bg-[#0a0a0f] border border-[#1e1e2e] text-gray-300 hover:border-[#2a2a3a]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedReason === reason.id
                      ? 'border-amber-500'
                      : 'border-gray-600'
                  }`}
                >
                  {selectedReason === reason.id && (
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
                {reason.label}
              </button>
            ))}
          </div>

          {/* Optional feedback */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
              Anything else you&apos;d like us to know?
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional feedback..."
              rows={3}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-[#1e1e2e]">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-[#1e1e2e] rounded-xl hover:bg-[#2a2a3a] transition-all disabled:opacity-50"
          >
            Keep My Plan
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500/80 rounded-xl hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Cancel Subscription'}
          </button>
        </div>
      </div>
    </div>
  );
}
