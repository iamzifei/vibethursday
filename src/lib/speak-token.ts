import { createHmac, timingSafeEqual } from "node:crypto";
// Relative, not "@/": the tests load this through Node's type stripper.
import { nextDay, sydneyMidnight } from "./course.ts";

/**
 * The link a picked speaker opens to hand in their talk (/speak, 2026-11-19).
 * Same HMAC shape as /my's token (my-signup.ts) under its own label, so
 * neither can stand in for the other.
 */

const LABEL = "vt.speak.v1";

/**
 * MEMBER_SECRET if set, otherwise ADMIN_TOKEN — the same pair /my reads. The
 * label inside the HMAC keeps this token from verifying as any other.
 */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;
  if (!key) throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; /speak is disabled");
  return key;
}

function sign(input: string, key: string): string {
  return createHmac("sha256", key).update(input).digest("base64url").slice(0, 32);
}

const SESSION = /^\d{4}-\d{2}-\d{2}$/;

/**
 * When a speaker's link stops working: midnight at the end of the session's
 * day, Sydney time. After the talk there is nothing left to hand in, and a
 * link that outlives its morning is only a way for somebody else to edit it.
 */
export function speakerTokenExpiry(session: string): Date {
  return sydneyMidnight(nextDay(session));
}

/**
 * `<signupId>.<session>.<signature>` — bound to one person and one morning.
 *
 * No expiry in the clear: it is derived from the session date, which the
 * signature covers, so neither can be changed. Only characters that survive a
 * URL path and a WeChat message untouched.
 */
export function speakerToken(signupId: string, session: string, key: string = secret()): string {
  if (!/^\d{1,18}$/.test(signupId) || !SESSION.test(session)) throw new Error("bad speaker token input");
  return `${signupId}.${session}.${sign(`${LABEL}:${signupId}.${session}`, key)}`;
}

/** Who and which morning a link is for, or null if it is forged or past its day. */
export function verifySpeakerToken(
  token: string | null | undefined,
  now: number = Date.now(),
  key: string = secret(),
): { signupId: string; session: string } | null {
  if (!token || token.length > 100) return null;

  const match = /^(\d{1,18})\.(\d{4}-\d{2}-\d{2})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;

  const [, signupId, session, signature] = match;
  if (Number.isNaN(Date.parse(`${session}T00:00:00Z`))) return null;

  const expected = Buffer.from(sign(`${LABEL}:${signupId}.${session}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return now < speakerTokenExpiry(session).getTime() ? { signupId, session } : null;
}
