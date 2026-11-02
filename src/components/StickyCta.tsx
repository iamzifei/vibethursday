"use client";

import { useEffect, useState } from "react";

/**
 * The bar pinned to the bottom of the screen (2026-11-02): what this is and
 * the one thing to do, a tap away wherever the reader has scrolled to.
 * It steps aside while the form it points to is on screen, so it never sits
 * over a field or the form's own submit button. A plain link underneath, so
 * it still works if script never runs.
 */
export function StickyCta({ href, label, cta }: { href: string; label: string; cta: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById(href.replace(/^#/, ""));
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [href]);

  return (
    <a className="sticky-cta" href={href} hidden={hidden} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
      <span>{label}</span>
      <strong>{cta}</strong>
    </a>
  );
}
