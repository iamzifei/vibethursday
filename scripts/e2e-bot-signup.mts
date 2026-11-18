/**
 * End-to-end check for sign-ups from the WeChat group bot (2026-11-18).
 *
 * Not part of `pnpm test`: it needs a real Postgres, and the pay page is
 * fetched from a running build. The smoke stack is both:
 *
 *   ./scripts/smoke-db.sh start
 *   DATABASE_URL="postgresql://vt@127.0.0.1:55432/vibethursday" \
 *     node --experimental-strip-types scripts/e2e-bot-signup.mts
 *   ./scripts/smoke-db.sh stop
 *
 * The route handlers are called in this process (so the session list can be
 * swapped for fixtures); the pay page is loaded over HTTP from APP_URL
 * (default http://127.0.0.1:3111), which is the smoke build.
 *
 * No email is sent and Stripe is never called: STRIPE_SECRET_KEY is removed
 * below, so the paid case takes the bank-transfer path.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import pg from "pg";

// Route files use "@/" and "next/server"; the test hooks resolve both.
register("../tests/fixtures/alias-hooks.mjs", import.meta.url);

const app = (process.env.APP_URL ?? "http://127.0.0.1:3111").replace(/\/$/, "");
const connectionString = process.env.DATABASE_URL ?? "";

/* Same guard as the other e2e scripts: this truncates, so it refuses anything
 * that does not look like a throwaway instance. */
const DISPOSABLE = /host=\/tmp\/|@localhost|@127\.0\.0\.1/;
if (!DISPOSABLE.test(connectionString)) {
  console.error("拒绝运行：DATABASE_URL 不像一次性实例。这个脚本会清空 signups。");
  console.error(`收到的是：${connectionString || "(空)"}`);
  process.exit(1);
}

const SECRET = "e2e-only-bot-secret-not-a-secret-0123456789abcdef";
process.env.BOT_SIGNUP_SECRET = SECRET;
// Absolute links in the responses point at the smoke build.
process.env.NEXT_PUBLIC_SITE_URL = app;
delete process.env.STRIPE_SECRET_KEY;

const { POST } = await import("@/app/api/bot/signup/route");
const { GET } = await import("@/app/api/bot/sessions/route");
const { POST: CANCEL } = await import("@/app/api/bot/cancel/route");
const { signBotRequest } = await import("@/lib/bot-signup");
const { SPECIAL_SESSIONS, nextThursdays, sydneyToday } = await import("@/lib/sessions");
const { mergeSignups, saveSignup } = await import("@/lib/db");
type SpecialSession = (typeof SPECIAL_SESSIONS)[number];

const pool = new pg.Pool({ connectionString });
const passed: string[] = [];
const check = (label: string) => passed.push(label);

// ── Helpers ──────────────────────────────────────────────────────────────

const RealDate = Date;
/** Moves this process's clock (not the database's) to `iso`, for one real paid Tuesday. */
function setClock(iso: string | null) {
  if (iso === null) {
    globalThis.Date = RealDate;
    return;
  }
  const offset = RealDate.parse(iso) - RealDate.now();
  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...(args as [string]));
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
}

const realSpecials = [...SPECIAL_SESSIONS];
/** Replaces the session list the routes read, in place (it is one shared module). */
function setSpecials(list: readonly SpecialSession[]) {
  const target = SPECIAL_SESSIONS as SpecialSession[];
  target.splice(0, target.length, ...list);
}

function signed(url: string, method: "GET" | "POST", body: string): Request {
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      "x-bot-timestamp": ts,
      "x-bot-signature": signBotRequest(SECRET, ts, method, new URL(url).pathname, body),
    },
    body: method === "POST" ? body : undefined,
  });
}

/** What /api/bot/signup answers (see the route). */
type Reply = {
  ok: boolean;
  status: string;
  session: { date: string; kind: string; online: boolean; fee: number | null };
  waitlisted?: boolean;
  position?: number;
  spotsLeft?: number;
  payUrl: string;
  amount?: number;
  joinUrl?: string;
};

async function signup(body: Record<string, unknown>): Promise<Reply> {
  const response = await POST(signed(`${app}/api/bot/signup`, "POST", JSON.stringify(body)));
  assert.equal(response.status, 200, `HTTP ${response.status}`);
  return (await response.json()) as Reply;
}

