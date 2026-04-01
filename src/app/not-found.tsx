import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-3xl mb-8">
        &#9889;
      </div>
      <h1 className="text-6xl font-bold text-white mb-3 font-mono">404</h1>
      <p className="text-xl text-gray-400 mb-2">Page not found</p>
      <p className="text-sm text-gray-600 mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-amber-500 text-black font-semibold rounded-xl text-sm hover:bg-amber-400 transition-all"
        >
          Back to home
        </Link>
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-[#1e1e2e] text-gray-300 font-medium rounded-xl text-sm hover:bg-[#2a2a3a] transition-all"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
