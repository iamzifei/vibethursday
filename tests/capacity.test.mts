import assert from "node:assert/strict";
import { test } from "node:test";
import { admission, SESSION_CAP } from "../src/lib/capacity.ts";

/**
 * The per-session signup cap (`src/lib/capacity.ts`).
 *
 * Decided 2026-09-28: aim for about thirty in the room, cap signups at forty.
 * Not everyone who signs up comes, and some regulars walk in without signing
 * up, so forty signups is roughly thirty people in the room.
 */

test("the cap is forty", () => {
  assert.equal(SESSION_CAP, 40);
});

test("below the cap, a signup is booked", () => {
  assert.equal(admission(0, false), "booked");
  assert.equal(admission(39, false), "booked");
});

test("at the cap, a new signup goes on the waitlist", () => {
  assert.equal(admission(40, false), "waitlist");
  assert.equal(admission(41, false), "waitlist");
});

test("★ someone already booked who submits again is never moved to the waitlist", () => {
  // A regular re-submitting to update their question must not lose their place.
  assert.equal(admission(40, true), "booked");
  assert.equal(admission(55, true), "booked");
});
