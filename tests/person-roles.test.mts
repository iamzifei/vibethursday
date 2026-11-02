/**
 * Two roles the organiser hands out by hand (2026-11-02), next to the paid
 * 共创会员:
 * - 共建者 (builder): someone from a Build Tuesday who has joined a project,
 *   on either side of it — building it or the one who needs it.
 * - 导师团 (mentor): invited by the organiser for what they know; comes to
 *   Tuesdays free, like a 共创会员.
 * Neither is bought; both are added and removed on /admin/roles.
 *
 * DB part against a throwaway local Postgres:
 *   FEE_TEST_DATABASE_URL=postgres://127.0.0.1:55433/vt_d npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PERSON_ROLE_KINDS, ROLE_LABEL } from "../src/lib/person-roles.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("the roles, named as the organiser names them", () => {
  // Spec change 2026-11-02: 志愿者 added (free on Tuesdays, not on public cards),
  // then 助理 (the team; signs in at /staff, not on public cards, not free).
  assert.deepEqual([...PERSON_ROLE_KINDS], ["builder", "mentor", "volunteer", "assistant"]);
  assert.equal(ROLE_LABEL.assistant, "助理");
  assert.equal(ROLE_LABEL.builder, "共建者");
  assert.equal(ROLE_LABEL.mentor, "导师团");
});

test("★ every place that waives the Tuesday fee asks isTuesdayFree, not isMember", () => {
  for (const file of [
    "src/app/api/signup/route.ts",
    "src/app/tuesday/pay/page.tsx",
    "src/app/my/page.tsx",
    "src/app/api/my/route.ts",
    "src/app/api/admin/waitlist/route.ts",
  ]) {
    assert.match(read(file), /isTuesdayFree\(/, file);
  }
});

test("roles are managed on an organiser-only page, and shown as badges on member cards", () => {
  assert.match(read("src/app/admin/roles/page.tsx"), /isAdminSession/);
  // Spec change 2026-11-02: the admin check is authorise(request, "admin").
  assert.match(read("src/app/api/admin/roles/route.ts"), /authorise\(request, "admin"/);
  assert.match(read("src/components/MemberCard.tsx"), /member\.mentor/);
  assert.match(read("src/components/MemberCard.tsx"), /member\.builder/);
});

const db = process.env.FEE_TEST_DATABASE_URL;

test(
  "★ a mentor comes to Tuesdays free; a builder does not; removing the role ends it",
  { skip: db ? false : "set FEE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { ensureSchema, getPool, isMember, isTuesdayFree, listPersonRoles, removePersonRole, setPersonRole } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    let id = "";
    try {
      id = (await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat) VALUES ('Mo', $1) RETURNING id::text AS id`, [`mo-${Date.now()}`])).rows[0].id;
      assert.equal(await isTuesdayFree(id), false);

      await setPersonRole(id, "builder", "一起做 Plugroo");
      assert.equal(await isTuesdayFree(id), false, "a builder still pays");

      await setPersonRole(id, "mentor", null);
      assert.equal(await isTuesdayFree(id), true, "a mentor comes free");
      assert.equal(await isMember(id), false, "and is not thereby a 共创会员");
      await setPersonRole(id, "mentor", "改备注");
      const mine = (await listPersonRoles()).filter((row) => row.signup_id === id);
      assert.equal(mine.length, 2, "one row per role, not per save");
      assert.equal(mine.find((row) => row.role === "mentor")?.note, "改备注");

      await removePersonRole(id, "mentor");
      assert.equal(await isTuesdayFree(id), false);
    } finally {
      if (id) await pool.query(`DELETE FROM signups WHERE id = $1::bigint`, [id]).catch(() => {});
      await pool.end();
    }
  },
);
