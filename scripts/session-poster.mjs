/**
 * Draws the poster for a session, in coloured pencil, from that morning's own
 * photographs.
 *
 *   OPENAI_API_KEY=... node scripts/session-poster.mjs 05
 *   OPENAI_API_KEY=... node scripts/session-poster.mjs all
 *
 * Run once per session, then commit the output; this is not part of the build.
 * It writes the master to `art/` and the derivatives the page serves into
 * `public/sessions/`.
 *
 * ★ Nothing has to be written by hand for a new session. The scene comes from
 * the note already in `content.ts` — the two sentences describing what actually
 * happened that morning — so adding a session to the gallery is still a
 * one-entry edit, and its poster is one command afterwards.
 *
 * ★ It is image-to-image, not text-to-image: the session's own photos go in as
 * references, so the poster is that room — the actual windows, the actual
 * light, the actual arrangement of tables — rather than a plausible café.
 *
 * Three rules the prompt below is built around, and none is decoration:
 *
 * - **No text, anywhere in the picture.** Every word on this site is real text
 *   so that it exists in three languages and can be read aloud. It is also the
 *   only way a wordless image cannot be misspelt, which matters twice over
 *   here because the note fed into the prompt is in Chinese and a model asked
 *   to paint Chinese will invent characters that are not characters.
 * - 🔴 **Nobody recognisable, and this one got sharper the moment the source
 *   became a photograph.** Every identifiable face in those photos is covered
 *   by a sticker. A model asked to redraw the picture will happily paint a
 *   face back where the sticker was, which would undo the entire policy by
 *   accident. The prompt says so twice, and the output is checked by eye
 *   before it ships.
 * - **The place, not the people.** What is worth keeping from the photograph
 *   is the room: the windows, the water outside, the tables, the morning
 *   light. The people are shapes in it.
 */

import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const artDir = join(root, "art");
const outDir = join(root, "public", "sessions");

const MODEL = "gpt-image-2";
/* 3:2 — a banner across the top of a row in the archive, and the widest square
   the model offers is too tall to sit above a paragraph without taking the
   screen. */
const SIZE = "1536x1024";

/** Shared so every poster in the run belongs to the same set of drawings. */
const STYLE = [
  "Redraw this scene as a coloured pencil drawing on lightly textured paper.",
  "Visible pencil strokes and cross-hatching, layered colour built up by hand,",
  "slightly uneven edges, the tooth of the paper showing through in the light",
  "areas, gentle unsaturated colour with warm morning light. It should look",
  "drawn by a person sitting in the room, not filtered or traced: proportions",
  "a little loose, some areas finished and some left as sketch.",
  "No digital gloss, no smooth airbrush gradients, no vector outlines, no 3D,",
  "no photographic detail, no oil or watercolour wash.",
].join(" ");

/**
 * The one thing the model gets wrong on its own.
 *
 * Asked to paint a tech meetup it paints a lecture — a speaker at a whiteboard,
 * rows of chairs facing forward. This meetup's first house rule is that it is
 * not that ("no speaker, no reporting slides, no stage and audience"), so the
 * first attempt at session one produced a picture that contradicted the
 * sentence printed two sections above it on the same site.
 */
const FORMAT = [
  "Keep the room from the photographs: the same windows and the water and boats",
  "beyond them, the same tables and chairs and their arrangement, the same",
  "light. Keep roughly the same number of people, in roughly the same places.",
].join(" ");

const RULES = [
  "🔴 NO FACES. This is the most important instruction. Draw nobody's face:",
  "every person is seen from behind, from above, or turned away, and any head",
  "that would show a face is drawn as hair and shoulders with no features at",
  "all — no eyes, no nose, no mouth. Where the source photograph has a sticker",
  "or a blur over someone's head, do NOT reconstruct a face there: draw the",
  "back or side of a head instead. Nobody in this drawing may be identifiable.",
  "🔴 Absolutely no text of any kind: no letters, no Chinese characters, no",
  "numbers, no signage, no writing on screens, no logos, no watermark, no",
  "signature. Any surface that would carry words is left blank or turned away.",
].join(" ");

