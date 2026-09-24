import assert from "node:assert/strict";
import { test } from "node:test";
import { currentVersion, releaseDate, RELEASES } from "../src/lib/changelog.ts";
import { copy } from "../src/lib/content.ts";

/**
 * The meetup's own version history (`src/lib/changelog.ts`).
 *
 * This is the one page on the site whose entire value is that it is true, and
 * every way it can stop being true is silent: a duplicate version renders
 * twice and looks fine, an entry added in the wrong place puts August above
 * September, and a missing translation renders as nothing at all rather than
 * as an error.
 */

test("versions are unique and never reused", () => {
  const versions = RELEASES.map((release) => release.version);
  assert.equal(new Set(versions).size, versions.length, `duplicate version: ${versions.join(", ")}`);
});

test("the list is newest first, by both date and version", () => {
  // The page renders this array in order and nothing sorts it, so the order
  // here is the order a reader sees.
  for (let i = 1; i < RELEASES.length; i += 1) {
    const newer = RELEASES[i - 1];
    const older = RELEASES[i];

    assert.ok(
      newer.date >= older.date,
      `v${newer.version} (${newer.date}) is listed above v${older.version} (${older.date})`,
    );

    const [newerMajor, newerMinor] = newer.version.split(".").map(Number);
    const [olderMajor, olderMinor] = older.version.split(".").map(Number);

    assert.ok(
      newerMajor > olderMajor || (newerMajor === olderMajor && newerMinor > olderMinor),
      `v${newer.version} does not come after v${older.version}`,
    );
  }
});

test("every release says something, in both written languages", () => {
  for (const release of RELEASES) {
    assert.match(release.version, /^\d+\.\d+$/, `odd version: ${release.version}`);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/, `odd date on v${release.version}`);
    assert.ok(["major", "minor"].includes(release.kind), `odd kind on v${release.version}`);

    // Traditional is converted from the Chinese at render time, so two written
    // languages is all there is to keep in step.
    assert.ok(release.zh.trim().length > 8, `v${release.version} has no Chinese`);
    assert.ok(release.en.trim().length > 8, `v${release.version} has no English`);
  }
});

test("a major release is reserved for the shape of the morning changing", () => {
  // Not a style rule — it is what the page tells the reader the chip means.
  // Three so far: the first session, the format, and the room.
  const majors = RELEASES.filter((release) => release.kind === "major").map((r) => r.version);
  assert.deepEqual(majors, ["3.0", "2.0", "1.0"]);
});

test("the current version is the top of the list", () => {
  assert.equal(currentVersion(), RELEASES[0].version);
  // The footer and the home page both print this; it has to be a plain number,
  // because both render it as "v{n}".
  assert.match(currentVersion(), /^\d+\.\d+$/);
});

test("★ a release date never claims to be a Thursday", () => {
  // `formatSession` hard-codes （周四） because every date it was written for is
  // one. Most of these are not — the format changed on a Wednesday, the member
  // wall landed on a Saturday — so reusing it here would have printed a
  // confident, wrong weekday under a third of the entries.
  for (const release of RELEASES) {
    for (const lang of ["zh", "zh-Hant", "en"] as const) {
      const text = releaseDate(release.date, lang);
      assert.ok(!text.includes("周"), `${release.date} in ${lang} claims a weekday: ${text}`);
      assert.ok(!text.includes("週"), `${release.date} in ${lang} claims a weekday: ${text}`);
      assert.ok(!/Thu|Mon|Tue|Wed|Fri|Sat|Sun/.test(text), `${release.date} in ${lang}: ${text}`);
    }
  }

  assert.equal(releaseDate("2026-08-06", "zh"), "2026年8月6日");
  assert.equal(releaseDate("2026-08-06", "en"), "6 Aug 2026");
});

test("the page's own copy exists in both languages", () => {
  for (const lang of ["zh", "en"] as const) {
    const t = copy[lang].changelog;

    for (const key of ["eyebrow", "title", "lede", "current", "major", "minor", "footerLink"] as const) {
      assert.ok(t[key]?.trim(), `${lang}.changelog.${key} is empty`);
    }

    // Only the home page interpolates this one — the footer builds its own
    // line from `footerLink` and the version. It is still the single thing
    // standing between the hero and a literal "版本 {v}".
    assert.ok(
      t.versionLabel.includes("{v}"),
      `${lang}.changelog.versionLabel lost its {v} placeholder — the home page would print it literally`,
    );
  }
});
