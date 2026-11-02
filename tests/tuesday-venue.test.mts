/**
 * Build Tuesday's address is for the people who have paid (2026-11-02).
 *
 * The session costs money, so where it happens is part of what you get for
 * paying: the public pages say "Chatswood" and that the address shows after
 * payment. It appears on the payment page once paid (or waived), on the
 * signup confirmation and on /my for members and for anyone paid or waived.
 * It is defined once, in `tuesday-venue.ts`, so it cannot leak back into the
 * public copy by being typed there again.
 *
 * The session also runs as three parts from 10:30 to 15:30 now: projects and
 * tech in the morning, business owners' needs over lunch, a workshop after.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";
import { TUESDAY_VENUE } from "../src/lib/tuesday-venue.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

// Words that only the address contains; "Chatswood" alone is public.
// (Not "Victoria Ave": the Thursday venue is on Victoria Avenue too.)
const ADDRESS_WORDS = ["Lemon Grove", "427–441", "56 号铺", "Shop 56"];

test("the address lives in tuesday-venue.ts", () => {
  for (const lang of ["zh", "en"] as const) {
    assert.ok(TUESDAY_VENUE[lang].address.includes("Lemon Grove"), `${lang} address`);
  }
  assert.match(TUESDAY_VENUE.mapsUrl, /^https:\/\/maps\.google\.com\//);
});

test("★ no public copy names the Tuesday address, in either language", () => {
  const text = JSON.stringify(copy);
  for (const word of ADDRESS_WORDS) {
    assert.ok(!text.includes(word), `public copy still contains "${word}"`);
  }
});

test("★ the /tuesday page shows no map link or directions image", () => {
  const page = read("src/app/tuesday/page.tsx");
  assert.ok(!page.includes("directions.webp"), "directions image on the public page");
  assert.ok(!page.includes("mapsUrl"), "map link on the public page");
});

test("the payment page shows the address only once paid or waived", () => {
  const page = read("src/app/tuesday/pay/page.tsx");
  for (const word of ADDRESS_WORDS) assert.ok(!page.includes(word), `pay page hard-codes "${word}"`);
  assert.match(page, /TuesdayVenue/);
  // The venue block sits behind the paid-or-waived check.
  assert.match(page, /\(fee\.status === "paid" \|\| fee\.status === "waived"\) && <TuesdayVenue/);
});

test("members and paid people see it on the confirmation and on /my", () => {
  assert.match(read("src/components/SignupForm.tsx"), /TuesdayVenue/);
  assert.match(read("src/app/my/page.tsx"), /TuesdayVenue/);
});

test("Tuesday runs 10:30–15:30 in three parts", () => {
  assert.equal(TUESDAY_VENUE.start, "10:30");
  assert.equal(TUESDAY_VENUE.end, "15:30");
  for (const lang of ["zh", "en"] as const) {
    const t = copy[lang].tuesday;
    assert.equal(t.format.length >= 3, true);
    const time = t.facts.find((fact) => fact.label === (lang === "zh" ? "时间" : "Time"));
    assert.ok(time && time.value.includes("15:30"), `${lang} time fact`);
  }
});
