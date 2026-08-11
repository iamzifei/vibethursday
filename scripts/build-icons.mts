/**
 * Renders the Harbour Bridge mark to the PNGs the site and the avatars need.
 *
 * Run manually, output committed — the same arrangement as the other two art
 * scripts, so nothing image-related runs during a build:
 *
 *   node --experimental-strip-types scripts/build-icons.mts
 *
 * Geometry is imported from src/lib/mark.ts rather than repeated here. That is
 * the whole reason this file exists instead of a hand-drawn SVG: the component
 * on the page and the icon in the browser tab cannot be allowed to drift.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
  ARCH_PATH,
  BACKDROP,
  DECK,
  HANGERS,
  MARK_COLOR,
  MARK_SIZE,
  PYLONS,
} from "../src/lib/mark.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rect = (r: { x: number; y: number; width: number; height: number }) =>
  `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/>`;

function markSvg(size: number): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}">`,
    `<rect width="${MARK_SIZE}" height="${MARK_SIZE}" rx="${BACKDROP.radius}" fill="${BACKDROP.fill}"/>`,
    `<g fill="${MARK_COLOR}">`,
    HANGERS.map(rect).join(""),
    `<path d="${ARCH_PATH}"/>`,
    rect(DECK),
    PYLONS.map(rect).join(""),
    `</g></svg>`,
  ].join("");
}

/** Files to write: the browser tab icon, the iOS home-screen icon, an avatar. */
const TARGETS = [
  { file: "src/app/icon.png", size: 512 },
  { file: "src/app/apple-icon.png", size: 512 },
  // Ko-fi, WeChat and anywhere else the community needs a square portrait.
  { file: "public/avatar.png", size: 1024 },
];

const browser = await chromium.launch();

for (const target of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    // Transparent page background: the mark supplies its own backdrop, so a
    // white page would only show up as fringing on the rounded corners.
    deviceScaleFactor: 1,
  });

  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}</style>${markSvg(target.size)}`,
  );

  const png = await page.screenshot({ omitBackground: true });
  await writeFile(path.join(root, target.file), png);
  await page.close();

  console.log(`${target.file}  ${target.size}×${target.size}`);
}

await browser.close();
