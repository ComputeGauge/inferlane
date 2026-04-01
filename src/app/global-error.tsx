'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ backgroundColor: '#0a0a0f', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            marginBottom: 24,
          }}>
            &#9889;
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24, maxWidth: 400 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p style={{ color: '#555', fontSize: 12, marginBottom: 16, fontFamily: 'monospace' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
              backgroundColor: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
