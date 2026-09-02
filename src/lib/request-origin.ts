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

  // `x-forwarded-host` first. In production this process sits behind a proxy,
  // and a proxy that rewrites `Host` to the address it is forwarding to leaves
  // `host` reading `localhost:8080` — which produces a link nobody outside the
  // container can open. The forwarded pair is what exists to answer this, and
  // where there is no proxy neither header is set and `host` is the truth.
  //
  // Both are still client-supplied and are validated below exactly as `host`
  // always was. NEXT_PUBLIC_SITE_URL above outranks both, so a deployment that
  // sets it never depends on any of this.
  const forwarded = store.get("x-forwarded-host");
  const raw = (forwarded ?? store.get("host") ?? "").split(",")[0].trim();

  // The Host header is client-supplied. Nothing downstream would be injectable
  // (the QR encoder turns its input into modules, not markup), but a crafted
  // host would still produce a code pointing somewhere else, so anything that
  // is not a plain hostname[:port] is discarded rather than trusted.
  const host = /^[A-Za-z0-9.-]+(:\d+)?$/.test(raw) ? raw : "localhost:3000";

  // Loopback is the only case that is not HTTPS. Matching on "localhost" alone
  // gave a 127.0.0.1 dev server an https:// QR that nothing could open.
  //
  // Deliberately NOT read from `x-forwarded-proto`, unlike the host above. The
  // dev server sets that header to `http` on every request, so trusting it
  // would emit `http://` links from a site that is https everywhere except
  // loopback — a regression traded for nothing, since this heuristic already
  // gets the only two cases this site has right.
  const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";

  return `${proto}://${host}`;
}
