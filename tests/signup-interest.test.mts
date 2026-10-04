import assert from "node:assert/strict";
import { test } from "node:test";

import { INTERESTS, parseInterest } from "../src/lib/signup-interest.ts";
import { copy } from "../src/lib/content.ts";

test("only the three listed answers are accepted", () => {
  for (const value of INTERESTS) assert.equal(parseInterest(value), value);
  for (const value of ["", "Tuesday", " class", "paid", null, undefined, 1, ["none"]]) {
    assert.equal(parseInterest(value), null, String(value));
  }
});

test("★ the buttons on the confirmation send exactly these values, in both languages", () => {
  // A relabelled button whose value drifted from the whitelist would save
  // nothing while telling the person "noted".
  for (const lang of ["zh", "en"] as const) {
    assert.deepEqual(
      copy[lang].signup.interestOptions.map((option) => option.value),
      [...INTERESTS],
      lang,
    );
  }
});

test("★ the class is called paid wherever it is offered, but no price is ever named", () => {
  // Decided 2026-10-05 (reversing 10-04): saying "paid" up front filters out
  // people who only want free, and keeps the later message consistent with
  // what they signed up to hear about. The price is not set, so no figure.
  for (const lang of ["zh", "en"] as const) {
    const s = copy[lang].signup;
    const classOption = s.interestOptions.find((option) => option.value === "class")!.label;
    for (const text of [classOption, s.interestThanksClass, s.hook]) {
      assert.match(text, /收费|paid/i, `${lang}: "${text}" offers the class without saying it is paid`);
      assert.doesNotMatch(text, /\$|¥|\d/, `${lang}: "${text}" names a price`);
    }
  }
});
