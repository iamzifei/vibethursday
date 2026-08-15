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
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { copy, getCopy, LANGS, LANG_LABEL, LANG_NAME } from "../src/lib/content.ts";
import { formatSession } from "../src/lib/sessions.ts";
import { langHref, NAV_CTA, NAV_LINKS } from "../src/lib/nav.ts";
import { siteUrl, FALLBACK_SITE_URL } from "../src/lib/site.ts";

const homePage = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");

/** Every `page.tsx` under src/app, however deeply nested. */
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

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

test("every page with the nav has the skip link's target", () => {
  // The bar puts six controls in front of the content, so the skip link is the
  // only short way past them. It points at #main, and a page that carries the
  // header but not the id sends the reader nowhere — silently, and only for
  // the people who most need it to work.
  const pages = pageFiles(path.join(process.cwd(), "src/app"));
  const missing: string[] = [];

  for (const file of pages) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("SiteHeader")) continue;
    if (!source.includes('<main id="main">')) missing.push(file);
  }

  assert.deepEqual(missing, [], `these pages render the nav but have no #main:\n${missing.join("\n")}`);
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

test("Traditional is the Simplified copy, converted, and nothing else", () => {
  const zh = getCopy("zh");
  const hant = getCopy("zh-Hant");

  // Read out into plain strings before asserting. `node:assert/strict`'s
  // `equal` is declared as an assertion function, so asserting straight on
  // `hant.nav.members` narrows the whole union to the literal it was compared
  // against — and every later property read on `hant` is then `never`.
  const actual = {
    members: hant.nav.members as string,
    support: hant.nav.support as string,
    subtitle: hant.hero.subtitle as string,
    brand: hant.nav.brand as string,
    photoSrc: hant.gallery.sessions[0].photos[0].src as string,
    htmlLang: hant.htmlLang as string,
    photoCount: hant.gallery.photoCount(4) as string,
    note: hant.who.note as string,
  };

  // Same shape — it is the same object walked, so a key that exists in one has
  // to exist in the other. This is what makes the third language free.
  assert.deepEqual(Object.keys(hant).sort(), Object.keys(zh).sort());

  // Converted where it is prose.
  assert.equal(actual.members, "成員");
  assert.equal(actual.support, "開銷");
  assert.equal(actual.subtitle, "悉尼 · 每週四上午的 AI 局");

  // Not converted where it is not prose: the brand, paths, and the language
  // tag a screen reader reads the page with.
  assert.equal(actual.brand, "Vibe Thursday");
  assert.equal(actual.photoSrc, zh.gallery.sessions[0].photos[0].src as string);
  assert.equal(actual.htmlLang, "zh-Hant");
  assert.equal(zh.htmlLang as string, "zh-CN");

  // Functions are wrapped, not dropped: this one builds a string at call time
  // and would otherwise be the one place Simplified leaked through.
  assert.equal(actual.photoCount, "4 張");

  // Characters only. `twp` would also swap vocabulary — 软件 → 軟體 — which is
  // a dictionary rewriting copy that was written a word at a time.
  assert.ok(actual.note.includes("軟件"), "vocabulary must not be substituted");
});

test("each written language keeps its own copy; only Traditional is derived", () => {
  // English must never be routed through the converter.
  assert.equal(getCopy("en").nav.members as string, "Members");
  assert.equal(getCopy("zh").nav.members as string, "成员");
});

test("a session date is converted too", () => {
  // Built at runtime rather than read from the copy bundle, so it misses the
  // conversion the bundle gets unless it asks for it: 周 → 週.
  assert.ok(formatSession("2026-08-20", "zh").includes("周四"));
  assert.ok(formatSession("2026-08-20", "zh-Hant").includes("週四"));
  assert.ok(!formatSession("2026-08-20", "zh-Hant").includes("周四"));
});

test("every language has a label and a name for the switch", () => {
  for (const lang of LANGS) {
    assert.ok(LANG_LABEL[lang]?.length, `${lang} has no short label`);
    assert.ok(LANG_NAME[lang]?.length, `${lang} has no full name`);
    // The visible label is one or two characters; anything longer stops being
    // a segment and starts being a word.
    assert.ok(LANG_LABEL[lang].length <= 2, `${lang}'s label is too long for a segment`);
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
