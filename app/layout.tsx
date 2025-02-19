import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
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
  title: "Hacker News with AI Summaries",
  description:
    "Get instant AI-powered summaries of Hacker News articles. Save time by reading concise versions of tech news, startup stories, and programming discussions. Free, fast, and no signup required.",
  keywords:
    "hacker news, AI summaries, tech news, startup news, article summarizer, HN reader",
  openGraph: {
    title: "Hacker News with AI Summaries",
    description:
      "Get instant AI-powered summaries of Hacker News articles. Save time with concise summaries.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hacker News with AI Summaries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hacker News with AI Summaries",
    description: "Get instant AI-powered summaries of Hacker News articles",
    images: [
      {
        url: "/twitter-image.png",
        width: 1200,
        height: 600,
        alt: "Hacker News with AI Summaries",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
