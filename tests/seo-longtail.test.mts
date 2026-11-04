/**
 * The long-tail phrase on the home page and in the site's description
 * (2026-11-02): "悉尼最火的华人 AI 线下聚会" — what people type, what an AI
 * assistant can quote, and the meetup's slogan (the organiser's call: a
 * slogan, not a measured claim). "Every week since August" is a fact.
 *
 * And Build Tuesday in the words of the model it follows (2026-11-02): focused
 * work at your own pace in the morning, the 导师团 alongside as guides rather
 * than lecturers, a hands-on workshop in the afternoon.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";

const root = path.resolve(import.meta.dirname, "..");

test("★ the home title, description and hero carry the long-tail phrase", () => {
  for (const text of [copy.zh.meta.title, copy.zh.meta.description, copy.zh.hero.subtitle]) {
    assert.match(text, /悉尼最火的华人 AI 线下聚会/, text);
  }
  assert.match(copy.en.meta.description, /Chinese-speaking/);
});

// Spec change 2026-11-02 (organiser): the slogan uses "最火" on purpose.
test("the slogan and the weekly fact are both there", () => {
  assert.match(copy.zh.meta.description, /悉尼最火的华人 AI 线下聚会/);
  assert.match(copy.zh.meta.description, /一场没停过/);
});

test("the layout's fallback title and description stay in step with the home page", () => {
  const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.ok(layout.includes(copy.zh.meta.title), "layout title");
  assert.ok(layout.includes(copy.zh.meta.description), "layout description");
});

// Spec change 2026-11-04: the afternoon workshop is gone and the day ends at 12:30.
// Spec change 2026-11-05: Tuesday online / 4-week membership — watch James
// build, 10:30–12:00, for members and mentors, no ticket price.
test("★ Build Tuesday reads like its model: online, watch James build, members and mentors", () => {
  const tuesday = JSON.stringify(copy.zh.tuesday);
  assert.match(tuesday, /线上/);
  assert.match(tuesday, /看 James/);
  assert.match(tuesday, /导师团/);
  assert.doesNotMatch(tuesday, /workshop/);
  assert.match(tuesday, /10:30–12:00/);
  assert.doesNotMatch(tuesday, /30 澳元/);
});
