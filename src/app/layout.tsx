import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieConsent from "@/components/CookieConsent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://inferlane.dev'),
  title: {
    default: "InferLane — The Cost Intelligence Layer for AI Agents",
    template: "%s | InferLane",
  },
  description: "The only cost tool that tracks Managed Agent runtime fees ($0.08/hr) and web searches ($10/1000) alongside token cost. MCP-first — teach Claude to pick the cheapest sufficient model before every API call. Routes routine work to local Gemma 4 for free. Works with Claude Code, Goose, Cursor, and any MCP client.",
  keywords: "MCP server, model context protocol, AI cost tracking, Claude Code, Goose, Cursor, Managed Agent runtime fees, cost optimization, compute budget, InferLane, model selection, local inference, Ollama, Gemma 4",
  authors: [{ name: "InferLane" }],
  creator: "InferLane",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: "Sonnet 4 beat Opus 4 AND Grok 4 on 20 real coding tasks",
    description: "We benchmarked 5 models blindly. Both reasoning models (Opus, Grok 4) scored LOWER than plain Sonnet at 4-5\u00d7 the cost. Our 90-day Claude Code bill went $18,136 \u2192 $4,163. Free plugin.",
    type: "website",
    url: "https://inferlane.dev",
    siteName: "InferLane",
    images: [
      {
        url: '/hero-comparison.png',
        width: 1200,
        height: 630,
        alt: 'Sonnet 4 beat Opus and Grok 4 on 20 real coding tasks — InferLane benchmark',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sonnet 4 beat Opus 4 AND Grok 4 on 20 real coding tasks",
    description: "5-model blind benchmark. Reasoning models lost to plain Sonnet while costing 4-5\u00d7 more.",
    images: ['/hero-comparison.png'],
  },
  alternates: {
    canonical: "https://inferlane.dev",
  },
};

// JSON-LD structured data for search engines
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'InferLane',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  description: 'The cost intelligence layer for AI agents. MCP server with 9 tools for model selection, cost estimation, side-by-side comparison, promotion discovery, spend tracking, and multi-provider dispatch.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free MCP server. Pro dashboard from $9/month.',
  },
  url: 'https://inferlane.dev',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* DNS prefetch for third-party services */}
        <link rel="dns-prefetch" href="https://us.i.posthog.com" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        {/* Preconnect for critical third-party origins */}
        <link rel="preconnect" href="https://us.i.posthog.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0f] min-h-screen`}
      >
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
