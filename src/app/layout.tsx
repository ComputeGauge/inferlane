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
  title: "ComputeGauge — The Cost Intelligence Layer for AI Agents",
  description: "Make every AI agent cost-aware. Model selection, spend tracking, credibility scoring, and local-to-cloud routing via MCP. Save 40-70% on AI compute. Works with Claude, Cursor, Windsurf, and any MCP-compatible agent.",
  keywords: "MCP server, model context protocol, AI cost, Claude, Cursor, Windsurf, OpenAI, cost optimization, compute budget, ComputeGauge, agent credibility, model selection, local inference, Ollama",
  openGraph: {
    title: "ComputeGauge — The Cost Intelligence Layer for AI Agents",
    description: "Make every AI agent cost-aware. 18 tools via MCP. Save 40-70% on AI compute.",
    type: "website",
    url: "https://computegauge.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "ComputeGauge — Cost Intelligence for AI Agents",
    description: "Make every AI agent cost-aware. 18 MCP tools. Save 40-70%.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
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
