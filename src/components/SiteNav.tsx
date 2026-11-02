"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { NavGroup } from "@/lib/nav";

export type NavItem = { href: string; label: string; group?: NavGroup };

type Props = {
  brand: string;
  brandHref: string;
  /** The section and page links, already carrying `?lang=` where needed. */
  items: NavItem[];
  /** Names the "community" group: the dropdown's button and the phone menu's heading. */
  communityLabel: string;
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
 * The links come in three groups (see NAV_LINKS): the sign-up pages inline,
 * the community pages behind one dropdown, and "我的" on the right with the
 * site-wide controls. Nine flat peers stopped fitting one row on 2026-11-02.
 *
 * Two renderings of the same links: an inline row on a wide screen, and a
 * panel behind a button below 980px. They are separate markup rather than one
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
  communityLabel,
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
    return path !== "/" && (pathname === path || pathname.startsWith(`${path}/`));
  };

  const events = items.filter((item) => item.group === "events");
  const community = items.filter((item) => item.group === "community");
  // Anything without a group lands with the account links rather than vanishing.
  const account = items.filter((item) => item.group !== "events" && item.group !== "community");

  const link = (item: NavItem) => (
    <Link
      className="nav__link"
      key={item.href}
      href={item.href}
      aria-current={isCurrent(item.href) ? "page" : undefined}
    >
      {item.label}
    </Link>
  );

  const row = (item: NavItem) => (
    <Link
      className="nav__row"
      key={item.href}
      href={item.href}
      aria-current={isCurrent(item.href) ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {item.label}
    </Link>
  );

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
          {/* The logo's head (2026-10-12, cut by scripts/build-icons.mts).
              Decorative — the link text already says the name. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- an 11 KB
              file already cut to size; the optimiser would only add a hop. */}
          <img className="nav__mark" src="/brand/mark.png" width={28} height={28} alt="" />
          {brand}
        </Link>

        <nav className="nav__wide" aria-label={menuLabel}>
          {events.map(link)}

          {community.length > 0 && (
            <NavDropdown
              label={communityLabel}
              items={community}
              isCurrent={isCurrent}
              pathname={pathname}
            />
          )}

          {/* "我的" sits apart, on the right with the controls that act on the
              whole site — where people look for their own account. */}
          <span className="nav__divider" aria-hidden="true" />
          {account.map(link)}

          <div className="nav__lang">{langSwitch}</div>

          {/* Not `btn--primary`: `.nav__cta` gives it the outlined accent
              treatment so it stops competing with each page's own lime CTA. */}
          <Link className="btn nav__cta" href={cta.href}>
            {cta.label}
          </Link>
        </nav>

        {/* ★ The sign-up link, on phones, outside the menu.
            Until 2026-09-24 the only CTA in the bar lived in `.nav__wide`,
            which is hidden below 980px — so on a phone, where nearly every
            visitor arrives from a group chat, the first screen of every page
            had no way to sign up without opening a menu first. Measured: on
            an iPhone SE the first sign-up button sat at y=945px on a 568px
            screen. Same outlined treatment as the wide one, so it does not
            compete with the page's own lime button. */}
        <Link className="btn nav__cta nav__cta--compact" href={cta.href} onClick={() => setOpen(false)}>
          {cta.label}
        </Link>

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
          {events.map(row)}

          {/* On a phone the dropdown becomes a heading: a menu inside a menu
              is one tap too many, and there is room to just list them. */}
          {community.length > 0 && (
            <>
              <span className="nav__heading">{communityLabel}</span>
              {community.map(row)}
            </>
          )}

          {account.length > 0 && <span className="nav__heading" aria-hidden="true" />}
          {account.map(row)}

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

type DropdownProps = {
  label: string;
  items: NavItem[];
  isCurrent: (href: string) => boolean;
  pathname: string;
};

/**
 * The "社区" dropdown in the wide bar.
 *
 * A disclosure (a button that shows a list of links), not an ARIA `menu`:
 * these are page links, and the menu role would take away the Tab key and
 * the link semantics a screen reader announces. Opens on click rather than
 * hover, so it works the same on a tablet; closes on Escape, on a click
 * outside, and on navigation.
 */
function NavDropdown({ label, items, isCurrent, pathname }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Same render-time reset as the phone panel: the back button is not a click.
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Back to the button, so a keyboard user is not dropped at the top of the page.
      button.current?.focus();
    };

    // `mousedown`, not `click`, for the same reason as LangSwitch.
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

  // The button carries the accent when you are on any page inside it, so the
  // bar still says where you are with the page itself out of sight.
  const inside = items.some((item) => isCurrent(item.href));

  return (
    <div className="nav__drop" ref={root}>
      <button
        ref={button}
        className={`nav__link nav__drop-trigger${inside ? " nav__link--inside" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="nav-community"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <svg className="langs__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="nav__drop-menu" id="nav-community">
          {items.map((item) => (
            <Link
              className="langs__opt"
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
