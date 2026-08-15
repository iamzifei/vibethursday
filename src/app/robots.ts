import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The sitemap line has to carry an absolute URL, and the deployment's own
// address is only known at request time.
export const dynamic = "force-dynamic";

/**
 * What crawlers may read.
 *
 * Everything public is allowed. The exclusions are all views of one person's
 * own data or of the organiser's: `/me` and `/badge` need a member session,
 * `/admin` needs the organiser's, and `/api` returns no pages at all. None of
 * them are secret by virtue of being listed here — the routes check their own
 * sessions — this only keeps them out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/me", "/badge", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
