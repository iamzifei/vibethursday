/**
 * The two images /play hands you to keep: the share poster, and postcards.
 *
 * Both are drawn in the browser for the same reason the weekly poster is (see
 * canvas-kit.ts): the text is Chinese, and the only place a Chinese font is
 * guaranteed is the device already showing Chinese.
 *
 * The pictures are side-on rather than the game's top-down view, because
 * side-on is where the bridge is the Coathanger and the Opera House is sails
 * — the shapes everybody knows. Each is drawn at a low native resolution and
 * scaled up with smoothing off, the same trick that makes the game pixel art.
 */

import { ACCENT, FG1, FG2, INK, MONO, SANS, SPARK, wrap } from "@/components/canvas-kit";
import type { Look } from "@/lib/game/protocol";
import { PETS } from "@/lib/game/protocol";
import { characterSprite, critterSprite } from "./art";
import { iconCanvas } from "./icons";

/* =============================================================================
   Scene pieces, in art pixels
============================================================================= */

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

type Mood = "golden" | "day" | "dusk";

const SKIES: Record<Mood, string[]> = {
  golden: ["#1f2a6b", "#2f3a86", "#4a4596", "#6e4f9e", "#9a5a9b", "#c96a8c", "#ee8570", "#ffa45e", "#ffc46b"],
  day: ["#3f8fd8", "#4d9ade", "#5ea6e4", "#72b3ea", "#88c0ef", "#9ecdf3", "#b5d9f6", "#cbe4f8", "#dcedf9"],
  dusk: ["#141b45", "#1c2358", "#2a2b6a", "#3d3278", "#583a84", "#7a4288", "#a24c86", "#cc5f7c", "#ec7c70"],
};

function sky(ctx: Ctx, w: number, horizon: number, mood: Mood) {
  const bands = SKIES[mood];
  const h = horizon / bands.length;
  bands.forEach((color, i) => px(ctx, color, 0, i * h, w, h + 1));
  if (mood !== "day") for (const [x, y] of [[20, 12], [48, 26], [90, 8], [140, 20], [30, 40], [200, 14]]) if (x < w) px(ctx, "#dfe6ff", x, y);
}

