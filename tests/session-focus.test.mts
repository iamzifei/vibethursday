/**
 * Which session the member wall groups itself around.
 *
 * The rule this pins down was a live defect, measured on the evening of the
 * fourth session (2026-08-27 21:50): the wall's only heading was "所有成员",
 * because `nextThursdays(1)[0]` had already rolled to the following week at
 * noon and nobody had signed up for that yet. Everyone who had spent that
 * morning together stopped being grouped anywhere — during lunch, which is
 * exactly when someone is trying to work out who it was they had been talking
 * to.
 *
 * `sessionInFocus` is a pure function of (next session, today) so these can
 * walk a whole week without touching the clock.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { sessionInFocus } from "../src/lib/sessions.ts";

/** The two Thursdays these tests move between. */
const LAST = "2026-08-27";
const NEXT = "2026-09-03";

test("during a session, the wall is looking at that session", () => {
  // Before noon on a Thursday `nextThursdays` still returns today, so the
  // session in focus is the one happening in the room right now.
  assert.equal(sessionInFocus(LAST, LAST), LAST);
});

test("the evening a session ends, the wall still shows that session", () => {
  // This is the bug. After noon `nextThursdays` says 2026-09-03, and the old
  // code grouped on that — emptying the group out.
  assert.equal(sessionInFocus(NEXT, LAST), LAST, "the session that just happened dropped out");
});

test("Friday and Saturday still look back", () => {
  assert.equal(sessionInFocus(NEXT, "2026-08-28"), LAST);
  assert.equal(sessionInFocus(NEXT, "2026-08-29"), LAST);
});

test("the switch to looking forward happens between Sunday and Monday", () => {
  // Sunday is four days out from the next session, Monday is three.
  assert.equal(sessionInFocus(NEXT, "2026-08-30"), LAST, "Sunday should still look back");
  assert.equal(sessionInFocus(NEXT, "2026-08-31"), NEXT, "Monday should look forward");
});

test("the run-up to a session looks forward", () => {
  for (const day of ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]) {
    assert.equal(sessionInFocus(NEXT, day), NEXT, `${day} should look forward`);
  }
});

test("every day of the week resolves to one of the two adjacent Thursdays", () => {
  // A guard against an off-by-one putting the wall on a Thursday that never
  // ran, which would show an empty group and look like a broken page.
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date("2026-08-27T00:00:00Z");
    day.setUTCDate(day.getUTCDate() + offset);
    const today = day.toISOString().slice(0, 10);
    const next = today > LAST && today <= NEXT ? NEXT : LAST;

    assert.ok(
      [LAST, NEXT].includes(sessionInFocus(next, today)),
      `${today} resolved to something that is not an adjacent Thursday`,
    );
  }
});

test("before the meetup existed there is no previous session to fall back to", () => {
  // FIRST_SESSION is 2026-08-06. Looking back from the very first week would
  // otherwise point at 2026-07-30, a Thursday on which nothing happened.
  assert.equal(sessionInFocus("2026-08-06", "2026-08-01"), "2026-08-06");
});
