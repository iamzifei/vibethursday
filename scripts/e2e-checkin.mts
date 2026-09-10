/**
 * End-to-end check for checking in on the day.
 *
 * Not part of `npm test` on purpose: it needs a real Postgres, and the unit
 * suite must stay runnable with nothing installed. Run it against a throwaway
 * database when the check-in SQL changes — the smoke stack is one:
 *
 *   ./scripts/smoke-db.sh start
 *   DATABASE_URL="postgresql://vt@127.0.0.1:55432/vibethursday" ADMIN_TOKEN=smoke \
 *     node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     scripts/e2e-checkin.mts
 *
 * The cases that matter are 4 and 6: a person's own "show my name" answer
 * must survive the organiser ticking them, and the export must say who was
 * there without inventing anyone.
 */

import assert from "node:assert/strict";
import pg from "pg";

import { buildRoster, buildWall } from "@/lib/checkin";
import {
  checkIn,
  countCheckins,
  listCheckins,
  listRoster,
  listSignups,
  publishCardForSignup,
  saveSignup,
  undoCheckin,
} from "@/lib/db";

const base = {
  email: null,
  demoIntent: "listen",
  availability: [] as string[],
  aiModels: [] as string[],
  aiSpend: null,
  source: null,
  lang: "zh",
  botCheck: "skipped",
  topic: null,
};

const TODAY = "2026-09-10";
const LAST_WEEK = "2026-09-03";

const connectionString = process.env.DATABASE_URL ?? "";

/* Same guard as the other e2e script: this truncates, so it refuses anything
 * that does not look like a throwaway instance. */
const DISPOSABLE = /host=\/tmp\/|@localhost|@127\.0\.0\.1/;

if (!DISPOSABLE.test(connectionString)) {
  console.error("拒绝运行：DATABASE_URL 不像一次性实例。这个脚本会清空 signups / members / checkins。");
  console.error(`收到的是：${connectionString || "(空)"}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const passed: string[] = [];
const check = (label: string) => passed.push(label);

await saveSignup({ ...base, name: "schema warmup", wechat: "wx_warmup", building: null, firstSession: null });
await pool.query("TRUNCATE signups, members, checkins RESTART IDENTITY CASCADE");

// Three people signed up for today, one for last week only.
const ada = await saveSignup({ ...base, name: "Ada", wechat: "wx_ada", building: "在做 A", firstSession: TODAY });
const ben = await saveSignup({ ...base, name: "Ben", wechat: "wx_ben", building: "在做 B", firstSession: TODAY });
const cai = await saveSignup({ ...base, name: "Cai", wechat: "wx_cai", building: "在做 C", firstSession: TODAY });
await saveSignup({ ...base, name: "Old", wechat: "wx_old", building: "上周的", firstSession: LAST_WEEK });
await publishCardForSignup(ada);

// 1 ── The roster is today's signups and nobody else.
let roster = buildRoster(TODAY, await listRoster(TODAY), await listCheckins(TODAY));
assert.deepEqual(roster.map((entry) => entry.name), ["Ada", "Ben", "Cai"]);
assert.equal(roster.every((entry) => !entry.checkedIn), true);
check("名单 = 今天报名的人");

// 2 ── Tapping puts you on the wall when you said so, and only then.
await checkIn({ session: TODAY, signupId: ada, onWall: true, source: "qr" });
await checkIn({ session: TODAY, signupId: ben, onWall: false, source: "qr" });

let rows = await listCheckins(TODAY);
assert.equal(rows.length, 2);
let wall = buildWall(rows);
assert.equal(wall.total, 2);
assert.equal(wall.unnamed, 1, "Ben 说了不上墙");
assert.deepEqual(wall.entries.map((entry) => [entry.kind, entry.name]), [["card", "Ada"]], "Ada 有卡，墙上是她的卡");
assert.equal(wall.entries[0].kind === "card" && wall.entries[0].slug, rows[0].member!.slug);
check("签到 → 上墙与否照本人的答案");

// 3 ── Tapping twice is one row, and the second answer wins.
await checkIn({ session: TODAY, signupId: ben, onWall: true, source: "qr" });
rows = await listCheckins(TODAY);
assert.equal(rows.length, 2, "重复签到多了一行");
assert.equal(rows.find((row) => row.signup_id === ben)?.on_wall, true, "第二次的答案没有生效");
check("重复签到 → 幂等，以最后一次答案为准");

// 4 ── The organiser's tick never overrides what a person answered.
await checkIn({ session: TODAY, signupId: ben, onWall: false, source: "admin" });
rows = await listCheckins(TODAY);
assert.equal(rows.find((row) => row.signup_id === ben)?.on_wall, true, "管理员的勾把本人的上墙答案盖掉了");
assert.equal(rows.find((row) => row.signup_id === ben)?.source, "qr");
await checkIn({ session: TODAY, signupId: cai, onWall: false, source: "admin" });
rows = await listCheckins(TODAY);
assert.equal(rows.find((row) => row.signup_id === cai)?.source, "admin");
check("管理员手动签到 → 不改本人的上墙答案");

// 5 ── A walk-in is a signup for today, and on the roster once checked in.
const dee = await saveSignup({ ...base, name: "Dee", wechat: null, building: "现场来的", firstSession: TODAY, source: "walk-in" });
await checkIn({ session: TODAY, signupId: dee, onWall: true, source: "walk-in" });
roster = buildRoster(TODAY, await listRoster(TODAY), await listCheckins(TODAY));
assert.deepEqual(
  roster.filter((entry) => entry.checkedIn).map((entry) => entry.name).sort(),
  ["Ada", "Ben", "Cai", "Dee"],
);
wall = buildWall(await listCheckins(TODAY));
assert.deepEqual(
  wall.entries.filter((entry) => entry.kind === "light").map((entry) => [entry.name, entry.building]),
  [["Ben", "在做 B"], ["Dee", "现场来的"]],
);
check("walk-in → 进报名库 + 签到 + 轻卡上墙");

// 6 ── The export says who was there, per session, and nothing more.
const signups = await listSignups();
const byName = Object.fromEntries(signups.map((row) => [row.name, row.checked_in]));
assert.deepEqual(byName["Ada"], [TODAY]);
assert.deepEqual(byName["Old"], []);
assert.deepEqual(byName["schema warmup"] ?? [], [], "warmup 行不该在");
assert.equal((await countCheckins()).get(TODAY), 4);
assert.equal((await countCheckins()).has(LAST_WEEK), false, "没人签到的场次不该有数");
check("导出 checked_in 列 + 每场到场数");

// 7 ── Undo removes the row, and only that row.
await undoCheckin(TODAY, cai);
assert.equal((await listCheckins(TODAY)).length, 3);
assert.equal((await countCheckins()).get(TODAY), 3);
check("撤销 → 只删那一人");

// 8 ── Contact details are not in what the wall is built from.
const wallInput = buildWall(await listCheckins(TODAY));
assert.ok(!JSON.stringify(wallInput).includes("wx_"), "微信号进了墙的数据");
check("墙的数据里没有联系方式");

await pool.end();

console.log(passed.map((label) => `✓ ${label}`).join("\n"));
console.log(`\n${passed.length}/8 通过`);
