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

/**
 * Whether a session can still be cancelled or moved away from on `today`
 * (Sydney date). The day itself counts — plans change at breakfast — but past
 * sessions are the attendance record and stay as they are.
 */
export function canChangeSession(session: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  return session >= today;
}
