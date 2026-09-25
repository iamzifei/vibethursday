/**
 * /play's icon set: 12×12 pixel icons drawn for this game, instead of emoji.
 *
 * Emoji render differently on every phone — a different face on iOS,
 * Android and Windows, none of them pixel art — so the HUD looked like three
 * different games. One grid per icon here, and two renderers read it: the
 * React `Icon` (SVG, for buttons) and `iconCanvas` (for bubbles drawn on the
 * game canvas). Same pixels everywhere.
 *
 * One character per pixel; `.` is transparent.
 */

const PALETTE: Record<string, string> = {
  k: "#0a0b0d", // ink
  w: "#f2f5f3", // white
  l: "#c6ff3d", // lime
  c: "#3ddcff", // cyan
  y: "#ffc93d", // yellow
  p: "#ff5c8a", // pink
  r: "#e5533b", // red
  b: "#8a5a2b", // brown
  g: "#a4acb4", // grey
  o: "#f28c28", // orange
  s: "#f6d7c3", // skin
  u: "#3a8fd9", // blue
};

export const ICONS = {
  bag: [
    "....kkkk....",
    "...k....k...",
    "..kkkkkkkk..",
    ".kllllllllk.",
    ".kllllllllk.",
    ".kkkkkkkkkk.",
    ".kllkkkkllk.",
    ".kllkwwkllk.",
    ".kllkkkkllk.",
    ".kllllllllk.",
    ".kllllllllk.",
    "..kkkkkkkk..",
  ],
  shirt: [
    "..kkk..kkk..",
    ".kcccwwccck.",
    "kcccccccccck",
    "kkkcccccckkk",
    "..kcccccck..",
    "..kcccccck..",
    "..kcccccck..",
    "..kcccccck..",
    "..kcccccck..",
    "..kkkkkkkk..",
    "............",
    "............",
  ],
  smile: [
    "...kkkkkk...",
    "..kyyyyyyk..",
    ".kyyyyyyyyk.",
    "kyykyyyykyyk",
    "kyykyyyykyyk",
    "kyyyyyyyyyyk",
    "kykyyyyyykyk",
    "kyykkkkkkyyk",
    ".kyyyyyyyyk.",
    "..kyyyyyyk..",
    "...kkkkkk...",
    "............",
  ],
  sound: [
    "............",
    ".....k......",
    "....kk...k..",
    "...kwk.k..k.",
    "kkkwwk..k.k.",
    "kwwwwk..k..k",
    "kwwwwk..k..k",
    "kkkwwk..k.k.",
    "...kwk.k..k.",
    "....kk...k..",
    ".....k......",
    "............",
  ],
  mute: [
    "............",
    ".....k......",
    "....kk......",
    "...kwk.p...p",
    "kkkwwk..p.p.",
    "kwwwwk...p..",
    "kwwwwk..p.p.",
    "kkkwwk.p...p",
    "...kwk......",
    "....kk......",
    ".....k......",
    "............",
  ],
  help: [
    "...kkkkkk...",
    "..kllllllk..",
    ".kllkkkkllk.",
    "kllkllllkllk",
    "kllllllkkllk",
    "klllllkklllk",
    "klllllkllllk",
    "kllllllllllk",
    ".klllkklllk.",
    "..kllkkllk..",
    "...kkkkkk...",
    "............",
  ],
  share: [
    ".....kk.....",
    "....kllk....",
    "...kllllk...",
    "..kkkllkkk..",
    "....kllk....",
    "....kllk....",
    "kkk.kllk.kkk",
    "kwk.kkkk.kwk",
    "kwk......kwk",
    "kwkkkkkkkkwk",
    "kwwwwwwwwwwk",
    "kkkkkkkkkkkk",
  ],
  pin: [
    "...kkkkkk...",
    "..kppppppk..",
    ".kppppppppk.",
    ".kpppwwpppk.",
    ".kppwwwwppk.",
    ".kpppwwpppk.",
    "..kppppppk..",
    "...kppppk...",
    "....kppk....",
    ".....kk.....",
    "............",
    "............",
  ],
  camera: [
    "............",
    "............",
    "...kkkk.....",
    "kkkggggkkkkk",
    "kggggkkkgggk",
    "kgggkcckkggk",
    "kggkcwcckggk",
    "kggkcccckggk",
    "kgggkcckgggk",
    "kggggkkggggk",
    "kkkkkkkkkkkk",
    "............",
  ],
  star: [
    ".....kk.....",
    "....kyyk....",
    "....kyyk....",
    "kkkkyyyykkkk",
    "kyyyyyyyyyyk",
    ".kyyyyyyyyk.",
    "..kyyyyyyk..",
    "..kyyyyyyk..",
    ".kyyykkyyyk.",
    ".kyyk..kyyk.",
    "kyk......kyk",
    "kk........kk",
  ],
  lock: [
    "............",
    "...kkkkkk...",
    "..kk....kk..",
    "..k......k..",
    "..k......k..",
    "kkkkkkkkkkkk",
    "kyyyyyyyyyyk",
    "kyyyykkyyyyk",
    "kyyyykkyyyyk",
    "kyyyyyyyyyyk",
    "kkkkkkkkkkkk",
    "............",
  ],
  close: [
    "............",
    ".kk......kk.",
    ".kwk....kwk.",
    "..kwk..kwk..",
    "...kwkkwk...",
    "....kwwk....",
    "....kwwk....",
    "...kwkkwk...",
    "..kwk..kwk..",
    ".kwk....kwk.",
    ".kk......kk.",
    "............",
  ],
  menu: [
    "............",
    ".kkkkkkkkkk.",
    ".kwwwwwwwwk.",
    ".kkkkkkkkkk.",
    "............",
    ".kkkkkkkkkk.",
    ".kwwwwwwwwk.",
    ".kkkkkkkkkk.",
    "............",
    ".kkkkkkkkkk.",
    ".kwwwwwwwwk.",
    ".kkkkkkkkkk.",
  ],
  // ── Emotes ──
  wave: [
    "...k.k.k....",
    "..kskskskk..",
    "c.kskskskk..",
    "..ksssssksk.",
    "c.ksssssssk.",
    "..ksssssssk.",
    "..ksssssssk.",
    "...ksssssk..",
    "....kssssk..",
    "....kkkkk...",
    "............",
    "............",
  ],
  heart: [
    "............",
    ".kkk....kkk.",
    "kpppk..kpppk",
    "kpwppkkppppk",
    "kppppppppppk",
    "kppppppppppk",
    ".kppppppppk.",
    "..kppppppk..",
    "...kppppk...",
    "....kppk....",
    ".....kk.....",
    "............",
  ],
  laugh: [
    "...kkkkkk...",
    "..kyyyyyyk..",
    ".kyyyyyyyyk.",
    "kykkyyyykkyk",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyyk",
    "kykkkkkkkkyk",
    "kyykppppkyyk",
    ".kyykkkkyyk.",
    "..kyyyyyyk..",
    "...kkkkkk...",
    "............",
  ],
  coffee: [
    "...w..w.....",
    "....w..w....",
    "...w..w.....",
    "kkkkkkkkk...",
    "kbbbbbbbkkk.",
    "kwwwwwwwk.k.",
    "kwwwwwwwk.k.",
    "kwwwwwwwkkk.",
    ".kwwwwwk....",
    "..kkkkk.....",
    "kkkkkkkkkk..",
    "............",
  ],
  idea: [
    "...kkkkkk...",
    "..kyyyyyyk..",
    ".kyywyyyyyk.",
    ".kywyyyyyyk.",
    ".kyyyyyyyyk.",
    ".kyyyyyyyyk.",
    "..kyyyyyyk..",
    "...kyyyyk...",
    "...kggggk...",
    "...kkkkkk...",
    "...kggggk...",
    "....kkkk....",
  ],
  party: [
    "..y....p....",
    "......c...l.",
    ".p..l.......",
    "....y...p...",
    "..c.....kk..",
    "......kkyk..",
    ".....kpyyk..",
    "....kyyppk..",
    "...kppyyk...",
    "..kyyppk....",
    ".kkkkkk.....",
    "............",
  ],
  chat: [
    "............",
    ".kkkkkkkkkk.",
    "kwwwwwwwwwwk",
    "kwwwwwwwwwwk",
    "kwkkwkkwkkwk",
    "kwwwwwwwwwwk",
    "kwwwwwwwwwwk",
    ".kkkwwkkkkk.",
    "...kwk......",
    "...kk.......",
    "............",
    "............",
  ],
  thanks: [
    "............",
    "..kk....kk..",
    ".kppk..kppk.",
    "..kkpkkpkk..",
    "kkkkkkkkkkkk",
    "kppppyyppppk",
    "kkkkkkkkkkkk",
    ".kpppyypppk.",
    ".kpppyypppk.",
    ".kpppyypppk.",
    ".kkkkkkkkkk.",
    "............",
  ],
} as const;

export type IconName = keyof typeof ICONS;

export const ICON_SIZE = 12;

/** Horizontal runs of one colour, so a 12×12 icon is a dozen rects, not 144. */
export function iconRuns(name: IconName): { x: number; y: number; w: number; color: string }[] {
  const runs: { x: number; y: number; w: number; color: string }[] = [];
  ICONS[name].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      if (ch !== ".") runs.push({ x, y, w: end - x, color: PALETTE[ch] ?? "#ff00ff" });
      x = end;
    }
  });
  return runs;
}

const cache = new Map<IconName, HTMLCanvasElement>();

/** An icon as a 12×12 canvas, for drawing on the game canvas. */
export function iconCanvas(name: IconName): HTMLCanvasElement {
  const hit = cache.get(name);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d")!;
  for (const run of iconRuns(name)) {
    ctx.fillStyle = run.color;
    ctx.fillRect(run.x, run.y, run.w, 1);
  }
  cache.set(name, canvas);
  return canvas;
}
