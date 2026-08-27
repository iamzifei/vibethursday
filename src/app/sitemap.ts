import type { MetadataRoute } from "next";
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
 * Individual member pages are deliberately NOT listed. They are public and
 * linked from the wall, so a crawler that follows links still reaches them —
 * but ticking "publish" means putting a card on the wall, and handing every
 * card to search engines by name is a further step nobody agreed to. Links in,
 * not a directory out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

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
  ];
}
