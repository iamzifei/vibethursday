/**
 * Signing up without a session must not be refused as "closed" (2026-11-08).
 *
 * The class card ("先登记，有新课先通知我") and the "no morning yet" option both
 * send firstSession = "none". Since the 20:00 cut-off check (2026-11-04) the
 * route refused any value not in the bookable list, and "none" is not a date,
 * so these signups failed with "这一场的报名已经截止了" and were never saved.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { resolveSessionChoice } from "../src/lib/sessions.ts";

const bookable = ["2026-11-10", "2026-11-12"];

test("★ 'none' is no session, not a closed one", () => {
  assert.deepEqual(resolveSessionChoice("none", bookable), { firstSession: null, closed: false });
});

test("no value at all is no session", () => {
  assert.deepEqual(resolveSessionChoice(null, bookable), { firstSession: null, closed: false });
  assert.deepEqual(resolveSessionChoice("", bookable), { firstSession: null, closed: false });
});

test("an offered date is booked", () => {
  assert.deepEqual(resolveSessionChoice("2026-11-10", bookable), { firstSession: "2026-11-10", closed: false });
});

test("★ a date no longer offered is still refused out loud", () => {
  assert.deepEqual(resolveSessionChoice("2026-11-03", bookable), { firstSession: null, closed: true });
  assert.deepEqual(resolveSessionChoice("garbage", bookable), { firstSession: null, closed: true });
});

test("the signup route decides through resolveSessionChoice", () => {
  const route = readFileSync(path.join(import.meta.dirname, "../src/app/api/signup/route.ts"), "utf8");
  assert.match(route, /resolveSessionChoice\(/);
  assert.match(route, /closed[\s\S]{0,120}session_closed/);
});
