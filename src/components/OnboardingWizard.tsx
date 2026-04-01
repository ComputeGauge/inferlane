'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrack, EVENTS } from '@/hooks/useTrack';

const ONBOARDING_KEY = 'il_onboarding_complete';

const steps = [
  {
    title: 'Welcome to InferLane',
    description: 'The cost intelligence layer for your AI stack. Let\'s get you set up in under 2 minutes.',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
        <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
    ),
    bullets: [
      'Track spend across all AI providers in one dashboard',
      'Get alerts before you blow your budget',
      'Compare model costs and find savings',
    ],
  },
  {
    title: 'Connect a Provider',
    description: 'Link your first AI provider to start tracking real spend. You can add more later.',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
    ),
    bullets: [
      'Supports Anthropic, OpenAI, Google, AWS Bedrock, Azure, and more',
      'API keys are encrypted with AES-256-GCM — never stored in plain text',
      'Or skip this step and explore with demo data first',
    ],
  },
  {
    title: 'Set Your Budget',
    description: 'Define monthly spend limits and get notified before overages happen.',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    bullets: [
      'Get email or Slack alerts at 80% and 100% of budget',
      'See projected monthly spend based on current usage',
      'Catch cost spikes before they become problems',
    ],
  },
];

export default function OnboardingWizard() {
  const { user, isDemo } = useAuth();
  const track = useTrack();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if onboarding was already completed
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setVisible(true);
      track(EVENTS.ONBOARDING_START);
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      track(EVENTS.ONBOARDING_STEP, { step: nextStep + 1, title: steps[nextStep].title });
      setCurrentStep(nextStep);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = useCallback(() => {
    track(EVENTS.ONBOARDING_COMPLETE, { stepsViewed: currentStep + 1 });
    localStorage.setItem(ONBOARDING_KEY, Date.now().toString());
    setVisible(false);
  }, [track, currentStep]);

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleComplete();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, handleComplete]);

  if (!visible) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="InferLane onboarding">
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-8 max-w-lg w-full mx-4 shadow-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? 'w-8 bg-amber-400'
                  : i < currentStep
                  ? 'w-4 bg-amber-400/40'
                  : 'w-4 bg-[#2a2a3a]'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">{step.icon}</div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          {step.title}
        </h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          {step.description}
        </p>

        {/* Bullet points */}
        <ul className="space-y-3 mb-8">
          {step.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-300">{bullet}</span>
            </li>
          ))}
        </ul>

        {isDemo && currentStep === 0 && (
          <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-3 mb-6">
            <p className="text-xs text-amber-300 text-center">
              You&apos;re in demo mode — exploring with sample data. Sign up anytime to connect real providers.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip setup
          </button>
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold rounded-lg text-sm hover:brightness-110 transition-all"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
