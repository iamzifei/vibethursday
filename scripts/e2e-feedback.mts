/**
 * End-to-end check for feedback on a session.
 *
 * Not part of `npm test` on purpose: it needs a real Postgres and a running
 * build, and the unit suite must stay runnable with nothing installed. The
 * smoke stack is one command:
 *
 *   ./scripts/smoke-db.sh start
 *   DATABASE_URL="postgresql://vt@127.0.0.1:55432/vibethursday" \
 *     MEMBER_SECRET="smoke-only-member-secret-not-a-secret" \
 *     node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     scripts/e2e-feedback.mts
 *
 * ★ This posts to the real route rather than calling `saveFeedback` directly,
 * because everything worth checking here lives in the route: the code, the
 * window, and the whitelists. A test that called the database helper would
 * pass with all three of them deleted.
 *
 * The cases that matter are 3 and 4 — a code for the wrong session and a
 * session whose week is over must both be refused, since those are the two
 * ways a stale link in a group chat files an answer under the wrong morning.
 */

import assert from "node:assert/strict";
import pg from "pg";

import { listFeedback } from "@/lib/db";
import { feedbackCode, summarise } from "@/lib/feedback";
import { sydneyToday } from "@/lib/sessions";

const connectionString = process.env.DATABASE_URL ?? "";
const app = process.env.APP_URL ?? "http://127.0.0.1:3111";
const secret = process.env.MEMBER_SECRET ?? process.env.ADMIN_TOKEN ?? "";

/* Same guard as the other e2e scripts: this truncates, so it refuses anything
 * that does not look like a throwaway instance. */
const DISPOSABLE = /host=\/tmp\/|@localhost|@127\.0\.0\.1/;

if (!DISPOSABLE.test(connectionString)) {
  console.error("拒绝运行：DATABASE_URL 不像一次性实例。这个脚本会清空 feedback 表。");
  console.error(`收到的是：${connectionString || "(空)"}`);
  process.exit(1);
}

if (!secret) {
  console.error("要 MEMBER_SECRET（或 ADMIN_TOKEN），否则算不出反馈码。");
  process.exit(1);
}

const TODAY = sydneyToday().toISOString().slice(0, 10);

/** A session whose week is long over. */
const OLD = new Date(Date.parse(`${TODAY}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);

const pool = new pg.Pool({ connectionString });
const passed: string[] = [];
const check = (label: string) => passed.push(label);

/** Posts the form the page posts, and reports where the route sent it. */
async function post(fields: Record<string, string>): Promise<string> {
  const body = new URLSearchParams(fields);

  const response = await fetch(`${app}/api/feedback`, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  assert.equal(response.status, 303, "每一条路径都应该是 303 回跳");

  const location = response.headers.get("location") ?? "";
  return new URL(location, app).search;
}

// The schema is created on first use; touching the table guarantees it exists
// before the TRUNCATE below.
await listFeedback();
await pool.query("TRUNCATE feedback RESTART IDENTITY");

const code = feedbackCode(TODAY, secret);

// 1 ── A filled-in form goes in.
let where = await post({
  session: TODAY,
  code,
  lang: "zh",
  rating: "5",
  recommend: "yes",
  best: "分桌之后那一段",
  better: "开场再短一点",
  name: "Ada",
});
assert.match(where, /done=1/, `交上去应该 done，实际 ${where}`);

let rows = await listFeedback(TODAY);
assert.equal(rows.length, 1);
assert.equal(rows[0].rating, 5);
assert.equal(rows[0].recommend, "yes");
assert.equal(rows[0].name, "Ada");
check("填好的表 → 入库");

// 2 ── Anonymous, and with half the questions skipped, is still a valid form.
where = await post({ session: TODAY, code, lang: "zh", rating: "4", better: "桌子之间太吵" });
assert.match(where, /done=1/);

rows = await listFeedback(TODAY);
assert.equal(rows.length, 2);
const anon = rows.find((row) => row.name === null);
assert.ok(anon, "匿名那一份应该在");
assert.equal(anon.recommend, null, "跳过的题必须是 null，不是空串也不是 0");
assert.equal(anon.best, null);
check("匿名 + 跳过的题 → 存成 null");

// 3 ── A code for another session is refused.
where = await post({ session: TODAY, code: feedbackCode("2020-01-02", secret), lang: "zh", rating: "1" });
assert.match(where, /err=code/, `别的场次的码应该被拒，实际 ${where}`);
assert.equal((await listFeedback(TODAY)).length, 2, "被拒的提交不该留下行");
check("别的场次的码 → 拒");

// 4 ── ★ A session whose week is over is refused, even with its own real code.
where = await post({ session: OLD, code: feedbackCode(OLD, secret), lang: "zh", rating: "5" });
assert.match(where, /err=code/, `过期的场次应该被拒，实际 ${where}`);
assert.equal((await listFeedback(OLD)).length, 0, "过期的场次不该收到行");
check("★ 窗口关了的场次 → 拒（码是对的也拒）");

// 5 ── A form with nothing in it is refused, and a name alone is nothing.
where = await post({ session: TODAY, code, lang: "zh" });
assert.match(where, /err=empty/, `空表应该被拒，实际 ${where}`);

where = await post({ session: TODAY, code, lang: "zh", name: "只写了名字" });
assert.match(where, /err=empty/, "只有名字不算答了题");
assert.equal((await listFeedback(TODAY)).length, 2);
check("空表 / 只有名字 → 拒");

// 6 ── Out-of-range answers are dropped, not stored.
where = await post({
  session: TODAY,
  code,
  lang: "zh",
  rating: "9",
  recommend: "banana",
  best: "这一句得留着",
});
assert.match(where, /done=1/);

rows = await listFeedback(TODAY);
const forged = rows.find((row) => row.best === "这一句得留着");
assert.ok(forged);
assert.equal(forged.rating, null, "rating=9 不该进库");
assert.equal(forged.recommend, null, "recommend=banana 不该进库");
check("超范围的答案 → 丢掉，正文照留");

// 7 ── The summary, against the right denominators.
const summary = summarise(
  (await listFeedback()).map((row) => ({
    session: row.session,
    rating: row.rating,
    recommend: row.recommend === "yes" || row.recommend === "maybe" || row.recommend === "no" ? row.recommend : null,
  })),
);

assert.equal(summary.length, 1, "只有今天这一场收到过");
assert.equal(summary[0].session, TODAY);
assert.equal(summary[0].count, 3, "三份表");
assert.equal(summary[0].rated, 2, "其中两份打了分");
assert.equal(summary[0].average, 4.5, "(5+4)/2，跳过的那份不算 0");
assert.equal(summary[0].asked, 1);
assert.equal(summary[0].yes, 1);
check("汇总：份数 / 打分数 / 平均分 / 会带朋友，各自的分母");

// 8 ── Reading one session reads only that session.
await pool.query(
  `INSERT INTO feedback (session, rating, best) VALUES ($1::date, 3, '上一场的')`,
  [OLD],
);
assert.equal((await listFeedback(TODAY)).length, 3);
assert.equal((await listFeedback(OLD)).length, 1);
assert.equal((await listFeedback()).length, 4);
assert.equal(summarise((await listFeedback()).map((r) => ({ session: r.session, rating: r.rating, recommend: null })))[0].session, TODAY, "汇总里最新的一场在最前");
check("分场次查看：只读那一场");

await pool.end();

console.log(passed.map((label) => `✓ ${label}`).join("\n"));
console.log(`\n${passed.length}/8 通过`);
