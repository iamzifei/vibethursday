/**
 * Guards on /guide's copy.
 *
 * Each principle's id is a public address (`/guide#p3`) that gets pasted into
 * the group chat. Renumbering one silently sends every old link to the wrong
 * line, so the ids are pinned here, and the two written languages must say the
 * same number of things in the same order.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { GUIDE_COPY } from "../src/lib/guide-copy.ts";

const LANGS = ["zh", "en"] as const;

test("principle ids are the stable p1–p8", () => {
  for (const lang of LANGS) {
    assert.deepEqual(
      GUIDE_COPY[lang].principles.map((item) => item.id),
      ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
      `${lang} principle ids changed — links already sent to the group would break`,
    );
  }
});

test("both languages have the same shape", () => {
  const [zh, en] = LANGS.map((lang) => GUIDE_COPY[lang]);
  assert.equal(zh.day.length, en.day.length);
  assert.equal(zh.title.length, en.title.length);
  assert.deepEqual(
    zh.ways.map((way) => way.icon),
    en.ways.map((way) => way.icon),
  );
});

test("no empty strings", () => {
  for (const lang of LANGS) {
    const g = GUIDE_COPY[lang];
    const strings = [
      g.meta.title, g.meta.description, g.eyebrow, g.lede, g.dayTitle, g.waysTitle, g.principlesTitle,
      g.closeTitle, g.closeText, g.cta, g.tuesdayLink, ...g.title,
      ...g.day.flatMap((step) => [step.name, step.text]),
      ...g.ways.flatMap((way) => [way.name, way.text]),
      ...g.principles.flatMap((item) => [item.head, item.text]),
    ];
    for (const value of strings) assert.ok(value.trim().length > 0, `${lang} has an empty string`);
  }
});
