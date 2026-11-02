import { faviconFor } from "@/lib/works";

/**
 * A work's icon (2026-11-02): its site's favicon when it has a link, its
 * first letter on a tinted tile otherwise — and underneath the favicon too,
 * so a site with no icon still shows something. Decorative: the title next
 * to it says what it is.
 */
export function WorkIcon({ title, url, size = 40 }: { title: string; url: string | null; size?: number }) {
  const icon = faviconFor(url);
  const letter = Array.from(title.trim())[0]?.toUpperCase() ?? "·";
  return (
    <span className="work-icon" style={{ width: size, height: size }} aria-hidden="true">
      <span className="work-icon__letter">{letter}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon && <img src={icon} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
    </span>
  );
}
