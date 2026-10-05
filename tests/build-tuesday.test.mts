/**
 * Build Tuesday: a second kind of session that is not on a Thursday.
 *
 * The risk these tests pin down was found before a line was written: the
 * signup route whitelisted dates against `nextThursdays()`, so a Tuesday date
 * from the form would have been stored as "no session" while the person was
 * told they were signed up. Everything that decides "is this a date people can
 * book" now goes through `openSpecialSessions` / `bookableSessions`, and these
 * check that a Tuesday is in, that it drops out once it is over, and that no
 * Thursday changes.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { admission, capFor, SESSION_CAP } from "../src/lib/capacity.ts";
import { formatSession, isSpecialSession, openSpecialSessions, SPECIAL_SESSIONS } from "../src/lib/sessions.ts";

const FIRST_TUESDAY = "2026-10-06";

test("the first Build Tuesday is registered, 10:00–12:00, fifteen places", () => {
  const first = SPECIAL_SESSIONS.find((session) => session.date === FIRST_TUESDAY);
  assert.ok(first, "2026-10-06 is missing from SPECIAL_SESSIONS");
  assert.equal(first.kind, "tuesday");
  assert.equal(first.cap, 15);
  assert.equal(first.endHour, 12);
  // A Tuesday really is a Tuesday: a typo in the date would put it on the
  // wrong day of the week while every label still said 周二.
  assert.equal(new Date(`${first.date}T00:00:00Z`).getUTCDay(), 2);
});

test("every special session is a valid date and not a Thursday", () => {
  for (const session of SPECIAL_SESSIONS) {
    assert.match(session.date, /^\d{4}-\d{2}-\d{2}$/);
    // A special session on a Thursday would collide with that week's Thursday
    // in every per-date table on the site.
    assert.notEqual(new Date(`${session.date}T00:00:00Z`).getUTCDay(), 4, session.date);
  }
});

test("a Tuesday can be booked from the days before it until it ends at noon", () => {
  assert.ok(openSpecialSessions("2026-10-04", 9).some((s) => s.date === FIRST_TUESDAY));
  assert.ok(openSpecialSessions(FIRST_TUESDAY, 11).some((s) => s.date === FIRST_TUESDAY));
  assert.ok(!openSpecialSessions(FIRST_TUESDAY, 12).some((s) => s.date === FIRST_TUESDAY), "still bookable after it ended");
  assert.ok(!openSpecialSessions("2026-10-07", 9).some((s) => s.date === FIRST_TUESDAY), "still bookable the day after");
});

test("isSpecialSession only knows registered dates", () => {
  assert.equal(isSpecialSession(FIRST_TUESDAY), true);
  assert.equal(isSpecialSession("2026-10-08"), false);
  assert.equal(isSpecialSession("not a date"), false);
});

test("★ the cap is per session: fifteen on the Tuesday, forty on a Thursday", () => {
  assert.equal(capFor(FIRST_TUESDAY), 15);
  assert.equal(capFor("2026-10-08"), SESSION_CAP);
  assert.equal(admission(14, false, capFor(FIRST_TUESDAY)), "booked");
  assert.equal(admission(15, false, capFor(FIRST_TUESDAY)), "waitlist");
  // The default stays forty, so every existing caller is unchanged.
  assert.equal(admission(15, false), "booked");
});

test("★ a Tuesday is labelled 周二, and Thursdays are still 周四", () => {
  assert.equal(formatSession(FIRST_TUESDAY, "zh"), "10月6日（周二）");
  assert.equal(formatSession(FIRST_TUESDAY, "zh-Hant"), "10月6日（週二）");
  assert.equal(formatSession(FIRST_TUESDAY, "en"), "Tue, 6 Oct");
  assert.equal(formatSession("2026-10-08", "zh"), "10月8日（周四）");
  assert.equal(formatSession("2026-10-08", "zh-Hant"), "10月8日（週四）");
});

test("★ one morning a week: a Tuesday and that week's Thursday are the same week", async () => {
  const { sameWeekSessions } = await import("../src/lib/sessions.ts");
  // Tue 6 Oct and Thu 8 Oct share a week; Thu 1 Oct and Tue 13 Oct do not.
  assert.deepEqual(sameWeekSessions("2026-10-06", ["2026-10-01", "2026-10-08", "2026-10-13"]), ["2026-10-08"]);
  assert.deepEqual(sameWeekSessions("2026-10-08", ["2026-10-06", "2026-10-15"]), ["2026-10-06"]);
  assert.deepEqual(sameWeekSessions("2026-10-13", ["2026-10-08", "2026-10-15", "2026-10-15"]), ["2026-10-15"]);
  // The date itself, and garbage, never count.
  assert.deepEqual(sameWeekSessions("2026-10-08", ["2026-10-08", "none", ""]), []);
  // Monday and Sunday bound the week.
  assert.deepEqual(sameWeekSessions("2026-10-12", ["2026-10-11", "2026-10-18"]), ["2026-10-18"]);
});

test("★ builders get only the Thursday waitlist when that week's Tuesday has room", async () => {
  const { builderToWaitlist, isBuilderPurpose } = await import("../src/lib/capacity.ts");
  const base = { purpose: "product", session: "2026-10-08", isTuesday: false, alreadyIn: false, sameWeekTuesdayOpen: true };
  assert.equal(isBuilderPurpose("product"), true);
  assert.equal(isBuilderPurpose("tech"), true);
  assert.equal(isBuilderPurpose("biz"), false);
  assert.equal(isBuilderPurpose("learn"), false);
  assert.equal(builderToWaitlist(base), true);
  assert.equal(builderToWaitlist({ ...base, purpose: "tech" }), true);
  // Business owners and newcomers are who Thursday is for.
  assert.equal(builderToWaitlist({ ...base, purpose: "biz" }), false);
  assert.equal(builderToWaitlist({ ...base, purpose: "learn" }), false);
  assert.equal(builderToWaitlist({ ...base, purpose: null }), false);
  // No open Tuesday that week: nowhere else to go, so Thursday as usual.
  assert.equal(builderToWaitlist({ ...base, sameWeekTuesdayOpen: false }), false);
  // Nobody already holding a place is demoted.
  assert.equal(builderToWaitlist({ ...base, alreadyIn: true }), false);
  // The Tuesday itself is never affected.
  assert.equal(builderToWaitlist({ ...base, isTuesday: true }), false);
});
