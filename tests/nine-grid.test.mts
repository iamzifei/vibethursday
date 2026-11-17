/**
 * The Moments nine-grid tool's geometry (`nine-grid.ts`, 2026-11-18): every
 * piece must be an exact ninth of one square, or the picture breaks apart
 * once WeChat crops each thumbnail to a square.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { squareFor, tilePlacement, TILE } from "../src/lib/nine-grid.ts";

test("crop: the square is the short edge, and position slides along the long one", () => {
  assert.deepEqual(squareFor(4000, 3000, "crop", 0.5), { side: 3000, x: -500, y: 0 });
  assert.deepEqual(squareFor(4000, 3000, "crop", 0), { side: 3000, x: 0, y: 0 });
  assert.deepEqual(squareFor(4000, 3000, "crop", 1), { side: 3000, x: -1000, y: 0 });
  assert.deepEqual(squareFor(3000, 4000, "crop", 1), { side: 3000, x: 0, y: -1000 });
  // Out-of-range positions are clamped rather than sliding off the picture.
  assert.deepEqual(squareFor(4000, 3000, "crop", 7), squareFor(4000, 3000, "crop", 1));
});

test("pad: the square is the long edge, with the picture centred in it", () => {
  assert.deepEqual(squareFor(4000, 3000, "pad"), { side: 4000, x: 0, y: 500 });
  assert.deepEqual(squareFor(3000, 4000, "pad"), { side: 4000, x: 500, y: 0 });
});

test("a square picture is the same either way", () => {
  assert.deepEqual(squareFor(2000, 2000, "crop"), squareFor(2000, 2000, "pad"));
});

test("★ the nine pieces tile the square exactly, in posting order", () => {
  const w = 3000;
  const h = 3000;
  const square = squareFor(w, h, "crop");
  // Piece 0 is the top-left ninth: the picture starts at the canvas corner
  // and is drawn at three times the canvas size.
  assert.deepEqual(tilePlacement(square, w, h, 0), { dx: 0, dy: 0, dw: TILE * 3, dh: TILE * 3 });
  // Piece 5 is row 1, column 2: shifted two cells left and one cell up.
  assert.deepEqual(tilePlacement(square, w, h, 5), { dx: -TILE * 2, dy: -TILE, dw: TILE * 3, dh: TILE * 3 });
  // Piece 8 is the bottom-right ninth.
  assert.deepEqual(tilePlacement(square, w, h, 8), { dx: -TILE * 2, dy: -TILE * 2, dw: TILE * 3, dh: TILE * 3 });
});

test("crop offset carries into every piece", () => {
  const square = squareFor(4500, 3000, "crop", 0.5); // overhangs 750px each side
  const first = tilePlacement(square, 4500, 3000, 0, 1000);
  // A cell is 1000 source px, drawn at 1000 px: scale 1, so the overhang is −750.
  assert.deepEqual(first, { dx: -750, dy: 0, dw: 4500, dh: 3000 });
});
