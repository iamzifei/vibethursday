/**
 * Build Tuesday from 10 November: mornings only (10:30–12:30), and signups
 * close at 20:00 the evening before (James 2026-11-04).
 *
 * Why: on 3 November eight people had signed up the night before, twelve by
 * the morning and fifteen turned up for twelve seats; the afternoon workshop
 * never started. A cut-off the night before lets the host set the room and
 * line up the two cases. Walk-ins at the door are unaffected: the check-in
 * route does not go through these lists.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { bookableSpecialSessions, openSpecialSessions, SPECIAL_SESSIONS } from "../src/lib/sessions.ts";
import { checkinLinkOpen } from "../src/lib/go.ts";
import { TUESDAY_VENUE } from "../src/lib/tuesday-venue.ts";

const NEXT = "2026-11-10";
const dates = (list: { date: string }[]) => list.map((s) => s.date);

// Spec change 2026-11-05: Tuesday online / 4-week membership — over by 12:00.
test("from 10 November a Tuesday ends at 12:00 and closes for signups at 20:00 the night before", () => {
  const session = SPECIAL_SESSIONS.find((s) => s.date === NEXT);
  assert.ok(session);
  assert.equal(session.endHour, 12);
  assert.equal(session.closesEveHour, 20);
});

test("bookable until 19:59 on Monday, not from 20:00", () => {
  assert.ok(dates(bookableSpecialSessions("2026-11-09", 19)).includes(NEXT));
  assert.ok(!dates(bookableSpecialSessions("2026-11-09", 20)).includes(NEXT));
  assert.ok(!dates(bookableSpecialSessions(NEXT, 9)).includes(NEXT), "bookable on the morning itself");
  // Earlier in the week it is open as before.
  assert.ok(dates(bookableSpecialSessions("2026-11-05", 22)).includes(NEXT));
});

test("after the cut-off the next Tuesday is still offered", () => {
  assert.deepEqual(dates(bookableSpecialSessions("2026-11-09", 21)), ["2026-11-17"]);
});

test("the session itself stays live on the day for the admin and /go (only booking closes)", () => {
  // Spec change 2026-11-05: Tuesday online / 4-week membership — ends at 12:00.
  assert.ok(dates(openSpecialSessions(NEXT, 11)).includes(NEXT));
  assert.ok(!dates(openSpecialSessions(NEXT, 12)).includes(NEXT));
});

test("the /go check-in link follows the shorter Tuesday", () => {
  assert.equal(checkinLinkOpen(true, 12, true), true);
  assert.equal(checkinLinkOpen(true, 13, true), false);
});

test("the venue card says 12:30", () => {
  assert.equal(TUESDAY_VENUE.end, "12:30");
});

test("no public copy still promises the afternoon", () => {
  for (const file of ["src/lib/content.ts", "src/lib/screen.ts", "src/app/quick/page.tsx"]) {
    const source = readFileSync(path.join(import.meta.dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /15:30/, file);
  }
});

test("every route that books a date uses the cut-off list", () => {
  const sessions = readFileSync(path.join(import.meta.dirname, "../src/lib/sessions.ts"), "utf8");
  assert.match(sessions, /export function bookableSessions[\s\S]*?upcomingBookableSpecialSessions\(\)/);
  for (const file of ["src/app/tuesday/page.tsx", "src/app/api/signup/route.ts"]) {
    const source = readFileSync(path.join(import.meta.dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /\bupcomingSpecialSessions\(\)/, file);
  }
});

test("★ a date that closed while the form was open is refused, not silently dropped (review 2026-11-04)", () => {
  // Before: an unbookable date became "no session" and the person saw the
  // normal success screen with nothing booked. With a public 20:00 cut-off an
  // ordinary user hits this by opening the form at 19:55.
  const route = readFileSync(path.join(import.meta.dirname, "../src/app/api/signup/route.ts"), "utf8");
  assert.match(route, /resolveSessionChoice\([\s\S]{0,80}if \(closed\)[\s\S]{0,120}session_closed/);
  const form = readFileSync(path.join(import.meta.dirname, "../src/components/SignupForm.tsx"), "utf8");
  assert.match(form, /"session_closed"[\s\S]{0,80}copy\.errorClosed/);
  const content = readFileSync(path.join(import.meta.dirname, "../src/lib/content.ts"), "utf8");
  assert.equal(content.match(/errorClosed:/g)?.length, 2, "zh and en");
});
