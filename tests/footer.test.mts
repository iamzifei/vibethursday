/**
 * Guards on the footer's slogan and source link.
 *
 * The slogan is the one string on the site that is not plain prose: it carries
 * a `{heart}` placeholder that `SiteFooter` swaps for an icon. A placeholder
 * that goes missing does not throw and does not look broken — the sentence
 * just quietly loses its heart in one language. These tests pin the parts that
 * can drift without anyone noticing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { copy, getCopy } from "../src/lib/content.ts";
import { SOURCE_URL } from "../src/lib/site.ts";

const WRITTEN_LANGS = ["zh", "en"] as const;

test("both written languages place the heart exactly once", () => {
  for (const lang of WRITTEN_LANGS) {
    const slogan = copy[lang].footer.slogan;

    assert.equal(
      slogan.split("{heart}").length - 1,
      1,
      `${lang} slogan should contain exactly one {heart}: ${slogan}`,
    );
  }
});

test("the heart keeps a space on each side", () => {
  // The gap is written into the copy rather than added as a margin on the
  // icon, which means it is a translator's to lose. Without it the heart butts
  // straight against a word and reads as punctuation.
  for (const lang of WRITTEN_LANGS) {
    const [before, after] = copy[lang].footer.slogan.split("{heart}");

    assert.ok(before.endsWith(" "), `${lang} slogan is missing the space before the heart`);
    assert.ok(after.startsWith(" "), `${lang} slogan is missing the space after the heart`);
  }
});

test("the placeholder survives the Traditional conversion", () => {
  // `deepTranslate` walks every string in the copy bundle. It converts Chinese
  // characters and leaves ASCII alone, so the placeholder should come through
  // untouched — but that is a property of the converter, not a promise it made
  // to us, and the Traditional reader is the one who would never report it.
  assert.match(getCopy("zh-Hant").footer.slogan, /\{heart\}/);
});

test("every language names the source link", () => {
  for (const lang of ["zh", "zh-Hant", "en"] as const) {
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
