#!/usr/bin/env node
/**
 * Generates a blog post's cover and in-body illustration with gpt-image-2
 * (2026-11-03), from the `cover_prompt` and `figure_prompt` lines of each
 * draft. Skips any image that already exists, so it is safe to re-run.
 *
 *   OPENAI_API_KEY=... node scripts/blog-images.mjs <drafts dir> <images dir> [slug ...]
 *
 * Writes <images dir>/<slug>.png (cover) and <images dir>/<slug>-1.png
 * (illustration), 1536×1024. Then run blog-import.mjs to convert them.
 * Prompts must ask for no text: the model cannot be trusted to spell.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [drafts, out, ...only] = process.argv.slice(2);
if (!drafts || !out || !process.env.OPENAI_API_KEY) {
  console.error("usage: OPENAI_API_KEY=... node scripts/blog-images.mjs <drafts dir> <images dir> [slug ...]");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

async function generate(prompt, file) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1536x1024", quality: "high", n: 1 }),
  });
  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${path.basename(file)}: ${JSON.stringify(payload.error ?? payload).slice(0, 300)}`);
  writeFileSync(file, Buffer.from(b64, "base64"));
  console.log(`wrote ${file}`);
}

const jobs = [];
for (const name of readdirSync(drafts).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
  const text = readFileSync(path.join(drafts, name), "utf8");
  const slug = /^slug: (.+)$/m.exec(text)?.[1].trim();
  if (!slug || (only.length && !only.includes(slug))) continue;
  const cover = /^cover_prompt: (.+)$/m.exec(text)?.[1].trim();
  const figure = /^figure_prompt: (.+)$/m.exec(text)?.[1].trim();
  if (cover && !existsSync(path.join(out, `${slug}.png`))) jobs.push([cover, path.join(out, `${slug}.png`)]);
  if (figure && !existsSync(path.join(out, `${slug}-1.png`))) jobs.push([figure, path.join(out, `${slug}-1.png`)]);
}

// A few at a time: each call takes tens of seconds.
for (let i = 0; i < jobs.length; i += 4) {
  const results = await Promise.allSettled(jobs.slice(i, i + 4).map(([prompt, file]) => generate(prompt, file)));
  for (const result of results) if (result.status === "rejected") console.error(String(result.reason));
}
console.log(`${jobs.length} image(s) requested`);
