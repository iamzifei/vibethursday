import type { MetadataRoute } from "next";
import { getCopy } from "@/lib/content";
import { countCheckins, listWallMembers } from "@/lib/db";
import { listWorks } from "@/lib/works";
import { nextThursdays } from "@/lib/sessions";
import { siteUrl } from "@/lib/site";

// The deployment's own address is only known at request time.
export const dynamic = "force-dynamic";

/**
 * The pages worth crawling.
 *
 * Only what a stranger is meant to find: the home page, the member wall, the
 * Wharf, the session archive, the works, the pixel game, the Small Business Month page, the
 * changelog, and what running the meetup costs. `/me`, `/badge`, `/checkin`, `/feedback`, `/order`, `/go` and `/admin`
 * are all either signed-in views of one person's own data or pages that need a
 * code to mean anything, and are excluded here as well as in robots.txt.
 *
 * Each session's own page IS listed: it is the record of a public morning,
 * written for exactly the stranger a sitemap is for, and everyone on it
 * answered "show me" on the day. The next two Thursdays are listed too —
 * before the day, that page is the session's introduction, and it is the
 * only address on this site that means "this coming Thursday".
 *
 * `/claim` is NOT listed: the page itself says `noindex`, and a sitemap entry
 * for a noindex page is an error in Search Console, not a hint.
 *
 * `/go` and `/order` are NOT listed for the same reason, and on top of it:
 * `/go` changes every day and shows the visitor their own order and signup,
 * and `/order` means nothing without the session code in its URL. Both are
 * `noindex` and blocked in robots.txt.
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

  // Every work's own page (2026-11-02): a product is put on the wall to be
  // seen. A person's own page still stays out of this list (see above), even
  // though a work page names its maker and links to them — links in.
  // A database hiccup costs these entries, never the whole sitemap.
  const works = listWorks(await listWallMembers().catch(() => []));

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
    everyLanguage("/play", { changeFrequency: "monthly", priority: 0.5 }),
    // Linked from this event's own page on nsw.gov.au for October 2026. It is
    // the address the government listing sends people to, so it has to be
    // crawlable in its own right rather than only reachable through the form.
    everyLanguage("/sbm", { changeFrequency: "weekly", priority: 0.8 }),
    // Changes whenever the meetup itself does, which is roughly monthly and
    // is exactly what the page is for.
    everyLanguage("/changelog", { changeFrequency: "monthly", priority: 0.5 }),
    everyLanguage("/support", { changeFrequency: "monthly", priority: 0.5 }),
    everyLanguage("/tuesday", { changeFrequency: "weekly", priority: 0.6 }),
    // The community guide: how a Thursday runs and what we ask of each other.
    everyLanguage("/guide", { changeFrequency: "monthly", priority: 0.6 }),
    // The first chapter of how the meetup was run (2026-11-02), Chinese only.
    { url: `${base}/guide/how-we-run`, changeFrequency: "monthly" as const, priority: 0.6 },
    ...works.map((work) => everyLanguage(`/works/${work.key}`, { changeFrequency: "monthly", priority: 0.5 })),
    ...[...dates]
      .sort()
      .map((date) => everyLanguage(`/sessions/${date}`, { changeFrequency: "monthly", priority: 0.5 })),
    ...nextThursdays(2)
      .filter((date) => !dates.has(date))
      .map((date) => everyLanguage(`/sessions/${date}`, { changeFrequency: "weekly", priority: 0.6 })),
  ];
}
