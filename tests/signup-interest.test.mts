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

test("the confirmation never talks money", () => {
  // This is the free meetup's own page; the question only asks what people
  // would come to.
  for (const lang of ["zh", "en"] as const) {
    const text = JSON.stringify(copy[lang].signup.interestOptions) + copy[lang].signup.interestTitle;
    assert.doesNotMatch(text, /\$|收费|付费|价|paid|price|fee/i, lang);
  }
});
