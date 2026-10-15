/**
 * The dinner after a Thursday (2026-10-15, src/lib/dinner.ts): off unless
 * configured, seats capped with a waitlist, a second signup keeps the seat.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { dinnerConfig, looksLikeDinnerRef, newDinnerRef } from "../src/lib/dinner.ts";

const GOOD = JSON.stringify({ place: "示范餐厅", time: "12:15", price: 45, dishes: [{ id: "a", zh: "牛肉面", en: "Beef noodles" }] });

test("the dinner is off unless DINNER_CONFIG is set and valid", () => {
  assert.equal(dinnerConfig(undefined), null);
  assert.equal(dinnerConfig("not json"), null);
  assert.equal(dinnerConfig(JSON.stringify({ place: "x", time: "y", price: 45, dishes: [] })), null, "no dishes, no dinner");
  assert.equal(dinnerConfig(JSON.stringify({ place: "x", time: "y", price: 0, dishes: [{ id: "a", zh: "面" }] })), null, "no price, no dinner");
  const c = dinnerConfig(GOOD);
  assert.equal(c?.cap, 12, "twelve seats unless set");
  assert.equal(c?.dishes[0].en, "Beef noodles");
});

test("references: DN plus five characters, never mistaken for a fee or class reference", () => {
  for (let i = 0; i < 100; i += 1) assert.ok(looksLikeDinnerRef(newDinnerRef()));
  assert.equal(looksLikeDinnerRef("TUABCDE"), false);
  assert.equal(looksLikeDinnerRef("AIABCDE"), false);
});

/*
 * Against a throwaway local Postgres:
 *   DINNER_TEST_DATABASE_URL=postgres://localhost:55433/vt_dinner_test pnpm test
 */
const db = process.env.DINNER_TEST_DATABASE_URL;

test(
  "★ seats fill to the cap then waitlist; signing up again keeps the reference and updates the dish",
  { skip: db ? false : "set DINNER_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { ensureSchema, getPool, bookDinner, listDinner } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const session = "2026-10-29";
    const made: string[] = [];
    const person = async (n: number) => {
      const id = (await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat, sessions) VALUES ($1, $2, ARRAY[$3]::date[]) RETURNING id::text AS id`, [`p${n}`, `dinner-${Date.now()}-${n}`, session])).rows[0].id;
      made.push(id);
      return id;
    };
    try {
      const a = await person(1), b = await person(2), c = await person(3);
      const first = await bookDinner({ session, signupId: a, dish: "x", ref: newDinnerRef(), cap: 2 });
      assert.equal(first.status, "pending");
      assert.equal((await bookDinner({ session, signupId: b, dish: "x", ref: newDinnerRef(), cap: 2 })).status, "pending");
      assert.equal((await bookDinner({ session, signupId: c, dish: "x", ref: newDinnerRef(), cap: 2 })).status, "waitlist", "the third of two seats waits");
      const again = await bookDinner({ session, signupId: a, dish: "y", ref: newDinnerRef(), cap: 2 });
      assert.equal(again.ref, first.ref, "same seat, same reference");
      assert.equal((await listDinner(session)).find((row) => row.ref === first.ref)?.dish, "y");
      // Cancelling the Thursday frees an unpaid seat, so it no longer counts against the cap.
      const { cancelSession } = await import("../src/lib/db.ts");
      await cancelSession(a, session);
      assert.equal((await listDinner(session)).find((row) => row.ref === first.ref)?.status, "cancelled");
    } finally {
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.end();
    }
  },
);
