/**
 * The free first chapter of "how Vibe Thursday was run" (2026-11-02), on its
 * own page under /guide, rendered from a small markdown subset.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseMiniMarkdown } from "../src/lib/mini-markdown.ts";
import { PLAYBOOK_CHAPTER_1 } from "../src/lib/playbook.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("the markdown subset: headings, bold labels, lists, code blocks, paragraphs with **bold**", () => {
  const blocks = parseMiniMarkdown("## 第一步\n\n**做了什么**\n\n一段 **重点** 文字。\n\n- 甲\n- 乙\n\n1. 一\n2. 二\n\n```\n原样\n  缩进\n```\n");
  assert.deepEqual(blocks.map((block) => block.type), ["h2", "label", "p", "ul", "ol", "code"]);
  assert.deepEqual(blocks[2], { type: "p", parts: [{ text: "一段 " }, { text: "重点", bold: true }, { text: " 文字。" }] });
  assert.equal((blocks[3] as { items: unknown[] }).items.length, 2);
  assert.deepEqual(blocks[5], { type: "code", text: "原样\n  缩进" });
});

test("★ the chapter is public-safe: no money, no company name, no titles", () => {
  const text = PLAYBOOK_CHAPTER_1.markdown;
  for (const bad of ["$", "Orris", "博士", "澳元", "收费"]) assert.ok(!text.includes(bad), bad);
  assert.equal(parseMiniMarkdown(text).filter((block) => block.type === "h2").length, 6, "six steps");
});

test("it has its own page, linked from /guide, in the sitemap and llms.txt", () => {
  assert.match(read("src/app/guide/how-we-run/page.tsx"), /PLAYBOOK_CHAPTER_1/);
  assert.match(read("src/app/guide/page.tsx"), /\/guide\/how-we-run/);
  assert.match(read("src/app/sitemap.ts"), /\/guide\/how-we-run/);
  assert.match(read("src/app/llms.txt/route.ts"), /\/guide\/how-we-run/);
});
