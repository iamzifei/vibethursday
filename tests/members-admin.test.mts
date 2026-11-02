/**
 * The 共创会员 register (2026-11-02): every paid membership in one list, by
 * how it was paid, with a way to record one paid outside the site (James:
 * "599 的支付做好记录……有的人也许确实付费了，但是网站没记录").
 *
 * A manual entry makes someone a member for a year, so it is organiser-only
 * and needs a note saying how they paid.
 *
 * DB part against a throwaway local Postgres:
 *   COURSE_TEST_DATABASE_URL=postgres://127.0.0.1:55433/vt_b npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { membershipSource, parseManualMember } from "../src/lib/membership-admin.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ a manual entry needs a name, a WeChat ID, a past date and a note on how they paid", () => {
  const ok = parseManualMember({ name: " Mia ", wechat: " mia_01 ", date: "2026-10-20", note: "10-20 转账给主办人" }, "2026-11-02");
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.value, { name: "Mia", wechat: "mia_01", paidOn: "2026-10-20", note: "10-20 转账给主办人" });
  const base = { name: "Mia", wechat: "mia_01", date: "2026-10-20", note: "n" };
  assert.equal(parseManualMember({ ...base, name: "" }, "2026-11-02").ok, false);
  assert.equal(parseManualMember({ ...base, wechat: "" }, "2026-11-02").ok, false);
  assert.equal(parseManualMember({ ...base, note: "  " }, "2026-11-02").ok, false, "a note is required");
  assert.equal(parseManualMember({ ...base, date: "2026-11-03" }, "2026-11-02").ok, false, "not in the future");
  assert.equal(parseManualMember({ ...base, date: "2025-10-01" }, "2026-11-02").ok, false, "not more than a year back: it would already have lapsed");
});

test("how a membership was paid: card (/join), the 10-25 class by transfer, or recorded by hand", () => {
  assert.equal(membershipSource({ course: "vt-cocreator", stripe_session: "cs_1", note: null }), "card");
  assert.equal(membershipSource({ course: "vt-cocreator", stripe_session: null, note: "手动登记：现金" }), "manual");
  assert.equal(membershipSource({ course: "vip-2026-10-25", stripe_session: null, note: null }), "class");
});

test("the register is organiser-only and posts to an organiser-only route", () => {
  assert.match(read("src/app/admin/members/page.tsx"), /isAdminSession/);
  const route = read("src/app/api/admin/membership/route.ts");
  assert.match(route, /isAdminRequest/);
  assert.match(route, /parseManualMember/);
});

const db = process.env.COURSE_TEST_DATABASE_URL;

test(
  "★ a manual entry makes them a member (matched by WeChat ID); a second one for the same person changes nothing",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { addManualMembership, ensureSchema, getPool, isMember, listMemberships } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const wechat = `manual-${Date.now()}`;
    let signupId = "";
    try {
      signupId = (await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat) VALUES ('Rae', $1) RETURNING id::text AS id`, [wechat])).rows[0].id;
      assert.equal(await isMember(signupId), false);
      const first = await addManualMembership({ name: "Rae", wechat: ` ${wechat.toUpperCase()} `, paidOn: "2026-10-20", note: "转账" });
      assert.equal(first, "added");
      assert.equal(await isMember(signupId), true);
      const row = (await listMemberships()).find((item) => item.wechat.trim().toLowerCase() === wechat);
      assert.equal(row?.paid_on, "2026-10-20");
      assert.equal(row?.expires_on, "2027-10-20");
      assert.match(row?.note ?? "", /手动登记/);
      assert.equal(await addManualMembership({ name: "Rae", wechat, paidOn: "2026-10-21", note: "again" }), "already");
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE lower(trim(wechat)) = $1`, [wechat]).catch(() => {});
      if (signupId) await pool.query(`DELETE FROM signups WHERE id = $1::bigint`, [signupId]).catch(() => {});
      await pool.end();
    }
  },
);