function sun(ctx: Ctx, x: number, y: number, r: number, mood: Mood) {
  ctx.fillStyle = mood === "day" ? "#fff6c9" : "#ffe29a";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function water(ctx: Ctx, w: number, top: number, h: number, mood: Mood, sunX?: number) {
  const bands = mood === "day" ? ["#2a78c2", "#2670b8", "#2268ad", "#1f60a2", "#1b5897"] : ["#3c3f8f", "#35428f", "#2d4a92", "#274f93", "#215494"];
  const bh = h / bands.length;
  bands.forEach((color, i) => px(ctx, color, 0, top + i * bh, w, bh + 1));
  if (sunX !== undefined) {
    for (let y = top + 2; y < top + h; y += 3) {
      const lw = 6 + ((y * 7) % 11);
      px(ctx, mood === "day" ? "#e8f4ff" : "#ffc46b", sunX - lw / 2 + ((y * 13) % 5) - 2, y, lw, 1);
    }
  }
  for (let i = 0; i < w / 6; i += 1) px(ctx, mood === "day" ? "#6fb2ee" : "#6f7ac8", (i * 53) % w, top + 4 + ((i * 29) % (h - 6)), 4, 1);
}

function towers(ctx: Ctx, x0: number, x1: number, base: number, tall: number, mood: Mood) {
  const body = mood === "day" ? "#8fa3b8" : "#5b4a86";
  const glass = mood === "day" ? "#c7d6e4" : "#8d7bb8";
  for (let x = x0, i = 0; x < x1; i += 1) {
    const w = 8 + ((i * 7) % 7);
    const h = tall * (0.45 + ((i * 37) % 55) / 100);
    px(ctx, body, x, base - h, w, h);
    for (let wy = base - h + 3; wy < base - 2; wy += 4) px(ctx, glass, x + 2, wy, w - 4, 1);
    x += w + 2;
  }
}

/** The bridge side on, from `left` to `right`, deck at `deckY`. */
function bridge(ctx: Ctx, left: number, right: number, deckY: number, rise: number, color = "#2c2644", stone = "#6d5a78") {
  const span0 = left + 14;
  const span1 = right - 14;
  const archAt = (x: number) => {
    const t = (x - span0) / (span1 - span0);
    return deckY + 8 - Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * rise;
  };
  for (let x = span0 + 6; x < span1 - 4; x += 5) px(ctx, color, x, archAt(x), 1, Math.max(0, deckY - archAt(x)));
  for (let x = span0; x <= span1; x += 1) {
    const y = archAt(x);
    px(ctx, color, x, y, 1, 3);
    px(ctx, color, x, y + 7 + (x % 6 < 3 ? 0 : 1), 1, 2);
    if (x % 6 === 0) px(ctx, color, x, y, 1, 9);
  }
  px(ctx, color, left, deckY, right - left, 4);
  for (const x of [left - 4, right - 16]) {
    px(ctx, stone, x, deckY - 30, 20, 50);
    px(ctx, "#ffffff22", x, deckY - 30, 20, 2);
    px(ctx, "#00000033", x + 13, deckY - 30, 7, 50);
    for (let k = 0; k < 3; k += 1) px(ctx, "#00000044", x + 3 + k * 6, deckY - 24, 3, 8);
  }
}

/** The Opera House side on: podium and five sails, `s` scales it. */
function opera(ctx: Ctx, x: number, base: number, s: number, lit = "#fbf8f0", shade = "#e8e1d0") {
  px(ctx, "#d9b98a", x - 8 * s, base, 128 * s, 12 * s);
  px(ctx, "#c29f6f", x - 8 * s, base + 10 * s, 128 * s, 3 * s);
  const sail = (sx: number, w: number, h: number) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(x + sx * s, base);
    ctx.quadraticCurveTo(x + (sx + w * 0.15) * s, base - h * 0.8 * s, x + (sx + w * 0.85) * s, base - h * s);
    ctx.quadraticCurveTo(x + (sx + w * 0.7) * s, base - h * 0.4 * s, x + (sx + w) * s, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(x + (sx + 2) * s, base);
    ctx.quadraticCurveTo(x + (sx + w * 0.2) * s, base - h * 0.7 * s, x + (sx + w * 0.8) * s, base - (h - 2) * s);
    ctx.quadraticCurveTo(x + (sx + w * 0.45) * s, base - h * 0.35 * s, x + (sx + w * 0.5) * s, base);
    ctx.closePath();
    ctx.fill();
  };
  sail(0, 30, 38);
  sail(20, 34, 50);
  sail(42, 30, 42);
  sail(64, 26, 30);
  sail(84, 20, 20);
}

function ferry(ctx: Ctx, x: number, y: number) {
  px(ctx, "#1f6b3a", x, y, 34, 5);
  px(ctx, "#f2c230", x, y, 34, 1);
  px(ctx, "#f2ead2", x + 5, y - 6, 24, 6);
  for (let wx = x + 7; wx < x + 27; wx += 4) px(ctx, "#5b7f9e", wx, y - 4, 2, 2);
  px(ctx, "#1f6b3a", x + 11, y - 9, 12, 3);
  px(ctx, "#ffffff55", x - 2, y + 5, 38, 1);
}

function gulls(ctx: Ctx, points: [number, number][], color = "#2c2644") {
  for (const [x, y] of points) {
    px(ctx, color, x, y, 3, 1);
    px(ctx, color, x + 3, y + 1, 1, 1);
    px(ctx, color, x + 4, y, 3, 1);
  }
}

function tree(ctx: Ctx, x: number, base: number, r: number, color = "#2e7a3d") {
  px(ctx, "#5b4030", x - 1, base - r, 3, r);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, base - r - r * 0.6, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff22";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, base - r - r * 0.9, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function ground(ctx: Ctx, w: number, top: number, h: number, color: string, edge: string) {
  px(ctx, color, 0, top, w, h);
  px(ctx, edge, 0, top, w, 2);
  for (let x = 0; x < w; x += 12) px(ctx, "#00000022", x, top + 6, 1, h);
}

function lunaFace(ctx: Ctx, x: number, base: number) {
  // Towers either side, then the grinning face between them.
  for (const tx of [x - 30, x + 22]) {
    px(ctx, "#f2efe6", tx, base - 56, 10, 56);
    px(ctx, "#e5533b", tx, base - 60, 10, 5);
    px(ctx, "#3a8fd9", tx + 2, base - 66, 6, 6);
    for (let y = base - 50; y < base; y += 8) px(ctx, "#f2c230", tx + 2, y, 6, 3);
  }
  ctx.fillStyle = "#f2c230";
  ctx.beginPath();
  ctx.arc(x, base - 30, 20, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, "#3a8fd9", x - 11, base - 40, 7, 7);
  px(ctx, "#3a8fd9", x + 4, base - 40, 7, 7);
  px(ctx, "#1c1c1c", x - 9, base - 38, 3, 3);
  px(ctx, "#1c1c1c", x + 6, base - 38, 3, 3);
  px(ctx, "#e5533b", x - 13, base - 24, 26, 9);
  px(ctx, "#f7f4ec", x - 11, base - 22, 22, 4);
  px(ctx, "#b3542e", x - 17, base - 52, 34, 4);
  // Ferris wheel behind.
  ctx.strokeStyle = "#f2efe6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + 52, base - 44, 22, 0, Math.PI * 2);
  ctx.stroke();
  for (let a = 0; a < 8; a += 1) {
    ctx.beginPath();
    ctx.moveTo(x + 52, base - 44);
    ctx.lineTo(x + 52 + Math.cos((a * Math.PI) / 4) * 22, base - 44 + Math.sin((a * Math.PI) / 4) * 22);
    ctx.stroke();
    px(ctx, a % 2 ? "#e5533b" : "#3a8fd9", x + 50 + Math.cos((a * Math.PI) / 4) * 22, base - 46 + Math.sin((a * Math.PI) / 4) * 22, 4, 4);
  }
}

function market(ctx: Ctx, x0: number, base: number) {
  const colors = ["#e5533b", "#3a8fd9", "#2f9e44", "#f28c28", "#7b5cd6"];
  for (let i = 0; i < 5; i += 1) {
    const x = x0 + i * 34;
    px(ctx, "#8a6442", x, base - 14, 28, 14);
    for (let k = 0; k < 28; k += 4) {
      px(ctx, colors[i], x + k, base - 26, 2, 8);
      px(ctx, "#f7f4ec", x + k + 2, base - 26, 2, 8);
    }
    px(ctx, "#f2c230", x + 5, base - 11, 5, 4);
    px(ctx, "#8fc8ef", x + 16, base - 11, 6, 4);
  }
}

/** The player — and pet — at `scale` art pixels per sprite pixel. */
function people(ctx: Ctx, looks: Look[], x: number, base: number, scale: number) {
  looks.forEach((look, i) => {
    const sprite = characterSprite(look, 0, 0);
    const sx = x + i * sprite.width * scale * 1.1;
    ctx.drawImage(sprite, sx, base - sprite.height * scale + 4, sprite.width * scale, sprite.height * scale);
    const pet = PETS[look.pet];
    if (pet && i === 0) {
      const petSprite = critterSprite(pet, 0);
      ctx.drawImage(petSprite, sx - petSprite.width - 2, base - petSprite.height + 3, petSprite.width, petSprite.height);
    }
  });
}

/* =============================================================================
   Scenes
============================================================================= */

export type SceneId = "kirribilli" | "forecourt" | "lunapark" | "farmcove" | "mall" | "bridge";

/** Draws one landmark scene into an art-resolution canvas `w`×`h`. */
function scene(ctx: Ctx, id: SceneId, w: number, h: number, looks: Look[]) {
  const horizon = Math.round(h * 0.58);
  switch (id) {
    case "kirribilli": {
      // The classic: Opera House and bridge in one frame, from across the water.
      sky(ctx, w, horizon, "golden");
      sun(ctx, w * 0.8, horizon - 14, 16, "golden");
      towers(ctx, w * 0.42, w * 0.7, horizon, 34, "golden");
      water(ctx, w, horizon, h - horizon, "golden", w * 0.8);
      bridge(ctx, 14, w * 0.66, horizon - 14, horizon - 70);
      ferry(ctx, w * 0.27, horizon + 18);
      opera(ctx, w * 0.56, horizon + 44, 1);
      ground(ctx, w, h - 30, 30, "#6f5a6a", "#8a7280");
      gulls(ctx, [[60, 40], [70, 46], [w - 34, 60]]);
      people(ctx, looks, w * 0.42, h - 30, 1.6);
      break;
    }
    case "forecourt": {
      // Close up: the sails fill the sky.
      sky(ctx, w, horizon + 20, "day");
      sun(ctx, w * 0.12, 26, 12, "day");
      water(ctx, w, horizon + 20, 20, "day");
      opera(ctx, w * 0.08, horizon + 36, 1.9);
      ground(ctx, w, h - 34, 34, "#c9a97a", "#e0c79c");
      for (let y = h - 30; y < h; y += 5) px(ctx, "#b3935f", 0, y, w, 1);
      gulls(ctx, [[w - 60, 30], [w - 48, 38]], "#1c3550");
      people(ctx, looks, w * 0.66, h - 34, 1.8);
      break;
    }
    case "lunapark": {
      sky(ctx, w, horizon, "dusk");
      water(ctx, w, horizon, 24, "dusk");
      bridge(ctx, w * 0.5, w + 40, horizon - 10, horizon - 60, "#241f3d", "#5a4a68");
      lunaFace(ctx, w * 0.3, h - 32);
      ground(ctx, w, h - 32, 32, "#5a4658", "#7a6278");
      for (let x = 8; x < w; x += 16) px(ctx, x % 32 ? "#ffd98a" : "#ff8ab0", x, h - 30, 3, 3);
      people(ctx, looks, w * 0.62, h - 32, 1.6);
      break;
    }
    case "farmcove": {
      // From the Botanic Garden: both icons across the cove, framed by fig trees.
      sky(ctx, w, horizon, "day");
      sun(ctx, w * 0.2, 30, 12, "day");
      water(ctx, w, horizon, h - horizon, "day");
      bridge(ctx, 18, w * 0.5, horizon - 8, horizon - 60, "#3d4c63", "#b8a684");
      opera(ctx, w * 0.5, horizon + 12, 0.9);
      ferry(ctx, w * 0.2, horizon + 26);
      ground(ctx, w, h - 30, 30, "#5c9e48", "#78b862");
      tree(ctx, 16, h - 26, 16, "#1f5a2e");
      tree(ctx, w - 14, h - 26, 18, "#2e7a3d");
      people(ctx, looks, w * 0.66, h - 30, 1.6);
      break;
    }
    case "mall": {
      // Chatswood: towers, the station, the Thursday market.
      sky(ctx, w, horizon + 30, "golden");
      sun(ctx, w * 0.85, horizon + 4, 14, "golden");
      towers(ctx, 4, w, horizon + 30, 90, "golden");
      px(ctx, "#3a3155", 0, horizon + 22, w, 8);
      px(ctx, "#c8c1b3", 0, horizon + 30, w, h);
      market(ctx, 10, h - 26);
      ground(ctx, w, h - 26, 26, "#d6c194", "#e4d3ad");
      for (const x of [w * 0.8, w * 0.95]) tree(ctx, x, h - 22, 10, "#8c6ed0");
      people(ctx, looks, w * 0.72, h - 26, 1.6);
      break;
    }
    case "bridge": {
      sky(ctx, w, horizon, "golden");
      sun(ctx, w * 0.5, horizon - 30, 14, "golden");
      water(ctx, w, horizon, h - horizon, "golden", w * 0.5);
      bridge(ctx, -20, w + 20, horizon - 6, horizon - 40);
      ferry(ctx, w * 0.62, horizon + 30);
      ground(ctx, w, h - 30, 30, "#6f5a6a", "#8a7280");
      people(ctx, looks, w * 0.38, h - 30, 1.6);
      break;
    }
  }
}

function drawScene(id: SceneId, w: number, h: number, looks: Look[]): HTMLCanvasElement {
  const art = document.createElement("canvas");
  art.width = w;
  art.height = h;
  const ctx = art.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  scene(ctx, id, w, h, looks);
  return art;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/* =============================================================================
   The share poster
============================================================================= */

export const POSTER_W = 1080;
export const POSTER_H = 1620;

export type PosterText = {
  brand: string;
  brandSub: string;
  when: string;
  about: string;
  stats: string;
  scan: string;
  scanSub: string;
  caption: string;
  site: string;
};

export async function drawPoster(look: Look, text: PosterText, qrDataUrl: string): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext("2d")!;

  // A shorter scene than the card's width would suggest, so the words and
  // the code below it never have to share a line.
  const ART_W = 270;
  const ART_H = 196;
  const art = drawScene("kirribilli", ART_W, ART_H, [look]);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.imageSmoothingEnabled = false;
  const sceneH = (ART_H * POSTER_W) / ART_W;
  ctx.drawImage(art, 0, 0, POSTER_W, sceneH);

  ctx.font = `600 26px ${MONO}`;
  ctx.textBaseline = "top";
  const tagW = ctx.measureText(text.caption).width + 36;
  ctx.fillStyle = "rgba(10,11,13,0.72)";
  ctx.fillRect(40, 40, tagW, 48);
  ctx.fillStyle = ACCENT;
  ctx.fillText(text.caption, 58, 52);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, sceneH, POSTER_W, 8);

  const pad = 64;
  let y = sceneH + 56;
  ctx.fillStyle = FG1;
  ctx.font = `800 84px ${SANS}`;
  ctx.fillText(text.brand, pad, y);
  y += 104;
  ctx.fillStyle = SPARK;
  ctx.font = `600 32px ${SANS}`;
  ctx.fillText(text.brandSub, pad, y);
  y += 56;
  ctx.fillStyle = ACCENT;
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText(text.when, pad, y);
  y += 62;
  ctx.fillStyle = FG2;
  ctx.font = `400 30px ${SANS}`;
  for (const line of wrap(ctx, text.about, POSTER_W - pad * 2, 4)) {
    ctx.fillText(line, pad, y);
    y += 44;
  }

  const qrSize = 230;
  const qrX = POSTER_W - pad - qrSize;
  const qrY = POSTER_H - pad - qrSize;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28);
  try {
    const qr = await loadImage(qrDataUrl);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
  } catch {
    // No code is better than no poster; the address is printed below it.
  }

  const leftW = qrX - pad - 40;
  let by = Math.max(qrY - 6, y + 24);
  ctx.fillStyle = "rgba(198,255,61,0.1)";
  ctx.fillRect(pad - 16, by - 14, leftW + 32, 130);
  ctx.fillStyle = FG1;
  ctx.font = `500 26px ${SANS}`;
  for (const line of wrap(ctx, text.stats, leftW, 3)) {
    ctx.fillText(line, pad, by);
    by += 38;
  }
  by = qrY + 150;
  ctx.fillStyle = ACCENT;
  ctx.font = `800 36px ${SANS}`;
  ctx.fillText(text.scan, pad, by);
  ctx.fillStyle = FG2;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(text.scanSub, pad, by + 50);
  ctx.font = `600 24px ${MONO}`;
  ctx.fillText(text.site, pad, by + 96);

  return canvas.toDataURL("image/png");
}

