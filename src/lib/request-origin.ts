import { headers } from "next/headers";

/**
 * Its own file, deliberately.
 *
 * This belongs next to `siteUrl` in `site.ts` by subject, and cannot live
 * there: `site.ts` is imported by the footer and nav tests, which Node loads
 * through its type stripper, and that resolver cannot follow `next/headers`.
 * Adding this import to `site.ts` broke two unrelated test files the moment it
 * was tried — which is the whole reason for the split, and the reason to leave
 * it split.
 */
/**
 * The absolute origin, for a URL that has to survive being scanned by a phone
 * that is not this one — a name badge on the table, or the code the room scans
 * to follow a deck. NEXT_PUBLIC_SITE_URL is the answer in production; the
 * request host covers local development, where that variable is usually unset.
 */
export async function requestOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const store = await headers();
  const raw = store.get("host") ?? "";

  // The Host header is client-supplied. Nothing downstream would be injectable
  // (the QR encoder turns its input into modules, not markup), but a crafted
  // host would still produce a code pointing somewhere else, so anything that
  // is not a plain hostname[:port] is discarded rather than trusted.
  const host = /^[A-Za-z0-9.-]+(:\d+)?$/.test(raw) ? raw : "localhost:3000";

  // Loopback is the only case that is not HTTPS. Matching on "localhost" alone
  // gave a 127.0.0.1 dev server an https:// QR that nothing could open.
  const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";

  return `${proto}://${host}`;
}
