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
  // Regrouped 2026-11-02: nine flat links no longer fitted one row (the CTA
  // was wrapping into a vertical column of characters). The bar now shows
  // three groups instead of nine peers:
  //   "events"    — the things you sign up or pay for, inline in the bar;
  //   "community" — what has accumulated from the Thursdays, behind one
  //                 "社区" dropdown (a list under one heading on phones);
  //   "account"   — "我的", on the right next to the language menu, where
  //                 people look for their own account.
  // The order of the array is still the order inside each group, and the
  // paid things still come first (tests pin /tuesday, /join, /class).
  //
  // Build Tuesday, in the bar since 2026-10-15: people could not find how to
  // sign up for it, or tell it apart from Thursday.
  { href: "/tuesday", label: "tuesday", group: "events" },
  // The 共创会员 (2026-11-02): Tuesday's membership, so right after Tuesday.
  { href: "/join", label: "member", group: "events" },
  // The AI+IP class, in the bar since 2026-10-12.
  { href: "/class", label: "class", group: "events" },
  // The session archive, then the articles, the wall and the works: the parts
  // of this site that get thicker every week.
  { href: "/sessions", label: "sessions", group: "community" },
  { href: "/blog", label: "blog", group: "community" },
  { href: "/members", label: "members", group: "community" },
  { href: "/works", label: "works", group: "community" },
  // 2026-11-01: the guide took /play's slot — it is the community's one rules page.
  { href: "/guide", label: "guide", group: "community" },
  // 2026-11-02: one page for "what did I sign up for, my card, am I a member".
  { href: "/my", label: "my", group: "account" },
  // Not in the bar: "/wharf" (since 2026-10-11, linked from the archive),
  // "/support" (since 2026-10-15, in the home page footer), "/play" (footer
  // since 2026-11-01).
] as const;

export type NavGroup = (typeof NAV_LINKS)[number]["group"];

/** The pixel game, moved from the bar to the footer on 2026-11-01. */
export const PLAY_LINK = { href: "/play", label: "play" } as const;

/** Linked from the home page footer only, never the bar (see SiteFooter). */
export const SUPPORT_LINK = { href: "/support", label: "support" } as const;

/** The sign-up CTA, which is the bar's one accented item. */
export const NAV_CTA = { href: "/#signup", label: "cta" } as const;

/** The bar's sign-up button on the Tuesday pages: Tuesday's own form. */
export const NAV_CTA_TUESDAY = { href: "/tuesday#signup", label: "ctaTuesday" } as const;

/**
 * Which sign-up the bar offers on a page (2026-11-02). Everywhere it was
 * "sign up for Thursday", so someone reading about Tuesday had to scroll past
 * the button to find Tuesday's form. On /tuesday and below it now goes there.
 */
export function navCtaFor(path: string): { href: string; label: "cta" | "ctaTuesday" } {
  const tuesday = path === "/tuesday" || path.startsWith("/tuesday/");
  return tuesday ? { ...NAV_CTA_TUESDAY } : { ...NAV_CTA };
}

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
