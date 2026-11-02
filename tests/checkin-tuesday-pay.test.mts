/**
 * Checking in to a paid Build Tuesday (2026-11-02): someone who still owes
 * the fee goes from the check-in straight to their own payment page (marked
 * "checked in"); a walk-in is booked if a place is left — and pays the same
 * way — or, when it is full, checked in on the waitlist and told to see the
 * organiser. Places are never promised to a walk-in. 共创会员 and 导师团 owe
 * nothing and go on to their badge as before.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterCheckin } from "../src/lib/checkin-pay.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ where a check-in leads: free day → badge; free person → badge; owes → payment; full walk-in → see the organiser", () => {
  assert.equal(afterCheckin({ feeDay: false, free: false, booked: true, status: "pending" }), "badge");
  assert.equal(afterCheckin({ feeDay: true, free: true, booked: true, status: "pending" }), "badge");
  assert.equal(afterCheckin({ feeDay: true, free: false, booked: true, status: "paid" }), "badge");
  assert.equal(afterCheckin({ feeDay: true, free: false, booked: true, status: "waived" }), "badge");
  assert.equal(afterCheckin({ feeDay: true, free: false, booked: true, status: "pending" }), "pay");
  assert.equal(afterCheckin({ feeDay: true, free: false, booked: false, status: null }), "full");
  assert.equal(afterCheckin({ feeDay: true, free: true, booked: false, status: null }), "badge", "a mentor never waits on a place");
});

test("the check-in route follows it, checks capacity for a walk-in, and the pages say what happened", async () => {
  const route = read("src/app/api/checkin/route.ts");
  assert.match(route, /afterCheckin\(/);
  assert.match(route, /sessionHeadcount\(/);
  assert.match(route, /isTuesdayFree\(/);
  assert.match(read("src/app/tuesday/pay/page.tsx"), /params\.in/);
  const { copy } = await import("../src/lib/content.ts");
  assert.ok(copy.zh.checkin.walkInFull.length > 0);
  assert.ok(copy.en.checkin.walkInFull.length > 0);
});
