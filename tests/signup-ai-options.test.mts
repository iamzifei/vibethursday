/**
 * Guards on the two optional AI questions on the signup form.
 *
 * The form and the API route each hold their own copy of the allowed values —
 * the route whitelists them so a crafted request cannot put free text into a
 * column that is only ever read back as counts. That means two lists which have
 * to stay identical, in two files, with nothing at runtime that notices when
 * they stop being. Drift here is silent and one-directional: the form keeps
 * offering an option, the route keeps dropping it, and the answer just never
 * appears in the numbers.
 *
 * The route cannot be imported here — it pulls in `next/server` and `@/lib/db`,
 * and the test runner is Node's type stripper with no path aliases — so its
 * whitelists are read out of the source text instead.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { copy } from "../src/lib/content.ts";

const LANGS = ["zh", "en"] as const;

const ROUTE = readFileSync(new URL("../src/app/api/signup/route.ts", import.meta.url), "utf8");

/** Pulls the string literals out of one `const NAME = new Set([...])` in the route. */
function whitelist(name: string): string[] {
  const block = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`).exec(ROUTE);
  assert.ok(block, `the signup route no longer declares a ${name} whitelist`);

  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** Every model value the form offers, in one flat list. */
function modelValues(lang: (typeof LANGS)[number]): string[] {
  return copy[lang].signup.fields.aiModelGroups.flatMap((group) =>
    group.options.map((option) => option.value),
  );
}

test("the model options the form offers are exactly the ones the route accepts", () => {
  const accepted = new Set(whitelist("AI_MODELS"));

  for (const lang of LANGS) {
    const offered = modelValues(lang);

    for (const value of offered) {
      assert.ok(accepted.has(value), `${lang} offers "${value}", which the route drops`);
    }

    assert.equal(
      offered.length,
      accepted.size,
      `${lang} offers ${offered.length} models but the route accepts ${accepted.size}`,
    );
  }
});

test("the spend bands the form offers are exactly the ones the route accepts", () => {
  const accepted = new Set(whitelist("AI_SPEND"));

  for (const lang of LANGS) {
    const offered = copy[lang].signup.fields.aiSpendOptions.map((option) => option.value);

    for (const value of offered) {
      assert.ok(accepted.has(value), `${lang} offers "${value}", which the route drops`);
    }

    assert.equal(
      offered.length,
      accepted.size,
      `${lang} offers ${offered.length} bands but the route accepts ${accepted.size}`,
    );
  }
});

test("both languages offer the same values in the same order", () => {
  // Only the labels are translated. A value that differs per language would
  // split one answer into two rows in every count on /admin, and the split
  // would follow which form someone happened to open.
  assert.deepEqual(modelValues("zh"), modelValues("en"));
  assert.deepEqual(
    copy.zh.signup.fields.aiSpendOptions.map((option) => option.value),
    copy.en.signup.fields.aiSpendOptions.map((option) => option.value),
  );
});

test("every model value says which side of the wall it is on", () => {
  // /admin counts the overseas/China split by prefix rather than from a second
  // "which model is which" table, precisely so there is no second table to fall
  // out of step. A value with neither prefix would be counted on no side at all
  // and would go missing from that number without changing the total.
  for (const value of modelValues("zh")) {
    assert.match(value, /^(intl_|cn_)/, `"${value}" belongs to neither side of the split`);
  }

  for (const prefix of ["intl_", "cn_"]) {
    assert.ok(
      modelValues("zh").some((value) => value.startsWith(prefix)),
      `nothing on the form is a ${prefix} model, so that count can only ever be zero`,
    );
  }
});

test("both questions say out loud that they are optional", () => {
  // Neither helps the person filling the form in — they exist for the
  // organiser. Someone who cannot answer must be able to see that skipping is a
  // real option rather than an unfinished field.
  const optional: Record<(typeof LANGS)[number], RegExp> = {
    zh: /选填/,
    en: /optional/i,
  };

  for (const lang of LANGS) {
    const fields = copy[lang].signup.fields;

    assert.match(fields.aiModelsHint, optional[lang], `${lang} model question reads as required`);
    assert.match(fields.aiSpendHint, optional[lang], `${lang} spend question reads as required`);
  }
});
