/**
 * Tests for the invariants /support depends on.
 *
 * Run with `pnpm test`. Node's built-in test runner and type stripping are
 * used deliberately: this repo has no ORM, no migration step and no test
 * framework, and these checks do not justify being the thing that introduces
 * one.
 *
 * What is worth testing here is not arithmetic — there is none left since the
 * public ledger was dropped — but the promises the copy makes: no name carries
 * an amount, no string names a fixed price, and the only way to give actually
 * resolves.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTRIBUTORS, SUPPORT_URL } from "../src/lib/support.ts";
import { copy } from "../src/lib/content.ts";

test("the contributor list carries no amounts", () => {
  // The opt-in list says who showed up for this, never how much anyone paid.
  // A field creeping in here is what would turn it into a donor ranking.
  for (const person of CONTRIBUTORS) {
    assert.deepEqual(Object.keys(person).sort(), ["kinds", "name", "slug"].filter((key) => key in person).sort());
  }
});

test("every contribution kind has a label in both languages", () => {
  // A kind with no label renders blank, which reads as "contributed nothing".
  const kinds = new Set(CONTRIBUTORS.flatMap((person) => person.kinds));
  kinds.add("money");
  kinds.add("demo");
  kinds.add("brought");
  kinds.add("helped");

  for (const lang of ["zh", "en"] as const) {
    for (const kind of kinds) {
      assert.ok(copy[lang].support.thanksKinds[kind], `${lang} is missing a label for "${kind}"`);
    }
  }
});

test("the published copy never hard-codes a single venue price", () => {
  // The venue charge moves — minimum spend at one place, a room fee at the
  // next. Copy that names an exact figure starts lying the first week it
  // changes, and nobody edits eight strings across two languages to keep up.
  // The ledger carries the real per-session number; the copy gives a range.
  // A range is the point, so ranges are removed before the check — what must
  // not survive is a lone figure, which is what reads as "the price".
  const RANGE = /(?:A?\$|AUD\s?)?\d{2,}\s*[–—-]\s*(?:A?\$|AUD\s?)?\d{2,}/g;
  const LONE_PRICE = /(?:A?\$|AUD\s?)\d{2,}|\d{2,}\s*块/;

  for (const lang of ["zh", "en"] as const) {
    const support = JSON.stringify(copy[lang].support).replace(RANGE, "«range»");

    assert.ok(
      !LONE_PRICE.test(support),
      `${lang} /support copy hard-codes a price: ${support.match(LONE_PRICE)?.[0]}`,
    );
  }
});

test("every availability slot the form offers is one the API accepts", () => {
  // The route whitelists these values; an option whose value is not on that
  // list is silently dropped and the person is counted as having answered
  // nothing, which is invisible in the admin tally.
  const ACCEPTED = new Set(["weekday_evening", "weekend_day", "weekend_evening"]);

  for (const lang of ["zh", "en"] as const) {
    for (const option of copy[lang].signup.fields.availabilityOptions) {
      assert.ok(ACCEPTED.has(option.value), `${lang}: unknown slot "${option.value}"`);
    }
  }
});

test("the support link is an absolute https Ko-fi URL", () => {
  // This is the only way to give on the whole site, and it is a hand-typed
  // constant. A typo here renders a button that looks fine and goes nowhere,
  // which nothing else would catch.
  const url = new URL(SUPPORT_URL);

  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "ko-fi.com");
  assert.notEqual(url.pathname, "/");
});
