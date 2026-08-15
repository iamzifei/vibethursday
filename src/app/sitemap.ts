import type { MetadataRoute } from "next";
import { listWallMembers } from "@/lib/db";
import { siteUrl } from "@/lib/site";

// Reads the member wall, which changes whenever anyone edits their card. A
// cached sitemap would keep pointing crawlers at a wall from whenever the app
// was last deployed.
export const dynamic = "force-dynamic";

/**
 * The pages worth crawling.
 *
 * Only what a stranger is meant to find: the home page, the member wall, the
 * live cards on it, what running the meetup costs, and the claim page. `/me`,
 * `/badge` and `/admin` are all signed-in views of one person's own data and
 * are excluded here as well as in robots.txt.
 *
 * Member pages are listed because they are already public and already linked
 * from the wall — a card only reaches this list after its owner ticks
 * "publish", and a hidden or draft card is not in `listWallMembers`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const pages: MetadataRoute.Sitemap = [
    bilingual("/", { changeFrequency: "weekly", priority: 1 }),
    bilingual("/members", { changeFrequency: "weekly", priority: 0.8 }),
    bilingual("/support", { changeFrequency: "monthly", priority: 0.5 }),
    bilingual("/claim", { changeFrequency: "yearly", priority: 0.3 }),
  ];

  // A database that is down must not take the sitemap with it: the four pages
  // above do not depend on it, and an empty 500 tells a crawler far less than
  // a short sitemap does.
  try {
    const members = await listWallMembers();

    for (const member of members) {
      pages.push(
        bilingual(`/members/${member.slug}`, { changeFrequency: "monthly", priority: 0.6 }),
      );
    }
  } catch (error) {
    console.error("sitemap: could not read the member wall", error);
  }

  return pages;
}
