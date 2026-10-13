/**
 * The organiser's notes on people (2026-10-13, src/lib/person-profile.ts).
 *
 * Three things must hold: input is cleaned to known values, the notes never
 * leave the admin pages, and merging two signup rows keeps the notes of both.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  cleanProfile,
  cleanTags,
  countValues,
  csvField,
  levelFromSelfReport,
  matchesFilter,
  splitTags,
} from "../src/lib/person-profile.ts";

test("a profile keeps only known roles, levels and industries", () => {
  const profile = cleanProfile({
    roles: ["owner", "hacker", "builder", "owner"],
    level: 7,
    industry: "made-up",
    tags: [" iOS ", "ios", "", 3, "会计"],
    resources: "not a list",
    note: "   ",
  });
  assert.deepEqual(profile, { roles: ["owner", "builder"], level: null, industry: null, tags: ["iOS", "会计"], resources: [], note: null });
  assert.equal(cleanProfile({ level: 3, industry: "property" }).level, 3);
  assert.equal(cleanProfile({ level: "3" }).level, null, "a string is not a level");
  assert.equal(cleanProfile(null).roles.length, 0);
});

test("tags: typed separators split, whitespace collapses, length and count are capped", () => {
  assert.deepEqual(splitTags("投放，iOS、 会计 ;  有客户渠道\nSEO"), ["投放", "iOS", "会计", "有客户渠道", "SEO"]);
  assert.deepEqual(cleanTags(["AI   图像", "ai 图像"]), ["AI 图像"]);
  assert.equal(cleanTags(["字".repeat(80)])[0].length, 30);
  assert.equal(cleanTags(Array.from({ length: 40 }, (_, i) => `t${i}`)).length, 20);
});

test("the self-reported AI level suggests a starting level", () => {
  assert.equal(levelFromSelfReport("none"), 1);
  assert.equal(levelFromSelfReport("daily"), 2);
  assert.equal(levelFromSelfReport("builder"), 4);
  assert.equal(levelFromSelfReport(null), null);
});

test("filters: every set filter must match; tags ignore case; q searches notes too", () => {
  const person = {
    name: "王老板",
    wechat: "wang123",
    roles: ["owner" as const],
    level: 2 as const,
    industry: "property",
    tags: ["iOS"],
    resources: ["有客户渠道"],
    note: "想找技术合伙人",
  };
  assert.ok(matchesFilter(person, {}));
  assert.ok(matchesFilter(person, { role: "owner", level: "2", industry: "property", tag: "ios" }));
  assert.ok(!matchesFilter(person, { role: "builder" }));
  assert.ok(!matchesFilter(person, { level: "3" }));
  assert.ok(matchesFilter(person, { resource: "有客户渠道" }));
  assert.ok(matchesFilter(person, { q: "合伙人" }));
  assert.ok(!matchesFilter(person, { q: "律师" }));
});

test("counts merge case and sort by frequency", () => {
  assert.deepEqual(countValues([["iOS", "SEO"], ["ios"], ["SEO"], ["SEO"]]), [
    { value: "SEO", count: 3 },
    { value: "iOS", count: 2 },
  ]);
});

test("CSV fields are quoted when needed and never run as formulas", () => {
  assert.equal(csvField("a,b"), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvField(null), "");
  assert.equal(csvField("\tcmd"), "'\tcmd");
});

/** Every source file under src. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test("★ the notes are read only by admin pages", () => {
  const src = path.join(import.meta.dirname, "../src");
  const readers = /\b(listTaggingRoster|listTaggingSessions|savePersonProfile|listProfileTags|listProfiledPeople|countUntaggedAttendees)\b/;
  const tables = /\bperson_(profiles|session_notes)\b/;
  const leaks: string[] = [];

  for (const file of sourceFiles(src)) {
    const relative = path.relative(src, file).split(path.sep).join("/");
    const source = readFileSync(file, "utf8");
    if (relative === "lib/db.ts") continue;
    const admin = relative.startsWith("app/admin/") || relative.startsWith("app/api/admin/");
    if (tables.test(source)) leaks.push(`${relative}: names a notes table (only db.ts may)`);
    if (readers.test(source) && !admin) leaks.push(`${relative}: reads the notes outside the admin pages`);
  }

  assert.deepEqual(leaks, []);
});

/*
 * Against a throwaway local Postgres, like the schema test:
 *   PROFILE_TEST_DATABASE_URL=postgres://localhost:55433/vt_profile_test pnpm test
 */
const db = process.env.PROFILE_TEST_DATABASE_URL;

test(
  "★ merging two signup rows keeps both rows' notes",
  { skip: db ? false : "set PROFILE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { ensureSchema, getPool, mergeSignups, savePersonProfile, listProfiledPeople, listTaggingRoster } = await import(
      "../src/lib/db.ts"
    );
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    const insert = async (name: string, wechat: string) =>
      (
        await pool.query<{ id: string }>(
          `INSERT INTO signups (name, email, wechat, sessions) VALUES ($1, NULL, $2, ARRAY['2026-10-13']::date[]) RETURNING id::text AS id`,
          [name, wechat],
        )
      ).rows[0].id;

    const made: string[] = [];
    try {
      const keep = await insert("Ann", `ann-${stamp}`);
      const drop = await insert("Ann", `ann2-${stamp}`);
      made.push(keep, drop);
      await pool.query(`INSERT INTO checkins (session, signup_id, source) VALUES ('2026-10-13', $1, 'admin')`, [drop]);

      await savePersonProfile({
        signupId: keep,
        profile: { roles: ["owner"], level: null, industry: "food", tags: ["SEO"], resources: [], note: "keeps a café" },
        session: null,
        sessionNote: null,
      });
      await savePersonProfile({
        signupId: drop,
        profile: { roles: ["builder"], level: 3, industry: "tech", tags: ["seo", "iOS"], resources: ["有场地"], note: "ships iOS apps" },
        session: "2026-10-13",
        sessionNote: "showed a demo",
      });

      const roster = await listTaggingRoster("2026-10-13");
      const dropRow = roster.find((row) => row.id === drop)!;
      assert.equal(dropRow.checked_in, true);
      assert.equal(dropRow.session_note, "showed a demo");
      assert.deepEqual(dropRow.profile?.tags, ["seo", "iOS"]);

      assert.deepEqual(await mergeSignups(keep, drop), { ok: true });

      const merged = (await listProfiledPeople()).find((person) => person.id === keep)!;
      assert.ok(merged, "the kept row still has its notes");
      assert.deepEqual(merged.roles, ["builder", "owner"]);
      assert.equal(merged.level, 3, "a gap on keep is filled from the other row");
      assert.equal(merged.industry, "food", "keep's own value wins");
      assert.deepEqual(merged.tags, ["SEO", "iOS"], "joined without a case-only duplicate");
      assert.deepEqual(merged.resources, ["有场地"]);
      assert.equal(merged.note, "keeps a café\nships iOS apps");
      assert.deepEqual(merged.session_notes, [{ session: "2026-10-13", note: "showed a demo" }]);
      assert.deepEqual(merged.attended, ["2026-10-13"]);

      // Saving again with a blank morning note removes that note.
      await savePersonProfile({ signupId: keep, profile: merged, session: "2026-10-13", sessionNote: null });
      assert.deepEqual((await listProfiledPeople()).find((person) => person.id === keep)!.session_notes, []);
    } finally {
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.end();
    }
  },
);
