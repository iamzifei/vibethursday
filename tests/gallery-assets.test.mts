/**
 * Every photo the gallery names has to exist, in every width and format.
 *
 * The gallery gains a session a week, and each photo is now six files behind
 * one `src` that carries no extension. A typo in content.ts, or a session
 * regenerated with a different number of photos, produces a broken image on
 * the home page and nothing anywhere else — no type error, no build failure,
 * no test. This is that missing signal.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";

/** Kept in step with `scripts/build-photos.mts` and the <picture> in page.tsx. */
const WIDTHS = [400, 800, 1600];
const FORMATS = ["avif", "jpg"];

const publicDir = path.join(process.cwd(), "public");

test("every photo in the gallery has all its derivatives on disk", () => {
  const missing: string[] = [];

  for (const lang of ["zh", "en"] as const) {
    for (const session of copy[lang].gallery.sessions) {
      for (const photo of session.photos) {
        for (const width of WIDTHS) {
          for (const format of FORMATS) {
            const file = `${photo.src}-${width}.${format}`;
            if (!existsSync(path.join(publicDir, file))) missing.push(`${lang} ${file}`);
          }
        }
      }
    }
  }

  assert.deepEqual(missing, [], `gallery references files that are not in public/:\n${missing.join("\n")}`);
});

test("both languages describe the same photos for the same session", () => {
  // The two language bundles hold separate copies of the list, so a session
  // added to one and not the other, or a fourth photo appended to only the
  // Chinese side, shows a different gallery depending on ?lang=.
  const byDate = (lang: "zh" | "en") =>
    new Map(copy[lang].gallery.sessions.map((s) => [s.date, s.photos.map((p) => p.src)]));

  const zh = byDate("zh");
  const en = byDate("en");

  assert.deepEqual([...zh.keys()].sort(), [...en.keys()].sort(), "the two languages list different sessions");

  for (const [date, srcs] of zh) {
    assert.deepEqual(srcs, en.get(date), `session ${date} has different photos in zh and en`);
  }
});

test("each photo declares real pixel dimensions", () => {
  // These become the width/height attributes, which is what stops the page
  // jumping as photos load. A placeholder or a copied-and-not-updated pair is
  // worse than nothing: it reserves the wrong space with confidence.
  for (const lang of ["zh", "en"] as const) {
    for (const session of copy[lang].gallery.sessions) {
      for (const photo of session.photos) {
        assert.ok(
          Number.isInteger(photo.width) && photo.width > 0,
          `${lang} ${photo.src} has no usable width`,
        );
        assert.ok(
          Number.isInteger(photo.height) && photo.height > 0,
          `${lang} ${photo.src} has no usable height`,
        );
      }
    }
  }
});
