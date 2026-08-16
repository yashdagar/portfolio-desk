import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Where this site actually lives, for resolving absolute URLs.
 *
 * Read from the platform rather than hardcoded, and that is not fussiness. It
 * *was* hardcoded to `portfolio-desk.vercel.app`, which is a perfectly real
 * site belonging to a complete stranger — the project got
 * `portfolio-desk-omega` because the plain name was already taken. Every share
 * card and canonical URL was pointing at someone else's domain, and nothing in
 * the build or the deploy would ever have complained.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the production hostname whichever
 * deployment is reading it, so previews resolve their OG images against
 * production rather than against themselves.
 */
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Yash Dagar",
  description:
    "Full-stack developer in Gurugram. Sit at my desk — the monitors show what I'm actually working on right now.",
  openGraph: {
    title: "Yash Dagar",
    description:
      "Sit at my desk. The monitors show what I'm actually working on right now.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1918",
  // The scene is a fixed viewport experience; zooming breaks the seated framing.
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
