'use client';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
      <p className="text-red-400 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-300 hover:text-red-200 underline ml-4 shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
