/**
 * Whether a form post came from this site's own pages (2026-10-05 review).
 *
 * The cookies these routes rely on are SameSite=Lax, which already keeps a
 * third-party page from posting with them. This is the second lock, for the
 * cases Lax does not cover (an old in-app browser, another subdomain): when the
 * browser says where the request came from — `Origin`, or `Sec-Fetch-Site` —
 * it has to be here. A browser that sends neither is let through, as before.
 */
export function fromThisSite(request: Request, origin: string): boolean {
  const sent = request.headers.get("origin");
  if (sent && sent !== "null" && sent !== origin) return false;
  if (sent === "null") return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  return true;
}
