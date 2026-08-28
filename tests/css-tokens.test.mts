import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Every custom property the stylesheet reads must be one it also defines.
 *
 * ⚠️ This exists because the same mistake was made twice in one day, and both
 * times it was invisible. A `var(--name)` that resolves to nothing does not
 * warn, does not throw, and does not show up in a screenshot as anything
 * obviously wrong:
 *
 *   - `color: var(--text-secondary)` (no such token; the real one is `--fg2`)
 *     silently inherited the parent's colour, which happened to look fine.
 *   - `padding-block: A clamp(var(--space-10), 11vh, var(--space-16))` — no
 *     `--space-10` — made the WHOLE declaration invalid, so the element lost
 *     its top padding too, which is not where anybody would look.
 *
 * The second one is the reason this checks the file rather than the rendered
 * page: one bad token takes its whole declaration with it, including the parts
 * that were correct.
 */

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

test("★ every var(--token) the stylesheet reads is defined somewhere in it", () => {
  // ⚠️ Not anchored to the line start. Most of the scale is declared several
  // to a line (`--space-1: 4px; --space-2: 8px;`), and requiring `^` reported
  // twenty-three perfectly good tokens as missing the first time this ran.
  // `var(--x)` is never followed by a colon, so matching `--name:` anywhere is
  // safe.
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]));

  const missing = [...used].filter((token) => !defined.has(token)).sort();

  assert.deepEqual(missing, [], `undefined custom properties: ${missing.join(", ")}`);
});
