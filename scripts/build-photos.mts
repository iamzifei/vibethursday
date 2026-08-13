/**
 * Turns a folder of phone photos into the derivatives the gallery serves.
 *
 *   node --experimental-strip-types scripts/build-photos.mts \
 *     --in "/path/to/Aug 13 AI meetup" --session 02
 *
 * Why a script and not just dragging files into public/: the gallery gains a
 * session every week, and every week the same four decisions have to come out
 * the same way. Doing it by hand is how one session ends up as a 3.7 MB JPEG
 * that a phone downloads in full.
 *
 * What it emits per photo, into public/photos/:
 *
 *   session-NN-i-{400,800,1600}.avif
 *   session-NN-i-{400,800,1600}.jpg
 *
 * Three widths, each with a job. 400 is the album cover on the home page,
 * where three of them sit stacked at a couple of hundred pixels — everyone
 * downloads those, so they are the ones worth being small. 800 covers a phone
 * at 2x and a desktop column once an album is opened. 1600 covers a retina
 * screen showing one photo full width.
 *
 * Two formats, not three. AVIF is what almost everyone gets; JPEG is the floor
 * that always works. WebP would sit between them and help Safari 15 and old
 * Android, and it is one line to add here if the traffic ever justifies four
 * more files per photo to keep in step.
 *
 * It prints a content.ts snippet at the end, including each photo's real
 * dimensions — the gallery needs those to reserve the right space before the
 * image loads, and reading them off the file is the only way they cannot drift.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const WIDTHS = [400, 800, 1600] as const;

/** Only shrink, never upscale: `>` is ImageMagick for "if larger than". */
const resizeSpec = (width: number) => `${width}x>`;

const args = process.argv.slice(2);
const argOf = (flag: string) => {
  const at = args.indexOf(flag);
  return at === -1 ? null : args[at + 1] ?? null;
};

const inputDir = argOf("--in");
const session = argOf("--session");

if (!inputDir || !session) {
  console.error("用法: --in <照片目录> --session <NN>");
  process.exit(1);
}

const outputDir = path.join(process.cwd(), "public", "photos");
mkdirSync(outputDir, { recursive: true });

const sources = readdirSync(inputDir)
  .filter((name) => /\.(jpe?g|png|heic)$/i.test(name))
  // Shot order is the order they happened in, which is the order worth showing.
  .sort((a, b) => statSync(path.join(inputDir, a)).mtimeMs - statSync(path.join(inputDir, b)).mtimeMs);

if (sources.length === 0) {
  console.error(`${inputDir} 里没有图片`);
  process.exit(1);
}

const run = (cmd: string, cmdArgs: string[]) => execFileSync(cmd, cmdArgs, { stdio: "pipe" });

const sizeOf = (file: string) => {
  const out = run("magick", ["identify", "-format", "%w %h", file]).toString().trim();
  const [w, h] = out.split(" ").map(Number);
  return { width: w, height: h };
};

const kb = (file: string) => Math.round(statSync(file).size / 1024);

type Entry = { stem: string; width: number; height: number; bytes: number[] };
const entries: Entry[] = [];

for (const [index, name] of sources.entries()) {
  const source = path.join(inputDir, name);
  const stem = `session-${session}-${index + 1}`;
  const original = sizeOf(source);
  const bytes: number[] = [];

  for (const width of WIDTHS) {
    const jpg = path.join(outputDir, `${stem}-${width}.jpg`);
    const avif = path.join(outputDir, `${stem}-${width}.avif`);

    // -strip drops EXIF. Phone photos carry GPS coordinates and a device
    // serial, and this gallery is on a page that tells you where the venue is
    // already — the metadata adds nothing and leaks where someone was.
    run("magick", [source, "-auto-orient", "-resize", resizeSpec(width), "-strip", "-quality", "82", "-interlace", "Plane", jpg]);
    run("avifenc", ["-q", "60", "--speed", "4", jpg, avif]);

    bytes.push(kb(jpg), kb(avif));
  }

  // Reported from the largest JPEG, which is what the width/height attributes
  // describe. Every width shares the aspect ratio, so any of them would do.
  const emitted = sizeOf(path.join(outputDir, `${stem}-${WIDTHS.at(-1)}.jpg`));

  entries.push({ stem, width: emitted.width, height: emitted.height, bytes });

  console.log(
    `${name}\n  → ${stem}  ${original.width}×${original.height} → ${emitted.width}×${emitted.height}` +
      `  [${WIDTHS.map((w, i) => `${w}w jpg ${bytes[i * 2]}KB / avif ${bytes[i * 2 + 1]}KB`).join(", ")}]`,
  );
}

console.log("\n── content.ts 片段（alt 需要手写，脚本猜不出照片里是什么）──\n");

for (const entry of entries) {
  console.log(
    `            { src: "/photos/${entry.stem}", alt: "TODO", width: ${entry.width}, height: ${entry.height} },`,
  );
}

console.log(
  `\n注意 src 不带扩展名：<picture> 自己拼 -400/-800/-1600 和 .avif/.jpg。` +
    `\n照片里认得出的人脸，上线前必须遮掉——站上写着「认得出的人脸都遮掉了」。\n`,
);
