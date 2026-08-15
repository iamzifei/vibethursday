/**
 * The nav bar's two silent failure modes.
 *
 * Neither shows up as a type error or a broken build: a link to a section that
 * has been renamed just scrolls nowhere, and a language-switched anchor with
 * the query string in the wrong place loads the page in the wrong language and
 * then ignores the anchor. Both look fine in a screenshot.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";
import { langHref, NAV_CTA, NAV_LINKS } from "../src/lib/nav.ts";
import { siteUrl, FALLBACK_SITE_URL } from "../src/lib/site.ts";

const homePage = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");

test("every anchor in the nav is a section on the home page", () => {
  const anchors = [...NAV_LINKS, NAV_CTA]
    .map((link) => link.href.split("#")[1])
    .filter((hash): hash is string => Boolean(hash));

  for (const hash of anchors) {
    assert.ok(
      homePage.includes(`id="${hash}"`),
      `the nav points at #${hash}, which no section on the home page carries`,
    );
  }
});

test("every nav item has a label in both languages", () => {
  for (const lang of ["zh", "en"] as const) {
    for (const link of [...NAV_LINKS, NAV_CTA]) {
      const label = copy[lang].nav[link.label];
      assert.ok(label && label.trim().length > 0, `${lang} has no nav label for "${link.label}"`);
    }
    // Names the menu button, which is otherwise an unlabelled icon.
    assert.ok(copy[lang].nav.menu, `${lang} has no label for the menu button`);
  }
});

test("the language switch puts its query string ahead of the fragment", () => {
  // "/#signup?lang=en" would send `lang=en` to the browser as part of the
  // fragment: Chinese page, and no scroll to the form either.
  assert.equal(langHref("/#signup", "en"), "/?lang=en#signup");
  assert.equal(langHref("/", "en"), "/?lang=en");
  assert.equal(langHref("/members", "en"), "/members?lang=en");
  assert.equal(langHref("/members?role=builder", "en"), "/members?role=builder&lang=en");
});

test("Chinese hrefs carry no query string at all", () => {
  // Chinese is the default, so `?lang=zh` would only be a second URL for every
  // page — one to get indexed twice and one to get shared.
  for (const link of [...NAV_LINKS, NAV_CTA]) {
    assert.equal(langHref(link.href, "zh"), link.href);
  }
});

test("the site URL never ends in a slash", () => {
  // Everything downstream writes `${siteUrl()}/path`, so a trailing slash here
  // becomes a double slash in sitemap.xml and llms.txt.
  const previous = process.env.NEXT_PUBLIC_SITE_URL;

  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    assert.equal(siteUrl(), "https://example.com");

    delete process.env.NEXT_PUBLIC_SITE_URL;
    assert.equal(siteUrl(), FALLBACK_SITE_URL);
    assert.ok(!FALLBACK_SITE_URL.endsWith("/"));
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
