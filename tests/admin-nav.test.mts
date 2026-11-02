/**
 * Every organiser page can be found from the admin menu (2026-11-02). The sidebar and phone menu
 * come from ADMIN_NAV; a page under src/app/admin with no entry there fails.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ADMIN_NAV } from "../src/lib/admin-nav.ts";

const root = path.resolve(import.meta.dirname, "..");
const adminDir = path.join(root, "src/app/admin");

/** Top-level admin pages: /admin/<dir> with a page.tsx. Deeper pages (desk/pay) are reached from their parent. */
function adminPages(): string[] {
  return readdirSync(adminDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(adminDir, entry.name, "page.tsx")))
    .map((entry) => `/admin/${entry.name}`);
}

test("★ every admin page is in the navigation", () => {
  // Spec change 2026-11-02: links may carry ?day=tue|thu, so strip the query too.
  const hrefs = new Set(ADMIN_NAV.flatMap((group) => group.links.map((link) => link.href.split("#")[0].split("?")[0])));
  for (const page of adminPages()) assert.ok(hrefs.has(page), `${page} has no entry in ADMIN_NAV`);
  assert.ok(hrefs.has("/admin"));
});

test("every anchor in the navigation exists on /admin", () => {
  const admin = readFileSync(path.join(adminDir, "page.tsx"), "utf8");
  for (const link of ADMIN_NAV.flatMap((group) => group.links)) {
    const [, anchor] = link.href.split("#");
    if (anchor) assert.match(admin, new RegExp(`id="${anchor}"`), link.href);
  }
});

test("the frame wraps every admin page, but only once signed in", () => {
  const layout = readFileSync(path.join(adminDir, "layout.tsx"), "utf8");
  // Spec change 2026-11-02: the helper at the door gets a narrower frame, so
  // the layout asks staffRole (admin, helper or nobody) instead.
  assert.match(layout, /staffRole/);
  assert.match(layout, /if \(!role\) return children/);
  assert.match(layout, /AdminFrame/);
});

test("Tuesday and Thursday each have their own block with their own desk (2026-11-02)", () => {
  const tue = ADMIN_NAV.find((group) => group.title.startsWith("周二"));
  const thu = ADMIN_NAV.find((group) => group.title.startsWith("周四"));
  assert.ok(tue && thu, "no 周二 / 周四 group");
  assert.ok(tue.links.some((link) => link.href === "/admin/desk?day=tue"));
  assert.ok(thu.links.some((link) => link.href === "/admin/desk?day=thu"));
  for (const page of ["desk", "door", "followup"]) {
    const source = readFileSync(path.join(adminDir, page, "page.tsx"), "utf8");
    assert.match(source, /sessionForDay\(/, `/admin/${page} ignores ?day=`);
  }
});
