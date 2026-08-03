import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: "Vibe Thursday · 悉尼每周四的 AI 局",
  description:
    "每周四上午，悉尼 CBD。带上你用 AI 做的任何东西，5 分钟讲给一屋子懂的人听。没做完的、还在想的，都能讲。免费。",
  openGraph: {
    type: "website",
    siteName: "Vibe Thursday",
    locale: "zh_CN",
    alternateLocale: "en_AU",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Vibe Thursday · 悉尼每周四的 AI 局" }],
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
