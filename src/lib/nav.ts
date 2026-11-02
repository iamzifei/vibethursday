// Relative, not "@/": the tests load this through Node's type stripper.
// From the leaf, not from `content.ts`: this file is imported by client
// components, and `content.ts` would bring the Traditional dictionary with it.
import { LANG_PARAM, type Lang } from "./lang.ts";

/**
 * What the site's nav bar points at.
 *
 * Kept out of the components so that both renderings of the bar — the wide row
 * and the phone panel — are built from one list, and so a test can check that
 * every anchor here is still a section on the home page. Sections get renamed;
 * a nav link to a `#what` that no longer exists fails silently by scrolling
 * nowhere.
 */
export const NAV_LINKS = [
  // Reordered 2026-11-02 (home page refactor): the three things that cost
  // money first, then what has accumulated from the Thursdays, then the rules.
  // "/#what" left the bar: it is an anchor on the home page, reached by
  // scrolling — the same reason "流程" left before it.
  //
  // Build Tuesday, in the bar since 2026-10-15: people could not find how to
  // sign up for it, or tell it apart from Thursday.
  { href: "/tuesday", label: "tuesday" },
  // The 共创会员 (2026-11-02): Tuesday's membership, so right after Tuesday.
  { href: "/join", label: "member" },
  // The AI+IP class, in the bar since 2026-10-12.
  { href: "/class", label: "class" },
  // The session archive, then the wall and the works: the parts of this site
  // that get thicker every week.
  { href: "/sessions", label: "sessions" },
  { href: "/members", label: "members" },
  { href: "/works", label: "works" },
  // 2026-11-01: the guide took /play's slot — it is the community's one rules page.
  { href: "/guide", label: "guide" },
  // Not in the bar: "/wharf" (since 2026-10-11, linked from the archive),
  // "/support" (since 2026-10-15, in the home page footer), "/play" (footer
  // since 2026-11-01).
] as const;

/** The pixel game, moved from the bar to the footer on 2026-11-01. */
export const PLAY_LINK = { href: "/play", label: "play" } as const;

/** Linked from the home page footer only, never the bar (see SiteFooter). */
export const SUPPORT_LINK = { href: "/support", label: "support" } as const;

/** The sign-up CTA, which is the bar's one accented item. */
export const NAV_CTA = { href: "/#signup", label: "cta" } as const;

/**
 * Puts the current language on an internal href, ahead of any fragment.
 *
 * "/#signup" has to become "/?lang=en#signup", never "/#signup?lang=en" — in
 * the second the query string is part of the fragment, so the page loads in
 * the default language and the anchor never resolves either. Simplified
 * Chinese is the default and carries no query string at all, which is why
 * every link on the Chinese site is still a clean URL.
 */
export function langHref(href: string, lang: Lang): string {
  const param = LANG_PARAM[lang];
  if (!param) return href;

  const [path, hash] = href.split("#");
  const separator = path.includes("?") ? "&" : "?";

  return `${path || "/"}${separator}lang=${param}${hash ? `#${hash}` : ""}`;
}
