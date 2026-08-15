"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, LANG_LABEL, LANG_NAME, type Lang } from "@/lib/content";
import { langHref } from "@/lib/nav";

type Props = {
  current: Lang;
  /** The current page without any `lang` parameter, e.g. "/members". */
  path: string;
  /** Names the control for a screen reader — "语言" in the reader's language. */
  label: string;
};

/**
 * The language menu.
 *
 * A dropdown rather than three visible segments: the segmented version put
 * 110px of control in a bar whose whole job is to stay out of the way, and two
 * thirds of it were options nobody was going to take. The trigger still shows
 * which language you are in — that is the part worth spending width on — and
 * the choices appear when someone actually wants them.
 *
 * The options are plain `<a>`, not `<Link>`, on purpose. A language change is
 * a change to the whole document, and a full navigation is what guarantees the
 * phone menu it may have been opened from is gone afterwards: switching
 * language keeps the same pathname, so client-side routing would leave this
 * component mounted and the panel behind it open.
 */
export function LangSwitch({ current, path, label }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    // `mousedown`, not `click`: a click that starts outside and ends on the
    // trigger would otherwise close and immediately reopen the menu.
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="langs" ref={root}>
      <button
        className="langs__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        // The visible label is one or two characters, so the button says what
        // it is and which language is current in full for a screen reader.
        aria-label={`${label}: ${LANG_NAME[current]}`}
        onClick={() => setOpen((value) => !value)}
      >
        {LANG_LABEL[current]}
        <svg
          className="langs__chevron"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="langs__menu" role="menu" aria-label={label}>
          {LANGS.map((lang) => (
            <a
              className={`langs__opt${lang === current ? " langs__opt--on" : ""}`}
              key={lang}
              href={langHref(path, lang)}
              hrefLang={lang}
              role="menuitem"
              aria-current={lang === current ? "true" : undefined}
            >
              {LANG_NAME[lang]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
