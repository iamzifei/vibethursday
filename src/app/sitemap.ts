import type { MetadataRoute } from "next";
import { getCopy } from "@/lib/content";
import { countCheckins } from "@/lib/db";
import { siteUrl } from "@/lib/site";

// The deployment's own address is only known at request time.
export const dynamic = "force-dynamic";

/**
 * The pages worth crawling.
 *
 * Only what a stranger is meant to find: the home page, the member wall, the
 * Wharf, the session archive, what running the meetup costs, and the claim page. `/me`, `/badge` and `/admin`
 * are all signed-in views of one person's own data and are excluded here as
 * well as in robots.txt.
 *
 * Each session's own page IS listed: it is the record of a public morning,
 * written for exactly the stranger a sitemap is for, and everyone on it
 * answered "show me" on the day.
 *
 * Individual member pages are deliberately NOT listed. They are public and
 * linked from the wall, so a crawler that follows links still reaches them —
 * but ticking "publish" means putting a card on the wall, and handing every
 * card to search engines by name is a further step nobody agreed to. Links in,
 * not a directory out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  // Written-up sessions and checked-in sessions, deduplicated; the copy
  // bundle's dates are the same in every language.
  const dates = new Set<string>([
    ...getCopy("zh").gallery.sessions.map((session) => session.date),
    ...(await countCheckins()).keys(),
  ]);

  // All three languages are the same URL with a different `lang`, so every
  // entry declares its own set rather than there being separate trees.
  const everyLanguage = (
    path: string,
    rest: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
  ) => ({
    url: `${base}${path}`,
    alternates: {
      languages: {
        "zh-Hans": `${base}${path}`,
        "zh-Hant": `${base}${path}?lang=zh-Hant`,
        "en-AU": `${base}${path}?lang=en`,
      },
    },
    ...rest,
  });

  return [
    everyLanguage("/", { changeFrequency: "weekly", priority: 1 }),
    everyLanguage("/members", { changeFrequency: "weekly", priority: 0.8 }),
    everyLanguage("/wharf", { changeFrequency: "weekly", priority: 0.8 }),
    everyLanguage("/sessions", { changeFrequency: "weekly", priority: 0.7 }),
    everyLanguage("/works", { changeFrequency: "weekly", priority: 0.7 }),
    everyLanguage("/support", { changeFrequency: "monthly", priority: 0.5 }),
    everyLanguage("/claim", { changeFrequency: "yearly", priority: 0.3 }),
    ...[...dates]
      .sort()
      .map((date) => everyLanguage(`/sessions/${date}`, { changeFrequency: "monthly", priority: 0.5 })),
  ];
}
