import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://inferlane.ai'),
  title: {
    default: "InferLane — The Cost Intelligence Layer for AI Agents",
    template: "%s | InferLane",
  },
  description: "Make every AI agent cost-aware. Model selection, spend tracking, credibility scoring, and local-to-cloud routing via MCP. Save 40-70% on AI compute. Works with Claude, Cursor, Windsurf, and any MCP-compatible agent.",
  keywords: "MCP server, model context protocol, AI cost, Claude, Cursor, Windsurf, OpenAI, cost optimization, compute budget, InferLane, agent credibility, model selection, local inference, Ollama",
  authors: [{ name: "InferLane" }],
  creator: "InferLane",
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: "InferLane — The Cost Intelligence Layer for AI Agents",
    description: "Make every AI agent cost-aware. 18 tools via MCP. Save 40-70% on AI compute.",
    type: "website",
    url: "https://inferlane.ai",
    siteName: "InferLane",
  },
  twitter: {
    card: "summary_large_image",
    title: "InferLane — Cost Intelligence for AI Agents",
    description: "Make every AI agent cost-aware. 18 MCP tools. Save 40-70%.",
  },
  alternates: {
    canonical: "https://inferlane.ai",
  },
};

// JSON-LD structured data for search engines
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'InferLane',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  description: 'The cost intelligence layer for AI agents. MCP server with 18 tools for model selection, spend tracking, and credibility scoring.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free MCP server. Pro dashboard from $9/month.',
  },
  url: 'https://inferlane.ai',
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
        </Providers>
      </body>
    </html>
  );
}
