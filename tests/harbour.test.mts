import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * The two halftone backdrops: the home page's Sydney skyline and the Wharf's
 * Darling Harbour.
 *
 * Both tests below exist because the same two mistakes were made more than
 * once each while drawing them, and neither shows up as an error — the page
 * renders, nothing throws, and the landmarks are simply not there.
 */

function read(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

test("★ the two backdrops share no ids", () => {
  // Both are inline SVG with a <pattern> and a <mask> referenced by id, and ids
  // in an SVG are global to the document. They are on different pages today, so
  // a collision would break nothing — until somebody puts a wharf hero on the
  // home page, at which point one drawing silently becomes the other.
  const ids = (file: string) => [...read(file).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);

  const home = new Set(ids("src/components/SydneySkyline.tsx"));
  const wharf = ids("src/components/DarlingHarbour.tsx");

  assert.ok(home.size > 0 && wharf.length > 0);
  for (const id of wharf) {
    assert.ok(!home.has(id), `both drawings define id="${id}"`);
  }
});

test("★ the Wharf backdrop declares a ratio rather than a height", () => {
  // ⚠️ Twice now, a `height` in `vh` on this element passed a check at one
  // window size and cropped the landmarks at another. The svg is
  // `xMidYMax slice` over a 1200×250 viewBox: a box wider than 4.8:1 scales to
  // cover the width and eats the top, which is where the tower, the masts and
  // the pylons are. Declaring the ratio is what makes that impossible.
  const css = read("src/app/globals.css");
  const rule = css.slice(css.indexOf(".wharf-hero > .skyline {"));
  const desktop = rule.slice(0, rule.indexOf("}"));

  assert.match(desktop, /aspect-ratio:/, "the desktop rule must declare an aspect ratio");
  assert.doesNotMatch(desktop, /height:\s*(clamp|\d)[^;]*vh/, "no viewport-height sizing here");
});

test("the Wharf backdrop is decorative, not content", () => {
  const svg = read("src/components/DarlingHarbour.tsx");
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /focusable="false"/);
});
