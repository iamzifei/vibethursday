/**
 * /members as a directory (2026-11-02): pages of 24, the most common tags as
 * filters, a "has works" filter, a one-line summary on every card that has
 * anything to say, and structured data for the list and for each person.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { paginate, topTags } from "../src/lib/directory.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("the most common tags, merged across case, labelled by the most used spelling", () => {
  const top = topTags([{ tags: ["AI Agent", "出海"] }, { tags: ["ai agent"] }, { tags: ["AI Agent"] }], 5);
  assert.deepEqual(top[0], { label: "AI Agent", count: 3 });
  assert.deepEqual(top[1], { label: "出海", count: 1 });
});

test("pages clamp to the range there is", () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual(paginate(items, 1, 24).items.length, 24);
  assert.equal(paginate(items, 3, 24).items.length, 2);
  assert.equal(paginate(items, 99, 24).page, 3);
  assert.equal(paginate(items, -2, 24).page, 1);
  assert.equal(paginate([], 1, 24).pages, 1);
});

test("the wall pages, filters by tag and by having works, and lists its people for machines", () => {
  const page = read("src/app/members/page.tsx");
  assert.match(page, /PAGE_SIZE = 24/);
  assert.match(page, /rel="next"/);
  assert.match(page, /ItemList/);
  assert.match(page, /topTags\(/);
  assert.match(page, /works === "1"|params\.works/);
});

test("every card with a headline or a bio shows one line of it", () => {
  const card = read("src/components/MemberCard.tsx");
  assert.match(card, /member\.headline \?\? member\.bio/);
});

test("a person's page is a ProfilePage with a breadcrumb", () => {
  const page = read("src/app/members/[slug]/page.tsx");
  assert.match(page, /ProfilePage/);
  assert.match(page, /BreadcrumbList/);
});
