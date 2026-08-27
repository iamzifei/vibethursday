/**
 * Paints the poster for a session, in the style of a Studio Ghibli background.
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
 * Two rules the prompt below is built around, and neither is decoration:
 *
 * - **No text, anywhere in the picture.** Every word on this site is real text
 *   so that it exists in three languages and can be read aloud. It is also the
 *   only way a wordless image cannot be misspelt, which matters twice over
 *   here because the note fed into the prompt is in Chinese and a model asked
 *   to paint Chinese will invent characters that are not characters.
 * - **Nobody recognisable.** The photographs on this site have every
 *   identifiable face covered, and a painting of the same room should not
 *   quietly reintroduce what the photo policy removes. People are seen from
 *   behind, at a distance, or turned away.
 */

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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

/** Shared so every poster in the run belongs to the same set of paintings. */
const STYLE = [
  "A hand-painted illustration in the style of a Studio Ghibli background:",
  "soft gouache and watercolour texture on paper, warm natural morning light,",
  "gentle saturated colour, painterly clouds, and ordinary everyday objects",
  "rendered with real affection — cups, cables, notebooks, a plant on a sill.",
  "Calm and warm. The feeling of an ordinary weekday morning that is quietly",
  "going well. No digital gloss, no hard vector outlines, no 3D, no lens flare.",
].join(" ");

const SETTING = [
  "The place is a café on the water in Darling Harbour, Sydney, on a Thursday",
  "morning: tall windows, the harbour and moored boats outside, a couple of",
  "silver gulls on the railing, warm timber and pale walls inside, laptops and",
  "coffee cups on the tables.",
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
  "This is not a talk and must not look like one. Unless the description below",
  "explicitly says somebody was presenting, there is no stage, no speaker",
  "standing at a screen or whiteboard, and no rows of chairs facing forward:",
  "people sit around tables facing one another, talking in twos and threes,",
  "laptops turned so a neighbour can see.",
].join(" ");

const RULES = [
  "🔴 Absolutely no text of any kind: no letters, no Chinese characters, no",
  "numbers, no signage, no writing on screens, no logos, no watermark, no",
  "signature. Any surface that would carry words is left blank or turned away.",
  "🔴 No recognisable faces. Everyone is seen from behind, from a distance, in",
  "profile turned away, or softly out of focus. No portraits.",
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
    SETTING,
    "What to paint is that particular morning, described here by the person who",
    `ran it: 「${session.note}」`,
    "Paint the room as those sentences describe it — how many people, how they",
    "are arranged, whether it is one long table or several, what is happening at",
    "the front — and let the rest of the picture be the light and the harbour.",
    FORMAT,
    RULES,
  ].join(" ");
}

async function paint(session) {
  process.stdout.write(`→ ${session.title} (${session.date}) … `);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, prompt: prompt(session), size: SIZE, quality: "high", n: 1 }),
  });

  if (!response.ok) {
    throw new Error(`${session.n}: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${session.n}: response contained no image data`);

  const master = join(artDir, `session-${session.n}-poster.png`);
  await writeFile(master, Buffer.from(b64, "base64"));

  // Quantised for the same reason the comic's master is: these are flat
  // painted images with few real colours, 160 of them is more than they
  // contain, and it takes a master from megabytes to a few hundred kilobytes
  // with no visible difference.
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
