/**
 * Renders art/xhs-poster.html to a 3:4 PNG for Xiaohongshu.
 *
 * Rendered in a browser rather than composited with ImageMagick because the
 * poster is mostly Chinese type: the browser can reach PingFang's real bold
 * weights, and CSS handles the line breaking and vertical rhythm that would
 * otherwise be hand-placed pixel offsets.
 *
 *   node scripts/render-poster.mjs
 */

import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "art", "xhs-poster.html");
const output = join(root, "art", "xhs-cover.png");

// 1200x1600 CSS pixels at 2x — 2400x3200, comfortably above what Xiaohongshu
// downsamples to, so the type stays crisp on a high-density phone.
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 1600 },
  deviceScaleFactor: 2,
});

await page.goto(`file://${source}`);
await page.waitForTimeout(400);

await page.locator(".poster").screenshot({ path: output });
await browser.close();

console.log(`Wrote ${output}`);
