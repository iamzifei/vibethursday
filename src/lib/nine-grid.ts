/**
 * The geometry behind the Moments nine-grid tool (/tools/grid, 2026-11-18).
 *
 * WeChat Moments shows nine pictures as a 3×3 grid of SQUARE thumbnails, each
 * one centre-cropped from whatever was posted. So the only way the nine pieces
 * line up into one big picture on every phone is for every piece to already
 * be a square: then the thumbnail crop removes nothing, whatever the screen.
 *
 * Hence two steps, both pure arithmetic and kept here so they can be tested
 * without a browser:
 *   1. `squareFor` decides how the uploaded picture becomes one square —
 *      cropped (the picture fills the square, the overflow is cut) or padded
 *      (the whole picture fits, the rest is a plain colour);
 *   2. `tilePlacement` says where to draw the picture onto each of the nine
 *      output canvases so that each canvas shows exactly its ninth.
 *
 * All lengths are in source-image pixels unless they say otherwise.
 */

/** How a non-square picture becomes a square. */
export type Fit = "crop" | "pad";

/** Output size of each piece, in pixels. 1080 is what WeChat keeps for a full-screen view. */
export const TILE = 1080;

/** JPEG quality for each piece: high enough that WeChat's own re-compression does not show seams. */
export const JPEG_QUALITY = 0.92;

/**
 * The square everything is cut from: its side, and where the picture's
 * top-left corner sits inside it (negative when the picture overhangs, i.e.
 * when cropping).
 */
export type Square = { side: number; x: number; y: number };

/**
 * Turns a w×h picture into a square.
 *
 * - "crop": the square's side is the SHORT edge; `position` (0 to 1) slides
 *   the picture along its long edge — 0 keeps the left/top, 1 the right/bottom,
 *   0.5 the centre.
 * - "pad": the side is the LONG edge, and the picture sits centred in it.
 */
export function squareFor(width: number, height: number, fit: Fit, position = 0.5): Square {
  const p = Math.min(1, Math.max(0, position));
  if (fit === "crop") {
    const side = Math.min(width, height);
    // `|| 0` turns the -0 of a zero overhang into a plain 0.
    return { side, x: -(width - side) * p || 0, y: -(height - side) * p || 0 };
  }
  const side = Math.max(width, height);
  return { side, x: (side - width) / 2, y: (side - height) / 2 };
}

/** Where to draw the picture on one output canvas: drawImage(img, dx, dy, dw, dh). */
export type Placement = { dx: number; dy: number; dw: number; dh: number };

/**
 * Where to draw the whole picture on piece `index` (0–8, row by row, the
 * order the pieces are posted in) so that a `size`×`size` canvas shows exactly
 * that ninth of the square. The parts that fall outside the canvas are simply
 * clipped by it, so one formula covers both crop and pad.
 */
export function tilePlacement(square: Square, width: number, height: number, index: number, size = TILE): Placement {
  const cell = square.side / 3;
  const column = index % 3;
  const row = Math.floor(index / 3);
  const scale = size / cell;
  return {
    dx: (square.x - column * cell) * scale,
    dy: (square.y - row * cell) * scale,
    dw: width * scale,
    dh: height * scale,
  };
}
