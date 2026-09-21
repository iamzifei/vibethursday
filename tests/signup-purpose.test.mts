/**
 * Guards on the "what do you want to take away this time" question.
 *
 * It is the one required choice on the form, and it is required on the client
 * only: the route whitelists the value but never rejects a signup for leaving it
 * out, because a page opened before the question existed must still be able to
 * sign someone up. That split is deliberate and easy to "fix" by accident, so
 * both halves are pinned here.
 *
 * The answer is stored per session, keyed by date, because the same person can
 * come for a different reason next week — a single column would let week two
 * silently overwrite week one, the exact failure `questions.ts` warns about.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { copy } from "../src/lib/content.ts";

const LANGS = ["zh", "en"] as const;

const ROUTE = readFileSync(new URL("../src/app/api/signup/route.ts", import.meta.url), "utf8");
const FORM = readFileSync(new URL("../src/components/SignupForm.tsx", import.meta.url), "utf8");
const DB = readFileSync(new URL("../src/lib/db.ts", import.meta.url), "utf8");

function whitelist(name: string): string[] {
  const block = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`).exec(ROUTE);
  assert.ok(block, `the signup route no longer declares a ${name} whitelist`);
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

test("the purposes the form offers are exactly the ones the route accepts", () => {
  const accepted = new Set(whitelist("PURPOSES"));

  for (const lang of LANGS) {
    const offered = copy[lang].signup.fields.purposeOptions.map((option) => option.value);

    for (const value of offered) {
      assert.ok(accepted.has(value), `${lang} offers "${value}", which the route drops`);
    }
    assert.equal(offered.length, accepted.size, `${lang} offers ${offered.length}, route accepts ${accepted.size}`);
  }
});

test("both languages offer the same purpose values in the same order", () => {
  const zh = copy.zh.signup.fields.purposeOptions.map((option) => option.value);
  const en = copy.en.signup.fields.purposeOptions.map((option) => option.value);
  assert.deepEqual(zh, en);
});

test("both languages have a message for a missing purpose", () => {
  for (const lang of LANGS) {
    assert.ok(copy[lang].signup.errorPurpose.trim().length > 0, `${lang} has no errorPurpose`);
  }
});

test("nothing is pre-selected, so a count of answers is a count of real choices", () => {
  // A default would make "learn" (or whichever option got it) the answer of
  // everybody who scrolled past, and the count would measure the default.
  const block = /name="purpose"[\s\S]{0,400}/.exec(FORM);
  assert.ok(block, "the form no longer renders a purpose radio group");
  assert.ok(!/defaultChecked/.test(block[0]), "the purpose radio group pre-selects an option");
});

test("the form refuses to submit without a purpose", () => {
  assert.match(FORM, /data\.get\("purpose"\)/, "the form never reads the purpose");
  assert.match(FORM, /copy\.errorPurpose/, "the form never shows the missing-purpose message");
});

test("the route does not reject a signup that has no purpose", () => {
  // A stale page without the question must still be able to sign someone up.
  assert.ok(!/missing_purpose/.test(ROUTE), "the route rejects signups without a purpose");
});

test("purposes are merged per session, never replaced wholesale", () => {
  assert.match(DB, /ADD COLUMN IF NOT EXISTS purposes jsonb/, "no purposes column");
  assert.match(DB, /purposes\s*=\s*CASE[\s\S]{0,200}purposes \|\| jsonb_build_object/, "update does not merge purposes");
});

test("someone who picks \"mornings do not work\" is not blocked by the purpose question", () => {
  // No session means the answer is never stored (see the db test above), so
  // demanding it would be a hoop with nothing behind it.
  assert.match(
    FORM,
    /data\.get\("firstSession"\)\s*!==\s*"none"\s*&&\s*!data\.get\("purpose"\)/,
    "the purpose check does not exempt the no-session option",
  );
});
