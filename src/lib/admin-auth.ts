import { timingSafeEqual } from "node:crypto";

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
