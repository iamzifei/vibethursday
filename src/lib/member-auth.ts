import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Who is editing their own card.
 *
 * A signed cookie rather than a session table: there is nothing to revoke and
 * nothing to look up, so the database stays out of the auth path entirely. The
 * cookie carries a member id and an expiry, and a signature over both — change
 * either and the signature stops matching.
 */

export const MEMBER_COOKIE = "vt_member";

/** Six months. Long enough that a regular claims once and never again. */
const TTL_SECONDS = 180 * 24 * 60 * 60;

/**
 * MEMBER_SECRET if it is set, otherwise ADMIN_TOKEN, which is already required
 * for the site to run. The label keeps this key separate from anything else
 * ADMIN_TOKEN is ever used for, so a member cookie can never be replayed as an
 * admin credential.
 */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;

  if (!key) {
    throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; member sign-in is disabled");
  }

  return key;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`vt.member.v1:${payload}`).digest("base64url");
}

export function issueToken(memberId: string): string {
  const payload = `${memberId}.${Math.floor(Date.now() / 1000) + TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the member id a token vouches for, or null if it does not. */
export function readToken(token: string | undefined): string | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [memberId, expiry, signature] = parts;
  const expected = sign(`${memberId}.${expiry}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  // timingSafeEqual throws on a length mismatch, and the length of a base64url
  // SHA-256 digest is fixed, so anything else is simply not one of ours.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (!/^\d+$/.test(expiry) || Number(expiry) * 1000 <= Date.now()) return null;
  if (!/^\d+$/.test(memberId)) return null;

  return memberId;
}

/** The signed-in member id for the current request, or null. */
export async function currentMemberId(): Promise<string | null> {
  const store = await cookies();
  return readToken(store.get(MEMBER_COOKIE)?.value);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Set on HTTPS only in production; localhost is plain HTTP.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  };
}
