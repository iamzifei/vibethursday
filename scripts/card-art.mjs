/**
 * The seven card faces behind the weekly poster.
 *
 *   OPENAI_API_KEY=... node scripts/card-art.mjs          # all seven
 *   OPENAI_API_KEY=... node scripts/card-art.mjs harbour  # just one, to retry it
 *
 * Run once, then commit the output — this is not part of the build, and it is
 * not a weekly chore either. `posterCard()` in `src/lib/poster-card.ts` picks
 * which of these seven a given Thursday gets, so the rotation needs no new
 * picture: week 8 is the bridge, week 15 is the bridge again with a different
 * date, a different tint and a different set of questions on it.
 *
 * ★ Each subject is one recognisable Sydney thing, and the set is deliberately
 * not seven skylines. The first attempt at these was drawn procedurally and
 * three of the seven came out as "dotted rectangles" — two of them were
 * supposed to be different landmarks and were indistinguishable from each
 * other. Each entry below names what makes its subject that subject and
 * nothing else.
 *
 * The style, the model and the two hard rules all live in `art-style.mjs`.
 */

import { execFileSync } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generate, MODEL } from "./art-style.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "cards");

/* The poster's own size. The API's nearest portrait is 2:3, so the extra
   height is cropped off the TOP — the sky is the part with nothing in it, and
   the bottom is the quiet band the poster's type sits in. */
const W = 1080;
const H = 1440;

/** Keyed by `SceneId` in `src/lib/poster-card.ts`. A test holds the two in step. */
const SUBJECTS = {
  harbour: [
    "Subject: the Sydney Harbour Bridge, seen side-on from the water. The steel arch",
    "and its deck are the dominant object and run off the left edge of the frame;",
    "the hangers read as an even vertical rhythm under the arch, one stone pylon",
    "anchors the composition. Water below as flat horizontal bands.",
    // ⚠️ Said explicitly. Left to itself the model paints the sails in beside
    // the arch, which is how the first version of this card ended up being
    // read as an Opera House card — and the Opera House already has its own.
    "The bridge alone — no Opera House anywhere in the frame.",
  ].join(" "),

  opera: [
    "Subject: the Sydney Opera House, close, from the water at a low angle. The",
    "overlapping shell roofs are the dominant object, filling most of the frame and",
    "cropped at the right edge; their curved ribbed surfaces step down toward the",
    "podium. Harbour water below as flat horizontal bands.",
    "The shells alone — no bridge anywhere in the frame.",
  ].join(" "),

  chatswood: [
    "Subject: a tight cluster of four or five slim residential towers of clearly",
    "different heights and crowns — one stepped, one with a thin roof blade, one",
    "flat — standing over the long low curved canopy of a suburban railway station,",
    "with the station's platform lights beneath it. Visible sky gaps between the",
    "towers so the cluster reads as one specific skyline rather than a field of",
    "rectangles. No glass office boxes, nothing generic.",
  ].join(" "),

  wharf: [
    "Subject: an old timber wharf seen side-on, low over the water. A row of heavy",
    "creosoted piles with diagonal cross-bracing carries a plank deck that runs off",
    "the right edge of the frame; the piles continue down into their own reflection.",
    "Three or four silver gulls in the air above it at different heights and sizes,",
    "wings open. No boats, no buildings.",
  ].join(" "),

  bondi: [
    "Subject: one large wave mid-break, seen from the water, the lip curling forward",
    "and throwing spray, with the sandstone headland of a surf beach behind it at the",
    "right. The wave is the dominant object and is cropped at the left edge. Bands of",
    "spent foam in the foreground. No surfers, no people.",
  ].join(" "),

  ferry: [
    "Subject: a Sydney harbour ferry crossing, seen broadside, moving right. A long",
    "low hull with a raked bow rising out of the water, a double-deck cabin, a squat",
    "funnel amidships and a short mast; a wake spreading behind it. The boat is the",
    "dominant object and is cropped at the right edge. A low distant shoreline far",
    "behind it, much smaller. No people on deck.",
  ].join(" "),

  tower: [
    "Subject: Sydney Tower, the observation tower — a very tall slender concrete",
    "shaft carrying a wide golden turret near the top, with a long thin spire above",
    "it. The tower is the dominant object, cropped at the top edge, and stands at",
    "least twice as tall as the cluster of low city blocks at its base so it is",
    "unmistakably the subject. No other tall towers competing with it.",
  ].join(" "),
};

const wanted = process.argv.slice(2);
const jobs = wanted.length > 0 ? wanted : Object.keys(SUBJECTS);

for (const name of jobs) {
  const subject = SUBJECTS[name];

  if (!subject) {
    console.error(`unknown card "${name}". known: ${Object.keys(SUBJECTS).join(", ")}`);
    process.exit(1);
  }

  process.stdout.write(`${name} … `);

  await mkdir(outDir, { recursive: true });

  const raw = join(outDir, `${name}.raw.png`);
  const out = join(outDir, `${name}.png`);

  await writeFile(raw, await generate(subject));

  /* Crop to the poster's ratio from the bottom, then quantise.
   *
   * These pictures are three inks on near-black, so a 64-colour palette is
   * visually lossless and turns a 2MB plate into something a phone on café
   * Wi-Fi will actually finish downloading. -strip drops the metadata. */
  execFileSync("magick", [
    raw,
    "-gravity", "south",
    "-crop", `1024x1365+0+0`,
    "+repage",
    "-resize", `${W}x${H}!`,
    "-colors", "64",
    "-strip",
    out,
  ]);

  await unlink(raw);

  const bytes = execFileSync("wc", ["-c", out]).toString().trim().split(/\s+/)[0];
  console.log(`${out} (${Math.round(Number(bytes) / 1024)}KB, ${MODEL})`);
}
