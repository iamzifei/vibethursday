/**
 * Every pixel in /play, drawn in code.
 *
 * No sprite sheets: there is nothing to license, nothing to download before
 * the first frame, and a character's appearance is a handful of palette
 * indexes rather than an image per combination. Everything is drawn at the
 * game's native resolution — sixteen art pixels to a tile — into small
 * offscreen canvases, which the engine then scales up by a whole number with
 * smoothing off. That scaling is what makes it pixel art; nothing here has to
 * pretend.
 */

import { hashString, isWalkable, tileAt, type CritterId, type GameMap } from "@/lib/game/world";
import type { Dir, Look } from "@/lib/game/protocol";

export const TILE = 16;

/* =============================================================================
   Palettes
============================================================================= */

export const SKIN = ["#f6d7c3", "#e9b894", "#c68a5e", "#8d5a3b", "#5c3a24"];
export const HAIR_COLORS = ["#2b2522", "#6b4226", "#c8964a", "#e8d6a0", "#b8453a", "#6f86d6", "#e58fb4"];
export const TOPS = ["#c6ff3d", "#3ddcff", "#ff5c8a", "#f4f4f0", "#2c3e70", "#f2a33a", "#7b5cd6", "#2f8f5b"];
export const BOTTOMS = ["#2c3440", "#4a6fa5", "#c9b18a", "#7a2f3b", "#1c1c1c"];

const ROOFS: Record<string, [string, string, string]> = {
  // roof, roof shade, wall — terracotta, slate, sandstone, glass-and-concrete:
  // the four things a Sydney street is made of.
  A: ["#b86a4c", "#9c5640", "#e6d3b8"],
  B: ["#7f8a98", "#6b7582", "#cfd6de"],
  C: ["#cfae74", "#b8965e", "#e9dcc0"],
  D: ["#9aa9b4", "#86949f", "#dde6ec"],
};

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

/** A cheap per-tile noise value in [0, 1). */
function noise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/* =============================================================================
   Tiles
============================================================================= */

const isBuilding = (ch: string) => ch >= "A" && ch <= "D";
const isWaterTile = (ch: string) => ch === "~";

/**
 * One tile, drawn with its neighbours in mind: shore foam where water meets
 * land, a wall face where a building's south edge meets the street, a kerb
 * where a road meets the footpath. Those three edges are most of what makes
 * a top-down city read as a city.
 */
function drawTile(ctx: CanvasRenderingContext2D, map: GameMap, tx: number, ty: number, ox: number, oy: number) {
  const ch = tileAt(map, tx, ty);
  const n = tileAt(map, tx, ty - 1);
  const s = tileAt(map, tx, ty + 1);
  const w = tileAt(map, tx - 1, ty);
  const e = tileAt(map, tx + 1, ty);
  const r = noise(tx, ty);

  switch (ch) {
    case "~": {
      px(ctx, "#2b6cb3", ox, oy, 16, 16);
      for (let i = 0; i < 3; i += 1) {
        const wx = Math.floor(noise(tx, ty, i + 1) * 12);
        const wy = Math.floor(noise(tx, ty, i + 7) * 14);
        px(ctx, "#3b7fc6", ox + wx, oy + wy, 4, 1);
      }
      const foam = "#8fc8ef";
      if (!isWaterTile(n)) px(ctx, foam, ox, oy, 16, 2);
      if (!isWaterTile(s)) px(ctx, "#1f5796", ox, oy + 15, 16, 1);
      if (!isWaterTile(w)) px(ctx, foam, ox, oy, 1, 16);
      if (!isWaterTile(e)) px(ctx, foam, ox + 15, oy, 1, 16);
      return;
    }
    case "g":
    case "t": {
      px(ctx, "#5c9e48", ox, oy, 16, 16);
      for (let i = 0; i < 6; i += 1) {
        px(ctx, "#4d8a3c", ox + Math.floor(noise(tx, ty, i) * 15), oy + Math.floor(noise(tx, ty, i + 9) * 15), 1, 2);
      }
      if (r < 0.08) {
        const flower = r < 0.03 ? "#f4e27a" : r < 0.06 ? "#f7f2ee" : "#c9a7ff";
        px(ctx, flower, ox + 4 + Math.floor(r * 80) % 8, oy + 5 + Math.floor(r * 130) % 6, 2, 2);
      }
      if (ch === "t") drawTree(ctx, tx, ty, ox, oy);
      return;
    }
    case "s": {
      px(ctx, "#e7d39b", ox, oy, 16, 16);
      px(ctx, "#d8c286", ox + Math.floor(r * 12), oy + Math.floor(noise(tx, ty, 3) * 12), 2, 1);
      return;
    }
    case "w": {
      px(ctx, "#8a6442", ox, oy, 16, 16);
      for (let row = 0; row < 16; row += 4) px(ctx, "#6f4f33", ox, oy + row + 3, 16, 1);
      px(ctx, "#a47a52", ox + Math.floor(r * 10), oy + 1, 3, 1);
      if (isWaterTile(s)) px(ctx, "#4a3322", ox, oy + 14, 16, 2);
      return;
    }
    case "r": {
      px(ctx, "#4b4f58", ox, oy, 16, 16);
      for (let i = 0; i < 5; i += 1) {
        px(ctx, "#565b65", ox + Math.floor(noise(tx, ty, i) * 16), oy + Math.floor(noise(tx, ty, i + 5) * 16));
      }
      const kerb = "#9aa0a8";
      if (n !== "r" && n !== "u" && n !== "H") px(ctx, kerb, ox, oy, 16, 1);
      if (s !== "r" && s !== "u" && s !== "H") px(ctx, kerb, ox, oy + 15, 16, 1);
      if (w !== "r" && w !== "u" && w !== "H") px(ctx, kerb, ox, oy, 1, 16);
      if (e !== "r" && e !== "u" && e !== "H") px(ctx, kerb, ox + 15, oy, 1, 16);
      // Dashes down the middle of a road that runs straight.
      if ((n === "r" && s === "r" && w !== "r" && e !== "r") && ty % 2 === 0) px(ctx, "#e8e2c8", ox + 7, oy + 4, 2, 7);
      if ((w === "r" && e === "r" && n !== "r" && s !== "r") && tx % 2 === 0) px(ctx, "#e8e2c8", ox + 4, oy + 7, 7, 2);
      return;
    }
    case "p": {
      px(ctx, "#d6c194", ox, oy, 16, 16);
      const offset = ty % 2 === 0 ? 0 : 4;
      for (let row = 0; row < 16; row += 4) px(ctx, "#c4ad7f", ox, oy + row, 16, 1);
      for (let col = offset; col < 16; col += 8) {
        px(ctx, "#c4ad7f", ox + col, oy, 1, 4);
        px(ctx, "#c4ad7f", ox + ((col + 4) % 16), oy + 4, 1, 4);
        px(ctx, "#c4ad7f", ox + col, oy + 8, 1, 4);
        px(ctx, "#c4ad7f", ox + ((col + 4) % 16), oy + 12, 1, 4);
      }
      return;
    }
    case "P": {
      px(ctx, "#c8c1b3", ox, oy, 16, 16);
      if (w === "=" || w === "v" || w === "h") px(ctx, "#f5c518", ox, oy, 2, 16);
      if (e === "=" || e === "v" || e === "h") px(ctx, "#f5c518", ox + 14, oy, 2, 16);
      return;
    }
    case "H":
    case "h": {
      px(ctx, "#5d626b", ox, oy, 16, 16);
      px(ctx, "#6a707a", ox + Math.floor(r * 12), oy + Math.floor(noise(tx, ty, 2) * 12), 3, 1);
      if (!"Hh".includes(w)) px(ctx, "#8b929c", ox, oy, 2, 16);
      if (!"Hh".includes(e)) px(ctx, "#8b929c", ox + 14, oy, 2, 16);
      if (ch === "h") drawRails(ctx, ox, oy, "#5d626b");
      return;
    }
    case "=": {
      px(ctx, "#6e665e", ox, oy, 16, 16);
      drawRails(ctx, ox, oy, "#6e665e");
      return;
    }
    case "v": {
      px(ctx, "#8e9197", ox, oy, 16, 16);
      drawRails(ctx, ox, oy, "#8e9197");
      px(ctx, "#6d7076", ox, oy + 14, 16, 2);
      return;
    }
    case "u": {
      // A street under a railway: the street, in the viaduct's shadow.
      px(ctx, "#8f8676", ox, oy, 16, 16);
      px(ctx, "#6f685c", ox, oy, 16, 3);
      px(ctx, "#7c7466", ox, oy + 3, 16, 1);
      return;
    }
    default: {
      if (isBuilding(ch)) {
        drawBuilding(ctx, ch, tx, ty, ox, oy, isBuilding(n), isBuilding(s));
        return;
      }
      // Open ground: paving slabs.
      px(ctx, "#bdb7aa", ox, oy, 16, 16);
      px(ctx, "#aea898", ox, oy + 15, 16, 1);
      px(ctx, "#aea898", ox + 15, oy, 1, 16);
      if (r < 0.2) px(ctx, "#c9c4b8", ox + 3 + Math.floor(r * 40), oy + 5, 3, 2);
    }
  }
}

