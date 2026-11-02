/**
 * The long-tail phrase on the home page and in the site's description
 * (2026-11-02): "悉尼华人 AI 线下聚会" — what people type, and what an AI
 * assistant can quote. Kept to what the site can back up: weekly, since
 * August 2026; no "最火" or "最大", which nothing on the site could show.
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
    assert.match(text, /悉尼华人 AI 线下聚会/, text);
  }
  assert.match(copy.en.meta.description, /Chinese-speaking/);
});

test("no superlative the site cannot back up", () => {
  for (const text of [copy.zh.meta.title, copy.zh.meta.description, copy.zh.hero.subtitle, copy.en.meta.description]) {
    assert.doesNotMatch(text, /最火|最大|第一|最好|biggest|hottest|largest|#1/i, text);
  }
});

test("the layout's fallback title and description stay in step with the home page", () => {
  const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.ok(layout.includes(copy.zh.meta.title), "layout title");
  assert.ok(layout.includes(copy.zh.meta.description), "layout description");
});

test("★ Build Tuesday reads like its model: own pace in the morning, mentors as guides, workshop after", () => {
  const tuesday = JSON.stringify(copy.zh.tuesday);
  assert.match(tuesday, /按自己的节奏/);
  assert.match(tuesday, /导师团/);
  assert.match(tuesday, /陪跑/);
  assert.match(tuesday, /workshop/);
  // Settled facts unchanged.
  assert.match(tuesday, /10:30–15:30/);
  assert.match(tuesday, /30 澳元 \+ GST/);
});
