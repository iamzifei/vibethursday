/**
 * The back office, phone first, for the admin and the assistant (2026-11-02).
 *
 * One frame and one menu for both roles: the menu is filtered by the
 * permission table, so an assistant never sees a link to a page that would
 * only answer "no access", and a page an assistant may use is reachable
 * without the long /admin page (which stays the admin's).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ADMIN_NAV, ADMIN_TABS, navFor } from "../src/lib/admin-nav.ts";
import { can } from "../src/lib/permissions.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

// The pages an assistant works from, and the permission each must check.
const PANELS = {
  "src/app/admin/today/page.tsx": "desk",
  "src/app/admin/waitlist/page.tsx": "waitlist",
  "src/app/admin/questions/page.tsx": "questions",
  "src/app/admin/photos/page.tsx": "photos",
} as const;

test("★ each assistant panel exists and checks its own permission before reading anything", () => {
  for (const [file, permission] of Object.entries(PANELS)) {
    assert.ok(existsSync(path.join(root, file)), `${file} is missing`);
    const source = read(file);
    const gate = source.indexOf(`can(role, "${permission}")`);
    assert.ok(gate > 0, `${file} does not check can(role, "${permission}")`);
    // The gate comes before any database read.
    for (const call of ["listSignups(", "listDeskRows(", "listPhotosForReview(", "getSessionQuestions("]) {
      const at = source.indexOf(call);
      if (at >= 0) assert.ok(at > gate, `${file} reads ${call} before its permission check`);
    }
  }
});

test("★ the menu an assistant sees holds only pages the assistant may open", () => {
  const links = navFor("assistant").flatMap((group) => group.links);
  assert.ok(links.length > 0);
  for (const link of links) assert.ok(can("assistant", link.perm ?? "admin"), `${link.href} is in the assistant's menu`);
  const hrefs = links.map((link) => link.href.split("?")[0]);
  for (const page of ["/admin/today", "/admin/desk", "/admin/waitlist", "/admin/questions", "/admin/photos"]) {
    assert.ok(hrefs.includes(page), `${page} is missing from the assistant's menu`);
  }
  // Nothing of the admin's long page, members, pay links or roles.
  for (const href of hrefs) {
    assert.ok(!["/admin", "/admin/members", "/admin/paylinks", "/admin/roles"].includes(href), `${href} leaked`);
  }
  // The admin sees everything in ADMIN_NAV.
  assert.equal(navFor("admin").flatMap((g) => g.links).length, ADMIN_NAV.flatMap((g) => g.links).length);
});

test("the phone tab bar is the same four for both roles, all open to the assistant", () => {
  assert.deepEqual(ADMIN_TABS.map((tab) => tab.label), ["今天", "签到", "候补", "更多"]);
  for (const tab of ADMIN_TABS) if (tab.href) assert.ok(can("assistant", tab.perm ?? "admin"), tab.label);
});

test("the three moved actions come back to their own page, not to /admin", () => {
  assert.match(read("src/app/api/admin/waitlist/route.ts"), /new URL\("\/admin\/waitlist"/);
  assert.doesNotMatch(read("src/app/api/admin/waitlist/route.ts"), /new URL\("\/admin"|\/admin#waitlist/);
  assert.match(read("src/app/api/admin/questions/route.ts"), /\/admin\/questions/);
  assert.doesNotMatch(read("src/app/api/admin/photos/route.ts"), /\/admin#photos/);
  assert.match(read("src/app/api/admin/photos/route.ts"), /\/admin\/photos/);
});

test("the long /admin page no longer carries the moved sections", () => {
  const admin = read("src/app/admin/page.tsx");
  for (const id of ['id="waitlist"', 'id="questions"', 'id="photos"']) assert.ok(!admin.includes(id), id);
});

test("an assistant can see the photos they review", () => {
  const route = read("src/app/api/session-photo/[id]/route.ts");
  assert.match(route, /can\(await staffRole\(\), "photos"\)/);
});

test("the team door lands on today", () => {
  assert.match(read("src/app/staff/page.tsx"), /redirect\("\/admin\/today"\)/);
  assert.match(read("src/app/api/staff/session/route.ts"), /new URL\("\/admin\/today"/);
});

test("★ an assistant gives out places only while one is free; going over the cap is the admin's", () => {
  const route = read("src/app/api/admin/waitlist/route.ts");
  const check = route.indexOf('if (role !== "admin")');
  assert.ok(check > 0 && route.indexOf("booked >= capFor(session)") > check);
  assert.ok(check < route.indexOf("await promoteFromWaitlist("), "the cap check runs before promoting");
});

test("the tab bar is filtered by the same permissions as the menu", () => {
  assert.match(read("src/components/admin/AdminFrame.tsx"), /ADMIN_TABS\.filter\(\(tab\) => !tab\.href \|\| can\(role, tab\.perm \?\? "admin"\)\)/);
});

// ── 3b: the admin overview split into views (2026-11-02) ─────────────────────

test("★ no admin action lands on a bare /admin#anchor that the default view does not show", async () => {
  const { readdirSync } = await import("node:fs");
  const dir = path.join(root, "src/app/api/admin");
  for (const name of readdirSync(dir)) {
    const file = path.join("src/app/api/admin", name, "route.ts");
    if (!existsSync(path.join(root, file))) continue;
    const source = read(file);
    assert.doesNotMatch(source, /URL\(`\/admin#|URL\("\/admin#|url\.hash = /, `${file} redirects to an /admin anchor without its view`);
  }
});

test("each section anchor is rendered inside the view adminHref sends it to", async () => {
  const { adminHref } = await import("../src/lib/admin-nav.ts");
  const page = read("src/app/admin/page.tsx");
  // The view blocks in source order: `{view === "x" && (` up to the next one.
  const blocks = [...page.matchAll(/\{view === "([a-z]+)" && \(/g)].map((m, i, all) => ({
    view: m[1],
    body: page.slice(m.index!, all[i + 1]?.index ?? page.length),
  }));
  for (const anchor of ["week", "checkin", "split", "dinner", "shares", "after", "tuesday-fees", "course", "membership", "community", "wharf", "members", "data", "wechat-fix", "merge", "sessions", "logins", "deck", "signups"]) {
    const view = new URLSearchParams(adminHref(anchor).split("?")[1].split("#")[0]).get("view");
    const holder = blocks.find((block) => block.body.includes(`id="${anchor}"`));
    // `checkin` and `feedback` live inside the desk components rendered in those views.
    if (!holder && (anchor === "checkin")) continue;
    assert.ok(holder, `#${anchor} is not inside any view block`);
    assert.equal(holder.view, view, `#${anchor} is in the ${holder.view} view, adminHref says ${view}`);
  }
});

test("the overview is short: only the today card, the help and the tiles", () => {
  const page = read("src/app/admin/page.tsx");
  const start = page.indexOf('{view === "overview" && (');
  const end = page.indexOf('{view === "week" && (');
  assert.ok(start > 0 && end > start);
  assert.ok(page.slice(start, end).split("\n").length < 120, "the overview block grew past 120 lines");
});
