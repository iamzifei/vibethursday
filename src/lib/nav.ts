// Relative, not "@/": the tests load this through Node's type stripper.
import { LANG_PARAM, type Lang } from "./content.ts";

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
  { href: "/#what", label: "about" },
  { href: "/members", label: "members" },
  { href: "/#schedule", label: "schedule" },
  { href: "/support", label: "support" },
] as const;

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
