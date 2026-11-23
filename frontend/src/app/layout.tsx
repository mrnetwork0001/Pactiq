import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const signature = Mrs_Saint_Delafield({
  variable: "--font-signature",
  subsets: ["latin"],
  weight: "400",
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const viewport: Viewport = { themeColor: "#f2ede3", viewportFit: "cover" };

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  appleWebApp: { capable: true, title: "Pactiq", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  twitter: { card: "summary_large_image" },
  title: "Pactiq — make a pact with yourself, on QIE",
  description:
    "Stake QIE on a daily habit. An AI witness verifies every check-in, the chain keeps the record, and people who quit pay the people who don't.",
  openGraph: {
    title: "Pactiq — make a pact with yourself",
    description: "Put money on your habits. Prove it daily. Get paid.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${signature.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
