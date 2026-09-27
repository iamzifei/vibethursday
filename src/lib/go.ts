// Relative, not "@/": the tests load this through Node's type stripper.

/**
 * `/go` — the one link people are asked to remember.
 *
 * Coming to a session touches half a dozen pages: signing up, the member card,
 * ordering a drink, checking in, the Wharf, feedback. Each of them was its own
 * link, several of them long because they carry a session code, and every one
 * cost another message in the group. `/go` never changes; what it shows does,
 * by the calendar, so at any moment it lists only the two or three things
 * worth doing right then.
 *
 * This file is the rule for which things those are. Pure, no clock and no
 * database, so a whole week can be walked in a test.
 */

/** Where we are relative to the session in focus. */
export type GoPhase = "before" | "day" | "after";

/**
 * Before, on the day, or after — from `focusSession()`'s answer and today.
 *
 * `focusSession()` already looks forward from Monday and back from Thursday
 * noon, so it is the one source of truth for "which Thursday"; this only says
 * which side of it we are on. A focus in the past is "after" even when it is
 * today's date: that is Thursday afternoon, and the thing to do then is give
 * feedback, not find the check-in code.
 */
export function goPhase(focus: { date: string; past: boolean }, today: string): GoPhase {
  if (focus.past) return "after";
  return focus.date === today ? "day" : "before";
}

/** What the page knows about whoever is looking at it. All optional: most visitors are anonymous. */
export type GoState = {
  /** From a claimed member card. Null when we cannot tell. */
  signedUp: boolean | null;
  /** This phone has an order for the session in focus. */
  hasOrder: boolean;
  /** This browser is signed in to a member card. */
  hasCard: boolean;
};

export type GoItem =
  | "signup"
  | "order"
  | "myOrder"
  | "card"
  | "members"
  | "wharf"
  | "checkin"
  | "badge"
  | "feedback"
  | "session"
  | "nextSignup";

/**
 * Which things to show, in order.
 *
 * ★ `checkin` never carries a link, in any phase. The check-in code is on the
 * table in the room, and that is the whole of what makes a check-in mean
 * "was there": a code reachable from a link in the group would let anybody
 * check in from home.
 *
 * Not the support page, deliberately: donations are never raised on the day
 * and never sit in navigation (decided 2026-08-11), and this page is both.
 * The footer already carries that link.
 *
 * Signing up drops out once we know somebody has; ordering turns into "my
 * order" once this phone has one. We never hide signing up on a guess — an
 * anonymous visitor always sees it.
 */
export function goItems(phase: GoPhase, state: GoState): GoItem[] {
  const drink: GoItem = state.hasOrder ? "myOrder" : "order";

  if (phase === "before") {
    return [...(state.signedUp === true ? [] : (["signup"] as GoItem[])), drink, "card", "members", "wharf"];
  }

  if (phase === "day") {
    return ["checkin", drink, "badge", "members"];
  }

  return ["feedback", "session", "nextSignup"];
}