/** The sessions in the copy bundle, read rather than duplicated here. */
async function sessions() {
  const source = await readFile(join(root, "src/lib/content.ts"), "utf8");
  const gallery = source.slice(source.indexOf("    gallery: {"), source.indexOf("    wharfTeaser: {"));

  const found = [];
  const pattern = /date: "(\d{4}-\d{2}-\d{2})",\s*\n\s*title: "([^"]+)",\s*\n\s*note: "([^"]+)"/g;

  for (const match of gallery.matchAll(pattern)) {
    found.push({ date: match[1], title: match[2], note: match[3] });
  }

  // Numbered by date so the file name of a session's poster never moves when
  // an older one is added, which would silently repoint every page using it.
  return found
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((session, index) => ({ ...session, n: String(index + 1).padStart(2, "0") }));
}

function prompt(session) {
  return [
    STYLE,
    "The reference photographs are one morning of a weekly meetup in a café on",
    "the water at Darling Harbour, Sydney.",
    `The person who ran it described it this way: 「${session.note}」`,
    FORMAT,
    RULES,
  ].join(" ");
}

/**
 * That session's own photographs, largest first.
 *
 * The 1600px derivatives rather than anything larger, because that is the
 * largest thing in the repository — the originals are not committed, and this
 * is plenty for a reference.
 */
async function references(session) {
  const dir = join(root, "public", "photos");
  const files = (await readdir(dir))
    .filter((name) => name.startsWith(`session-${session.n}-`) && name.endsWith("-1600.jpg"))
    .sort();

  if (files.length === 0) {
    throw new Error(`${session.n}: no photographs to draw from in ${dir}`);
  }

  // Four is enough to establish the room and keeps the request small. They are
  // sorted, so the same four go in every time and a re-run is comparable.
  return files.slice(0, 4).map((name) => join(dir, name));
}

async function paint(session) {
  process.stdout.write(`→ ${session.title} (${session.date}) … `);

  const photos = await references(session);
  process.stdout.write(`${photos.length} 张原图 … `);

  // The edits endpoint, not generations: this is a drawing *of* those
  // photographs. multipart/form-data, and every reference goes in under the
  // same `image[]` field.
  const form = new FormData();
  form.set("model", MODEL);
  form.set("prompt", prompt(session));
  form.set("size", SIZE);
  form.set("quality", "high");
  form.set("n", "1");

  for (const path of photos) {
    const bytes = await readFile(path);
    form.append("image[]", new File([bytes], basename(path), { type: "image/jpeg" }));
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`${session.n}: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${session.n}: response contained no image data`);

  const master = join(artDir, `session-${session.n}-poster.png`);
  await writeFile(master, Buffer.from(b64, "base64"));

  // Quantised for the same reason the comic's master is: these are drawings
  // with few real colours, 160 of them is more than they contain, and it takes
  // a master from megabytes to a few hundred kilobytes with no visible change.
  execFileSync("magick", [
    master, "-strip", "-dither", "None", "-colors", "160",
    "-define", "png:compression-level=9", `PNG8:${master}`,
  ]);

  // Two widths. 1200 covers a laptop, 800 a phone at 2x; the master is 1536
  // and nothing on the page is ever wider than the content column.
  for (const width of [800, 1200]) {
    const jpg = join(outDir, `session-${session.n}-${width}.jpg`);

    execFileSync("magick", [
      master, "-resize", `${width}x>`,
      "-quality", "82", "-sampling-factor", "4:2:0", "-strip", jpg,
    ]);
    execFileSync("avifenc", ["-q", "48", "--speed", "4", jpg, join(outDir, `session-${session.n}-${width}.avif`)]);
  }

  console.log("done");
}

const which = process.argv[2];

if (!which) {
  console.error("usage: node scripts/session-poster.mjs <NN|all>");
  process.exit(1);
}

await mkdir(artDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const all = await sessions();
const todo = which === "all" ? all : all.filter((session) => session.n === which.padStart(2, "0"));

if (todo.length === 0) {
  console.error(`no session ${which}; known: ${all.map((s) => s.n).join(", ")}`);
  process.exit(1);
}

for (const session of todo) {
  await paint(session);
}

console.log(`\nWrote ${todo.length} poster(s) to ${outDir}`);
