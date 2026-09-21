/**
 * End-to-end check for "why are you coming this time", stored per session.
 *
 * Not part of `npm test`: it needs a real Postgres. Run it against the smoke
 * stack when the purposes SQL changes:
 *
 *   ./scripts/smoke-db.sh start
 *   DATABASE_URL="postgresql://vt@127.0.0.1:55432/vibethursday" \
 *     node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     scripts/e2e-purpose.mts
 *
 * The case that matters is 3: a second week's answer must not erase the first.
 */

import assert from "node:assert/strict";
import pg from "pg";

import { listSignups, saveSignup } from "@/lib/db";

const base = {
  email: null,
  building: null,
  demoIntent: "listen",
  availability: [] as string[],
  aiModels: [] as string[],
  aiSpend: null,
  source: null,
  lang: "zh",
  botCheck: "skipped",
  topic: null,
};

const WEEK_ONE = "2026-09-24";
const WEEK_TWO = "2026-10-01";

const connectionString = process.env.DATABASE_URL ?? "";
const DISPOSABLE = /host=\/tmp\/|@localhost|@127\.0\.0\.1/;

if (!DISPOSABLE.test(connectionString)) {
  console.error("拒绝运行：DATABASE_URL 不像一次性实例。这个脚本会清空 signups。");
  console.error(`收到的是：${connectionString || "(空)"}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const passed: string[] = [];
const check = (label: string) => passed.push(label);

// Warm the schema through the app's own path, then start from nothing.
await saveSignup({ ...base, name: "schema warmup", wechat: "wx_warmup", firstSession: null, purpose: null });
await pool.query("TRUNCATE signups RESTART IDENTITY CASCADE");

const purposesOf = async (name: string) =>
  (await listSignups()).find((row) => row.name === name)?.purposes;

// 1 ── A new signup with a session and a purpose records it against that session.
await saveSignup({ ...base, name: "甲", wechat: "wx_a", firstSession: WEEK_ONE, purpose: "biz" });
assert.equal(await purposesOf("甲"), `${WEEK_ONE}=biz`);
check("新报名 → 记在那一场下");

// 2 ── Changing your mind for the same week corrects it, not duplicates it.
await saveSignup({ ...base, name: "甲", wechat: "wx_a", firstSession: WEEK_ONE, purpose: "product" });
assert.equal(await purposesOf("甲"), `${WEEK_ONE}=product`);
check("同一场改答案 → 覆盖那一场");

// 3 ── Next week's answer is added; last week's stays.
await saveSignup({ ...base, name: "甲", wechat: "wx_a", firstSession: WEEK_TWO, purpose: "learn" });
assert.equal(await purposesOf("甲"), `${WEEK_ONE}=product ${WEEK_TWO}=learn`);
check("下一场 → 追加，不覆盖上一场");

// 4 ── A stale page that sends no purpose leaves every answer alone.
await saveSignup({ ...base, name: "甲", wechat: "wx_a", firstSession: WEEK_TWO, purpose: null });
assert.equal(await purposesOf("甲"), `${WEEK_ONE}=product ${WEEK_TWO}=learn`);
check("没带 purpose 的旧页面 → 什么都不动");

// 5 ── "Not coming" records no purpose, for a new row and an existing one.
await saveSignup({ ...base, name: "乙", wechat: "wx_b", firstSession: null, purpose: "tech" });
assert.equal(await purposesOf("乙"), "");
await saveSignup({ ...base, name: "甲", wechat: "wx_a", firstSession: null, purpose: "other" });
assert.equal(await purposesOf("甲"), `${WEEK_ONE}=product ${WEEK_TWO}=learn`);
check("没选场次 → 不记");

// 6 ── The sessions array still unions exactly as before.
const row = (await listSignups()).find((signup) => signup.name === "甲");
assert.deepEqual(row?.sessions, [WEEK_ONE, WEEK_TWO]);
check("sessions 行为不变");

await pool.end();

console.log(passed.map((label) => `✓ ${label}`).join("\n"));
console.log(`\n${passed.length}/6 通过`);
process.exit(0);
