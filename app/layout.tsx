import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.shortDescription,
  metadataBase: new URL(`https://${BRAND.domain}`),
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    type: "website",
  },
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#171717",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorText: "#171717",
    colorTextSecondary: "#555555",
    colorDanger: "#9f2f2d",
    borderRadius: "6px",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  options: {
    socialButtonsVariant: "blockButton" as const,
    socialButtonsPlacement: "top" as const,
    showOptionalFields: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning on <html> and <body> tolerates attribute
    // mismatches injected by browser extensions (e.g. password managers,
    // Grammarly, Arc Boost adding `data-arp`, etc.). Scoped to these two
    // elements only — hydration validation continues everywhere else.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="canvas-grain min-h-full flex flex-col bg-canvas text-ink"
      >
        <ClerkProvider appearance={clerkAppearance} dynamic>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
