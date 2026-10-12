/**
 * Cuts the logo artwork into the PNGs the site and the avatars need.
 *
 * Run manually, output committed — the same arrangement as the other art
 * scripts, so nothing image-related runs during a build. Needs ImageMagick
 * (`brew install imagemagick`):
 *
 *   node --experimental-strip-types scripts/build-icons.mts
 *
 * The sources are the two logo files in public/brand/ (2026-10-12): the full
 * logo with the wordmark, and the same drawing with the lettering removed.
 * Small sizes use only the head — at 16–32px the whole figure is a smudge,
 * while the sunglasses and the fried chicken still read.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FULL = "public/brand/vibethursday-logo.png";
const NO_TEXT = "public/brand/vibethursday-logo-notext.png";

/** The head and the chicken, in pixels of the 1254×1254 no-text source. */
const HEAD_CROP = "540x540+320+140";

const TARGETS = [
  // A tab icon is drawn at 16–32px and an iOS home-screen icon at 180px; the
  // old 512px files were re-downloaded on every page (2026-09-28 review).
  { file: "src/app/icon.png", source: NO_TEXT, crop: HEAD_CROP, size: 48 },
  { file: "src/app/apple-icon.png", source: NO_TEXT, crop: HEAD_CROP, size: 180 },
  // The nav bar shows it at 28px; 84px covers a 3× screen.
  { file: "public/brand/mark.png", source: NO_TEXT, crop: HEAD_CROP, size: 84 },
  // Ko-fi, WeChat, search results and anywhere else that needs a square
  // portrait: the whole logo, wordmark included.
  { file: "public/avatar.png", source: FULL, crop: null, size: 1024 },
];

for (const target of TARGETS) {
  execFileSync("magick", [
    path.join(root, target.source),
    ...(target.crop ? ["-crop", target.crop, "+repage"] : []),
    "-resize",
    `${target.size}x${target.size}`,
    "-strip",
    path.join(root, target.file),
  ]);
  console.log(`${target.file}  ${target.size}×${target.size}`);
}
