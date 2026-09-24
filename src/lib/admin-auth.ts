import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks an admin key against ADMIN_TOKEN.
 *
 * The comparison is constant-time so the response latency does not leak how
 * many leading characters of a guess were correct. If ADMIN_TOKEN is unset the
 * answer is always false — an unconfigured deployment must not expose the
 * signup list rather than fall open.
 */
export function isAdmin(provided: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, so compare lengths first. The
  // length of the token is not the secret; its contents are.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * The admin session cookie.
 *
 * ⚠️ Why this exists. Until 2026-09-24 the admin token travelled in the URL —
 * `/admin?key=…` — and every admin action redirected back to that same URL,
 * so the token sat in browser history, in any proxy or server log, and in
 * every screenshot of the address bar. A link that opens the page is still how
 * the organiser gets in; it now gets exchanged, once, for this cookie, and the
 * address bar is clean from then on.
 */
export const ADMIN_COOKIE = "vt_admin";

/** How long a session lasts before the link has to be opened again. */
export const ADMIN_SESSION_DAYS = 30;

/**
 * What the cookie holds: an HMAC derived from ADMIN_TOKEN, never the token.
 *
 * Deriving it means rotating ADMIN_TOKEN signs every existing session out with
 * no session table to clear, and a cookie read off a disk is not the token
 * that opens the link. The label keeps it from ever verifying as a check-in
 * or feedback code, which are HMACs under a different key anyway.
 */
export function adminSessionValue(token: string | undefined = process.env.ADMIN_TOKEN): string | null {
  if (!token) return null;
  return createHmac("sha256", token).update("vt.admin.session.v1").digest("base64url");
}

/** Constant-time check of a session cookie's value. */
export function isAdminSession(value: string | undefined): boolean {
  const expected = adminSessionValue();
  if (!expected || !value) return false;

  const a = Buffer.from(value);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether a request is the organiser's: a valid session cookie, or — for the
 * one request that sets it, and for a tab left open from before the change —
 * the token itself.
 */
export function isAdminRequest(cookieValue: string | undefined, providedKey?: string | null): boolean {
  return isAdminSession(cookieValue) || isAdmin(providedKey ?? undefined);
}
