import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Fonts are self-hosted from the `geist` package: no request to Google at
// build or run time, which also keeps the CSP simple.

const siteUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NEXORA — Precision electronics",
    template: "%s · NEXORA",
  },
  description:
    "Headphones, wearables, speakers and accessories, engineered with restraint. NEXORA is a fictional store built as a portfolio project.",
  openGraph: {
    type: "website",
    siteName: "NEXORA",
    locale: "en_IE",
  },
};

export const viewport: Viewport = {
  themeColor: "#efefefe",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
