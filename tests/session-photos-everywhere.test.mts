/**
 * Every morning in the archive shows a picture (2026-11-02): its own photos
 * where there are any, redrawn with faces replaced; otherwise one redrawn
 * scene from another morning, labelled as such — never another day's photos
 * passed off as that day's.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildArchive } from "../src/lib/archive.ts";
import { EXTRA_SESSION_PHOTOS } from "../src/lib/session-extra-photos.ts";

const root = path.resolve(import.meta.dirname, "..");

test("10-15 has its own photos, from the files on disk", () => {
  const rows = buildArchive([], [], [], new Map([["2026-10-15", 18]]));
  const row = rows.find((r) => r.date === "2026-10-15");
  assert.ok(row && row.photos.length >= 3);
  // The English page gets English alt text.
  const en = buildArchive([], [], [], new Map([["2026-10-15", 18]]), new Map(), "en").find((r) => r.date === "2026-10-15");
  assert.ok(en && en.photos.every((photo) => /^[\x00-\x7F]+$/.test(photo.alt)));
  for (const list of Object.values(EXTRA_SESSION_PHOTOS)) {
    for (const photo of list) {
      for (const f of ["-400.avif", "-400.jpg", "-800.jpg", "-1600.jpg"]) {
        assert.ok(existsSync(path.join(root, "public", photo.src + f)), photo.src + f);
      }
    }
  }
});

test("a morning with no photos shows a labelled scene from another morning", () => {
  const row = readFileSync(path.join(root, "src/components/SessionRow.tsx"), "utf8");
  assert.match(row, /row\.photos\.length === 0/);
  assert.match(row, /<SceneImage/);
  assert.match(row, /a\.noPhotos/);
});
