import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
// Relative imports only: the tests load this through Node's type stripper.
import { GUEST_ANIMALS } from "./protocol.ts";
import { hashString } from "./world.ts";

/**
 * A guest's identity on /play that survives a reload.
 *
 * Guests used to get a fresh animal every visit, which is fine for walking
 * around and useless for a weekly board: nobody can climb a ranking under a
 * name that changes each time. The server hands out a signed token; the
 * browser keeps it and brings it back; the animal and number are derived from
 * it, so the same phone is the same "Koala 42" all week.
 *
 * Its own HMAC label — it verifies as nothing else on the site.
 */

const LABEL = "vt.play.guest.v1";

function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;
  if (!key) throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; guest identities are disabled");
  return key;
}

function sign(id: string, key: string): string {
  return createHmac("sha256", key).update(`${LABEL}:${id}`).digest("base64url").slice(0, 22);
}

export function guestToken(key: string = secret()): string {
  const id = randomBytes(8).toString("hex");
  return `${LABEL}:${id}~${sign(id, key)}`;
}

/** The guest id inside a valid token, or null. */
export function readGuestToken(token: string | null | undefined, key: string = secret()): string | null {
  if (!token || token.length > 100) return null;
  const match = /^vt\.play\.guest\.v1:([0-9a-f]{16})~([A-Za-z0-9_-]{22})$/.exec(token);
  if (!match) return null;
  const expected = Buffer.from(sign(match[1], key));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}

/** [animal index, number 10–99], the same for the same id every time. */
export function guestIdentity(id: string): [number, number] {
  const h = hashString(`guest.${id}`);
  return [h % GUEST_ANIMALS, 10 + (Math.floor(h / GUEST_ANIMALS) % 90)];
}
