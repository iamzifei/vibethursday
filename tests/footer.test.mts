/**
 * Guards on the footer's slogan and source link.
 *
 * The slogan is the one string on the site that is not plain prose: it carries
 * a `{heart}` placeholder that `SiteFooter` swaps for an icon. A placeholder
 * that goes missing does not throw and does not look broken — the sentence
 * just quietly loses its heart. It is also the one line that is English on
 * every version of the site, which is a decision that only stays made if
 * something says so out loud.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { copy, getCopy, LANGS } from "../src/lib/content.ts";
import { FOOTER_SLOGAN, SOURCE_URL } from "../src/lib/site.ts";

const WRITTEN_LANGS = ["zh", "en"] as const;

test("the slogan places the heart exactly once", () => {
  assert.equal(
    FOOTER_SLOGAN.split("{heart}").length - 1,
    1,
    `the slogan should contain exactly one {heart}: ${FOOTER_SLOGAN}`,
  );
});

test("the heart keeps a space on each side", () => {
  // The gap is written into the string rather than added as a margin on the
  // icon. Without it the heart butts straight against a word and reads as
  // punctuation.
  const [before, after] = FOOTER_SLOGAN.split("{heart}");

  assert.ok(before.endsWith(" "), "the slogan is missing the space before the heart");
  assert.ok(after.startsWith(" "), "the slogan is missing the space after the heart");
});

test("the slogan stays out of the translated copy", () => {
  // It lives in `site.ts` precisely so that it is not sitting in a language
  // block inviting someone to translate the Chinese half of it. If it ever
  // reappears here, the decision has been quietly reversed.
  for (const lang of WRITTEN_LANGS) {
    assert.ok(
      !("slogan" in copy[lang].footer),
      `${lang} has a footer slogan again — it is meant to be English everywhere`,
    );
  }
});

test("every language names the source link for a screen reader", () => {
  // The link is a logo with no visible text, so this label is the only thing
  // announced. An empty one leaves a link that says "link".
  for (const lang of LANGS) {
    assert.ok(
      getCopy(lang).footer.sourceLink.trim().length > 0,
      `${lang} is missing a label for the source link`,
    );
  }
});

test("the source link points at the public repository over https", () => {
  // A footer link is the one place a typo goes unnoticed for weeks: nobody
  // clicks their own footer.
  assert.equal(SOURCE_URL, "https://github.com/iamzifei/vibethursday");
});
