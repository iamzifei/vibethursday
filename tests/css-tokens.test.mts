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

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The `:root` tokens that are plain hex colours. */
function rootColours(): Record<string, string> {
  const block = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

test("★ every text colour clears WCAG AA on every background", () => {
  // --fg3 failed this on every background it sat on until 2026-09-24 — 4.2:1
  // on the page and 3.1:1 on elevated cards — while being the colour of the
  // smallest type on the site. Nothing reported it: contrast is invisible to
  // the build, the tests and a screenshot taken on a good monitor.
  const tokens = rootColours();
  const text = ["fg1", "fg2", "fg3", "accent", "spark", "chip", "error"].filter((k) => tokens[k]);
  const backgrounds = Object.keys(tokens).filter((k) => k.startsWith("bg-"));

  assert.ok(text.length >= 4 && backgrounds.length >= 3, "could not read the tokens — the parser is broken");

  for (const fg of text) {
    for (const bg of backgrounds) {
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= 4.5, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1 (needs 4.5)`);
    }
  }
});

test("the canvas palette is the stylesheet's palette", () => {
  // Canvas cannot read a CSS custom property, so the poster and the badge
  // carry their own copy of the colours in canvas-kit.ts. When --fg3 was
  // lifted, that copy still held the old value — the images would have kept
  // the contrast failure the page had just fixed.
  const tokens = rootColours();
  const kit = readFileSync(path.join(process.cwd(), "src/components/canvas-kit.ts"), "utf8");

  for (const [constant, token] of [["INK", "bg-primary"], ["FG1", "fg1"], ["FG2", "fg2"], ["FG3", "fg3"], ["ACCENT", "accent"], ["SPARK", "spark"], ["CHIP", "chip"]] as const) {
    const literal = kit.match(new RegExp(`export const ${constant} = "(#[0-9a-fA-F]{6})"`))?.[1];
    assert.ok(literal, `canvas-kit.ts has no ${constant}`);
    assert.equal(literal.toLowerCase(), tokens[token]?.toLowerCase(), `${constant} (${literal}) ≠ --${token} (${tokens[token]})`);
  }
});
