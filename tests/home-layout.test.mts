/**
 * The home page, phone first (2026-11-02 refactor): sign-up before the
 * explaining, a picture before the form, a bottom bar to the form from
 * anywhere, nothing on the page that shows an empty room.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getCopy } from "../src/lib/content.ts";
import { NAV_LINKS } from "../src/lib/nav.ts";

const home = readFileSync(path.join(import.meta.dirname, "..", "src/app/page.tsx"), "utf8");
const at = (needle: string) => {
  const i = home.indexOf(needle);
  assert.ok(i >= 0, `missing: ${needle}`);
  return i;
};

// Spec change 2026-11-02 (site simplification, James): "what this is", the
// house rules section, "what has accumulated" and "who it is for" left the home
// page; three ways in come before the form, three steps after it, and the run
// of show and the rules are folded inside the steps.
test("order: picture, three ways in, form, first-time steps, photos", () => {
  const order = ["<SceneImage", 'id="paths"', 'id="signup"', 'id="schedule"', 'id="rules"', "c.gallery.title"].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(at("c.rules.items") > at('id="rules"'));
});

test("Thursday is the default way in, and the only card drawn as the main one", () => {
  for (const lang of ["zh", "en"] as const) {
    const items = getCopy(lang).paths.items;
    assert.equal(items[0].href, "#signup");
    assert.deepEqual(items.map((item) => Boolean(item.tag)), [true, false, false]);
  }
});

test("the copy the new layout reads exists in every language", async () => {
  const { LANGS } = await import("../src/lib/lang.ts");
  for (const lang of LANGS) {
    const c = getCopy(lang);
    for (const text of [c.hero.stickyLabel, c.hero.sceneAlt, c.signup.compareFold, c.signup.rulesNote]) {
      assert.ok(typeof text === "string" && text.length > 0, lang);
    }
  }
});

test("a bar to the form follows the reader down the page", () => {
  assert.match(home, /<StickyCta href="#signup"/);
  // The first screen's own button to the form, which the bar steps aside for.
  assert.match(home, /className="btn btn--primary" href="#signup"/);
});

test("the Thursday/Tuesday table no longer pushes the form down: it is folded", () => {
  assert.ok(at("<details") < at("<SessionCompare"));
  assert.ok(at("<SessionCompare") < at("<SignupForm"));
});

test("no empty-room teasers: the Wharf card and the pixel game card are gone", () => {
  assert.doesNotMatch(home, /c\.wharfTeaser/);
  assert.doesNotMatch(home, /c\.playTeaser/);
});

test("nav: paid things first, no home-page anchor, and an unambiguous CTA", () => {
  const hrefs = NAV_LINKS.map((link) => link.href as string);
  assert.ok(!hrefs.includes("/#what"));
  assert.deepEqual(hrefs.slice(0, 3), ["/tuesday", "/join", "/class"]);
  assert.equal(getCopy("zh").nav.cta, "报名周四");
  assert.equal(getCopy("en").nav.cta, "Join Thursday");
});
