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

// ── 2026-11-03: illustrations, table of contents, related posts ──────────────

test("an image line is an illustration, but only from /blog/ and never an outside URL", async () => {
  const { parseMiniMarkdown } = await import("../src/lib/mini-markdown.ts");
  assert.deepEqual(parseMiniMarkdown("![桌上的笔记本](/blog/x-1.webp)"), [{ type: "img", src: "/blog/x-1.webp", alt: "桌上的笔记本" }]);
  // Anything else stays text: no remote images, no other folders.
  for (const line of ["![a](https://evil.example/x.png)", "![a](/scenes/x.webp)", "![a](/blog/../x.webp)"]) {
    assert.equal(parseMiniMarkdown(line)[0].type, "p", line);
  }
});

test("second-level headings get stable, unique ids for the table of contents", async () => {
  const { headingId, tableOfContents } = await import("../src/lib/mini-markdown.ts");
  assert.equal(headingId("普通人怎么开始用 AI？"), "普通人怎么开始用-ai");
  const toc = tableOfContents("## 第一步\n段落\n## 第一步\n### 小节\n## Why AI?");
  assert.deepEqual(toc.map((item) => item.id), ["第一步", "第一步-2", "why-ai"]);
});

test("related posts share tags first, never include the post itself", async () => {
  const { relatedPosts, blogPosts } = await import("../src/lib/blog.ts");
  const posts = blogPosts();
  const post = posts[0];
  const related = relatedPosts(post.slug, 3);
  assert.equal(related.length, Math.min(3, posts.length - 1));
  assert.ok(!related.some((other) => other.slug === post.slug));
  const shared = (slug: string) => posts.find((p) => p.slug === slug)!.tags.filter((tag) => post.tags.includes(tag)).length;
  for (let i = 1; i < related.length; i++) assert.ok(shared(related[i - 1].slug) >= shared(related[i].slug), "ordered by shared tags");
});

test("the post page carries a table of contents and related posts without client script", () => {
  const page = readFileSync(path.join(process.cwd(), "src/app/blog/[slug]/page.tsx"), "utf8");
  assert.match(page, /tableOfContents\(/);
  assert.match(page, /relatedPosts\(/);
  assert.doesNotMatch(page, /"use client"/);
});

test("an edited post can say when: updated becomes dateModified", async () => {
  const { parsePost } = await import("../src/lib/blog.ts");
  const post = parsePost("---\nslug: a\ntitle: t\ndescription: d\ndate: 2026-11-02\nupdated: 2026-11-03\ntags: x\ncover_alt: c\n---\nbody");
  assert.equal(post.updated, "2026-11-03");
  assert.equal(parsePost("---\nslug: a\ntitle: t\ndescription: d\ndate: 2026-11-02\ntags: x\ncover_alt: c\n---\nbody").updated, "2026-11-02");
});

test("every illustration a post uses exists, at the size the page declares", async () => {
  const { blogPosts } = await import("../src/lib/blog.ts");
  const { parseMiniMarkdown } = await import("../src/lib/mini-markdown.ts");
  const { existsSync } = await import("node:fs");
  for (const post of blogPosts()) {
    for (const block of parseMiniMarkdown(post.body)) {
      if (block.type === "img") assert.ok(existsSync(path.join(process.cwd(), "public", block.src)), `${post.slug}: missing ${block.src}`);
    }
  }
});

test("★ every site link in every post goes to a page that exists (2026-11-03)", async () => {
  // A link to /sessions/2026-10-29 went into three drafts while that page was
  // a 404 (no write-up, no check-ins). Links are checked here, not trusted.
  // Since 2026-11-04 a past Thursday with bookings has a page too (see
  // `buildArchive`'s `today`), so the three links point at it again.
  const { blogPosts } = await import("../src/lib/blog.ts");
  const { parseMiniMarkdown } = await import("../src/lib/mini-markdown.ts");
  const { copy } = await import("../src/lib/content.ts");
  const slugs = new Set(blogPosts().map((post) => post.slug));
  // Session pages exist for written-up sessions, and for sessions with
  // check-ins (database). The second kind cannot be known here, so those dates
  // are listed once they have been checked live: 2026-10-22 returned 200 on
  // 2026-11-03. 2026-10-29 has bookings but no check-ins, which gives it a
  // page from 2026-11-04 on — re-check it live after that deploy.
  const LIVE_FROM_CHECKINS = ["2026-10-22", "2026-10-29"];
  const sessions = new Set([...copy.zh.gallery.sessions.map((session: { date: string }) => session.date), ...LIVE_FROM_CHECKINS]);
  const home = read("src/app/page.tsx");
  const hrefs = blogPosts().flatMap((post) =>
    parseMiniMarkdown(post.body).flatMap((block) => {
      const runs = block.type === "p" ? [block.parts] : block.type === "ul" || block.type === "ol" ? block.items : [];
      return runs.flat().filter((part) => part.href?.startsWith("/")).map((part) => ({ post: post.slug, href: part.href! }));
    }),
  );
  assert.ok(hrefs.length > 20, "expected internal links across the posts");
  for (const { post, href } of hrefs) {
    const [route, hash] = href.split("#");
    if (route.startsWith("/blog/")) assert.ok(slugs.has(route.slice(6)), `${post}: ${href} is not a post`);
    else if (route.startsWith("/sessions/")) assert.ok(sessions.has(route.slice(10)), `${post}: ${href} has no session page`);
    else if (route === "/" || route === "") assert.ok(!hash || home.includes(`id="${hash}"`), `${post}: ${href}`);
    else assert.ok(existsSync(path.join(process.cwd(), "src/app", route, "page.tsx")), `${post}: ${href} has no page`);
  }
});

test("every post receives links from at least two other posts", async () => {
  const { blogPosts } = await import("../src/lib/blog.ts");
  const posts = blogPosts();
  for (const post of posts) {
    const inbound = posts.filter((other) => other.slug !== post.slug && other.body.includes(`(/blog/${post.slug})`)).length;
    assert.ok(inbound >= 2, `${post.slug} has ${inbound} inbound links`);
  }
});
