"use client";

import { useEffect, useState } from "react";

/**
 * The bar pinned to the bottom of the screen (2026-11-02): what this is and
 * the one thing to do, a tap away wherever the reader has scrolled to.
 * It steps aside while the form it points to is on screen, so it never sits
 * over a field or the form's own submit button — and while any other button
 * on the page that leads to the same form is on screen (the one in the first
 * screen, say), so the reader never sees the same action twice at once.
 * Without script it stays hidden; the page's own buttons still work.
 */
export function StickyCta({ href, label, cta }: { href: string; label: string; cta: string }) {
  // Starts hidden and appears after the first look at the page, so it never
  // blinks on over a first screen that already has the same button.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const target = document.getElementById(href.replace(/^#/, ""));
    // No form to point at (or a very old browser): stay hidden; every page
    // using this bar also has its own button to the form near the top.
    if (!target || typeof IntersectionObserver === "undefined") return;
    // The form, plus every other link to it outside this bar.
    const watched = [target, ...document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]:not(.sticky-cta)`)];
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setHidden(onScreen.size > 0);
    }, { threshold: 0 });
    for (const element of watched) observer.observe(element);
    return () => observer.disconnect();
  }, [href]);

  return (
    <a className="sticky-cta" href={href} hidden={hidden} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
      <span>{label}</span>
      <strong>{cta}</strong>
    </a>
  );
}
