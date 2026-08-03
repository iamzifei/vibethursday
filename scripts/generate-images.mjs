/**
 * Generates the site's raster art with OpenAI's gpt-image-2.
 *
 * Run once, then commit the output — this is not part of the build. The images
 * are deliberately TEXTLESS: every piece of type on the site (including the
 * social card) is rendered as real text, so nothing depends on a model
 * spelling correctly.
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
