/**
 * robots.txt must not block any public page.
 *
 * ⚠️ This exists because it shipped. `Disallow: /me` was meant for the one
 * signed-in page at `/me`, but robots.txt rules are prefixes: it also blocked
 * `/members` and every member's own page under it. Search Console's live test
 * reported `/members` as "Blocked by robots.txt" on 2026-09-26, six weeks
 * after the rule went in. Nothing else would have noticed — the page worked
 * for every person who opened it.
 *
 * Checked on the source, with the matching rules Google documents: a rule is a
 * prefix of the path plus query, `*` matches anything, and a trailing `$`
 * anchors the end.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const APP = path.join(import.meta.dirname, "..", "src", "app");

/** Google's robots.txt path matching, reduced to what this site uses. */
function blocks(rule: string, url: string): boolean {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(url);
}

test("no disallow rule catches a public page", () => {
  const robots = readFileSync(path.join(APP, "robots.ts"), "utf8");
  const disallow = robots.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const rules = [...disallow.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(rules.length > 0, "disallow rules could not be read");

  const sitemap = readFileSync(path.join(APP, "sitemap.ts"), "utf8");
  const pages = [...sitemap.matchAll(/everyLanguage\("(\/[^"]*)"/g)].map((m) => m[1]);
  assert.ok(pages.includes("/members"), "sitemap paths could not be read");

  // Member pages are public and linked from the wall, though not listed.
  const publicUrls = pages.flatMap((p) => [p, `${p}?lang=en`]).concat("/members/someone");

  const blocked = publicUrls.flatMap((url) =>
    rules.filter((rule) => blocks(rule, url)).map((rule) => `${rule} blocks ${url}`),
  );
  assert.deepEqual(blocked, []);
});

test("the private pages are still blocked, in every language", () => {
  const robots = readFileSync(path.join(APP, "robots.ts"), "utf8");
  const disallow = robots.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const rules = [...disallow.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  for (const page of ["/admin", "/me", "/badge", "/checkin", "/feedback"]) {
    for (const url of [page, `${page}?lang=en`, `${page}/`]) {
      assert.ok(rules.some((rule) => blocks(rule, url)), `${url} is not blocked`);
    }
  }
  assert.ok(rules.some((rule) => blocks(rule, "/api/signup")), "/api/ is not blocked");
});
