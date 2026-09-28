// Relative, not "@/": the tests load this through Node's type stripper.

/**
 * How many people one session takes signups from.
 *
 * Decided 2026-09-28. The room could seat more — the venue is a bar and café
 * with space to spare — so this is not about chairs. It is about what the
 * morning is: one room together, a round of one-line introductions from the
 * first-timers, a talk, and two questions talked through properly. Every one of
 * those gets worse per person as the room grows, so the target is about thirty
 * people there.
 *
 * Forty signups gets about thirty: not everyone who signs up comes, and a few
 * regulars walk in without signing up at all. Walk-ins are never capped — they
 * check in at the door and do not pass through the signup route.
 *
 * ⚠️ A soft cap. Two people submitting for the fortieth place at the same moment
 * can both get in. That is one extra person in a room with space to spare, and
 * not worth a lock.
 */
export const SESSION_CAP = 40;

export type Admission = "booked" | "waitlist";

/**
 * Whether a signup for a session is booked or waitlisted.
 *
 * `count` is how many signups that session already has (the same count /admin
 * shows); `alreadyIn` is whether this person is one of them. Somebody already
 * booked who submits again — to change their question, say — keeps their place.
 */
export function admission(count: number, alreadyIn: boolean): Admission {
  if (alreadyIn) return "booked";
  return count < SESSION_CAP ? "booked" : "waitlist";
}

/**
 * Whether a person already holds this session on a row other than the one a
 * signup is about to update.
 *
 * The same person can exist twice in `signups` (a WeChat-only signup, then a
 * later one with an email and a differently written ID). `saveSignup` updates
 * the lower id of the matching rows; if the other one already has the session,
 * adding it again would make one person take two places towards the cap.
 */
export function bookedOnAnother(targetId: string, rows: readonly { id: string; booked: boolean }[]): boolean {
  return rows.some((row) => row.id !== targetId && row.booked);
}

/**
 * Whether a signup's name is the same person as the row it matched by email or
 * WeChat ID — the condition for letting it rewrite that row's profile.
 *
 * ★ Found by the 2026-09-28 review: the signup route needs no login, and it
 * merged into any row with the same email or WeChat ID, overwriting the name,
 * "what I'm working on" and the Wharf question. Knowing someone's WeChat ID was
 * enough to put words on the board under their name. Requiring the name as
 * well is the same bar `/claim` already uses (name plus one contact method).
 *
 * Width, spacing and case are ignored, and one name containing the other
 * counts, so a regular who adds or drops a surname is still themselves. A
 * single character never matches anything.
 */
export function sameSignupName(submitted: string, onFile: string): boolean {
  const norm = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const a = norm(submitted);
  const b = norm(onFile);
  if (a.length < 2 || b.length < 2) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * The whole name, not a part of it: width, spacing and case ignored, nothing
 * else. For the one thing `sameSignupName` is too loose for — handing a phone
 * a 60-day "remembers you" pass (2026-09-28 review: "Li" is inside a lot of
 * names, and a WeChat ID plus two letters is not much of a secret).
 */
export function exactSignupName(submitted: string, onFile: string): boolean {
  const norm = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const a = norm(submitted);
  return a.length >= 2 && a === norm(onFile);
}

/** Waitlisted people at which the admin page asks you to take a look. */
export const WAITLIST_ALERT = 5;
/** Signups for the session in the last day with no bot check, at which the same. */
export const UNVERIFIED_ALERT = 10;

/**
 * Whether the admin page should warn that a session may be being filled by a
 * script (2026-09-28 review: the bot check is advisory, so a handful of
 * addresses could take all forty places and push real people to the waitlist).
 *
 * Only a prompt to look — it blocks nothing. Returns the two numbers to show,
 * or null when neither is high enough to mention.
 */
export function capacityAlert(counts: { waitlist: number; unverifiedLastDay: number }) {
  return counts.waitlist >= WAITLIST_ALERT || counts.unverifiedLastDay >= UNVERIFIED_ALERT ? counts : null;
}
