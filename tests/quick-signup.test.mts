/**
 * /quick (2026-11-02): the shortest way to sign up, for a link or QR code the
 * organiser hands out. A nickname and a WeChat ID, nothing else; a Tuesday goes
 * straight on to card payment, a Thursday is booked there and then.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseQuick, quickSession } from "../src/lib/quick-signup.ts";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

test("only a name, a WeChat ID and which day", () => {
  assert.deepEqual(parseQuick(form({ name: " 小王 ", wechat: " wang_01 ", day: "tue" })), { name: "小王", wechat: "wang_01", day: "tue" });
  assert.deepEqual(parseQuick(form({ name: "A", wechat: "b", day: "thu" })), { name: "A", wechat: "b", day: "thu" });
  assert.equal(parseQuick(form({ name: "", wechat: "b", day: "tue" })), null);
  assert.equal(parseQuick(form({ name: "A", wechat: "", day: "tue" })), null);
  assert.equal(parseQuick(form({ name: "A", wechat: "b", day: "sat" })), null);
  assert.equal(parseQuick(form({ name: "A".repeat(61), wechat: "b", day: "tue" })), null);
});

test("the session is the next open one of that day, and only a bookable one", () => {
  const bookable = ["2026-11-05", "2026-11-10", "2026-11-12"];
  assert.equal(quickSession("tue", bookable, (d) => d === "2026-11-10"), "2026-11-10");
  assert.equal(quickSession("thu", bookable, (d) => d === "2026-11-10"), "2026-11-05");
  assert.equal(quickSession("tue", ["2026-11-05"], () => false), null);
});

test("the route books, then hands a Tuesday straight to Stripe", () => {
  const route = read("src/app/api/quick/route.ts");
  assert.match(route, /fromThisSite/);
  assert.match(route, /checkRateLimit\(/);
  assert.match(route, /verifyTurnstile\(/);
  // A name mismatch is refused before anything is written.
  assert.ok(route.indexOf("findMySignup(") < route.indexOf("saveSignupWithResult("));
  assert.match(route, /saveSignupWithResult\(/);
  assert.match(route, /isTuesdayFree\(/);
  assert.match(route, /getOrCreateSessionFee\(/);
  assert.match(route, /checkoutUrlFor\(/);
});

test("the page has two fields and no others", () => {
  const page = read("src/app/quick/page.tsx");
  const inputs = [...page.matchAll(/<input[^>]*name="(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(inputs, ["day", "name", "wechat"]);
  assert.match(page, /<QuickBotCheck/);
  assert.doesNotMatch(page, /导师团/, "the site does not say mentors are free");
});

test("the admin pay-links page offers the quick forms too", () => {
  const page = read("src/app/admin/paylinks/page.tsx");
  assert.match(page, /\/quick\?d=tue/);
  assert.match(page, /\/quick\?d=thu/);
  assert.match(page, /\/join#join-form/);
});
