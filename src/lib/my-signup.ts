import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * /my — letting someone see, move and cancel their own signup.
 *
 * Until 2026-09-28 the site could only ever *add* a session to a signup, and
 * nothing anywhere showed which sessions you had. Both gaps came back as the
 * same question from half a dozen people in one afternoon: "did it work?", and
 * "I picked the wrong Thursday, how do I change it?".
 *
 * The lookup uses the same pair the rest of the site trusts — WeChat ID plus a
 * matching name (`sameSignupName`) — so /my is exactly as strong as editing a
 * card, and no stronger. A successful lookup hands back a short-lived signed
 * token, and the change buttons carry that rather than the name again.
 */

/** How long a lookup lasts before you have to type your details again. */
export const MY_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const LABEL = "vt.my.v1";

/**
 * MEMBER_SECRET if set, otherwise ADMIN_TOKEN — the same environment the
 * check-in, feedback and order codes read. The label inside the HMAC keeps
 * this token from ever verifying as one of those.
 */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;
  if (!key) throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; /my is disabled");
  return key;
}

function sign(input: string, key: string): string {
  return createHmac("sha256", key).update(input).digest("base64url").slice(0, 32);
}

/**
 * `vt.my.v1:<signupId>.<expiresAt>~<signature>`. The id and expiry are in
 * the clear because they have to be read back; the signature covers both, so
 * neither can be changed.
 */
export function myToken(signupId: string, now: number = Date.now(), key: string = secret()): string {
  const head = `${LABEL}:${signupId}.${now + MY_TOKEN_TTL_MS}`;
  return `${head}~${sign(head, key)}`;
}

/** The signup id a token was issued for, or null if it is forged or expired. */
export function verifyMyToken(token: string | null | undefined, now: number = Date.now(), key: string = secret()): string | null {
  if (!token || token.length > 200) return null;

  const match = /^vt\.my\.v1:(\d{1,18})\.(\d{10,16})~([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;

  const [, id, expires, signature] = match;
  const expected = Buffer.from(sign(`${LABEL}:${id}.${expires}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return Number(expires) > now ? id : null;
}

/** How long a phone remembers whose signup it is (`vt_my` cookie). */
export const REMEMBER_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const REMEMBER_LABEL = "vt.my.remember.v1";

/** The cookie that holds `rememberToken`. */
export const REMEMBER_COOKIE = "vt_my";

/**
 * "This phone remembers you" (2026-09-28): set when someone signs up with a
 * matching name or looks themselves up on /my, so the next visit to /my or /go
 * from the same browser shows their Thursdays without typing anything.
 *
 * Same shape as `myToken` under a different label, so neither can stand in for
 * the other — a two-hour link put into the cookie does not become a 60-day one.
 */
export function rememberToken(signupId: string, now: number = Date.now(), key: string = secret()): string {
  const head = `${REMEMBER_LABEL}:${signupId}.${now + REMEMBER_TTL_MS}`;
  return `${head}~${sign(head, key)}`;
}

/** The signup id a remember cookie names, or null if forged or expired. */
export function readRememberToken(token: string | null | undefined, now: number = Date.now(), key: string = secret()): string | null {
  if (!token || token.length > 200) return null;

  const match = /^vt\.my\.remember\.v1:(\d{1,18})\.(\d{10,16})~([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;

  const [, id, expires, signature] = match;
  const expected = Buffer.from(sign(`${REMEMBER_LABEL}:${id}.${expires}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return Number(expires) > now ? id : null;
}

/** Cookie settings for `REMEMBER_COOKIE`, matching the order cookie's. */
export function rememberCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: REMEMBER_TTL_MS / 1000 };
}

/**
 * Whether a session can still be cancelled or moved away from on `today`
 * (Sydney date). The day itself counts — plans change at breakfast — but past
 * sessions are the attendance record and stay as they are.
 */
export function canChangeSession(session: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  return session >= today;
}

/**
 * The first and last character of a name, for "you signed up as D…g".
 *
 * Shown when a WeChat ID matched but the name typed did not. Enough to remind
 * someone which of their names they used, not enough to learn a stranger's
 * name from their WeChat ID. One- and two-character names show only the first.
 */
export function nameHint(name: string): string {
  const chars = [...name.trim()];
  if (chars.length === 0) return "…";
  if (chars.length <= 2) return `${chars[0]}…`;
  return `${chars[0]}…${chars[chars.length - 1]}`;
}
