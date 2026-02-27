// ============================================================
// ROOT LAYOUT — Next.js 14 App Router
// Providers: Auth, tRPC/React Query, Zustand hydration
// ============================================================

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sistema de Preparação — V2",
    template: "%s | Sistema de Preparação",
  },
  description:
    "Preparação estratégica para concursos públicos orientada por edital e inteligência artificial.",
  robots: {
    index: false, // SaaS — não indexar
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Preconnect para performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-[#0F172A] text-[#F8FAFC] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
