import Link from "next/link";

import type { Copy, Lang } from "@/lib/content";
import { langHref } from "@/lib/nav";
import { SOURCE_URL } from "@/lib/site";

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
      <div className="shell stack-3">
        <span className="h3 hl">{copy.footer.tagline}</span>

        <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
          {copy.footer.location}
        </span>

        {support && (
          <span className="body-sm">
            <Link href={langHref("/support", lang)}>{copy.footer.supportLink}</Link>
          </span>
        )}

        <span className="body-sm" style={{ color: "var(--fg3)" }}>
          <Slogan text={copy.footer.slogan} />
          {" · "}
          <a href={SOURCE_URL} rel="noopener noreferrer" target="_blank">
            {copy.footer.sourceLink}
          </a>
        </span>
      </div>
    </footer>
  );
}

/**
 * The slogan, with `{heart}` swapped for the icon.
 *
 * The placeholder keeps the sentence a single translatable string. Splitting
 * it into "before" and "after" halves would fix the word order in English into
 * every other language — and the heart does not sit in the same place in the
 * Chinese sentence as it does in the English one.
 *
 * The space either side of the heart comes from the copy, not from a margin
 * on the icon, so it is exactly one space and a translator can see it. A test
 * pins that both languages keep it.
 */
function Slogan({ text }: { text: string }) {
  const [before, ...rest] = text.split("{heart}");

  // No placeholder in this language's string: render it as written rather than
  // dropping the icon in somewhere it was not asked for.
  if (rest.length === 0) return <>{text}</>;

  return (
    <>
      {before}
      <Heart />
      {rest.join("{heart}")}
    </>
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