function drawRails(ctx: CanvasRenderingContext2D, ox: number, oy: number, bed: string) {
  for (let row = 1; row < 16; row += 4) px(ctx, "#5a4331", ox + 2, oy + row, 12, 2);
  px(ctx, "#b8bec6", ox + 4, oy, 1, 16);
  px(ctx, "#b8bec6", ox + 11, oy, 1, 16);
  void bed;
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  ch: string,
  tx: number,
  ty: number,
  ox: number,
  oy: number,
  roofAbove: boolean,
  roofBelow: boolean,
) {
  const [roof, shade, wall] = ROOFS[ch];
  if (roofBelow) {
    px(ctx, roof, ox, oy, 16, 16);
    // Ridges, so a big roof is not one flat slab.
    for (let row = 3; row < 16; row += 5) px(ctx, shade, ox, oy + row, 16, 1);
    if (!roofAbove) px(ctx, "#ffffff33", ox, oy, 16, 2);
    return;
  }
  // South edge: the front of the building, with windows.
  px(ctx, roof, ox, oy, 16, 6);
  px(ctx, shade, ox, oy + 5, 16, 1);
  px(ctx, wall, ox, oy + 6, 16, 10);
  const lit = noise(tx, ty, 11);
  const glass = ch === "D" || ch === "B" ? "#7fb3d9" : "#6a8fae";
  for (let col = 2; col < 16; col += 5) {
    px(ctx, lit < 0.25 ? "#f7e39a" : glass, ox + col, oy + 8, 3, 4);
  }
  px(ctx, "#00000022", ox, oy + 14, 16, 2);
}

