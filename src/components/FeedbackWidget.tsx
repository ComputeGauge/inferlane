'use client';

import { useState } from 'react';
import { useTrack, EVENTS } from '@/hooks/useTrack';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('feature');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const track = useTrack();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: feedback }),
      });
      if (res.ok) {
        track(EVENTS.FEEDBACK_SUBMIT, { type });
        setStatus('sent');
        setFeedback('');
        setTimeout(() => {
          setOpen(false);
          setStatus('idle');
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-80 bg-[#12121a] border border-[#1e1e2e] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#1e1e2e]">
            <h3 className="text-sm font-semibold text-white">Send Feedback</h3>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {status === 'sent' ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-green-400 font-medium">Thanks for your feedback!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="flex gap-2">
                {(['bug', 'feature', 'other'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      type === t
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-[#1e1e2e] text-gray-400 border border-transparent hover:border-[#2a2a3a]'
                    }`}
                  >
                    {t === 'bug' ? 'Bug' : t === 'feature' ? 'Feature' : 'Other'}
                  </button>
                ))}
              </div>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={3}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
              />
              <button
                type="submit"
                disabled={!feedback.trim() || status === 'sending'}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
              >
                {status === 'sending' ? 'Sending...' : 'Send Feedback'}
              </button>
              {status === 'error' && <p className="text-xs text-red-400">Failed to send. Try again.</p>}
            </form>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all flex items-center justify-center"
          aria-label="Send feedback"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
}
