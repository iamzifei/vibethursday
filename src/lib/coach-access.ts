// Relative, not "@/": the tests load this through Node's type stripper.

/**
 * Which allowance a press of "help me ask this better" is charged against.
 *
 * Members are limited per member, as they always were. Since 2026-09-28 the
 * button is also on the signup form, where most people have no member card
 * yet, so a visitor without one is limited per address instead of refused.
 *
 * ★ Neither of these is what bounds the bill. Anybody can mint a member cookie
 * or change address; the site-wide daily cap (`CALLS_PER_DAY` in the route,
 * `coach-budget.ts`) is charged before every call regardless and is the real
 * ceiling. These keys only stop one person, or one room, from spending all of
 * it on their own drafts.
 */

/**
 * Presses per hour for one address with no member card.
 *
 * A café full of phones is one address, so this is sized for a room pressing
 * it a few times each rather than for one person.
 */
export const VISITOR_CALLS_PER_HOUR = 20;

/** The rate-limit key and cap for this caller. `max: undefined` means the limiter's default. */
export function coachRateKey(memberId: string | null, ip: string): { key: string; max: number | undefined } {
  if (memberId) return { key: `coach:${memberId}`, max: undefined };
  return { key: `coach-ip:${ip}`, max: VISITOR_CALLS_PER_HOUR };
}

/**
 * What the route sends back for one call.
 *
 * ⚠️ A failed call is a 503, never `{ hint: null }`. `coachDraft` returns null
 * for every failure — no key, a timeout, an upstream error, a reply that did
 * not parse — and passing that on as "no hint" made the page say "this one is
 * specific enough" about whatever had been typed. Measured 2026-09-28 on
 * "想了解了解", the vaguest sentence there is.
 */
export function coachReply(
  coaching: { gap: string; ask: string } | null,
): { status: number; body: { error: string } | { hint: string | null; gap: string } } {
  if (!coaching) return { status: 503, body: { error: "unavailable" } };
  return { status: 200, body: { hint: coaching.ask || null, gap: coaching.gap } };
}
