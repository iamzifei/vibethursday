/**
 * Two changes the organiser made on 2026-11-02:
 * - Tuesday and Thursday can both be booked in the same week. Signing up for
 *   one no longer gives up the other (it made the register hard to keep).
 *   Moving a booking on /my still moves it: that is an explicit "from".
 * - The site does not say 导师团 come free. They do, and they are told
 *   privately; said publicly it reads like a privilege.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ signing up, moving and promoting from the waitlist never give up the other session that week", () => {
  for (const file of ["src/app/api/signup/route.ts", "src/app/api/my/route.ts", "src/app/api/admin/waitlist/route.ts"]) {
    assert.doesNotMatch(read(file), /sameWeekSessions\(/, file);
  }
  for (const lang of ["zh", "en"] as const) {
    assert.doesNotMatch(copy[lang].tuesday.thursdayNote, /只能报一场|One morning per week/, lang);
  }
});

test("★ no public page says mentors come free", () => {
  const publicText = JSON.stringify([copy.zh, copy.en]) + read("src/lib/screen.ts");
  assert.doesNotMatch(publicText, /导师团免费|和导师团免费|或导师团|\/ 导师团，免费|mentor team, so|Member \/ mentor/);
});
