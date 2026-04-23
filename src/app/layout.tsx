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
    default: "InferLane — Community-owned AI inference",
    template: "%s | InferLane",
  },
  description: "Share what you've got. Use what others share. InferLane is a community-owned peer-to-peer AI inference network. Install a small daemon — your idle Mac or GPU serves requests for others on the network. Earn kT credits; spend them on inference from the network. MCP-native — works with Claude Code, Cursor, Windsurf, and any MCP client.",
  keywords: "peer-to-peer AI inference, MCP server, model context protocol, Claude Code, Cursor, Windsurf, community-owned AI, kT credits, InferLane, cross-platform daemon, Mac mini inference, open beta",
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
    title: "InferLane — Community-owned AI inference",
    description: "Peer-to-peer AI inference network. Install a small daemon, earn kT credits as your idle Mac or GPU serves requests for others. MCP-native, cross-platform, credits-only (no cash conversion). Open beta.",
    type: "website",
    url: "https://inferlane.dev",
    siteName: "InferLane",
    images: [
      {
        url: 'https://inferlane.dev/hero-comparison.png',
        width: 1200,
        height: 630,
        alt: 'InferLane — Smart model routing and cost optimization for AI agents',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InferLane — Smart routing that cut our Claude Code bill 77%",
    description: "Compute exchange + 41-tool MCP server. Routes across 23 providers. Local-first. Privacy tiers. Free, open source.",
    images: ['https://inferlane.dev/hero-comparison.png'],
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
