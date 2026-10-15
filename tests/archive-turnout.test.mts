/**
 * The archive's turnout estimate and its numbering (2026-10-11).
 *
 * Check-in stopped being a headcount once the room outgrew the door, so the
 * archive estimates turnout from bookings where check-ins fall short — and a
 * Build Tuesday no longer takes a Thursday's number.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { archiveTotals, buildArchive, estimateTurnout, isThursday, isTuesday, SHOW_UP_RATE } from "../src/lib/archive.ts";
import { copy } from "../src/lib/content.ts";

const thursday = (date: string) => ({ date, title: `T ${date}`, note: "", photos: [] });

test("estimate: bookings × rate, only when it beats the check-ins", () => {
  assert.equal(estimateTurnout(18, 82), Math.round(82 * SHOW_UP_RATE));
  assert.equal(estimateTurnout(17, 20), null, "17 vs 17: check-ins already say it");
  assert.equal(estimateTurnout(undefined, 30), null, "no check-ins: the hand-written note has the number");
  assert.equal(estimateTurnout(5, 0), null);
  assert.equal(estimateTurnout(5, undefined), null);
});

test("a Build Tuesday is not numbered, and Thursdays after it keep their numbers", () => {
  const rows = buildArchive(
    [thursday("2026-09-24"), thursday("2026-10-01")],
    [],
    [],
    new Map([["2026-10-01", 18], ["2026-10-06", 6], ["2026-10-08", 10]]),
    new Map([["2026-10-01", 82], ["2026-10-06", 7], ["2026-10-08", 54]]),
  );
  const byDate = Object.fromEntries(rows.map((row) => [row.date, row]));
  assert.equal(byDate["2026-09-24"].index, 1);
  assert.equal(byDate["2026-10-01"].index, 2);
  assert.equal(byDate["2026-10-06"].index, 0);
  assert.equal(byDate["2026-10-08"].index, 3);
  assert.equal(byDate["2026-10-01"].estimated, 70);
  assert.equal(byDate["2026-10-06"].estimated, null, "6 checked in, 7 booked: check-ins win");
  assert.equal(byDate["2026-09-24"].estimated, null, "no check-in record in this fixture");
  assert.equal(archiveTotals(rows, 0, 0, 0).sessions, 3, "the total matches the last Thursday number");
});

test("every written-up session in the copy is a Thursday", () => {
  for (const session of copy.zh.gallery.sessions) assert.ok(isThursday(session.date), session.date);
});

test("turnout reads as a rough figure, with no check-in count beside it (2026-10-16)", () => {
  assert.match(copy.zh.archive.estimated, /^约 \{n\} 人到场$/);
  assert.match(copy.en.archive.estimated, /^About \{n\} came$/);
});

test("weekday helpers read the date as a calendar day, not a moment", () => {
  assert.ok(isThursday("2026-10-08"));
  assert.ok(isTuesday("2026-10-06"));
  assert.ok(!isTuesday("2026-10-08"));
});
