import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { RevealObserver } from "@/components/motion/reveal-observer";
import { introScript } from "@/components/brand/brand-intro";
import "./globals.css";

// Fonts are self-hosted (Geist and Archivo, both SIL OFL 1.1): no request to
// Google at build or run time, which also keeps the CSP simple.
const archivo = localFont({
  // Subset of Archivo (weights 500–600, widths 100–125%, Latin): 32 KB instead of 90 KB.
  // Rebuild with scripts/fonts/subset-archivo.py.
  src: "../fonts/archivo-display.woff2",
  variable: "--font-archivo",
  weight: "500 600",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
  adjustFontFallback: "Arial",
});

// Mono is only used for small labels: not preloaded, so it never competes with the hero
// image and display face for early bandwidth; the fallback stack covers the swap.
const geistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

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
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: "NEXORA — Precision electronics" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f2",
  colorScheme: "light",
};

// Marks the document as scripted before first paint, so scroll-reveal styles only
// ever hide content when the script that reveals it is running.
// The second line decides, before paint, whether the first-visit intro plays.
const headScript = `document.documentElement.classList.add("js");${introScript}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${geistMono.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
