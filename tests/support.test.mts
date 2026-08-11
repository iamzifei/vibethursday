/**
 * Tests for the /support ledger arithmetic.
 *
 * Run with `pnpm test`. Node's built-in test runner and type stripping are
 * used deliberately: this repo has no ORM, no migration step and no test
 * framework, and a running balance over a handful of rows does not justify
 * being the thing that introduces one.
 *
 * The money here is real and the page publishes it, so the cases that matter
 * are the ones where a wrong number would be believed: cent rounding, a
 * shortfall, and the order rows come back in.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONTRIBUTORS,
  formatAud,
  ledgerBalance,
  ledgerRows,
  LEDGER,
  SUPPORT_URL,
  type LedgerEntry,
} from "../src/lib/support.ts";
import { copy } from "../src/lib/content.ts";

const entry = (date: string, received: number, spent: number, contributors = 0): LedgerEntry => ({
  date,
  received,
  spent,
  contributors,
});

test("formatAud drops the decimals on whole dollars", () => {
  assert.equal(formatAud(11_800), "$118");
  assert.equal(formatAud(0), "$0");
});

test("formatAud keeps two decimals on part-dollar amounts", () => {
  assert.equal(formatAud(12_350), "$123.50");
  // A single trailing cent must not render as "$123.5".
  assert.equal(formatAud(12_305), "$123.05");
});

test("formatAud groups thousands", () => {
  assert.equal(formatAud(610_000), "$6,100");
});

test("formatAud keeps the sign outside the dollar mark", () => {
  // A shortfall reads as "-$56", never "$-56".
  assert.equal(formatAud(-5_600), "-$56");
  assert.equal(formatAud(-12_350), "-$123.50");
});

test("ledgerRows carries the balance forward across sessions", () => {
  const rows = ledgerRows([
    entry("2026-08-13", 18_000, 11_800, 9),
    entry("2026-08-20", 22_000, 11_800, 11),
  ]);

  // Newest first, because the page answers "where does it stand now".
  assert.deepEqual(
    rows.map((row) => row.date),
    ["2026-08-20", "2026-08-13"],
  );

  // 180 - 118 = 62, then + 220 - 118 = 164.
  assert.equal(rows[1].balance, 6_200);
  assert.equal(rows[0].balance, 16_400);
});

test("ledgerRows reports a shortfall as a negative balance", () => {
  const rows = ledgerRows([entry("2026-08-13", 6_000, 11_800, 3)]);

  assert.equal(rows[0].balance, -5_800);
  assert.equal(formatAud(rows[0].balance), "-$58");
});

test("ledgerRows does not mutate the entries it is given", () => {
  const entries = [entry("2026-08-13", 18_000, 11_800, 9), entry("2026-08-20", 0, 11_800, 0)];
  const before = JSON.parse(JSON.stringify(entries));

  ledgerRows(entries);

  // `.reverse()` is in-place on the mapped copy, never on the caller's array.
  assert.deepEqual(entries, before);
});

test("ledgerRows and ledgerBalance agree on the total", () => {
  const entries = [
    entry("2026-08-13", 18_000, 11_800, 9),
    entry("2026-08-20", 5_000, 11_800, 3),
    entry("2026-08-27", 30_000, 31_800, 15),
  ];

  assert.equal(ledgerRows(entries)[0].balance, ledgerBalance(entries));
});

test("an empty ledger balances to zero", () => {
  assert.deepEqual(ledgerRows([]), []);
  assert.equal(ledgerBalance([]), 0);
});

test("the shipped ledger starts empty", () => {
  // 2026-08-06 had a donated venue, so there is no first row to carry.
  assert.deepEqual(LEDGER, []);
});

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
