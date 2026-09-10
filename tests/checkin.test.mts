/**
 * The rules behind checking in on the day.
 *
 * Every function under test is pure — rows in, answer out — so a whole week
 * of edge cases runs without a database or a clock. The cases pin down the
 * decisions that matter: a code only works on its own day, a name that
 * appears twice gets a hint, and nobody is named on a wall who did not say so.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRoster,
  buildWall,
  canCheckIn,
  checkinCode,
  isSessionDate,
  shortHint,
  verifyCheckinCode,
  type RosterSignup,
  type WallCheckin,
} from "../src/lib/checkin.ts";

const KEY = "test-key-not-a-secret";
const THURSDAY = "2026-09-10";

test("a session code is stable for a date and differs between dates", () => {
  assert.equal(checkinCode(THURSDAY, KEY), checkinCode(THURSDAY, KEY));
  assert.notEqual(checkinCode(THURSDAY, KEY), checkinCode("2026-09-17", KEY));
  assert.equal(checkinCode(THURSDAY, KEY).length, 10);
});

test("a code verifies only for its own session and key", () => {
  const code = checkinCode(THURSDAY, KEY);

  assert.equal(verifyCheckinCode(THURSDAY, code, KEY), true);
  assert.equal(verifyCheckinCode("2026-09-17", code, KEY), false, "another week");
  assert.equal(verifyCheckinCode(THURSDAY, code, "other-key"), false, "another key");
  assert.equal(verifyCheckinCode(THURSDAY, code.slice(0, 9), KEY), false, "truncated");
  assert.equal(verifyCheckinCode(THURSDAY, "", KEY), false);
  assert.equal(verifyCheckinCode(THURSDAY, undefined, KEY), false);
  assert.equal(verifyCheckinCode("not-a-date", code, KEY), false);
});

test("only well-formed calendar dates are session dates", () => {
  assert.equal(isSessionDate("2026-09-10"), true);
  assert.equal(isSessionDate("2026-02-31"), false, "rolls into March");
  assert.equal(isSessionDate("2026-9-10"), false);
  assert.equal(isSessionDate("2026-09-10T00:00"), false);
  assert.equal(isSessionDate(""), false);
  assert.equal(isSessionDate(undefined), false);
});

test("the room can check in on the day and on no other day", () => {
  assert.equal(canCheckIn(THURSDAY, THURSDAY), true);
  assert.equal(canCheckIn(THURSDAY, "2026-09-09"), false, "the evening before");
  assert.equal(canCheckIn(THURSDAY, "2026-09-11"), false, "the morning after");
  assert.equal(canCheckIn("2026-09-17", THURSDAY), false, "next week's code today");
});

/** The smallest signup row the roster needs. */
function signup(id: string, name: string, sessions: string[], building: string | null = null): RosterSignup {
  return { id, name, building, sessions };
}

test("the roster is everyone signed up for the day, tapped names last", () => {
  const roster = buildRoster(
    THURSDAY,
    [
      signup("1", "Zoe", [THURSDAY]),
      signup("2", "Adam", [THURSDAY, "2026-09-03"]),
      signup("3", "Bea", ["2026-09-03"]),
      signup("4", "Carl", [THURSDAY]),
    ],
    [{ signup_id: "2", on_wall: true }],
  );

  assert.deepEqual(
    roster.map((entry) => [entry.name, entry.checkedIn]),
    [
      ["Carl", false],
      ["Zoe", false],
      ["Adam", true],
    ],
    "Bea signed up for another week and is not on this list",
  );
  assert.equal(roster.find((entry) => entry.name === "Adam")?.onWall, true);
});

test("a walk-in stays on the roster once checked in", () => {
  // A walk-in has no session on their signup row: they were added on the day
  // and checked in immediately. The check-in row is what puts them here.
  const roster = buildRoster(
    THURSDAY,
    [signup("9", "Walk In", [])],
    [{ signup_id: "9", on_wall: false }],
  );

  assert.equal(roster.length, 1);
  assert.equal(roster[0].checkedIn, true);
  assert.equal(roster[0].onWall, false);
});

test("a name that appears twice gets a hint, a unique one does not", () => {
  const roster = buildRoster(
    THURSDAY,
    [
      signup("1", "Chris", [THURSDAY], "smart city sensors  for\ncouncils and a lot more words here"),
      signup("2", "chris", [THURSDAY], "iOS apps"),
      signup("3", "Dana", [THURSDAY], "a newsletter"),
    ],
    [],
  );

  const byName = Object.fromEntries(roster.map((entry) => [entry.id, entry.hint]));

  assert.equal(byName["1"], "smart city sensors for c…", "collapsed and cut to a phone line");
  assert.equal(byName["2"], "iOS apps");
  assert.equal(byName["3"], null, "Dana is the only Dana");
});

test("shortHint collapses whitespace and returns null for nothing", () => {
  assert.equal(shortHint("  a   b \n c "), "a b c");
  assert.equal(shortHint(""), null);
  assert.equal(shortHint(null), null);
  assert.equal(shortHint("x".repeat(30)), `${"x".repeat(24)}…`);
});

/** A check-in row as the wall sees it. */
function checkin(
  name: string,
  on_wall: boolean,
  member: WallCheckin["member"] = null,
  building: string | null = null,
): WallCheckin {
  return { signup_id: name, name, building, on_wall, member };
}

test("the wall names only those who agreed, and uses a live card when there is one", () => {
  const wall = buildWall([
    checkin("Adam", true, { slug: "adam", published: true, hidden: false }),
    checkin("Bea", true, { slug: "bea", published: false, hidden: false }, "a draft card"),
    checkin("Carl", true, { slug: "carl", published: true, hidden: true }, "took the card down"),
    checkin("Dana", true, null, "no card at all"),
    checkin("Eve", false, { slug: "eve", published: true, hidden: false }),
  ]);

  assert.equal(wall.total, 5, "everyone who checked in counts");
  assert.equal(wall.unnamed, 1, "Eve chose not to be named, card or no card");
  assert.deepEqual(wall.entries, [
    { kind: "card", slug: "adam" },
    { kind: "light", name: "Bea", building: "a draft card" },
    { kind: "light", name: "Carl", building: "took the card down" },
    { kind: "light", name: "Dana", building: "no card at all" },
  ]);
});