async function cancel(body: Record<string, unknown>) {
  const response = await CANCEL(signed(`${app}/api/bot/cancel`, "POST", JSON.stringify(body)));
  assert.equal(response.status, 200, `HTTP ${response.status}`);
  return (await response.json()) as { ok: boolean; status: string; session: { date: string; kind: string; fee: number | null } | null };
}

async function thursdaySpotsLeft(): Promise<number> {
  return (await (await GET(signed(`${app}/api/bot/sessions`, "GET", ""))).json()).thursday.spotsLeft;
}

async function rowsNamed(wechatName: string) {
  return (
    await pool.query(
      `SELECT id::text, name, email, wechat, wechat_name, source, bot_check,
              ARRAY(SELECT to_char(d, 'YYYY-MM-DD') FROM unnest(sessions) d) AS sessions,
              ARRAY(SELECT to_char(d, 'YYYY-MM-DD') FROM unnest(waitlist) d) AS waitlist
         FROM signups WHERE wechat_name = $1`,
      [wechatName],
    )
  ).rows;
}

/** A Tuesday 2–8 days out: inside the 14-day horizon, never past an evening cut-off. */
function fixtureTuesday(): string {
  const day = sydneyToday();
  day.setUTCDate(day.getUTCDate() + 2);
  while (day.getUTCDay() !== 2) day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

// ── Start from nothing ───────────────────────────────────────────────────

await saveSignup({
  name: "schema warmup", email: null, wechat: "wx_warmup", building: null, demoIntent: null, topic: null,
  firstSession: null, source: null, availability: [], aiModels: [], aiSpend: null, purpose: null, lang: "zh", botCheck: "skipped",
});
await pool.query("TRUNCATE signups RESTART IDENTITY CASCADE");

const [THU, NEXT_THU] = nextThursdays(2);
const TUE = fixtureTuesday();
setSpecials([]);

// 1 ── Thursday by display name: booked, on a row with no contact details.
let r = await signup({ wechatName: "测试甲" });
assert.equal(r.ok, true);
assert.equal(r.status, "booked");
assert.deepEqual(r.session, { date: THU, kind: "thursday", online: false, fee: null });
assert.equal(r.spotsLeft, 39);
let rows = await rowsNamed("测试甲");
assert.equal(rows.length, 1);
assert.equal(rows[0].wechat, null, "群昵称进了 wechat 列");
assert.equal(rows[0].email, null);
assert.equal(rows[0].source, "wechat-bot");
assert.equal(rows[0].bot_check, "wechat-bot");
assert.deepEqual(rows[0].sessions, [THU]);
check("按群昵称报周四 → booked，wechat 列为空，来源 wechat-bot");

// 2 ── The same again, however spaced: already, and still one row.
r = await signup({ wechatName: "测试甲" });
assert.equal(r.status, "already");
assert.equal(r.waitlisted, false);
r = await signup({ wechatName: " 测试 甲 " });
assert.equal(r.status, "already");
assert.equal((await pool.query(`SELECT count(*)::int AS n FROM signups`)).rows[0].n, 1);
check("再报一次 → already，不多一行（同名 + 同场次幂等）");

// 2b ── Same display name, another Thursday: the same row gains it.
r = await signup({ wechatName: "测试甲", session: NEXT_THU });
assert.equal(r.status, "booked");
rows = await rowsNamed("测试甲");
assert.equal(rows.length, 1);
assert.deepEqual(rows[0].sessions, [THU, NEXT_THU]);
check("同一群昵称报下一周 → 加在同一行");

// 3 ── A full Thursday: waitlisted, never refused, with a place in the queue.
await pool.query(
  `INSERT INTO signups (name, wechat, sessions, source, bot_check)
   SELECT 'filler ' || n, 'filler_' || n, ARRAY[$1::date], 'signup', 'verified' FROM generate_series(1, 39) AS n`,
  [THU],
);
r = await signup({ wechatName: "测试乙" });
assert.equal(r.status, "waitlisted");
assert.equal(r.position, 1);
assert.equal(r.spotsLeft, 0);
assert.deepEqual((await rowsNamed("测试乙"))[0].waitlist, [THU]);
r = await signup({ wechatName: "测试乙" });
assert.equal(r.status, "already");
assert.equal(r.waitlisted, true);
assert.equal(r.position, 1, "再报一次不该排到后面");
check("满员 → waitlisted（第 1 位），再报 → already 且位置不变");

// 3b ── A place frees up: asking again moves them in, as the form does.
await pool.query(`UPDATE signups SET sessions = '{}' WHERE wechat = 'filler_39'`);
r = await signup({ wechatName: "测试乙" });
assert.equal(r.status, "booked");
rows = await rowsNamed("测试乙");
assert.deepEqual(rows[0].sessions, [THU]);
assert.deepEqual(rows[0].waitlist, []);
check("候补中有了空位，再报 → booked 并移出候补");

// 3c ── Merged into a signup with contact details: the display name still
// finds them, so the next name-only request is "already", not a second row.
const jia = await pool.query(
  `INSERT INTO signups (name, wechat, source, bot_check) VALUES ('测试甲', 'e2e_jia_01', 'signup', 'verified') RETURNING id::text AS id`,
);
const botJia = (await rowsNamed("测试甲"))[0].id;
assert.deepEqual(await mergeSignups(jia.rows[0].id, botJia), { ok: true });
r = await signup({ wechatName: "测试甲" });
assert.equal(r.status, "already");
rows = await rowsNamed("测试甲");
assert.equal(rows.length, 1, "合并后又多出一行");
assert.equal(rows[0].wechat, "e2e_jia_01");
check("合并后再按群昵称报 → already，不再新建一行");

// 4 ── Tuesday with none on offer.
r = await signup({ wechatName: "测试丙", session: "tuesday" });
assert.deepEqual(r, { ok: false, status: "no_tuesday" });
assert.equal((await rowsNamed("测试丙")).length, 0);
check("没有周二 → no_tuesday，不建行");

// 5 ── An online members-only Tuesday: not booked on a display name.
setSpecials([{ date: TUE, kind: "tuesday", endHour: 12, cap: 200, online: true }]);
r = await signup({ wechatName: "测试丙", session: "tuesday" });
assert.equal(r.status, "members_only");
assert.equal(r.ok, false);
assert.equal(r.joinUrl, `${app}/join`);
assert.deepEqual(r.session, { date: TUE, kind: "tuesday", online: true, fee: null });
assert.equal((await rowsNamed("测试丙")).length, 0, "members_only 不该建行");
// A real WeChat ID that is not a member: still not booked.
r = await signup({ wechatName: "测试丙", wechat: "e2e_not_member", session: "tuesday" });
assert.equal(r.status, "members_only");
// A mentor, by WeChat ID: booked, with the display name recorded on their row.
const mentor = await pool.query(
  `INSERT INTO signups (name, wechat, source, bot_check) VALUES ('测试导师', 'e2e_mentor_01', 'signup', 'verified') RETURNING id`,
);
await pool.query(`INSERT INTO person_roles (signup_id, role) VALUES ($1, 'mentor')`, [mentor.rows[0].id]);
r = await signup({ wechatName: "导师群名", name: "测试导师", wechat: "e2e_mentor_01", session: "tuesday" });
assert.equal(r.status, "booked");
const mentorRow = (await rowsNamed("导师群名"))[0];
assert.equal(mentorRow.wechat, "e2e_mentor_01");
assert.equal(mentorRow.source, "signup", "已有的人保留原来的来源");
assert.deepEqual(mentorRow.sessions, [TUE]);
// Someone else typing the mentor's WeChat ID: not booked, membership not revealed.
r = await signup({ wechatName: "冒充者", name: "另一个人", wechat: "e2e_mentor_01", session: "tuesday" });
assert.equal(r.status, "members_only", "别人填导师的微信号不该被放进来，也不该透露是否会员");
check("线上会员周二 → members_only（带 /join）；导师用微信号报 → booked；别人冒用其微信号 → members_only");

// 6 ── A paid Tuesday (fixture): booked, with a pay link and the amount.
setSpecials([{ date: TUE, kind: "tuesday", endHour: 12, cap: 12, fee: 30 }]);
r = await signup({ wechatName: "测试丁", session: "tuesday" });
assert.equal(r.status, "booked");
assert.deepEqual(r.session, { date: TUE, kind: "tuesday", online: false, fee: 30 });
assert.equal(r.amount, 33);
assert.match(r.payUrl, new RegExp(`^${app}/tuesday/pay\\?ref=TU[A-HJ-NP-Z2-9]{5}$`));
const firstPay = r.payUrl;
const fee = await pool.query(`SELECT status, hold_until FROM session_fees WHERE ref = $1`, [new URL(firstPay).searchParams.get("ref")]);
assert.equal(fee.rows[0].status, "pending");
assert.equal(fee.rows[0].hold_until, null, "没开刷卡就不该有付款时限");
r = await signup({ wechatName: "测试丁", session: "tuesday" });
assert.equal(r.status, "already");
assert.equal(r.payUrl, firstPay, "再报一次应给同一个付款编号");
// A WeChat ID on file under a different name: refused rather than booked
// with no payment reference.
r = await signup({ wechatName: "冒充者", name: "另一个人", wechat: "e2e_mentor_01", session: "tuesday" });
assert.equal(r.status, "name_mismatch");
check("收费周二（fixture）→ booked + payUrl + 金额；再报 → 同一个编号；名字对不上 → name_mismatch");

// 6b ── Someone copying a display name that sits on a signup with a WeChat ID
// (the mentor's, from case 5): only "already", none of that row's details,
// and nothing on that row is changed.
const before = (await rowsNamed("导师群名"))[0];
r = await signup({ wechatName: "导师群名", session: "tuesday" });
assert.equal(r.status, "already");
for (const field of ["payUrl", "amount", "member", "paid", "position", "waitlisted"]) {
  assert.ok(!(field in r), `冒用群昵称拿到了别人的 ${field}`);
}
r = await signup({ wechatName: "导师群名", session: NEXT_THU });
assert.equal(r.status, "booked");
const after = await rowsNamed("导师群名");
assert.equal(after.length, 2, "应另建一行群报名，而不是写到有微信号的那行");
assert.deepEqual(after.find((row) => row.id === before.id)?.sessions, before.sessions, "有微信号那行被改了");
assert.equal(after.find((row) => row.id !== before.id)?.wechat, null);
check("群昵称撞上有微信号的报名 → 只答 already、不给付款链接/会员信息、不改那一行");

// 7 ── GET /api/bot/sessions: what is on offer, with places left.
setSpecials([
  { date: TUE, kind: "tuesday", endHour: 12, cap: 12, fee: 30 },
]);
const listed = await (await GET(signed(`${app}/api/bot/sessions`, "GET", ""))).json();
assert.equal(listed.ok, true);
assert.equal(listed.thursday.date, THU);
assert.equal(listed.thursday.spotsLeft, 0, "周四已满");
assert.equal(listed.tuesdays.length, 1);
assert.deepEqual(
  { ...listed.tuesdays[0] },
  { date: TUE, kind: "tuesday", online: false, fee: 30, amount: 33, membersOnly: false, openTrial: false, cap: 12, spotsLeft: 10 },
);
check("GET /api/bot/sessions → 周四已满、周二带费用与金额、剩 10 位（导师 + 测试丁）");

// 8 ── A date no longer on offer is closed.
r = await signup({ wechatName: "测试戊", session: "2020-01-02" });
assert.deepEqual(r, { ok: false, status: "closed" });
check("过期日期 → closed");

// 8b ── Cancel: book, cancel, and the place is free again.
assert.equal(await thursdaySpotsLeft(), 0, "周四此时是满的");
let c = await cancel({ wechatName: "测试乙" });
assert.equal(c.status, "cancelled");
assert.equal(c.ok, true);
assert.deepEqual(c.session, { date: THU, kind: "thursday", online: false, fee: null });
assert.deepEqual((await rowsNamed("测试乙"))[0].sessions, []);
assert.equal(await thursdaySpotsLeft(), 1, "取消后应空出一个位子");
check("按群昵称取消 → cancelled，周四空出一位");

// 8c ── Cancelling twice: nothing left to cancel.
c = await cancel({ wechatName: "测试乙" });
assert.deepEqual(c, { ok: false, status: "not_found", session: null });
check("再取消一次 → not_found");

// 8d ── The same display name as a normal signup (merged in 3c, it has a
// WeChat ID): a display name alone must not cancel it.
c = await cancel({ wechatName: "测试甲" });
assert.equal(c.status, "not_found");
assert.ok((await rowsNamed("测试甲"))[0].sessions.includes(THU), "群昵称把别人的正常报名取消了");
// Their WeChat ID under someone else's name: not found either.
c = await cancel({ wechatName: "冒充者", name: "另一个人", wechat: "e2e_jia_01" });
assert.equal(c.status, "not_found");
// The person themselves, with their WeChat ID and name: cancelled.
c = await cancel({ wechatName: "测试甲", name: "测试甲", wechat: "e2e_jia_01", session: THU });
assert.equal(c.status, "cancelled");
assert.ok(!(await rowsNamed("测试甲"))[0].sessions.includes(THU));
check("群昵称撞上正常报名 → not_found；冒用微信号 → not_found；本人带微信号 → cancelled");

// 8e ── A paid session already paid for: left to the organiser.
await pool.query(`UPDATE session_fees f SET status = 'paid', paid_at = now() FROM signups g WHERE g.id = f.signup_id AND g.wechat_name = '测试丁'`);
c = await cancel({ wechatName: "测试丁", session: "tuesday" });
assert.equal(c.status, "paid_contact_organiser");
assert.equal(c.session?.date, TUE);
assert.deepEqual((await rowsNamed("测试丁"))[0].sessions, [TUE], "已付款的场次被取消了");
// Unpaid: cancelled, and the pay page's fee no longer counts as booked.
r = await signup({ wechatName: "测试庚", session: "tuesday" });
assert.equal(r.status, "booked");
c = await cancel({ wechatName: "测试庚", session: "tuesday" });
assert.equal(c.status, "cancelled");
const unpaid = await pool.query(
  `SELECT f.status, (f.session = ANY(g.sessions)) AS booked FROM session_fees f JOIN signups g ON g.id = f.signup_id WHERE g.wechat_name = '测试庚'`,
);
assert.deepEqual(unpaid.rows[0], { status: "pending", booked: false });
check("已付款的收费周二 → paid_contact_organiser 不取消；未付款的 → cancelled");

// 9 ── A real paid Tuesday, and its pay page served by the smoke build.
// The build only knows the dates in sessions.ts, so this uses one of those
// (27 Oct, a paid one) with this process's clock set to the Sunday before it.
setSpecials(realSpecials);
setClock("2026-10-24T23:00:00Z"); // 10:00 on 25 Oct in Sydney
try {
  r = await signup({ wechatName: "测试己", session: "tuesday" });
} finally {
  setClock(null);
}
assert.equal(r.status, "booked");
assert.equal(r.session.date, "2026-10-27");
assert.equal(r.amount, 33);
const ref = new URL(r.payUrl).searchParams.get("ref")!;
let page: string;
try {
  const response = await fetch(r.payUrl);
  assert.equal(response.status, 200, `pay page HTTP ${response.status}`);
  page = await response.text();
} catch (error) {
  console.error(`付款页打不开：${r.payUrl}（smoke 站点在跑吗？）`);
  throw error;
}
assert.ok(page.includes(ref), "付款页上没有这个编号");
assert.ok(page.includes("报上了，最后一步：转账"), "付款页不是待付款的样子");
assert.ok(page.includes("33 澳元"), "付款页上没有金额");
assert.ok(!page.includes("找不到这条付款"));
check("机器人建的报名 → 付款页在浏览器能打开（编号、金额、转账）");

// 10 ── No row anywhere holds a display name as its WeChat ID.
const leaked = await pool.query(`SELECT count(*)::int AS n FROM signups WHERE wechat_name IS NOT NULL AND lower(wechat) = lower(wechat_name)`);
assert.equal(leaked.rows[0].n, 0);
check("没有一行把群昵称写进 wechat 列");

await pool.end();
console.log(passed.map((label) => `✓ ${label}`).join("\n"));
console.log(`\n${passed.length}/18 通过`);
