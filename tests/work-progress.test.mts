/**
 * A work's progress (2026-11-02): a dated record of how a project moved —
 * demoed at a Build Tuesday, launched, first users, first revenue, a
 * third-party certificate — shown on the work's own page.
 *
 * The record is written by the organiser from what happened in the room, and
 * nothing is public until it is confirmed: confirming means the maker agreed
 * to that one line being shown. Members do not write it themselves (most
 * cards are two lines long; a field nobody fills would be an empty promise).
 *
 * Pure tests need no database. The last one runs against a throwaway local
 * Postgres:
 *   PROFILE_TEST_DATABASE_URL=postgres://127.0.0.1:55433/vt_e npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  PROGRESS_KINDS,
  lastTuesdayDemo,
  parseProgressForm,
  publicTimeline,
  titleHash,
  type ProgressEntry,
} from "../src/lib/progress.ts";
import { workKey } from "../src/lib/works.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const entry = (over: Partial<ProgressEntry>): ProgressEntry => ({
  id: "1",
  member_id: "7",
  work_hash: "abc123",
  happened_on: "2026-10-13",
  kind: "note",
  title: "x",
  detail: null,
  proof_url: null,
  confirmed: true,
  ...over,
});

test("the title hash is the tail of the work's key, so a record survives a change of handle", () => {
  assert.equal(titleHash("Windsify"), workKey("momo", "Windsify").slice(-6));
  assert.equal(titleHash("  windsify "), titleHash("Windsify"));
  assert.equal(workKey("someone-else", "Windsify").slice(-6), titleHash("Windsify"));
});

test("the kinds are a closed list, and a certificate is one of them", () => {
  assert.deepEqual([...PROGRESS_KINDS], ["tuesday", "launch", "users", "revenue", "credential", "note"]);
});

test("★ a valid form becomes an entry; anything off the list is refused", () => {
  const ok = parseProgressForm({
    member: "7",
    hash: "abc123",
    date: "2026-10-13",
    kind: "credential",
    title: "  考下 AWS Certified AI Practitioner  ",
    detail: "",
    proof: "https://www.credly.com/badges/xyz",
  });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.title, "考下 AWS Certified AI Practitioner");
    assert.equal(ok.value.detail, null, "an empty detail is no detail");
    assert.equal(ok.value.proofUrl, "https://www.credly.com/badges/xyz");
  }

  const base = { member: "7", hash: "abc123", date: "2026-10-13", kind: "note", title: "t" };
  assert.equal(parseProgressForm({ ...base, kind: "award" }).ok, false, "unknown kind");
  assert.equal(parseProgressForm({ ...base, date: "2026-02-31" }).ok, false, "impossible date");
  assert.equal(parseProgressForm({ ...base, hash: "ABC" }).ok, false, "not a title hash");
  assert.equal(parseProgressForm({ ...base, member: "x" }).ok, false, "not a member id");
  assert.equal(parseProgressForm({ ...base, title: "   " }).ok, false, "no title");
  assert.equal(parseProgressForm({ ...base, title: "字".repeat(141) }).ok, false, "title too long");
  assert.equal(parseProgressForm({ ...base, detail: "字".repeat(501) }).ok, false, "detail too long");
  assert.equal(parseProgressForm({ ...base, proof: "http://example.com" }).ok, false, "proof must be https");
  assert.equal(parseProgressForm({ ...base, proof: "javascript:alert(1)" }).ok, false, "no scripts");
});

test("★ the public timeline is confirmed entries only, newest first", () => {
  const timeline = publicTimeline([
    entry({ id: "1", happened_on: "2026-10-06", confirmed: true }),
    entry({ id: "2", happened_on: "2026-10-27", confirmed: false }),
    entry({ id: "3", happened_on: "2026-10-20", confirmed: true }),
    entry({ id: "4", happened_on: "2026-10-20", confirmed: true }),
  ]);
  assert.deepEqual(timeline.map((item) => item.id), ["4", "3", "1"], "a draft never shows; same day → later entry first");
});

test("'demoed at a Tuesday' is the latest confirmed Tuesday entry, never a draft", () => {
  assert.equal(
    lastTuesdayDemo([
      entry({ kind: "tuesday", happened_on: "2026-10-13" }),
      entry({ kind: "tuesday", happened_on: "2026-10-27", confirmed: false }),
      entry({ kind: "tuesday", happened_on: "2026-10-20" }),
      entry({ kind: "launch", happened_on: "2026-10-30" }),
    ]),
    "2026-10-20",
  );
  assert.equal(lastTuesdayDemo([entry({ kind: "launch" })]), null);
});

test("the schema creates the table after members, and the work page shows the timeline", () => {
  const db = read("src/lib/db.ts");
  const members = db.indexOf("CREATE TABLE IF NOT EXISTS members (");
  const progress = db.indexOf("CREATE TABLE IF NOT EXISTS work_progress (");
  assert.ok(progress > members && members > 0, "work_progress is created after members");

  const page = read("src/app/works/[key]/page.tsx");
  assert.match(page, /publicTimeline/);
  // A certificate links to whoever issued it; the site vouches for nothing.
  assert.match(page, /rel="nofollow noopener noreferrer"/);

  const list = read("src/app/works/page.tsx");
  assert.match(list, /lastTuesdayDemo/);
});

test("only an organiser can write a record, and it starts as a draft", () => {
  const route = read("src/app/api/admin/progress/route.ts");
  assert.match(route, /isAdminRequest/);
  assert.match(route, /parseProgressForm/);
  const page = read("src/app/admin/progress/page.tsx");
  assert.match(page, /isAdminSession/);
});

test("member pages still stay out of the sitemap", () => {
  const sitemap = read("src/app/sitemap.ts");
  assert.doesNotMatch(sitemap, /`\/members\/\$\{/);
});

const db = process.env.PROFILE_TEST_DATABASE_URL;

test(
  "★ a record is a draft until confirmed, is per work, and goes with the card",
  { skip: db ? false : "set PROFILE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { addProgress, deleteProgress, ensureSchema, getPool, listProgress, setProgressConfirmed } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    let signupId = "";
    try {
      signupId = (
        await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat) VALUES ('Pia', $1) RETURNING id::text AS id`, [`pia-${stamp}`])
      ).rows[0].id;
      const memberId = (
        await pool.query<{ id: string }>(
          `INSERT INTO members (signup_id, slug, display_name, published_at) VALUES ($1, $2, 'Pia', now()) RETURNING id::text AS id`,
          [signupId, `pia-${stamp}`],
        )
      ).rows[0].id;

      const id = await addProgress({
        memberId, workHash: titleHash("Plugroo"), happenedOn: "2026-10-13", kind: "tuesday",
        title: "第一次在周二 demo", detail: null, proofUrl: null,
      });
      let mine = (await listProgress()).filter((item) => item.member_id === memberId);
      assert.equal(mine.length, 1);
      assert.equal(mine[0].confirmed, false, "starts as a draft");
      assert.equal(mine[0].happened_on, "2026-10-13", "a date, not a timestamp shifted by the time zone");

      await setProgressConfirmed(id, true);
      mine = (await listProgress()).filter((item) => item.member_id === memberId);
      assert.equal(mine[0].confirmed, true);

      await deleteProgress(id);
      assert.equal((await listProgress()).filter((item) => item.member_id === memberId).length, 0);

      // Removing the card removes its records.
      await addProgress({ memberId, workHash: titleHash("Plugroo"), happenedOn: "2026-10-20", kind: "note", title: "n", detail: null, proofUrl: null });
      await pool.query(`DELETE FROM members WHERE id = $1::bigint`, [memberId]);
      assert.equal((await listProgress()).filter((item) => item.member_id === memberId).length, 0);
    } finally {
      if (signupId) await pool.query(`DELETE FROM signups WHERE id = $1::bigint`, [signupId]).catch(() => {});
      await pool.end();
    }
  },
);
