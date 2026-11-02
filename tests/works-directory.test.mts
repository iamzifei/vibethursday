/**
 * /works as a directory (2026-11-02): every work has its own address that
 * stays put across card edits, can be searched and filtered, and is described
 * to search engines and AI assistants in structured data, the sitemap and
 * llms.txt.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { findWork, listWorks, topFields, workKey } from "../src/lib/works.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const members = [
  {
    slug: "momo",
    display_name: "Momo",
    tags: ["AI Agent", "效率"],
    assets: [
      { kind: "product", title: "Windsify", tagline: "窗口管理", url: "https://windsify.app", stage: "live", platform: null },
      { kind: "media", title: "我的小红书", tagline: null, url: null, stage: null, platform: "xhs" },
    ],
  },
  {
    slug: "rob",
    display_name: "Rob",
    tags: ["ai agent", "出海"],
    assets: [{ kind: "product", title: "Plugroo", tagline: "AI 助力澳洲 EV 车主找充电桩", url: null, stage: "beta", platform: null }],
  },
];

test("a work's key is its maker plus a short hash of its title: stable, and the same whatever the case or spacing", () => {
  const key = workKey("momo", "Windsify");
  assert.match(key, /^momo-[0-9a-z]{6}$/);
  assert.equal(workKey("momo", "  windsify "), key);
  assert.notEqual(workKey("momo", "Other"), key);
  assert.notEqual(workKey("rob", "Windsify"), key);
});

test("listWorks carries the key, the maker's fields, and searches and filters", () => {
  const all = listWorks(members);
  assert.equal(all.length, 2, "products only");
  assert.equal(all[0].key, workKey("momo", "Windsify"));
  assert.deepEqual(all[0].fields, ["AI Agent", "效率"]);
  assert.equal(listWorks(members, { q: "充电" }).length, 1);
  assert.equal(listWorks(members, { field: "ai agent" }).length, 2, "fields match whatever the case");
  assert.equal(listWorks(members, { stage: "beta" })[0].title, "Plugroo");
  assert.equal(findWork(members, workKey("rob", "Plugroo"))?.title, "Plugroo");
  assert.equal(findWork(members, "rob-zzzzzz"), null);
});

test("the most common fields, merged across case, most common first", () => {
  assert.deepEqual(topFields(members, 5)[0], { label: "AI Agent", count: 2 });
});

test("each work has its own page with structured data and a breadcrumb", () => {
  const file = "src/app/works/[key]/page.tsx";
  assert.ok(existsSync(path.join(root, file)));
  const page = read(file);
  assert.match(page, /SoftwareApplication/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /rel="ugc nofollow noopener/);
});

test("the list page searches, lists its items for machines, and the sitemap and llms.txt name every work", () => {
  const list = read("src/app/works/page.tsx");
  assert.match(list, /name="q"/);
  assert.match(list, /ItemList/);
  assert.match(read("src/app/sitemap.ts"), /\/works\/\$\{/);
  assert.match(read("src/app/llms.txt/route.ts"), /listWorks/);
});

test("one maker listing the same title twice, in any case or spacing, is one work", () => {
  const twice = [{ slug: "a", display_name: "A", assets: [
    { kind: "product", title: "Foo", tagline: null, url: null, stage: null },
    { kind: "product", title: " foo ", tagline: null, url: null, stage: null },
  ] }];
  assert.equal(listWorks(twice).length, 1);
});
