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

/* The shared "helper at the door" link (2026-11-02) was retired the same
   night, once every assistant had a personal link (below). */

/** Constant-time string comparison; false on any length difference. */
function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ── An assistant's own pass (2026-11-02) ────────────────────────────────
   The site's ordinary sign-in rests on a name plus a WeChat ID, and a WeChat
   ID is something a whole room can see — fine for "show me my signup", not
   for the back office. So an assistant gets in with a personal link the admin
   sends them (shown on /admin/roles), which sets a staff-only cookie.

   Both are HMACs over the signup id and the moment the 助理 role was given
   (`stamp`). Removing the role ends both at once; removing and re-adding it
   is how a lost or leaked link is replaced. Derived from ADMIN_TOKEN under
   their own labels, so rotating the admin token ends every pass as well. */

export const STAFF_COOKIE = "vt_staff";

function staffMac(label: string, signupId: string, stamp: string, token: string | undefined): string | null {
  if (!token) return null;
  return createHmac("sha256", token).update(`${label}:${signupId}:${stamp}`).digest("base64url");
}

/** `<signupId>.<mac>` for the link the admin sends. Null when ADMIN_TOKEN is unset. */
export function staffInviteToken(signupId: string, stamp: string, token: string | undefined = process.env.ADMIN_TOKEN): string | null {
  const mac = staffMac("vt.staff.invite.v1", signupId, stamp, token);
  return mac ? `${signupId}.${mac.slice(0, 24)}` : null;
}

/** `<signupId>.<mac>` for the staff cookie. */
export function staffSessionToken(signupId: string, stamp: string, token: string | undefined = process.env.ADMIN_TOKEN): string | null {
  const mac = staffMac("vt.staff.session.v1", signupId, stamp, token);
  return mac ? `${signupId}.${mac}` : null;
}

/** Splits a link token or cookie into the signup id it names; null if malformed. */
export function readStaffToken(value: string | null | undefined): { signupId: string } | null {
  if (!value || value.length > 200) return null;
  const match = /^(\d{1,18})\.[A-Za-z0-9_-]{16,64}$/.exec(value);
  return match ? { signupId: match[1] } : null;
}

/** Whether a link token is the one for this signup and this grant of the role. */
export function staffInviteValid(value: string, signupId: string, stamp: string): boolean {
  const expected = staffInviteToken(signupId, stamp);
  return Boolean(expected && same(value, expected));
}

/** Whether a staff cookie is the one for this signup and this grant of the role. */
export function staffSessionValid(value: string, signupId: string, stamp: string): boolean {
  const expected = staffSessionToken(signupId, stamp);
  return Boolean(expected && same(value, expected));
}
