import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { copy } from "../src/lib/content.ts";

/**
 * A required field must never be folded away.
 *
 * Measured 2026-09-28: the English form requires an email (WeChat is optional
 * there), and moving email into the "A few more…" fold made English signups
 * fail with "Name and email are required" while the field sat out of sight.
 */
test("★ where email is required, the form renders it before the fold", () => {
  const form = readFileSync(path.join(process.cwd(), "src/components/SignupForm.tsx"), "utf8");
  const visible = form.indexOf("{copy.fields.emailRequired && emailField}");
  const fold = form.indexOf('<details className="disclosure"');

  assert.ok(visible > 0, "the required-email call site is missing");
  assert.ok(fold > 0, "the fold is missing");
  assert.ok(visible < fold, "the required email field is inside or after the fold");

  // The case this exists for.
  assert.equal(copy.en.signup.fields.emailRequired, true);
});
