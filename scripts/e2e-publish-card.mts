/**
 * End-to-end check for "tick the box at signup, land on the member wall".
 *
 * Not part of `npm test` on purpose: it needs a real Postgres, and the unit
 * suite must stay runnable with nothing installed. Run it against a throwaway
 * database when the signup or member SQL changes:
 *
 *   initdb -D /tmp/vtpg/data -U postgres --auth=trust
 *   pg_ctl -D /tmp/vtpg/data -o "-p 55433 -k /tmp/vtpg -c listen_addresses=''" start
 *   createdb -h /tmp/vtpg -p 55433 -U postgres vt
 *   DATABASE_URL="postgresql://postgres@/vt?host=/tmp/vtpg&port=55433" \
 *     node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     scripts/e2e-publish-card.mts
 *
 * The cases that matter are 5, 6 and 7: they are the ones where a careless
 * ON CONFLICT would quietly destroy something a member had done on purpose.
 */

import assert from "node:assert/strict";
import pg from "pg";

import { getMemberBySlug, listWallMembers, publishCardForSignup, saveSignup } from "@/lib/db";

const base = {
  email: null,
  demoIntent: "listen",
  firstSession: null,
  availability: [] as string[],
  source: null,
  lang: "zh",
  botCheck: "skipped",
};

const connectionString = process.env.DATABASE_URL ?? "";

/*
 * This script truncates tables, so it refuses to run against anything that
 * does not look like the throwaway instance in the header. The first version
 * had no guard and no cleanup, which left rows behind from a half-finished run
 * and made the next run fail on an assertion that was actually about stale
 * data — a false alarm is the cheap version of what an unguarded TRUNCATE
 * pointed at production would have been.
 */
const DISPOSABLE = /host=\/tmp\/|@localhost|@127\.0\.0\.1/;

if (!DISPOSABLE.test(connectionString)) {
  console.error("拒绝运行：DATABASE_URL 不像一次性实例。这个脚本会清空 signups 和 members。");
  console.error(`收到的是：${connectionString || "(空)"}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const passed: string[] = [];

const check = (label: string) => passed.push(label);

// Rerunnable from any state. `members` goes with it via ON DELETE CASCADE, but
// naming both makes the intent readable rather than implied.
await saveSignup({ ...base, name: "schema warmup", wechat: "wx_warmup", building: null, topic: null });
await pool.query("TRUNCATE signups, members RESTART IDENTITY CASCADE");

// 1 ── Not ticking the box leaves the wall alone.
await saveSignup({ ...base, name: "不勾的人", wechat: "wx_a", building: "在做 A", topic: "想聊 A" });
assert.equal((await listWallMembers()).length, 0, "没勾却上墙了");
check("不勾 → 不上墙");

// 2 ── Ticking it publishes a card built from the signup.
const id = await saveSignup({ ...base, name: "勾了的人", wechat: "wx_b", building: "在做 B", topic: "想聊 B" });
await publishCardForSignup(id);

const wall = await listWallMembers();
assert.equal(wall.length, 1, `勾了却没上墙，墙上 ${wall.length} 人`);
assert.equal(wall[0].display_name, "勾了的人");
assert.equal(wall[0].bio, "在做 B");
assert.equal(wall[0].looking_for, "想聊 B");
check("勾了 → 上墙，内容取自报名");

const slug = wall[0].slug;

// 3 ── Signing up again for another session must not produce a second card.
await publishCardForSignup(id);
assert.equal((await listWallMembers()).length, 1, "重复勾产生了第二张卡");
check("重复勾 → 幂等");

// 4 ── A returning person is the same signup row, so the same id comes back.
const idAgain = await saveSignup({ ...base, name: "勾了的人", wechat: "wx_b", building: null, topic: null });
assert.equal(idAgain, id, `老用户返回了新 id：${id} → ${idAgain}`);
check("老用户回来 → saveSignup 返回同一个 id");

// 5 ── Edits made in the card editor survive a later signup.
await pool.query(`UPDATE members SET display_name = '我改过的名字', bio = '我自己写的介绍' WHERE signup_id = $1`, [id]);
await publishCardForSignup(id);

const edited = await getMemberBySlug(slug);
assert.equal(edited?.display_name, "我改过的名字", "报名把用户改过的名字覆盖了");
assert.equal(edited?.bio, "我自己写的介绍", "报名把用户改过的简介覆盖了");
check("用户编辑过的卡片 → 报名不覆盖");

// 6 ── Taking your card down is explicit, and a tickbox elsewhere cannot undo it.
await pool.query(`UPDATE members SET hidden = true WHERE signup_id = $1`, [id]);
await publishCardForSignup(id);
assert.equal((await listWallMembers()).length, 0, "报名把用户主动隐藏的卡翻上来了");
await pool.query(`UPDATE members SET hidden = false WHERE signup_id = $1`, [id]);
check("用户隐藏过的卡 → 报名不翻回来");

// 7 ── A card claimed but never published is exactly who this feature is for.
await pool.query(`UPDATE members SET published_at = NULL WHERE signup_id = $1`, [id]);
assert.equal((await listWallMembers()).length, 0);
await publishCardForSignup(id);
assert.equal((await listWallMembers()).length, 1, "草稿勾了之后没被发布出来");
check("认领过但没发布的草稿 → 勾一下就上墙");

// 8 ── The contact fields the form promised to keep private stay off the card.
const row = await pool.query(`SELECT * FROM members WHERE signup_id = $1`, [id]);
assert.ok(!JSON.stringify(row.rows[0]).includes("wx_b"), "微信号进了成员卡");
check("邮箱 / 微信号 → 不进成员卡");

await pool.end();

console.log(`✅ ${passed.length} 项全过：`);
for (const label of passed) console.log(`   · ${label}`);
