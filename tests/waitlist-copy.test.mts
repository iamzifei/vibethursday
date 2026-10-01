/**
 * The waitlist is a waitlist again (James 2026-10-01).
 *
 * From 4.5 the copy said waitlisted people "can still come", which made the
 * 40-seat cap mean nothing: the room filled far past what it could hold.
 * The rule now: not booked means move to the next Thursday,
 * and only someone James contacts comes off the waitlist. These tests stop the
 * old promise creeping back into any page.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { copy } from "../src/lib/content.ts";

/** Every string in a copy bundle, with its dotted path. */
function strings(value: unknown, at = ""): Array<[string, string]> {
  if (typeof value === "string") return [[at, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${at}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => strings(item, at ? `${at}.${key}` : key));
  }
  return [];
}

const OLD_PROMISE = [/候补(也|照样)(能|可以)来/, /照样(能|可以)来/, /can still come/i];

test("★ no page tells a waitlisted person they can come anyway", () => {
  for (const lang of ["zh", "en"] as const) {
    for (const [at, text] of strings(copy[lang])) {
      for (const pattern of OLD_PROMISE) {
        assert.ok(!pattern.test(text), `${lang}.${at} still says it: ${text}`);
      }
    }
  }
});

test("the waitlist copy points at the next Thursday", () => {
  assert.match(copy.zh.signup.waitlistBody, /下一/);
  assert.match(copy.en.signup.waitlistBody, /next/i);
});
