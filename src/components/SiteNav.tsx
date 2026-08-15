"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { VibeThursdayMark } from "@/components/VibeThursdayMark";

export type NavItem = { href: string; label: string };

type Props = {
  brand: string;
  brandHref: string;
  /** The section and page links, already carrying `?lang=` where needed. */
  items: NavItem[];
  cta: NavItem;
  /** The 简/繁/EN control, rendered by a Server Component and passed in. */
  langSwitch: ReactNode;
  /** Names the menu button and both <nav> landmarks. */
  menuLabel: string;
  /** The skip link, which is the first thing a keyboard user reaches. */
  skipLabel: string;
};

/**
 * The bar every page opens with.
 *
 * Two renderings of the same links: an inline row on a wide screen, and a
 * panel behind a button below 860px. They are separate markup rather than one
 * list restyled by a media query because the phone version needs full-width
 * rows with real touch targets, which is a different layout, not a narrower
 * one. Both are hidden from assistive technology when their breakpoint is not
 * active — `.nav__panel` is `hidden` while closed, and the wide row is dropped
 * with `display: none`, which takes it out of the accessibility tree too.
 *
 * A client component only for the open/closed state. Everything it is handed
 * is a plain string, so the cost of the boundary is a few dozen bytes of RSC
 * payload rather than the whole copy object.
 */
export function SiteNav({
  brand,
  brandHref,
  items,
  cta,
  langSwitch,
  menuLabel,
  skipLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownFor, setShownFor] = useState(pathname);

  // Navigating between pages is client-side, so nothing here unmounts and an
  // open panel would stay open on top of the page it just left. Every link in
  // the panel closes it on click, but the browser's back button is not a click.
  //
  // Adjusted during render rather than in an effect: React re-runs this pass
  // before touching the DOM, so the panel is never painted open on the new
  // page. An effect would close it one frame late, and would be a cascading
  // render on every navigation.
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Anchors on the home page ("/?lang=en#signup") have to be compared on the
  // path alone, or nothing ever matches the current page.
  const isCurrent = (href: string) => {
    const path = href.split(/[?#]/)[0];
    return path !== "/" && pathname === path;
  };

  return (
    <header className="nav">
      {/* A plain <a>, not <Link>: this jumps within the current document, and
          routing it would re-render the page to move focus a few hundred
          pixels. */}
      <a className="skip-link" href="#main">
        {skipLabel}
      </a>

      <div className="shell nav__bar">
        <Link className="nav__brand mono" href={brandHref} onClick={() => setOpen(false)}>
          {/* Accent-coloured while the wordmark stays foreground: the bridge is
              the logo, the name is the label, and colouring both flattens them
              into one shape. Decorative — the link text already says the name. */}
          <span className="nav__mark">
            <VibeThursdayMark size={26} />
          </span>
          {brand}
        </Link>

        <nav className="nav__wide" aria-label={menuLabel}>
          {items.map((item) => (
            <Link
              className="nav__link"
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}

          <div className="nav__lang">{langSwitch}</div>

          {/* Not `btn--primary`: `.nav__cta` gives it the outlined accent
              treatment so it stops competing with each page's own lime CTA. */}
          <Link className="btn nav__cta" href={cta.href}>
            {cta.label}
          </Link>
        </nav>

        <button
          className="nav__toggle"
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={menuLabel}
          onClick={() => setOpen((value) => !value)}
        >
          {/* Three bars that fold into a cross. One SVG in both states so the
              button never changes size, and the lines animate rather than swap. */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path className="nav__bar-1" d="M3 6h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            <path className="nav__bar-2" d="M3 11h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            <path className="nav__bar-3" d="M3 16h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="nav__panel" id="site-menu" hidden={!open}>
        <nav className="shell nav__panel-inner" aria-label={menuLabel}>
          {items.map((item) => (
            <Link
              className="nav__row"
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="nav__panel-foot">
            <Link
              className="btn btn--primary nav__panel-cta"
              href={cta.href}
              onClick={() => setOpen(false)}
            >
              {cta.label}
            </Link>
            {/* No click handler here. It used to close the panel on any click
                inside, which was fine while the switch was three links and
                wrong the moment it became a menu: opening the menu would shut
                the panel underneath it. Picking a language is a full page load
                (see LangSwitch), so the panel is gone by itself. */}
            <div className="nav__lang">{langSwitch}</div>
          </div>
        </nav>
      </div>
    </header>
  );
}