/* =============================================================================
   Postcards
============================================================================= */

export const CARD_W = 1500;
export const CARD_H = 1000;

export type PostcardText = {
  /** "Greetings from" — the old-postcard line over the town's name. */
  greetings: string;
  town: string;
  /** Where it was taken, and who by. */
  place: string;
  from: string;
  date: string;
  site: string;
};

/**
 * A postcard: an illustrated landmark in a white border, with the big retro
 * town name across it, a stamp, a postmark with the date, and a caption.
 * Made to look like something worth keeping, because the whole point is
 * that somebody saves it and sends it on.
 */
export function drawPostcard(id: SceneId, looks: Look[], text: PostcardText): string {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  // Card stock.
  ctx.fillStyle = "#f6f1e6";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The picture, inset.
  const border = 44;
  const picW = CARD_W - border * 2;
  const picH = CARD_H - border * 2 - 120;
  const art = drawScene(id, 300, Math.round((300 * picH) / picW), looks);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(art, border, border, picW, picH);
  ctx.strokeStyle = "#1c1c1c";
  ctx.lineWidth = 4;
  ctx.strokeRect(border, border, picW, picH);

  // "Greetings from SYDNEY", big, with a hard drop shadow.
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `italic 700 44px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#1c1c1c";
  ctx.fillText(text.greetings, border + 42, border + 34 + 3);
  ctx.fillStyle = "#fff6d8";
  ctx.fillText(text.greetings, border + 40, border + 34);
  ctx.font = `900 150px ${SANS}`;
  ctx.lineWidth = 12;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1c1c1c";
  ctx.strokeText(text.town, border + 36, border + 86);
  ctx.fillStyle = "#1c1c1c";
  ctx.fillText(text.town, border + 44, border + 94);
  const gradient = ctx.createLinearGradient(0, border + 86, 0, border + 236);
  gradient.addColorStop(0, "#ffe27a");
  gradient.addColorStop(0.5, "#ff9f4a");
  gradient.addColorStop(1, "#e5533b");
  ctx.fillStyle = gradient;
  ctx.fillText(text.town, border + 36, border + 86);

  // Stamp, top right: perforated edge, a tiny Opera House, the value.
  const sw = 150;
  const sh = 180;
  const sx = CARD_W - border - sw - 30;
  const sy = border + 30;
  ctx.fillStyle = "#f6f1e6";
  ctx.fillRect(sx - 8, sy - 8, sw + 16, sh + 16);
  for (let i = 0; i <= sw; i += 14) {
    ctx.beginPath();
    ctx.arc(sx + i, sy - 8, 5, 0, Math.PI * 2);
    ctx.arc(sx + i, sy + sh + 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2a6b";
    ctx.fill();
  }
  ctx.fillStyle = "#1f6b8a";
  ctx.fillRect(sx, sy, sw, sh);
  const stamp = drawScene("forecourt", 64, 72, []);
  ctx.drawImage(stamp, sx + 8, sy + 8, sw - 16, sh - 52);
  ctx.fillStyle = "#f6f1e6";
  ctx.font = `800 28px ${MONO}`;
  ctx.fillText("VT", sx + 12, sy + sh - 38);
  ctx.textAlign = "right";
  ctx.fillText("AU", sx + sw - 12, sy + sh - 38);
  ctx.textAlign = "left";

  // Postmark beside the stamp, its wavy cancel lines just catching the edge.
  const cx = sx - 120;
  const cy = sy + sh * 0.5;
  ctx.strokeStyle = "rgba(40, 40, 60, 0.75)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(40, 40, 60, 0.85)";
  ctx.font = `700 16px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText("SYDNEY NSW", cx, cy - 36);
  ctx.font = `700 19px ${MONO}`;
  ctx.fillText(text.date, cx, cy - 10);
  ctx.font = `700 15px ${MONO}`;
  ctx.fillText("VIBE THURSDAY", cx, cy + 18);
  for (let k = 0; k < 4; k += 1) {
    ctx.beginPath();
    ctx.moveTo(cx + 84, cy - 30 + k * 18);
    for (let wx = 0; wx <= 80; wx += 20) ctx.lineTo(cx + 84 + wx, cy - 30 + k * 18 + (wx % 40 ? 6 : -6));
    ctx.stroke();
  }
  ctx.textAlign = "left";

  // Caption strip along the bottom: where, who, and where to find the game.
  const capY = CARD_H - border - 96;
  ctx.fillStyle = "#1c1c1c";
  ctx.font = `800 40px ${SANS}`;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(iconCanvas("pin"), border + 8, capY + 8, 40, 40);
  ctx.fillText(text.place, border + 58, capY + 6);
  ctx.fillStyle = "#5a5a5a";
  ctx.font = `500 28px ${SANS}`;
  ctx.fillText(text.from, border + 8, capY + 60);
  ctx.textAlign = "right";
  ctx.fillStyle = "#1c1c1c";
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText("Vibe Thursday · /play", CARD_W - border - 8, capY + 12);
  ctx.fillStyle = "#5a5a5a";
  ctx.font = `500 24px ${MONO}`;
  ctx.fillText(text.site, CARD_W - border - 8, capY + 60);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/jpeg", 0.92);
}
