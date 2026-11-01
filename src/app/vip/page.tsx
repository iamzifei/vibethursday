import type { Metadata } from "next";
import ClassPage from "../class/page";
import { IP_COURSE } from "@/lib/course";

/**
 * /vip: a second, shorter address for the membership page (2026-10-19), for
 * posters and Moments. The same page as /class, served here rather than
 * redirected, so the address people typed is the one they keep seeing.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${IP_COURSE.title} · Vibe Thursday`,
  robots: { index: false },
  alternates: { canonical: "/class" },
};

export default ClassPage;
