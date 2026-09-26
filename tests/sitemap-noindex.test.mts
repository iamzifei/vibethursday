/**
 * No page the sitemap lists may tell search engines not to index it.
 *
 * ⚠️ This exists because it shipped. `/claim` set `robots: { index: false }`
 * on purpose, and a week later the sitemap was written with `/claim` in it.
 * The two contradict each other — "please crawl this" and "do not index
 * this" — and Search Console reports every such URL as an error against the
 * sitemap, not as a quiet preference.
 *
 * Checked on the source because both halves are static: the sitemap names its
 * fixed paths in `everyLanguage("/...")` calls, and a page opts out of search
 * with a literal `index: false` in its metadata. When the two meet, one of
 * them is wrong; decide which, and change that one.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const APP = path.join(import.meta.dirname, "..", "src", "app");

test("no sitemap path is marked noindex by its own page", () => {
  const sitemap = readFileSync(path.join(APP, "sitemap.ts"), "utf8");
  const paths = [...sitemap.matchAll(/everyLanguage\("(\/[^"]*)"/g)].map((m) => m[1]);

  // Guards the regex itself: if the sitemap's shape changes and nothing
  // matches, this test would otherwise pass by checking nothing.
  assert.ok(paths.includes("/"), "sitemap paths could not be read");

  const noindexed = paths.filter((p) => {
    const page = path.join(APP, p, "page.tsx");
    return existsSync(page) && /index:\s*false/.test(readFileSync(page, "utf8"));
  });

  assert.deepEqual(noindexed, []);
});
