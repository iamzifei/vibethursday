/**
 * "今日在场" on the room's screen (2026-11-02): one card per person who
 * checked in and chose to be shown, refreshing by itself. Only what the
 * session's own public page already shows — nobody who chose not to be named.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ /live shows the wall (buildWall), refreshes itself, and is kept out of search", () => {
  const page = read("src/app/live/page.tsx");
  assert.match(page, /buildWall\(/, "only people who chose to be on the wall");
  assert.match(page, /http-equiv="refresh"|httpEquiv="refresh"/);
  assert.match(page, /index: false/);
  assert.doesNotMatch(page, /wechat/, "no contact details on a screen");
  assert.match(read("src/app/robots.ts"), /\/live/);
});

test("the admin menu leads to it", async () => {
  const { ADMIN_NAV } = await import("../src/lib/admin-nav.ts");
  assert.ok(ADMIN_NAV.flatMap((group) => group.links).some((link) => link.href === "/live"));
});
