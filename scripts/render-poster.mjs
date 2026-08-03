/**
 * Renders the social posters to PNG.
 *
 * Rendered in a browser rather than composited with ImageMagick because the
 * posters are mostly type: the browser reaches PingFang's real bold weights,
 * and CSS handles line breaking and vertical rhythm that would otherwise be
 * hand-placed pixel offsets.
 *
 *   node scripts/render-poster.mjs        # all
 *   node scripts/render-poster.mjs xhs    # just one
 */

import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const POSTERS = {
  // 3:4 portrait. Xiaohongshu shows the full frame, and forbids URLs in images
  // as off-platform diversion — hence no link on this one.
  xhs: { source: "xhs-poster.html", output: "xhs-cover.png", width: 1200, height: 1600 },

  // 16:9 landscape. X crops portrait images in the timeline, which would cut
  // the headline. Links are unrestricted there, so these carry the URL.
  //
  // Chinese is the one in use; the English card is held for when the meetup
  // starts running English sessions, so it is not rendered by default.
  "x-zh": { source: "x-poster-zh.html", output: "x-card-zh.png", width: 1600, height: 900 },
  "x-en": { source: "x-poster-en.html", output: "x-card-en.png", width: 1600, height: 900, onDemand: true },
};

const requested = process.argv[2];
const jobs = requested
  ? { [requested]: POSTERS[requested] }
  : Object.fromEntries(Object.entries(POSTERS).filter(([, p]) => !p.onDemand));

if (requested && !POSTERS[requested]) {
  console.error(`Unknown poster "${requested}". Known: ${Object.keys(POSTERS).join(", ")}`);
  process.exit(1);
}

// 2x device scale, comfortably above what either platform downsamples to, so
// the type stays crisp on a high-density phone.
const browser = await chromium.launch();

for (const [name, { source, output, width, height }] of Object.entries(jobs)) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });

  await page.goto(`file://${join(root, "art", source)}`);
  await page.waitForTimeout(400);

  const target = join(root, "art", output);
  await page.locator(".poster, .card").first().screenshot({ path: target });
  await page.close();

  console.log(`${name}: ${target} (${width * 2}x${height * 2})`);
}

await browser.close();
