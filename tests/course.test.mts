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

/*
 * Signing up again with the same WeChat ID returns the first order (one
 * transfer, never two) — but what they tell us the second time must not be
 * thrown away: people come back precisely to add what they want from the
 * class. Blank answers the second time keep what was there.
 *
 * Needs a throwaway local Postgres, like the schema test:
 *   COURSE_TEST_DATABASE_URL=postgres://localhost:55432/vt_course_test pnpm test
 */
const courseDb = process.env.COURSE_TEST_DATABASE_URL;

test(
  "★ signing up again keeps the order but saves the new needs",
  { skip: courseDb ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(courseDb!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = courseDb;
    const { createCourseOrder, listCourseOrders, getPool } = await import("../src/lib/db.ts");
    const course = `test-${Date.now()}`;
    const base = { course, cap: 40, signupId: null, name: "王老板", wechat: "wang123" };
    try {
      const first = await createCourseOrder({ ...base, industry: null, bizFocus: [], note: null, ref: newCourseRef() });
      const again = await createCourseOrder({
        ...base, wechat: " Wang123 ", industry: "property", bizFocus: ["leads"], note: "回客人微信太花时间", ref: newCourseRef(),
      });
      assert.equal(again.ref, first.ref, "same order, same reference");
      assert.equal(again.existing, true);

      // A third time with nothing filled in keeps the answers from the second.
      await createCourseOrder({ ...base, industry: null, bizFocus: [], note: null, ref: newCourseRef() });

      const orders = await listCourseOrders(course);
      assert.equal(orders.length, 1);
      assert.equal(orders[0].industry, "property");
      assert.deepEqual(orders[0].biz_focus, ["leads"]);
      assert.equal(orders[0].note, "回客人微信太花时间");
      assert.equal(orders[0].status, "pending");
    } finally {
      await getPool().end();
    }
  },
);
