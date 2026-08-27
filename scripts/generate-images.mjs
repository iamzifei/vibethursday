/**
 * Generates the site's raster art with OpenAI's gpt-image-2.
 *
 * Run once, then commit the output — this is not part of the build. The images
 * are deliberately TEXTLESS: every piece of type on the site (including the
 * social card) is rendered as real text, so nothing depends on a model
 * spelling correctly. That rule matters twice as much for the comic strip
 * below: a wordless four-panel gag cannot be misspelt, and a model asked for
 * a punchline in Chinese will invent characters that are not characters.
 *
 *   OPENAI_API_KEY=... node scripts/generate-images.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artDir = join(here, "..", "art");

const MODEL = "gpt-image-2";

/** Shared palette language so every image comes back on-brand. */
const PALETTE =
  "Strict palette: near-black background (#0A0B0D), electric lime green (#C6FF3D) as the dominant accent, " +
  "electric cyan (#3DDCFF) as a secondary spark, cool dark grey mid-tones. No other hues.";

const JOBS = [
  {
    file: "og-bg.png",
    size: "1536x1024",
    prompt: [
      "An abstract technology graphic for a weekly AI builders meetup. Dark near-black field.",
      "Across it, a loose isometric lattice of thin luminous lines and small nodes, like a network",
      "graph mid-assembly, drifting from the lower left toward the upper right with a sense of speed.",
      "A few nodes bloom into soft glows. Energetic, youthful, precise — closer to a modern synth",
      "album cover than to corporate stock art.",
      PALETTE,
      "Absolutely no text, no letters, no numbers, no logos, no watermarks, no人物.",
      "Composition must stay quiet and uncluttered through the left half and the vertical middle band,",
      "because large type will be laid over that area later. Concentrate detail in the right third",
      "and along the outer edges.",
      "Flat vector-adjacent rendering with subtle grain. No 3D chrome, no lens flare, no gradients",
      "covering the whole canvas.",
    ].join(" "),
  },
  {
    file: "icon-source.png",
    size: "1024x1024",
    prompt: [
      "A bold, minimal app icon mark on a near-black square background.",
      "The mark is a single geometric glyph suggesting forward motion and a spark: a thick",
      "electric-lime chevron or lightning-like angular stroke, centred, with generous margin around it.",
      "One small electric-cyan dot as a counterweight.",
      PALETTE,
      "Absolutely no text, no letters, no numbers, no wordmark.",
      "Flat, crisp, high contrast, geometric. Must stay legible when scaled down to 32 pixels.",
      "No gradients, no shadows, no 3D, no bevel.",
    ].join(" "),
  },
  {
    file: "wharf-strip.png",
    size: "1024x1024",
    prompt: [
      "A four-panel comic laid out as a 2x2 grid — two panels on top, two below — with thin",
      "dark panel borders and narrow pale blue-grey gutters between them, on a pale blue-grey field.",
      "Soft cel-shaded cartoon style: thin confident dark outlines, flat muted fills with gentle",
      "shading, a little paper texture. Palette is quiet and cool — pale blue sky, grey-blue sea,",
      "weathered grey timber and stone, warm sand. Gentle and dry, not zany.",
      "The characters are TWO Australian silver gulls, the same two birds in every panel: white",
      "head, breast and tail, light grey back and folded wings, black wingtips, and a bright",
      "orange-red bill, legs and eye-ring. One is slightly larger with a darker grey mantle; the",
      "other is smaller and paler, so they can be told apart at a glance.",
      "Panel 1 (top left): the two gulls standing side by side on a weathered timber wharf edge",
      "above the water, both in profile looking out to sea, calm and silent. NO speech bubble.",
      "Panel 2 (top right): the same two gulls on the decking, the smaller one turned toward the",
      "larger one. TWO empty white speech bubbles in the upper half, one above each bird, each",
      "with a tail pointing down to that bird's beak.",
      "Panel 3 (bottom left): a close-up of the larger gull's head and shoulders from the side,",
      "beak open, eye earnest, mid-sentence. ONE large empty white speech bubble filling the",
      "upper right of the panel, tail pointing to the beak.",
      "Panel 4 (bottom right): a close-up of the smaller gull's head from the side, beak open,",
      "expression completely deadpan. ONE large empty white speech bubble filling the upper left",
      "of the panel, tail pointing to the beak.",
      "🔴 CRITICAL: every speech bubble must be COMPLETELY EMPTY — plain white inside, nothing in",
      "it at all. No text, no letters, no characters, no numbers, no squiggles, no scribbles, no",
      "dots, no placeholder marks of any kind. The bubbles are blank shapes that will have real",
      "type laid over them later.",
      "Nowhere else in the image is there any text, signature, watermark or panel number either.",
      "The bubbles must be generously large and their interiors unobstructed, because long",
      "sentences will sit inside them.",
      "No 3D, no airbrush, no photographic rendering, no heavy gradients.",
    ].join(" "),
  },
  {
    file: "gull.png",
    size: "1024x1024",
    prompt: [
      "A single Australian silver gull, drawn as a gentle cel-shaded cartoon character, standing",
      "in profile facing right on a short stretch of weathered grey timber wharf decking, with a",
      "plain pale blue-grey background and generous empty margin on all sides.",
      "Head slightly cocked, expression completely deadpan — a bird waiting for somebody to drop",
      "a chip. Dry and understated, not cute, not zany.",
      "Same technique as a soft-coloured comic panel: thin confident dark outline, flat muted",
      "fills with gentle shading, a little paper texture. No screentone, no halftone dots.",
      "Anatomy must be a silver gull specifically: white head, breast and tail, light grey back",
      "and folded wing, black wingtips with small white spots, and a bright orange-red bill, legs",
      "and eye-ring — those three reds are the identification and must all be present.",
      "One warm yellow hot chip lies on the decking in front of the bird.",
      "Absolutely no text, no letters, no numbers, no speech bubble, no signature, no watermark,",
      "no border, no frame, no panel outline.",
      "No 3D, no airbrush, no photographic rendering.",
    ].join(" "),
  },
];

async function generate({ file, prompt, size }) {
  process.stdout.write(`→ ${file} (${size}) … `);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, prompt, size, quality: "high", n: 1 }),
  });

  if (!response.ok) {
    throw new Error(`${file}: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error(`${file}: response contained no image data`);
  }

  await writeFile(join(artDir, file), Buffer.from(b64, "base64"));
  console.log("done");
}

await mkdir(artDir, { recursive: true });

for (const job of JOBS) {
  await generate(job);
}

console.log(`\nWrote ${JOBS.length} image(s) to ${artDir}`);
