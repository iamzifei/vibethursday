/**
 * Preparing for a third-party AI certificate as one of the things to bring to
 * a Build Tuesday (2026-11-02): the AWS Certified AI Practitioner, which can
 * be sat in Simplified Chinese. The exam fee is the candidate's own.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ 'preparing for the AWS AI certificate' is a Tuesday option, in both languages, and the signup accepts it", async () => {
  const { copy } = await import("../src/lib/content.ts");
  for (const lang of ["zh", "en"] as const) {
    const values = copy[lang].signup.fields.tuesdayBringOptions.map((option: { value: string }) => option.value);
    assert.ok(values.includes("cert"), lang);
  }
  assert.match(read("src/app/api/signup/route.ts"), /TUESDAY_BRING = new Set\(\[[^\]]*"cert"/);
  assert.match(read("src/app/admin/desk/page.tsx"), /cert: /);
});

test("the Tuesday page says the certificate is an option, and that the exam fee is the candidate's own", async () => {
  const { copy } = await import("../src/lib/content.ts");
  const workshop = JSON.stringify(copy.zh.tuesday);
  assert.match(workshop, /AWS/);
  assert.match(workshop, /考试费自付/);
});
