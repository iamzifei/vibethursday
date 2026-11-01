/**
 * "What are you bringing to this Tuesday?" (2026-11-01): need / project / help,
 * asked when someone books a Build Tuesday so its one or two cases can be lined
 * up before the morning, and shown on the admin Tuesday desk.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";

const root = path.resolve(import.meta.dirname, "..");

test("the options the form offers are exactly the ones the API stores, in both languages", () => {
  // The route whitelists these; an option outside the list would be dropped
  // without a word, and the desk would show "—" for someone who answered.
  const route = readFileSync(path.join(root, "src/app/api/signup/route.ts"), "utf8");
  const accepted = route.match(/TUESDAY_BRING = new Set\(\[([^\]]+)\]\)/);
  assert.ok(accepted, "the route keeps a TUESDAY_BRING whitelist");
  const values = [...accepted[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();

  for (const lang of ["zh", "en"] as const) {
    const offered = copy[lang].signup.fields.tuesdayBringOptions.map((option) => option.value).sort();
    assert.deepEqual(offered, values, `${lang} offers a different set`);
  }
});

const db = process.env.FEE_TEST_DATABASE_URL;

test(
  "★ the answer is kept per Tuesday and read back on the desk with the sentence",
  { skip: db ? false : "set FEE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { ensureSchema, getPool, listTuesdayFeeDesk, setTuesdayBring } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    let id = "";
    try {
      id = (
        await pool.query<{ id: string }>(
          `INSERT INTO signups (name, wechat, topic, sessions) VALUES ('Ann', $1, '每天回客人微信两小时', ARRAY['2026-11-03','2026-11-10']::date[]) RETURNING id::text AS id`,
          [`ann-${stamp}`],
        )
      ).rows[0].id;
      await setTuesdayBring(id, "2026-11-03", "need");
      await setTuesdayBring(id, "2026-11-10", "help");

      const first = (await listTuesdayFeeDesk("2026-11-03")).find((row) => row.signup_id === id);
      assert.equal(first?.bring, "need");
      assert.equal(first?.topic, "每天回客人微信两小时");
      const second = (await listTuesdayFeeDesk("2026-11-10")).find((row) => row.signup_id === id);
      assert.equal(second?.bring, "help", "next week's answer is its own");
    } finally {
      if (id) await pool.query(`DELETE FROM session_fees WHERE signup_id = $1::bigint`, [id]).catch(() => {});
      if (id) await pool.query(`DELETE FROM signups WHERE id = $1::bigint`, [id]).catch(() => {});
      await pool.end();
    }
  },
);
