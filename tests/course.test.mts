/**
 * The paid class (2026-10-12, src/lib/course.ts): the form only keeps known
 * answers, references are easy to retype, and the bank details are never in
 * the repository.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { COURSE, hasPlace, looksLikeCourseRef, newCourseRef, parseCourseForm } from "../src/lib/course.ts";

test("references: AI plus five characters with no 0/O/1/I", () => {
  for (let i = 0; i < 200; i += 1) {
    const ref = newCourseRef();
    assert.ok(looksLikeCourseRef(ref), ref);
    assert.doesNotMatch(ref.slice(2), /[01OI]/);
  }
  assert.equal(looksLikeCourseRef("AI0OOOO"), false);
  assert.equal(looksLikeCourseRef("../etc"), false);
});

test("the form keeps only known industries and focus areas, trimmed", () => {
  const values: Record<string, unknown> = { name: "  王老板 ", wechat: " wang123 ", industry: "property", note: "" };
  const form = parseCourseForm(
    (name) => values[name],
    () => ["leads", "ops", "leads", "<script>"],
  );
  assert.deepEqual(form, { name: "王老板", wechat: "wang123", industry: "property", bizFocus: ["leads", "ops"], note: null });
  assert.equal(parseCourseForm((name) => (name === "industry" ? "made-up" : null), () => []).industry, null);
});

test("the free-text need is kept, trimmed and capped at 500", () => {
  const read = (note: unknown) => parseCourseForm((name) => (name === "note" ? note : null), () => []).note;
  assert.equal(read("  每天回客人微信太花时间 "), "每天回客人微信太花时间");
  assert.equal(read("字".repeat(800))?.length, 500);
  assert.equal(read("   "), null);
});

test("/class sends the need and /admin shows it", () => {
  const page = readFileSync(path.join(import.meta.dirname, "../src/app/class/page.tsx"), "utf8");
  assert.match(page, /<textarea[^>]*name="note"/);
  const admin = readFileSync(path.join(import.meta.dirname, "../src/app/admin/page.tsx"), "utf8");
  assert.match(admin, /order\.note/);
});

test("forty places, then the waitlist", () => {
  assert.equal(COURSE.cap, 40);
  assert.ok(hasPlace(39));
  assert.ok(!hasPlace(40));
});

test("no bank details anywhere in the source", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mts|json|md)$/.test(entry)) files.push(full);
    }
  };
  walk(path.join(process.cwd(), "src"));
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\bBSB\b\s*[:：]?\s*\d{3}-?\d{3}/i, file);
  }
});
