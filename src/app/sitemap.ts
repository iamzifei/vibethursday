import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The deployment's own address is only known at request time.
export const dynamic = "force-dynamic";

/**
 * The pages worth crawling.
 *
 * Only what a stranger is meant to find: the home page, the member wall, what
 * running the meetup costs, and the claim page. `/me`, `/badge` and `/admin`
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

  // Both languages are the same URL plus `?lang=en`, so every entry declares
  // its own pair rather than there being separate zh and en trees.
  const bilingual = (path: string, rest: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">) => ({
    url: `${base}${path}`,
    alternates: {
      languages: {
        "zh-CN": `${base}${path}`,
        "en-AU": `${base}${path}?lang=en`,
      },
    },
    ...rest,
  });

  return [
    bilingual("/", { changeFrequency: "weekly", priority: 1 }),
    bilingual("/members", { changeFrequency: "weekly", priority: 0.8 }),
    bilingual("/support", { changeFrequency: "monthly", priority: 0.5 }),
    bilingual("/claim", { changeFrequency: "yearly", priority: 0.3 }),
  ];
}
