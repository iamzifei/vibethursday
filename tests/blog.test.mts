/**
 * The blog (2026-11-02): articles written from the public Thursday sessions
 * and the questions people bring, for search and AI answers. Parsed from
 * markdown with frontmatter (`blog.ts`), rendered by /blog and /blog/[slug].
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseInline, parseMiniMarkdown } from "../src/lib/mini-markdown.ts";
import { BLOG_AUTHOR, blogPosts, parsePost, splitFaq } from "../src/lib/blog.ts";
import { NAV_LINKS } from "../src/lib/nav.ts";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

test("inline links: only site paths and https, never javascript:", () => {
  assert.deepEqual(parseInline("看 [往期](/sessions) 吧"), [{ text: "看 " }, { text: "往期", href: "/sessions" }, { text: " 吧" }]);
  assert.deepEqual(parseInline("[x](https://x.com/JamesAI)"), [{ text: "x", href: "https://x.com/JamesAI" }]);
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ text: "[x](javascript:alert(1))" }]);
  // "/\\host" is read by browsers as "//host": refused.
  assert.equal(parseInline("[x](/\\evil.com)")[0].href, undefined);
  assert.deepEqual(parseInline("**粗** 和 [链](/a)"), [{ text: "粗", bold: true }, { text: " 和 " }, { text: "链", href: "/a" }]);
});

test("### is a third-level heading", () => {
  assert.deepEqual(parseMiniMarkdown("### 问题？\n回答。"), [
    { type: "h3", text: "问题？" },
    { type: "p", parts: [{ text: "回答。" }] },
  ]);
});

test("a post: frontmatter fields, body, and the FAQ split off the end", () => {
  const post = parsePost(`---
slug: a-b
title: 标题
description: 摘要
date: 2026-11-02
tags: 甲,乙
cover_prompt: x
cover_alt: 图
---

开头。

## 一节
内容。

## 常见问题
### 问一？
答一。
### 问二？
答二。
`);
  assert.equal(post.slug, "a-b");
  assert.deepEqual(post.tags, ["甲", "乙"]);
  assert.equal(post.coverAlt, "图");
  const { body, faq } = splitFaq(post.body);
  assert.match(body, /## 一节/);
  assert.doesNotMatch(body, /常见问题/);
  assert.deepEqual(faq, [{ q: "问一？", a: "答一。" }, { q: "问二？", a: "答二。" }]);
});

test("every published post is complete, has its cover, and keeps the public-repo rules", () => {
  const posts = blogPosts();
  assert.ok(posts.length >= 6, `expected the first six posts, found ${posts.length}`);
  const slugs = new Set<string>();
  for (const post of posts) {
    assert.match(post.slug, /^[a-z0-9]+(-[a-z0-9]+)+$/, post.slug);
    assert.ok(!slugs.has(post.slug), `duplicate slug ${post.slug}`);
    slugs.add(post.slug);
    assert.ok(post.title.length >= 10 && post.title.length <= 40, `${post.slug} title length ${post.title.length}`);
    assert.ok(post.description.length >= 50 && post.description.length <= 140, `${post.slug} description length ${post.description.length}`);
    assert.match(post.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(existsSync(path.join(process.cwd(), "public/blog", `${post.slug}.webp`)), `${post.slug} has no cover image`);
    assert.ok(existsSync(path.join(process.cwd(), "public/blog", `${post.slug}-og.jpg`)), `${post.slug} has no share image`);
    assert.ok(splitFaq(post.body).faq.length >= 3, `${post.slug} needs at least three FAQ entries`);
    // The bio rules and the public-repo rules (global CLAUDE.md, AGENTS.md).
    for (const banned of [/博士/, /Orris/i, /澳元/, /\$\d/, /月入|年入|营收/]) {
      assert.doesNotMatch(post.body + post.title + post.description, banned, `${post.slug} contains ${banned}`);
    }
  }
});

test("the author is 澳洲AI教父, linked to X", () => {
  assert.deepEqual(BLOG_AUTHOR, { name: "澳洲AI教父", url: "https://x.com/JamesAI" });
  const page = read("src/app/blog/[slug]/page.tsx");
  assert.match(page, /BlogPosting/);
  assert.match(page, /FAQPage/);
  assert.match(page, /BLOG_AUTHOR/);
});

test("the blog is reachable: nav, sitemap, llms.txt", () => {
  assert.ok(NAV_LINKS.some((link) => link.href === "/blog"));
  assert.match(read("src/app/sitemap.ts"), /\/blog/);
  assert.match(read("src/app/llms.txt/route.ts"), /\/blog/);
});

test("only the blog's images are cached for a month, never its pages", () => {
  const config = read("next.config.ts");
  assert.doesNotMatch(config, /cards\|blog\)\/:path\*/);
  assert.match(config, /source: "\/blog\/:file\(/);
});
