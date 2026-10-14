/**
 * Build Tuesday's fee (2026-10-14, src/lib/tuesday-fee.ts): which Tuesdays
 * charge, what is transferred, that members come free, and that a second
 * signup keeps the first payment reference.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { feeFor, openSpecialSessions, SPECIAL_SESSIONS } from "../src/lib/sessions.ts";
import { feeLabel, feeToPay, looksLikeFeeRef, newFeeRef, payLabel } from "../src/lib/tuesday-fee.ts";

test("from 20 October every Tuesday is $30 + GST; Thursdays and the first two Tuesdays stay free", () => {
  assert.equal(feeFor("2026-10-06"), null);
  assert.equal(feeFor("2026-10-13"), null);
  assert.equal(feeFor("2026-10-15"), null, "a Thursday");
  assert.equal(feeFor("2026-10-20"), 30);
  for (const session of SPECIAL_SESSIONS.filter((s) => s.fee)) {
    assert.equal(new Date(`${session.date}T00:00:00Z`).getUTCDay(), 2, `${session.date} is a Tuesday`);
  }
});

test("only this Tuesday and the next are offered, not every listed one", () => {
  const open = openSpecialSessions("2026-10-14", 9).map((s) => s.date);
  assert.deepEqual(open, ["2026-10-20", "2026-10-27"]);
  // On the morning itself, until it ends.
  assert.deepEqual(openSpecialSessions("2026-10-20", 11).map((s) => s.date), ["2026-10-20", "2026-10-27", "2026-11-03"]);
  assert.deepEqual(openSpecialSessions("2026-10-20", 12).map((s) => s.date), ["2026-10-27", "2026-11-03"]);
});

test("the amount: listed before GST, transferred with it", () => {
  assert.equal(feeLabel(30), "30 澳元 + GST");
  assert.equal(feeToPay(30), 33);
  assert.equal(payLabel(30), "33 澳元（含 GST）");
});

test("references: TU plus five characters with no 0/O/1/I, never mistaken for a class reference", () => {
  for (let i = 0; i < 200; i += 1) {
    const ref = newFeeRef();
    assert.ok(looksLikeFeeRef(ref), ref);
    assert.doesNotMatch(ref.slice(2), /[01OI]/);
  }
  assert.equal(looksLikeFeeRef("AIABCDE"), false);
});

test("no bank details in the source: they come from TUESDAY_PAYMENT_INFO", () => {
  for (const file of ["src/lib/tuesday-fee.ts", "src/app/tuesday/pay/page.tsx"]) {
    const source = readFileSync(path.join(import.meta.dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /\bBSB\b|\b\d{3}-\d{3}\b/, file);
  }
});

/*
 * Against a throwaway local Postgres, like the schema test:
 *   FEE_TEST_DATABASE_URL=postgres://localhost:55433/vt_fee_test pnpm test
 */
const db = process.env.FEE_TEST_DATABASE_URL;

test(
  "★ members are free, a second signup keeps the reference, and a merge keeps the fee",
  { skip: db ? false : "set FEE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { ensureSchema, getPool, getOrCreateSessionFee, isMember, listTuesdayFeeDesk, mergeSignups } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    const made: string[] = [];
    const insert = async (name: string, wechat: string) => {
      const id = (
        await pool.query<{ id: string }>(
          `INSERT INTO signups (name, wechat, sessions) VALUES ($1, $2, ARRAY['2026-10-20']::date[]) RETURNING id::text AS id`,
          [name, wechat],
        )
      ).rows[0].id;
      made.push(id);
      return id;
    };

    try {
      const member = await insert("Mia", `Mia ${stamp}`);
      const guest = await insert("Gus", `gus-${stamp}`);
      await pool.query(
        `INSERT INTO course_orders (course, name, wechat, ref, status, paid_at) VALUES ('test', 'Mia', $1, $2, 'paid', now())`,
        [`mia${stamp}`, `AI${String(stamp).slice(-5)}`],
      );
      assert.equal(await isMember(member), true, "matched by WeChat ID, ignoring case and spaces");
      assert.equal(await isMember(guest), false);

      const first = await getOrCreateSessionFee("2026-10-20", guest, "TUAAAAA");
      const again = await getOrCreateSessionFee("2026-10-20", guest, "TUBBBBB");
      assert.equal(again.ref, first.ref, "signing up twice keeps one reference");

      const desk = await listTuesdayFeeDesk("2026-10-20");
      assert.equal(desk.find((row) => row.signup_id === member)?.member, true);
      assert.equal(desk.find((row) => row.signup_id === guest)?.ref, "TUAAAAA");

      // The same person under a second row: the fee moves to the row kept.
      const dupe = await insert("Gus", `gus2-${stamp}`);
      assert.deepEqual(await mergeSignups(dupe, guest), { ok: true });
      const after = await listTuesdayFeeDesk("2026-10-20");
      assert.equal(after.find((row) => row.signup_id === dupe)?.ref, "TUAAAAA");
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE course = 'test'`).catch(() => {});
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.end();
    }
  },
);
