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
  // Next to the wall on purpose. These two are the only things on this site
  // that get thicker over time — every other item describes what happens on a
  // Thursday, these two are what has accumulated from the Thursdays so far.
  //
  // The donation link was deliberately kept out of this bar, on the grounds
  // that being in it makes something look like a main attribute of the meetup.
  // That reasoning is why this one belongs in it.
  { href: "/works", label: "works" },
  { href: "/wharf", label: "wharf" },
  { href: "/sessions", label: "sessions" },
  // "流程" used to sit here and no longer does. It is an anchor a third of the
  // way down the home page, and anyone reading the home page reaches it by
  // scrolling; the bar's remaining slots are worth more to the four pages that
  // are not on the home page at all.
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
