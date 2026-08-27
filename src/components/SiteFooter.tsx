import Link from "next/link";

import type { Copy, Lang } from "@/lib/content";
import { langHref, NAV_LINKS } from "@/lib/nav";
import { FOOTER_SLOGAN, SOURCE_URL } from "@/lib/site";

type Props = {
  lang: Lang;
  copy: Copy;
  /**
   * Whether to show the link to /support.
   *
   * Only the home page carries it. The member wall deliberately does not:
   * a page whose subject is people should not put a money link under every
   * card, which is the same reason cards carry no donation marker.
   */
  support?: boolean;
};

/**
 * The closing block every page ends with.
 *
 * It was copied into three pages before this existed, which is how the member
 * wall ended up one line behind the home page more than once. One component
 * means the venue line can only be wrong in one place.
 */
export function SiteFooter({ lang, copy, support = false }: Props) {
  return (
    <footer className="section" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="shell footer__bar">
        <div className="stack-3">
          <span className="h3 hl">{copy.footer.tagline}</span>

          <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
            {copy.footer.location}
          </span>

          {/* A second way to every page, for the reader who has scrolled to
              the bottom rather than reached for the bar at the top.

              ⚠️ `/support` is filtered out unless this page asked for it. The
              member wall deliberately carries no money link, for the same
              reason its cards carry no donation marker, and a site map in the
              footer must not be the thing that quietly puts one under every
              card on it. */}
          <nav className="footer__map" aria-label={copy.nav.menu}>
            {NAV_LINKS.filter((link) => support || link.href !== "/support").map((link) => (
              <Link key={link.href} href={langHref(link.href, lang)}>
                {copy.nav[link.label]}
              </Link>
            ))}
          </nav>
        </div>

        <span className="body-sm footer__meta">
          <Slogan text={FOOTER_SLOGAN} />

          <a
            className="footer__source"
            href={SOURCE_URL}
            rel="noopener noreferrer"
            target="_blank"
            aria-label={copy.footer.sourceLink}
          >
            <GitHubMark />
          </a>
        </span>
      </div>
    </footer>
  );
}

/**
 * The slogan, with `{heart}` swapped for the icon.
 *
 * The placeholder keeps the sentence a single string rather than a "before"
 * and an "after" half, which would leave the heart's position to whoever next
 * edits the two of them.
 *
 * The space either side of the heart comes from the copy, not from a margin on
 * the icon, so it is exactly one space and visible to anyone editing the line.
 * A test pins that it stays there.
 */
function Slogan({ text }: { text: string }) {
  const [before, ...rest] = text.split("{heart}");

  // No placeholder in the string: render it as written rather than dropping the
  // icon in somewhere it was not asked for.
  if (rest.length === 0) return <>{text}</>;

  return (
    <span>
      {before}
      <Heart />
      {rest.join("{heart}")}
    </span>
  );
}

/**
 * A small filled heart that sits on the text baseline.
 *
 * Drawn rather than typed as an emoji: ❤️ renders as a different shape on
 * every platform and brings its own colour with it, so the one warm spot in a
 * grey line would look different to every reader. This one is red on purpose
 * and red from a token, and is marked decorative because the sentence around
 * it already reads correctly without it.
 */
function Heart() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ color: "var(--heart)", display: "inline-block", verticalAlign: "-0.1em" }}
    >
      <path d="M8 14.5 1.9 8.4a3.9 3.9 0 0 1 0-5.5 3.9 3.9 0 0 1 5.5 0L8 3.5l.6-.6a3.9 3.9 0 0 1 5.5 0 3.9 3.9 0 0 1 0 5.5Z" />
    </svg>
  );
}

/**
 * GitHub's Octocat mark, the official 16px path.
 *
 * Decorative here: the anchor around it carries the accessible name, which is
 * translated, so a screen reader says what the link is for rather than naming
 * a logo. It inherits `currentColor`, which is what lets the link go from grey
 * to accent on hover with one CSS rule.
 */
function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
