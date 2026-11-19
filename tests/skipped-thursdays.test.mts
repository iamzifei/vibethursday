/**
 * Thursdays that are not held (2026-11-19): 24 and 31 December, the Christmas
 * and New Year weeks. The meetup is back on 7 January 2027. A skipped
 * Thursday must never be offered for signup, and the Thursdays around it
 * still are.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { SKIPPED_THURSDAYS, thursdaysFrom } from "../src/lib/sessions.ts";

test("★ 24 and 31 December are skipped", () => {
  assert.ok(SKIPPED_THURSDAYS.includes("2026-12-24"));
  assert.ok(SKIPPED_THURSDAYS.includes("2026-12-31"));
});

test("★ from mid-December the next Thursdays jump straight to 7 January", () => {
  assert.deepEqual(thursdaysFrom("2026-12-18", 9, 3), ["2027-01-07", "2027-01-14", "2027-01-21"]);
});

test("the Thursday before the break is still offered", () => {
  assert.deepEqual(thursdaysFrom("2026-12-14", 9, 2), ["2026-12-17", "2027-01-07"]);
});

test("an ordinary week is unaffected", () => {
  assert.deepEqual(thursdaysFrom("2026-11-19", 9, 2), ["2026-11-19", "2026-11-26"]);
  assert.deepEqual(thursdaysFrom("2026-11-19", 13, 1), ["2026-11-26"]);
});

// Review 2026-11-19: "the last session" must never be a skipped Thursday.
import { sessionInFocus } from "../src/lib/sessions.ts";
import { sessionForFeedback } from "../src/lib/feedback.ts";

test("★ looking back over the break lands on 17 December, not a skipped week", () => {
  // From 18 December the next session is 7 January, more than three days away.
  for (const today of ["2026-12-18", "2026-12-25", "2027-01-02"]) {
    assert.equal(sessionInFocus("2027-01-07", today), "2026-12-17", today);
  }
  assert.equal(sessionInFocus("2027-01-07", "2027-01-05"), "2027-01-07");
});

test("★ feedback over the break belongs to 17 December", () => {
  for (const today of ["2026-12-24", "2026-12-28", "2026-12-31", "2027-01-06"]) {
    assert.equal(sessionForFeedback(today), "2026-12-17", today);
  }
  assert.equal(sessionForFeedback("2027-01-07"), "2027-01-07");
});
