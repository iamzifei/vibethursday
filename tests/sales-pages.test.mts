/**
 * Paid pages follow one pattern (2026-11-02): the primary action near the top,
 * a bar pinned to the bottom of the screen that steps aside when the form is
 * in view, and pictures of the real room (redrawn, faces replaced).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("/class: the bottom bar is the shared StickyCta pointing at the signup form", () => {
  const page = read("src/app/class/page.tsx");
  assert.match(page, /<StickyCta href="#class-signup"/);
  assert.doesNotMatch(page, /className="vip-sticky"/, "the old CSS-only bar never stepped aside");
  // The form card itself is the target, so the bar hides for the whole form.
  assert.match(page, /className="[^"]*vip-signup[^"]*" id="class-signup"/);
});

// Spec change 2026-11-18 (James): from the 12/13 class, a yearly member who
// has never taken a class comes free; anyone who has, member or not, comes as
// a refresher and pays the seat fee.
test("/class: a 共创会员 who has not taken a class comes free; past students come as a refresher", () => {
  const page = read("src/app/class/page.tsx");
  assert.match(page, /还没上过课的免费/);
  assert.match(page, /算复训/);
  assert.doesNotMatch(page, /共创会员已包含这门课/);
});

test("/class shows the last class, redrawn, from files that exist", async () => {
  const { CLASS_SCENES, sceneSrc } = await import("../src/lib/scenes.ts");
  assert.ok(CLASS_SCENES.length >= 3);
  for (const scene of CLASS_SCENES) {
    for (const w of [640, 1200] as const) assert.ok(existsSync(path.join(root, "public", sceneSrc(scene.id, w))), `${scene.id} ${w}`);
  }
  const page = read("src/app/class/page.tsx");
  assert.match(page, /CLASS_SCENES/);
});

test("/join: a button to the form in the first screen, as well as the bottom bar", () => {
  const page = read("src/app/join/page.tsx");
  assert.match(page, /className="btn btn--primary[^"]*" href="#join-form"/);
  assert.match(page, /<StickyCta href="#join-form"/);
});
