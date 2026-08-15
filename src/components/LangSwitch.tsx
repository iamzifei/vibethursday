import Link from "next/link";
import { LANGS, LANG_LABEL, LANG_NAME, type Lang } from "@/lib/content";
import { langHref } from "@/lib/nav";

type Props = {
  current: Lang;
  /** The current page without any `lang` parameter, e.g. "/members". */
  path: string;
  /** Names the group for a screen reader — "语言" in the reader's language. */
  label: string;
};

/**
 * 简 · 繁 · EN.
 *
 * A segmented control rather than a toggle, because with three languages a
 * toggle would have to hide two of them behind a menu, and the one thing a
 * reader who cannot read the current script needs is to see their own option
 * without opening anything. One character each does that in less width than
 * the word "ENGLISH" took on its own.
 *
 * Three links, not buttons: each one is a real URL for this page in that
 * language, so it can be opened in a new tab, shared, and crawled — which is
 * also what makes the `hreflang` alternates in the sitemap true.
 */
export function LangSwitch({ current, path, label }: Props) {
  return (
    <div className="langs" role="group" aria-label={label}>
      {LANGS.map((lang) => {
        const isCurrent = lang === current;

        return (
          <Link
            className={`langs__opt${isCurrent ? " langs__opt--on" : ""}`}
            key={lang}
            href={langHref(path, lang)}
            // The tag of the language it goes to, not the one it is written in.
            hrefLang={lang}
            aria-current={isCurrent ? "true" : undefined}
            // The visible label is one character; the full name is what a
            // screen reader should read out.
            aria-label={LANG_NAME[lang]}
          >
            {LANG_LABEL[lang]}
          </Link>
        );
      })}
    </div>
  );
}
