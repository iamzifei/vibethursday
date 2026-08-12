/**
 * Tests for the per-session headcount on /admin.
 *
 * The thing worth pinning down here is the counting rule, not the rendering.
 * Signups are upserted, so a returning person adds a date to an existing row
 * instead of creating a new one — every naive way of counting a Thursday
 * (rows created that week, `first_session`) therefore gives a wrong answer,
 * and has done so in practice.
 *
 * The last test pins down what these numbers are *not*: see the note in
 * signup-stats.ts about why "how many are new" is not in here.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { countPerSession, type CountableSignup } from "../src/lib/signup-stats.ts";

/** A signup row with only the fields the counts read. */
function signup(sessions: string[], demoIntent: string | null = null): CountableSignup {
  return { sessions, demo_intent: demoIntent };
}

test("a person is counted once in every session they signed up for", () => {
  const counts = countPerSession(
    [signup(["2026-08-06", "2026-08-13"]), signup(["2026-08-13"])],
    ["2026-08-13"],
  );

  const byDate = new Map(counts.map((session) => [session.date, session]));
  assert.equal(byDate.get("2026-08-06")?.total, 1);
  assert.equal(byDate.get("2026-08-13")?.total, 2);
});

test("a duplicated date does not inflate a session", () => {
  const counts = countPerSession([signup(["2026-08-13", "2026-08-13"])], ["2026-08-13"]);

  assert.equal(counts.length, 1);
  assert.equal(counts[0].total, 1);
});

test("only an explicit yes counts as wanting to demo", () => {
  const counts = countPerSession(
    [
      signup(["2026-08-13"], "yes"),
      signup(["2026-08-13"], "maybe"),
      signup(["2026-08-13"], "listen"),
      signup(["2026-08-13"], null),
    ],
    ["2026-08-13"],
  );

  assert.equal(counts[0].total, 4);
  assert.equal(counts[0].wantsToDemo, 1);
});

test("someone who picked no session is in no session", () => {
  // These are the people who cannot make a weekday morning. They belong in the
  // "can't do Thu" number, never in a Thursday's headcount.
  const counts = countPerSession([signup([])], ["2026-08-13"]);

  assert.deepEqual(counts, [{ date: "2026-08-13", total: 0, wantsToDemo: 0 }]);
});

test("the next session is listed even with nobody signed up for it", () => {
  // A zero has to render as a zero. Dropping the row would read as "not asked
  // yet" on the one page whose job is to answer "how many for Thursday".
  const counts = countPerSession([signup(["2026-08-06"])], ["2026-08-13"]);

  assert.equal(counts[0].date, "2026-08-13");
  assert.equal(counts[0].total, 0);
});

test("upcoming sessions come first, then past ones most recent first", () => {
  const counts = countPerSession(
    [signup(["2026-07-30"]), signup(["2026-08-06"]), signup(["2026-08-20"]), signup(["2026-08-27"])],
    ["2026-08-13"],
  );

  assert.deepEqual(
    counts.map((session) => session.date),
    ["2026-08-13", "2026-08-20", "2026-08-27", "2026-08-06", "2026-07-30"],
  );
});

test("no count claims to say who is new", () => {
  // Guards the deletion, not an addition. A "first timers" count was shipped
  // here on 2026-08-12 and read 26 for the session whose real group increment
  // was 1: the earliest date on a signup is the earliest one the form could
  // still offer, not when that person arrived. If a field like this comes
  // back, it needs a source that knows who is already in the WeChat group.
  const [session] = countPerSession([signup(["2026-08-13"])], ["2026-08-13"]);

  assert.deepEqual(Object.keys(session).sort(), ["date", "total", "wantsToDemo"]);
});
