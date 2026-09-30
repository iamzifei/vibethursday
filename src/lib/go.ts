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
  /** The check-in link is live right now (`checkinLinkOpen`). */
  checkinOpen: boolean;
};

export type GoItem =
  | "signup"
  | "order"
  | "myOrder"
  | "mySignup"
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
 * ★ `checkin` links to the check-in page only on the morning itself
 * (`checkinLinkOpen`); the rest of the time it is a line telling people the
 * code is on the table. James chose that trade on 2026-09-28: a few hours in
 * which someone at home could tap it, in exchange for nobody having to find a
 * code on a crowded table.
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
    // "mySignup" always follows: most people here arrived from the group asking
    // whether their signup went through, or needing to move it (2026-09-28).
    return [...(state.signedUp === true ? [] : (["signup"] as GoItem[])), "mySignup", drink, "card", "members", "wharf"];
  }

  if (phase === "day") {
    // From ten (when the check-in link opens) the drinks sheet has already gone
    // to the bar, so a new order would reach nobody: only an existing order is
    // shown, and everyone else orders at the counter (James 2026-09-30).
    if (state.checkinOpen) {
      return ["checkin", ...(state.hasOrder ? (["myOrder"] as GoItem[]) : []), "badge", "members"];
    }
    return ["checkin", drink, "badge", "members"];
  }

  // From noon the session looks back, but anyone who forgot to tap should
  // still find check-in first until the link closes.
  return [...(state.checkinOpen ? (["checkin"] as GoItem[]) : []), "feedback", "session", "nextSignup"];
}

/** Hours (Sydney) during which /go links straight to check-in, on the session's own date. */
export const CHECKIN_LINK_FROM = 10;
export const CHECKIN_LINK_UNTIL = 13;

/**
 * Whether /go shows a check-in link right now: only on the session's own date,
 * 10:00 to 13:00 Sydney time. The check-in route has its own, wider rule (the
 * whole day) and is unchanged; this only decides whether /go hands out the link.
 */
export function checkinLinkOpen(isSessionDay: boolean, sydneyHour: number): boolean {
  return isSessionDay && sydneyHour >= CHECKIN_LINK_FROM && sydneyHour < CHECKIN_LINK_UNTIL;
}
