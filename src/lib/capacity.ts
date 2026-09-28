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