function drawTree(ctx: CanvasRenderingContext2D, tx: number, ty: number, ox: number, oy: number) {
  const kind = noise(tx, ty, 21);
  // Mostly figs and gums; the odd jacaranda, which is what the North Shore
  // looks like from October.
  const [dark, mid, light] =
    kind < 0.12 ? ["#6d4fb0", "#8c6ed0", "#b59cf0"] : kind < 0.45 ? ["#4f6b3a", "#6b8a4c", "#8fae6a"] : ["#1f5a2e", "#2e7a3d", "#4b9a52"];
  px(ctx, "#00000033", ox + 3, oy + 12, 11, 3);
  px(ctx, "#5b4030", ox + 7, oy + 9, 2, 5);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(ox + 8, oy + 7, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.arc(ox + 7, oy + 6, 5, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, light, ox + 5, oy + 3, 3, 2);
}

/** A 16×16-tile block of the map, drawn once and reused every frame. */
export const CHUNK = 16;

export function renderChunk(map: GameMap, cx: number, cy: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(CHUNK * TILE, CHUNK * TILE);
  for (let y = 0; y < CHUNK; y += 1) {
    for (let x = 0; x < CHUNK; x += 1) {
      const tx = cx * CHUNK + x;
      const ty = cy * CHUNK + y;
      if (tx >= map.width || ty >= map.height) {
        px(ctx, "#2b6cb3", x * TILE, y * TILE, TILE, TILE);
        continue;
      }
      drawTile(ctx, map, tx, ty, x * TILE, y * TILE);
    }
  }
  return canvas;
}

/* =============================================================================
   People
============================================================================= */

/** Character sprites are 16 wide and 24 tall; the bottom 16 sit on the tile. */
export const CHAR_W = 16;
export const CHAR_H = 24;

const charCache = new Map<string, HTMLCanvasElement>();

export function characterSprite(look: Look, dir: Dir, frame: number): HTMLCanvasElement {
  const key = `${look.skin}.${look.hair}.${look.hairColor}.${look.top}.${look.bottom}.${look.acc}.${look.hat}.${dir}.${frame}`;
  const hit = charCache.get(key);
  if (hit) return hit;

  const [canvas, ctx] = makeCanvas(CHAR_W, CHAR_H);
  drawCharacter(ctx, look, dir, frame);
  charCache.set(key, canvas);
  return canvas;
}

function shadeOf(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, dir: Dir, frame: number) {
  const skin = SKIN[look.skin] ?? SKIN[1];
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const top = TOPS[look.top] ?? TOPS[0];
  const bottom = BOTTOMS[look.bottom] ?? BOTTOMS[0];
  const Y = 6; // head top row
  const side = dir === 1 || dir === 2;
  const back = dir === 3;

  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(4, 22, 8, 2);

  // Legs, with a two-frame walk.
  const lift = frame === 1 ? 1 : 0;
  const lift2 = frame === 2 ? 1 : 0;
  if (side) {
    px(ctx, bottom, 6, 17, 4, 4 - lift);
    px(ctx, "#1d1d22", 6 + (frame === 1 ? -1 : frame === 2 ? 1 : 0), 21 - lift, 4, 1);
  } else {
    px(ctx, bottom, 5, 17, 2, 4 - lift);
    px(ctx, bottom, 9, 17, 2, 4 - lift2);
    px(ctx, "#1d1d22", 5, 21 - lift, 2, 1);
    px(ctx, "#1d1d22", 9, 21 - lift2, 2, 1);
  }

  // Backpack behind the body when seen from the back or side.
  if (look.acc === 3 && (back || side)) {
    px(ctx, "#8a5a2b", back ? 5 : dir === 1 ? 10 : 3, 12, back ? 6 : 3, 5);
  }

  // Torso and arms.
  px(ctx, top, 4, 12, 8, 6);
  px(ctx, shadeOf(top, 0.82), 4, 17, 8, 1);
  if (!side) {
    const swing = frame === 0 ? 0 : 1;
    px(ctx, top, 3, 12 + (frame === 1 ? swing : 0), 1, 4);
    px(ctx, top, 12, 12 + (frame === 2 ? swing : 0), 1, 4);
    px(ctx, skin, 3, 16 + (frame === 1 ? swing : 0), 1, 1);
    px(ctx, skin, 12, 16 + (frame === 2 ? swing : 0), 1, 1);
  } else {
    const armX = dir === 1 ? 7 : 8;
    px(ctx, shadeOf(top, 0.9), armX, 12 + (frame ? 1 : 0), 2, 4);
    px(ctx, skin, armX, 16 + (frame ? 1 : 0), 2, 1);
  }
  if (look.acc === 3 && !back && !side) px(ctx, "#8a5a2b", 4, 12, 1, 4);

  // Head: an 8×7 rounded square.
  px(ctx, skin, 4, Y + 1, 8, 5);
  px(ctx, skin, 5, Y, 6, 7);
  px(ctx, skin, 7, Y + 6, 2, 1); // neck

  // Face.
  if (!back) {
    const eye = "#2a1f1a";
    if (side) {
      const ex = dir === 1 ? 5 : 10;
      px(ctx, eye, ex, Y + 3, 1, 2);
      px(ctx, "#f0a0a0", dir === 1 ? 5 : 10, Y + 5, 1, 1);
    } else {
      px(ctx, eye, 6, Y + 3, 1, 2);
      px(ctx, eye, 9, Y + 3, 1, 2);
      px(ctx, "#f0a0a066", 5, Y + 5, 1, 1);
      px(ctx, "#f0a0a066", 10, Y + 5, 1, 1);
    }
  }

  drawHair(ctx, look.hair, hair, dir, Y);

  if (look.acc === 1 && !back) {
    const frame = "#23262d";
    if (side) {
      px(ctx, frame, dir === 1 ? 4 : 9, Y + 3, 3, 1);
      px(ctx, "#9fd6ff", dir === 1 ? 4 : 10, Y + 3, 2, 1);
    } else {
      px(ctx, frame, 5, Y + 3, 6, 1);
      px(ctx, "#9fd6ff", 5, Y + 3, 2, 1);
      px(ctx, "#9fd6ff", 9, Y + 3, 2, 1);
    }
  }
  if (look.acc === 2) {
    px(ctx, "#2b2f36", 4, Y - 1, 8, 1);
    px(ctx, "#ff5c8a", 3, Y + 2, 2, 3);
    px(ctx, "#ff5c8a", 11, Y + 2, 2, 3);
  }

  drawHat(ctx, look.hat, dir, Y);
}

function drawHair(ctx: CanvasRenderingContext2D, style: number, color: string, dir: Dir, Y: number) {
  const hi = shadeOf(color, 1.25);
  const back = dir === 3;
  const side = dir === 1 || dir === 2;
  const nape = dir === 1 ? 10 : 4; // the side of the head facing away

  // The cap of hair every style shares.
  if (style === 1) {
    px(ctx, color, 5, Y - 1, 6, 2);
    px(ctx, color, 4, Y, 8, 1);
  } else {
    px(ctx, color, 5, Y - 2, 6, 1);
    px(ctx, color, 4, Y - 1, 8, 2);
    px(ctx, hi, 6, Y - 2, 2, 1);
  }

  if (back) {
    // From behind: hair over the whole head for everything but a buzz cut.
    px(ctx, color, 4, Y, 8, style === 1 ? 3 : 5);
  } else if (side) {
    px(ctx, color, nape, Y, 2, 4);
    px(ctx, color, dir === 1 ? 4 : 6, Y, 6, 1);
  } else if (style !== 1) {
    // Fringe.
    px(ctx, color, 4, Y + 1, 1, 2);
    px(ctx, color, 11, Y + 1, 1, 2);
    px(ctx, color, 5, Y + 1, 3, 1);
  }

  switch (style) {
    case 2: // bob
      if (!side) {
        px(ctx, color, 3, Y, 1, 6);
        px(ctx, color, 12, Y, 1, 6);
      } else px(ctx, color, nape, Y, 2, 6);
      if (back) px(ctx, color, 4, Y + 5, 8, 1);
      break;
    case 3: // long
      if (!side) {
        px(ctx, color, 3, Y, 1, 10);
        px(ctx, color, 12, Y, 1, 10);
      } else px(ctx, color, nape, Y, 2, 10);
      if (back) px(ctx, color, 4, Y + 5, 8, 5);
      break;
    case 4: // ponytail
      if (back) px(ctx, color, 7, Y + 5, 2, 5);
      else if (side) px(ctx, color, dir === 1 ? 12 : 2, Y + 1, 2, 4);
      else px(ctx, color, 12, Y + 1, 1, 3);
      break;
    case 5: // bun
      px(ctx, color, 6, Y - 4, 4, 2);
      px(ctx, hi, 7, Y - 4, 1, 1);
      break;
    case 6: // curly
      for (let i = 0; i < 5; i += 1) px(ctx, color, 3 + i * 2, Y - 3 + (i % 2), 2, 2);
      if (!side) {
        px(ctx, color, 3, Y, 1, 4);
        px(ctx, color, 12, Y, 1, 4);
      }
      break;
    default:
      break;
  }
}

function drawHat(ctx: CanvasRenderingContext2D, hat: number, dir: Dir, Y: number) {
  switch (hat) {
    case 1: // bucket
      px(ctx, "#e5d3a0", 5, Y - 4, 6, 3);
      px(ctx, "#cdb983", 3, Y - 1, 10, 1);
      break;
    case 2: // akubra
      px(ctx, "#7a4e2d", 5, Y - 5, 6, 3);
      px(ctx, "#4d301b", 5, Y - 3, 6, 1);
      px(ctx, "#6a4327", 1, Y - 2, 14, 1);
      break;
    case 3: // cockatoo crest
      px(ctx, "#ffd84a", 7, Y - 6, 2, 4);
      px(ctx, "#ffd84a", 5, Y - 5, 2, 3);
      px(ctx, "#ffd84a", 9, Y - 5, 2, 3);
      px(ctx, "#fff3b0", 7, Y - 6, 1, 2);
      break;
    case 4: // opera sails
      px(ctx, "#f7f4ec", 4, Y - 4, 2, 3);
      px(ctx, "#f7f4ec", 7, Y - 6, 2, 5);
      px(ctx, "#f7f4ec", 10, Y - 4, 2, 3);
      px(ctx, "#d9d0bd", 8, Y - 6, 1, 5);
      break;
    case 5: // lime cap
      px(ctx, "#c6ff3d", 4, Y - 3, 8, 3);
      if (dir === 0) px(ctx, "#9fd61f", 4, Y, 8, 1);
      else if (dir === 1) px(ctx, "#9fd61f", 1, Y - 1, 4, 1);
      else if (dir === 2) px(ctx, "#9fd61f", 11, Y - 1, 4, 1);
      px(ctx, "#0a0b0d", 7, Y - 2, 2, 1);
      break;
    case 6: // jacaranda crown
      for (let i = 0; i < 5; i += 1) {
        px(ctx, i % 2 ? "#b59cf0" : "#8c6ed0", 3 + i * 2, Y - 2 - (i % 2), 2, 2);
      }
      px(ctx, "#5c9e48", 4, Y - 1, 8, 1);
      break;
    case 7: // coffee cup
      px(ctx, "#f4f1ea", 5, Y - 5, 6, 4);
      px(ctx, "#8a5a2b", 5, Y - 5, 6, 1);
      px(ctx, "#c9a27a", 6, Y - 3, 4, 1);
      px(ctx, "#f4f1ea", 11, Y - 4, 1, 2);
      px(ctx, "#e5e0d6", 4, Y - 1, 8, 1);
      break;
    case 8: // ibis beanie
      px(ctx, "#f2f0ea", 4, Y - 3, 8, 3);
      px(ctx, "#d9d6cd", 4, Y - 1, 8, 1);
      px(ctx, "#1c1c1c", 7, Y - 5, 2, 2);
      break;
    case 9: // beret
      px(ctx, "#8e2f3a", 3, Y - 3, 9, 2);
      px(ctx, "#a93b48", 4, Y - 4, 6, 1);
      px(ctx, "#5c1d25", 7, Y - 5, 1, 1);
      break;
    case 10: // koala ears
      px(ctx, "#8d949c", 2, Y - 3, 3, 3);
      px(ctx, "#8d949c", 11, Y - 3, 3, 3);
      px(ctx, "#e8d3dc", 3, Y - 2, 1, 1);
      px(ctx, "#e8d3dc", 12, Y - 2, 1, 1);
      break;
    default:
      break;
  }
}

/* =============================================================================
   Critters
============================================================================= */

const critterCache = new Map<string, HTMLCanvasElement>();

export function critterSprite(id: CritterId, frame: number): HTMLCanvasElement {
  const key = `${id}.${frame}`;
  const hit = critterCache.get(key);
  if (hit) return hit;

  const wide = id === "whale";
  const [canvas, ctx] = makeCanvas(wide ? 32 : 16, 16);
  const bob = frame % 2;

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  if (!wide) ctx.fillRect(4, 14, 8, 2);

  switch (id) {
    case "ibis":
    case "golden": {
      const body = id === "golden" ? "#f2c94c" : "#f2f0ea";
      const head = id === "golden" ? "#8a6414" : "#1c1c1c";
      px(ctx, body, 5, 7 + bob, 7, 5);
      px(ctx, shadeOf(body.length === 7 ? body : "#f2f0ea", 0.85), 10, 8 + bob, 3, 3);
      px(ctx, head, 3, 4 + bob, 3, 4);
      px(ctx, head, 1, 6 + bob, 2, 1);
      px(ctx, head, 0, 7 + bob, 1, 2);
      px(ctx, "#1c1c1c", 7, 12, 1, 3);
      px(ctx, "#1c1c1c", 9, 12, 1, 3);
      if (id === "golden") px(ctx, "#fff7cc", 7, 7 + bob, 2, 1);
      break;
    }
    case "gull": {
      px(ctx, "#f7f7f5", 5, 7 + bob, 7, 5);
      px(ctx, "#a9b3bd", 8, 7 + bob, 5, 3);
      px(ctx, "#f7f7f5", 3, 5 + bob, 4, 4);
      px(ctx, "#e5533b", 1, 7 + bob, 2, 1);
      px(ctx, "#1c1c1c", 4, 6 + bob, 1, 1);
      px(ctx, "#e5533b", 7, 12, 1, 3);
      px(ctx, "#e5533b", 9, 12, 1, 3);
      break;
    }
    case "cockatoo": {
      px(ctx, "#f5f5f0", 5, 5 + bob, 6, 8);
      px(ctx, "#ffd84a", 6, 1 + bob, 2, 4);
      px(ctx, "#ffd84a", 8, 2 + bob, 2, 3);
      px(ctx, "#1c1c1c", 6, 7 + bob, 1, 1);
      px(ctx, "#3a3a3a", 4, 8 + bob, 2, 2);
      px(ctx, "#8a8a8a", 7, 13, 2, 2);
      break;
    }
    case "lorikeet": {
      px(ctx, "#2f9e44", 5, 6 + bob, 6, 7);
      px(ctx, "#3a5bd9", 5, 3 + bob, 5, 4);
      px(ctx, "#f28c28", 6, 7 + bob, 4, 2);
      px(ctx, "#e03131", 4, 5 + bob, 1, 2);
      px(ctx, "#f2d024", 7, 9 + bob, 2, 1);
      px(ctx, "#1c1c1c", 6, 4 + bob, 1, 1);
      break;
    }
    case "kookaburra": {
      px(ctx, "#8b6a4a", 4, 6 + bob, 8, 7);
      px(ctx, "#efe6d6", 5, 3 + bob, 6, 5);
      px(ctx, "#4a3a2a", 6, 4 + bob, 4, 1);
      px(ctx, "#3a3a3a", 2, 5 + bob, 3, 2);
      px(ctx, "#5c86c9", 10, 8 + bob, 2, 2);
      px(ctx, "#1c1c1c", 7, 5 + bob, 1, 1);
      break;
    }
    case "dragon": {
      px(ctx, "#7a8a6a", 3, 8, 9, 4);
      px(ctx, "#5f6e52", 3, 8, 9, 1);
      px(ctx, "#7a8a6a", 0, 9, 3, 2);
      px(ctx, "#7a8a6a", 12, 9 + bob, 4, 1);
      px(ctx, "#b8563a", 5, 10, 3, 2);
      px(ctx, "#5f6e52", 4, 12, 1, 2);
      px(ctx, "#5f6e52", 10, 12, 1, 2);
      px(ctx, "#1c1c1c", 1, 9, 1, 1);
      break;
    }
    case "turkey": {
      px(ctx, "#1f1f22", 4, 6 + bob, 9, 7);
      px(ctx, "#1f1f22", 12, 4 + bob, 3, 7);
      px(ctx, "#d33a2c", 3, 3 + bob, 3, 3);
      px(ctx, "#f2c230", 3, 6 + bob, 2, 2);
      px(ctx, "#6a6a6a", 6, 13, 1, 2);
      px(ctx, "#6a6a6a", 9, 13, 1, 2);
      break;
    }
    case "magpie": {
      px(ctx, "#1a1a1a", 4, 6 + bob, 8, 7);
      px(ctx, "#f5f5f5", 8, 6 + bob, 4, 2);
      px(ctx, "#f5f5f5", 10, 9 + bob, 3, 3);
      px(ctx, "#1a1a1a", 3, 4 + bob, 4, 4);
      px(ctx, "#cfd4da", 1, 6 + bob, 2, 1);
      px(ctx, "#b0302a", 4, 5 + bob, 1, 1);
      px(ctx, "#1a1a1a", 6, 13, 1, 2);
      px(ctx, "#1a1a1a", 9, 13, 1, 2);
      break;
    }
    case "whale": {
      px(ctx, "#1f3550", 4, 8, 24, 5);
      px(ctx, "#2b4a70", 6, 7, 18, 2);
      px(ctx, "#1f3550", 26, 6, 4, 3);
      px(ctx, "#1f3550", 28, 12, 4, 2);
      px(ctx, "#8fc8ef", 2, 12, 28, 1);
      if (bob) {
        px(ctx, "#d9f0ff", 8, 2, 1, 5);
        px(ctx, "#d9f0ff", 6, 1, 1, 2);
        px(ctx, "#d9f0ff", 10, 1, 1, 2);
      }
      break;
    }
  }

  critterCache.set(key, canvas);
  return canvas;
}

/* =============================================================================
   Landmarks and props
============================================================================= */

const propCache = new Map<string, HTMLCanvasElement>();

function cached(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = propCache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(w, h);
  draw(ctx);
  propCache.set(key, canvas);
  return canvas;
}

/**
 * The Opera House, over its real footprint.
 *
 * Two rows of shells — the Concert Hall to the west, the smaller theatre to
 * the east — on the sandstone podium, with the monumental steps along the
 * south. Drawn in three-quarter view so the shells rise off the page, which
 * is the one thing a flat top-down view of it could never show.
 */
export function operaHouse(wTiles: number, hTiles: number): { canvas: HTMLCanvasElement; lift: number } {
  const lift = 64; // art pixels the shells rise above the footprint
  const W = wTiles * TILE;
  const H = hTiles * TILE + lift;
  const canvas = cached(`opera.${wTiles}.${hTiles}`, W, H, (ctx) => {
    // Podium, and the Monumental Steps along its south side.
    px(ctx, "#d8c9a6", 0, lift, W, H - lift);
    px(ctx, "#e6d9ba", 0, lift, W, 3);
    px(ctx, "#c5b48d", 0, H - 26, W, 26);
    for (let row = H - 26; row < H; row += 3) px(ctx, "#b3a178", 0, row, W, 1);

    const shell = (cx: number, base: number, halfW: number, height: number) => {
      // Shadow side.
      ctx.fillStyle = "#d9d2c1";
      ctx.beginPath();
      ctx.moveTo(cx - halfW, base);
      ctx.quadraticCurveTo(cx - halfW * 0.7, base - height * 0.75, cx + halfW * 0.05, base - height);
      ctx.quadraticCurveTo(cx + halfW * 0.55, base - height * 0.5, cx + halfW, base);
      ctx.closePath();
      ctx.fill();
      // Sunlit face.
      ctx.fillStyle = "#faf7ef";
      ctx.beginPath();
      ctx.moveTo(cx - halfW + 2, base);
      ctx.quadraticCurveTo(cx - halfW * 0.65, base - height * 0.72, cx + halfW * 0.02, base - height + 2);
      ctx.quadraticCurveTo(cx - halfW * 0.05, base - height * 0.45, cx + halfW * 0.1, base);
      ctx.closePath();
      ctx.fill();
      // The chevron tiling that makes the shells glitter.
      ctx.strokeStyle = "#e8e1d0";
      ctx.lineWidth = 1;
      for (let k = 1; k < 5; k += 1) {
        const y = base - (height * k) / 5;
        ctx.beginPath();
        ctx.moveTo(cx - halfW * (1 - k * 0.17), y + 3);
        ctx.lineTo(cx, y);
        ctx.stroke();
      }
      // Glass wall where the shell meets the podium.
      ctx.fillStyle = "#6f8aa3";
      ctx.fillRect(Math.round(cx - halfW * 0.8), base - 3, Math.round(halfW * 1.6), 3);
    };

    const body = H - lift - 26;
    // Concert Hall to the west, the Joan Sutherland Theatre to the east,
    // north (back) to south (front) so the nearer shells overlap.
    const west: [number, number][] = [[0.2, 64], [0.38, 92], [0.56, 80], [0.72, 54]];
    const east: [number, number][] = [[0.26, 54], [0.44, 74], [0.62, 64], [0.78, 42]];
    for (let i = 0; i < 4; i += 1) {
      shell(W * 0.32, lift + body * west[i][0] + 24, W * 0.2, west[i][1]);
      shell(W * 0.7, lift + body * east[i][0] + 24, W * 0.16, east[i][1]);
    }
    // The small restaurant shells at the south-west corner.
    shell(W * 0.14, H - 30, W * 0.08, 26);
  });
  return { canvas, lift };
}

/** Luna Park's grinning entrance: a face between two towers. */
export function lunaFace(): HTMLCanvasElement {
  return cached("luna", 64, 72, (ctx) => {
    for (const x of [0, 52]) {
      px(ctx, "#f2efe6", x, 12, 12, 60);
      px(ctx, "#e5533b", x, 8, 12, 6);
      px(ctx, "#3a8fd9", x + 3, 0, 6, 8);
      for (let y = 18; y < 70; y += 8) px(ctx, "#f2c230", x + 3, y, 6, 3);
    }
    ctx.fillStyle = "#f2c230";
    ctx.beginPath();
    ctx.arc(32, 32, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e5533b";
    ctx.fillRect(18, 40, 28, 10);
    ctx.fillStyle = "#f7f4ec";
    ctx.fillRect(20, 42, 24, 4);
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(22, 46, 20, 3);
    ctx.fillStyle = "#3a8fd9";
    ctx.fillRect(21, 22, 7, 7);
    ctx.fillRect(36, 22, 7, 7);
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(23, 24, 3, 3);
    ctx.fillRect(38, 24, 3, 3);
    ctx.fillStyle = "#b3542e";
    ctx.fillRect(14, 12, 36, 5);
  });
}

/** The Avenue: the round building at 465 Victoria Avenue, with the flag out. */
export function roundBuilding(): HTMLCanvasElement {
  return cached("avenue", 80, 88, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(40, 76, 36, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Drum.
    px(ctx, "#e9dfc9", 8, 36, 64, 40);
    for (let x = 12; x < 70; x += 8) px(ctx, "#7fb3d9", x, 44, 5, 22);
    px(ctx, "#c9bca0", 8, 72, 64, 4);
    // Roof.
    ctx.fillStyle = "#d8cdb4";
    ctx.beginPath();
    ctx.ellipse(40, 36, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#efe6d2";
    ctx.beginPath();
    ctx.ellipse(40, 34, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Vines over the glass room.
    for (let i = 0; i < 9; i += 1) px(ctx, i % 2 ? "#4b9a52" : "#2e7a3d", 10 + i * 7, 38 + (i % 3), 5, 3);
    // The flag.
    px(ctx, "#3a3f47", 62, 0, 2, 34);
    px(ctx, "#c6ff3d", 64, 2, 16, 10);
    px(ctx, "#0a0b0d", 67, 5, 2, 4);
    px(ctx, "#0a0b0d", 71, 5, 2, 4);
    px(ctx, "#0a0b0d", 75, 5, 2, 4);
    // Door.
    px(ctx, "#3a3f47", 34, 60, 12, 16);
    px(ctx, "#c6ff3d", 38, 56, 4, 2);
  });
}

/** A market stall with a striped awning. */
export function stall(colorIndex: number): HTMLCanvasElement {
  const colors = ["#e5533b", "#3a8fd9", "#2f9e44", "#f28c28", "#7b5cd6", "#e58fb4"];
  const c = colors[colorIndex % colors.length];
  return cached(`stall.${colorIndex % colors.length}`, 20, 26, (ctx) => {
    px(ctx, "rgba(0,0,0,0.25)", 1, 23, 18, 3);
    px(ctx, "#8a6442", 2, 14, 16, 9);
    px(ctx, "#a47a52", 2, 14, 16, 2);
    px(ctx, "#5b4030", 2, 6, 1, 17);
    px(ctx, "#5b4030", 17, 6, 1, 17);
    for (let x = 0; x < 20; x += 4) {
      px(ctx, c, x, 2, 2, 7);
      px(ctx, "#f7f4ec", x + 2, 2, 2, 7);
    }
    px(ctx, shadeOf(c, 0.75), 0, 9, 20, 1);
    px(ctx, "#f2c230", 5, 16, 3, 3);
    px(ctx, "#8fc8ef", 11, 16, 4, 3);
  });
}

export function noticeboard(): HTMLCanvasElement {
  return cached("board", 20, 26, (ctx) => {
    px(ctx, "rgba(0,0,0,0.25)", 2, 23, 16, 3);
    px(ctx, "#5b4030", 3, 14, 2, 10);
    px(ctx, "#5b4030", 15, 14, 2, 10);
    px(ctx, "#8a6442", 0, 2, 20, 14);
    px(ctx, "#6f4f33", 0, 2, 20, 1);
    px(ctx, "#f7f4ec", 2, 4, 5, 5);
    px(ctx, "#fff3b0", 8, 5, 5, 6);
    px(ctx, "#c9e8ff", 14, 4, 4, 5);
    px(ctx, "#ffd1dc", 3, 10, 5, 4);
    px(ctx, "#e5533b", 4, 4, 1, 1);
    px(ctx, "#e5533b", 10, 5, 1, 1);
  });
}

/** A photo spot: a small camera on a post. */
export function cameraSign(): HTMLCanvasElement {
  return cached("camera", 16, 26, (ctx) => {
    px(ctx, "rgba(0,0,0,0.25)", 4, 23, 8, 3);
    px(ctx, "#6a707a", 7, 12, 2, 12);
    px(ctx, "#2b2f36", 1, 3, 14, 9);
    px(ctx, "#3a3f47", 1, 3, 14, 1);
    px(ctx, "#5a606a", 3, 1, 4, 2);
    px(ctx, "#9fd6ff", 6, 5, 5, 5);
    px(ctx, "#ffffff", 7, 6, 1, 1);
    px(ctx, "#ff5c8a", 12, 4, 2, 1);
  });
}

/** A transport sign on a post: the station's name, or the ferry's. */
export function signpost(kind: "train" | "ferry"): HTMLCanvasElement {
  return cached(`sign.${kind}`, 16, 28, (ctx) => {
    px(ctx, "rgba(0,0,0,0.25)", 4, 25, 8, 3);
    px(ctx, "#6a707a", 7, 10, 2, 16);
    px(ctx, kind === "train" ? "#f28c28" : "#2f9e44", 1, 0, 14, 12);
    px(ctx, "#ffffff", 4, 2, 8, 2);
    if (kind === "train") px(ctx, "#ffffff", 7, 4, 2, 6);
    else {
      px(ctx, "#ffffff", 3, 7, 10, 2);
      px(ctx, "#ffffff", 5, 5, 6, 2);
    }
  });
}

/** A Sydney ferry: green hull, cream cabin, going left or right. */
export function ferrySprite(facingRight: boolean): HTMLCanvasElement {
  return cached(`ferry.${facingRight}`, 40, 20, (ctx) => {
    px(ctx, "#1f5796", 2, 16, 36, 2);
    px(ctx, "#1f6b3a", 2, 11, 36, 5);
    px(ctx, "#f2c230", 2, 11, 36, 1);
    px(ctx, "#f2ead2", 7, 4, 26, 7);
    for (let x = 9; x < 32; x += 4) px(ctx, "#5b7f9e", x, 6, 2, 3);
    px(ctx, "#1f6b3a", 14, 1, 12, 3);
    px(ctx, "#f7f4ec", facingRight ? 30 : 6, 12, 3, 1);
    if (!facingRight) {
      // Mirror by redrawing is cheaper than a transform for a sprite this size.
      const data = ctx.getImageData(0, 0, 40, 20);
      const out = ctx.createImageData(40, 20);
      for (let y = 0; y < 20; y += 1)
        for (let x = 0; x < 40; x += 1)
          for (let c = 0; c < 4; c += 1) out.data[(y * 40 + x) * 4 + c] = data.data[(y * 40 + (39 - x)) * 4 + c];
      ctx.putImageData(out, 0, 0);
    }
  });
}

/** A Vibe shard: a small lime crystal. */
export function shardSprite(frame: number): HTMLCanvasElement {
  return cached(`shard.${frame % 4}`, 12, 16, (ctx) => {
    const glow = ["#c6ff3d", "#d7ff6b", "#eaffb0", "#d7ff6b"][frame % 4];
    px(ctx, "rgba(0,0,0,0.2)", 3, 13, 6, 2);
    px(ctx, glow, 5, 1, 2, 2);
    px(ctx, glow, 4, 3, 4, 6);
    px(ctx, "#9fd61f", 6, 3, 2, 6);
    px(ctx, glow, 5, 9, 2, 2);
    px(ctx, "#ffffff", 4, 4, 1, 2);
  });
}

/* =============================================================================
   The Harbour Bridge
============================================================================= */

export type BridgeGeometry = {
  /** Centre of the south and north pylon pairs, in tiles. */
  south: [number, number];
  north: [number, number];
  /** Half the deck's width, in tiles, measured across the span. */
  half: number;
};

/**
 * The span, from the real pylons the map generator found, and the deck's
 * width measured off the map at mid-span.
 */
export function bridgeGeometry(map: GameMap & { bridge?: { south: [number, number]; north: [number, number] } | null }): BridgeGeometry | null {
  if (!map.bridge) return null;
  const { south, north } = map.bridge;
  const dx = north[0] - south[0];
  const dy = north[1] - south[1];
  const length = Math.hypot(dx, dy);
  const nx = -dy / length;
  const ny = dx / length;
  const mx = (south[0] + north[0]) / 2;
  const my = (south[1] + north[1]) / 2;

  const extent = (sign: number) => {
    let d = 0;
    while (d < 12 && "Hh".includes(tileAt(map, Math.floor(mx + nx * sign * (d + 0.5)), Math.floor(my + ny * sign * (d + 0.5))))) d += 0.5;
    return d;
  };

  return { south, north, half: Math.max(2, (extent(1) + extent(-1)) / 2) };
}

type Frame = {
  sx: number;
  sy: number;
  ax: number;
  ay: number;
  nx: number;
  ny: number;
  length: number;
};

function frameOf(geo: BridgeGeometry): Frame {
  const [sx, sy] = geo.south;
  const dx = geo.north[0] - sx;
  const dy = geo.north[1] - sy;
  const length = Math.hypot(dx, dy);
  return { sx, sy, ax: dx / length, ay: dy / length, nx: -dy / length, ny: dx / length, length };
}

/**
 * The deck, as one straight surface from beyond one pair of pylons to beyond
 * the other: cycleway and two rail tracks on the west, the roadway, the
 * footway on the east — the real order, west to east. Drawn under everybody,
 * over the tiles, so the stepped edges of a rasterised diagonal disappear.
 * Its shadow falls east on the water, and the arch's shadow with it: from
 * straight above, the shadow is where the famous shape shows.
 */
export function drawBridgeDeck(
  ctx: CanvasRenderingContext2D,
  geo: BridgeGeometry,
  toScreen: (tx: number, ty: number) => [number, number],
  unit: number,
) {
  const f = frameOf(geo);
  const half = geo.half;
  const point = (along: number, across: number): [number, number] =>
    toScreen(f.sx + f.ax * along + f.nx * across, f.sy + f.ay * along + f.ny * across);
  const quad = (a0: number, a1: number, c0: number, c1: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const pts = [point(a0, c0), point(a1, c0), point(a1, c1), point(a0, c1)];
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  const strip = (a0: number, a1: number, across: number, color: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * unit;
    ctx.setLineDash(dash.map((d) => d * unit));
    ctx.beginPath();
    const [x0, y0] = point(a0, across);
    const [x1, y1] = point(a1, across);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const start = -4;
  const end = f.length + 4;
  const rise = f.length * 0.26;

  // Shadows on the water, cast east: the deck's, then the arch's.
  quad(start, end, half + 0.4, half + 1.6, "rgba(10, 25, 50, 0.22)");
  ctx.fillStyle = "rgba(10, 25, 50, 0.2)";
  ctx.beginPath();
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    const [x, y] = point(t * f.length, half + 1.2 + Math.sin(Math.PI * t) * rise * 0.45);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = 48; i >= 0; i -= 1) {
    const t = i / 48;
    const [x, y] = point(t * f.length, half + 1.2 + Math.sin(Math.PI * t) * rise * 0.45 - 0.8 - Math.sin(Math.PI * t) * 0.6);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Deck surfaces, west to east.
  quad(start, end, -half, half, "#5b6069");
  quad(start, end, -half, -half * 0.78, "#6b5e58"); // cycleway
  quad(start, end, half * 0.8, half, "#8a8f98"); // footway
  for (const track of [-half * 0.62, -half * 0.36]) {
    // Sleepers, then rails.
    for (let a = start; a < end; a += 0.3) strip(a, a + 0.12, track, "#5a4331", 7);
    strip(start, end, track - 0.14, "#c2c8cf", 1);
    strip(start, end, track + 0.14, "#c2c8cf", 1);
  }
  for (const lane of [0, half * 0.3, half * 0.55]) strip(start, end, lane, "#e8e2c8", 1, [6, 6]);
  strip(start, end, -half, "#9aa1ab", 2);
  strip(start, end, half, "#9aa1ab", 2);
  strip(start, end, half * 0.8, "#b8bec6", 1);
}

/**
 * The steel, over everything else: an arch seen from above is two ribs along
 * the edges of the deck and the bracing between them — heaviest mid-span,
 * where the arch is highest — then the four granite pylons at the ends.
 */
export function drawBridge(
  ctx: CanvasRenderingContext2D,
  geo: BridgeGeometry,
  toScreen: (tx: number, ty: number) => [number, number],
  unit: number,
) {
  const f = frameOf(geo);
  const half = geo.half + 0.25;
  const tilePx = TILE * unit;
  const point = (along: number, across: number): [number, number] =>
    toScreen(f.sx + f.ax * along + f.nx * across, f.sy + f.ay * along + f.ny * across);
  const line = (a: [number, number], b: [number, number], color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * unit;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };

  ctx.lineCap = "round";

  // Bracing across the deck, only where the arch is well above it.
  ctx.globalAlpha = 0.85;
  for (let along = f.length * 0.14; along <= f.length * 0.86; along += 1.6) {
    const t = along / f.length;
    const weight = 1 + Math.sin(Math.PI * t) * 1.5;
    line(point(along, -half), point(along + 0.8, half), "#6f7782", weight);
    line(point(along + 0.8, -half), point(along, half), "#6f7782", weight * 0.7);
  }
  ctx.globalAlpha = 1;

  // The two ribs: a trussed band along each edge.
  for (const side of [-1, 1]) {
    const outer = side * (half + 0.35);
    const inner = side * (half - 0.25);
    for (let along = 0; along < f.length; along += 1) {
      line(point(along, outer), point(along + 1, inner), "#5d646e", 1.2);
      line(point(along, inner), point(along + 1, outer), "#5d646e", 1.2);
    }
    line(point(0, outer), point(f.length, outer), "#4f565f", 3);
    line(point(0, inner), point(f.length, inner), "#8a929d", 3);
    line(point(0, inner), point(f.length, inner), "#b3bbc5", 1);
  }

  // Pylons: granite, a pair at each end, standing either side of the deck.
  for (const along of [0, f.length]) {
    for (const side of [-1, 1]) {
      const [cx, cy] = point(along, side * (half + 1.4));
      const w = 2.4 * tilePx;
      const h = 4.2 * tilePx;
      const x = cx - w / 2;
      const base = cy + 1.1 * tilePx;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x + 0.8 * tilePx, base - 0.7 * tilePx, w, 1.1 * tilePx);
      ctx.fillStyle = "#cbb88f";
      ctx.fillRect(x, base - h, w, h);
      ctx.fillStyle = "#b19d73";
      ctx.fillRect(x + w * 0.68, base - h, w * 0.32, h);
      ctx.fillStyle = "#e0cfa8";
      ctx.fillRect(x, base - h, w, 3 * unit);
      ctx.fillStyle = "#a08d64";
      for (let k = 0; k < 3; k += 1) ctx.fillRect(x + (5 + k * 11) * unit, base - h + 10 * unit, 5 * unit, 10 * unit);
      ctx.fillRect(x, base - h * 0.42, w, 2 * unit);
    }
  }
}

/** Whether a tile is a sensible place for a person to idle: not in a road. */
export function isStandingTile(map: GameMap, x: number, y: number): boolean {
  return isWalkable(map, x, y) && ".pgsPw".includes(tileAt(map, x, y));
}

/** A stable look for somebody who is not the player, from a string. */
export function lookFromSeed(seed: string): Look {
  const h = hashString(seed);
  return {
    skin: h % 5,
    hair: (h >>> 3) % 7,
    hairColor: (h >>> 6) % 5,
    top: (h >>> 9) % 8,
    bottom: (h >>> 12) % 5,
    acc: (h >>> 15) % 4,
    hat: 0,
    pet: -1,
  };
}
