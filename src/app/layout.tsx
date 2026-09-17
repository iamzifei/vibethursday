import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  // Kept in step with `copy.zh.meta` in content.ts, which every page overrides
  // this with; this is only what a route without its own metadata falls back to.
  title: "Vibe Thursday · 悉尼每周四上午的 AI 局 · Sydney AI Meetup",
  description:
    "每周四上午 10:30，悉尼 Chatswood。一群在做东西的人围一张桌子，聊各自在用 AI 干什么、卡在哪。想给大家看点东西可以，只来听也完全没问题。免费，不售票。",
  openGraph: {
    type: "website",
    siteName: "Vibe Thursday",
    locale: "zh_CN",
    alternateLocale: "en_AU",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Vibe Thursday · 悉尼每周四上午的 AI 局" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximum-scale or user-scalable=no: pinch-zoom must stay available.
  themeColor: "#0a0b0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The document language is Chinese because that is the default experience.
  // The English view re-declares `lang` on its own wrapper, so assistive
  // technology still switches pronunciation correctly.
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
