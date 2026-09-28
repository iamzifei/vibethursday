import assert from "node:assert/strict";
import { test } from "node:test";
import { checkinLinkOpen, goItems, goPhase, type GoState } from "../src/lib/go.ts";

/**
 * `/go` (`src/lib/go.ts`): the one link, and what it shows when.
 */

const ANON: GoState = { signedUp: null, hasOrder: false, hasCard: false, checkinOpen: false };

test("which side of the session we are on", () => {
  // Monday to Wednesday: focus is the coming Thursday.
  assert.equal(goPhase({ date: "2026-10-01", past: false }, "2026-09-29"), "before");
  // Thursday morning: focus is today and not past.
  assert.equal(goPhase({ date: "2026-10-01", past: false }, "2026-10-01"), "day");
  // Thursday afternoon onwards: focus has turned to look back, even on the same date.
  assert.equal(goPhase({ date: "2026-10-01", past: true }, "2026-10-01"), "after");
  assert.equal(goPhase({ date: "2026-10-01", past: true }, "2026-10-04"), "after");
});

test("before a session: sign up, order, card, the member wall, the Wharf", () => {
  assert.deepEqual(goItems("before", ANON), ["signup", "order", "card", "members", "wharf"]);
});

test("signing up drops out only when we know, and ordering turns into 'my order'", () => {
  assert.deepEqual(goItems("before", { ...ANON, signedUp: true }), ["order", "card", "members", "wharf"]);
  // Known not signed up, or unknown: still offered.
  assert.deepEqual(goItems("before", { ...ANON, signedUp: false })[0], "signup");
  assert.deepEqual(goItems("before", { ...ANON, hasOrder: true }), ["signup", "myOrder", "card", "members", "wharf"]);
});

test("on the day: check-in, the drink, the badge, who is here", () => {
  assert.deepEqual(goItems("day", ANON), ["checkin", "order", "badge", "members"]);
  assert.deepEqual(goItems("day", { ...ANON, hasOrder: true }), ["checkin", "myOrder", "badge", "members"]);
});

test("after: feedback first", () => {
  assert.deepEqual(goItems("after", ANON), ["feedback", "session", "nextSignup"]);
  // Nothing personal changes what matters after a session.
  assert.deepEqual(goItems("after", { signedUp: true, hasOrder: true, hasCard: true, checkinOpen: false }), [
    "feedback",
    "session",
    "nextSignup",
  ]);
});

test("★ no phase offers ordering and 'my order' at once, and none drops check-in on the day", () => {
  for (const phase of ["before", "day", "after"] as const) {
    for (const hasOrder of [true, false]) {
      const items = goItems(phase, { ...ANON, hasOrder });
      assert.ok(!(items.includes("order") && items.includes("myOrder")));
    }
  }
  assert.ok(goItems("day", { signedUp: true, hasOrder: true, hasCard: true, checkinOpen: false }).includes("checkin"));
});

test("★ the support page is never one of the items", () => {
  // Donations are not raised on the day and not placed in navigation (2026-08-11).
  for (const phase of ["before", "day", "after"] as const) {
    assert.ok(!(goItems(phase, ANON) as string[]).includes("support"));
  }
});

test("★ the check-in link is on /go only on the morning itself", () => {
  // James 2026-09-28: convenience on the day, but the headcount must still mean
  // "was in the room" — so the link exists 10:00–13:00 Sydney time on the
  // session's own date, and nowhere else.
  assert.equal(checkinLinkOpen(true, 9), false);
  assert.equal(checkinLinkOpen(true, 10), true);
  assert.equal(checkinLinkOpen(true, 12), true);
  assert.equal(checkinLinkOpen(true, 13), false);
  assert.equal(checkinLinkOpen(false, 11), false);
});

test("from noon /go turns to feedback, but check-in stays first until one", () => {
  // At 12:00 the session in focus turns to look back (phase "after"). Someone
  // who forgot to tap should still find check-in at the top for that last hour.
  assert.deepEqual(goItems("after", { ...ANON, checkinOpen: true }), ["checkin", "feedback", "session", "nextSignup"]);
  assert.deepEqual(goItems("after", { ...ANON, checkinOpen: false }), ["feedback", "session", "nextSignup"]);
});
