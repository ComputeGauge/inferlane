import Link from 'next/link';

export default function PublicNav() {
  return (
    <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="font-bold text-white text-lg">InferLane</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</Link>
        <Link href="/stats" className="text-sm text-gray-400 hover:text-white transition-colors">Stats</Link>
        <Link href="/transparency" className="text-sm text-gray-400 hover:text-white transition-colors">Transparency</Link>
        <Link href="/developers" className="text-sm text-gray-400 hover:text-white transition-colors">Developers</Link>
      </div>
    </nav>
  );
}
