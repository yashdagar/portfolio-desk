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

export const metadata: Metadata = {
  metadataBase: new URL("https://portfolio-desk.vercel.app"),
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
