/**
 * The AWS certificate as a Tuesday subject (2026-11-02) is on hold: taken off
 * the Tuesday page and the signup form until the organiser has asked the room
 * (spec change, 2026-11-02). To bring it back: the option in content.ts and
 * "cert" in TUESDAY_BRING (tests/tuesday-bring.test.mts keeps the two equal);
 * the desk, export and follow-up list still know the label.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ the certificate is not offered on the Tuesday page, the signup form or the screen", async () => {
  const { copy } = await import("../src/lib/content.ts");
  for (const lang of ["zh", "en"] as const) {
    const values = copy[lang].signup.fields.tuesdayBringOptions.map((option: { value: string }) => option.value);
    assert.ok(!values.includes("cert"), lang);
    assert.doesNotMatch(JSON.stringify(copy[lang].tuesday), /AWS/, lang);
  }
  assert.doesNotMatch(read("src/lib/screen.ts"), /AWS/);
});
