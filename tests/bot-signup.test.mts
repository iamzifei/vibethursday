import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { test } from "node:test";
import {
  BOT_CHECK,
  BOT_SOURCE,
  MAX_SKEW_SECONDS,
  botAlready,
  botAuthFailure,
  botNameKey,
  cancellableByName,
  feeBlocksCancel,
  pickCancelDate,
  botSecret,
  chooseBotSession,
  findBotRow,
  parseBotSignup,
  signBotRequest,
  verifyBotRequest,
} from "../src/lib/bot-signup.ts";
import type { SpecialSession } from "../src/lib/sessions.ts";
import { botSignupMatches } from "../src/lib/walk-in-match.ts";

/**
 * Signing up from the WeChat group bot (2026-11-18): the request signature,
 * which session a request means, and how a display-name-only sign-up is
 * deduped. The database half is exercised by scripts/e2e-bot-signup.mts.
 */

// Lets this file import the route handlers, which use the "@/" alias.
register("./fixtures/alias-hooks.mjs", import.meta.url);

const SECRET = "test-only-bot-secret-0123456789abcdef0123456789";
const NOW = 1_800_000_000;

const signed = (overrides: Partial<Parameters<typeof verifyBotRequest>[0]> = {}) => {
  const base = { secret: SECRET, method: "POST", path: "/api/bot/signup", body: '{"wechatName":"小明"}', nowSeconds: NOW };
  const timestamp = String(NOW);
  return {
    ...base,
    timestamp,
    signature: signBotRequest(SECRET, timestamp, base.method, base.path, base.body),
    ...overrides,
  };
};

// ── Auth ─────────────────────────────────────────────────────────────────

test("★ a correctly signed request passes", () => {
  assert.equal(verifyBotRequest(signed()), "ok");
});

test("★ a wrong signature, a wrong secret or a changed body is refused", () => {
  assert.equal(verifyBotRequest(signed({ signature: "0".repeat(64) })), "bad");
  assert.equal(verifyBotRequest(signed({ secret: `${SECRET}x` })), "bad");
  assert.equal(verifyBotRequest(signed({ body: '{"wechatName":"别人"}' })), "bad");
  assert.equal(verifyBotRequest(signed({ signature: "not-hex" })), "bad");
  assert.equal(verifyBotRequest(signed({ timestamp: "12abc" })), "bad");
});

test("a signature for one endpoint or method does not open another", () => {
  assert.equal(verifyBotRequest(signed({ path: "/api/bot/sessions" })), "bad");
  assert.equal(verifyBotRequest(signed({ method: "GET" })), "bad");
});

test("★ missing headers are refused", () => {
  assert.equal(verifyBotRequest(signed({ timestamp: null })), "missing");
  assert.equal(verifyBotRequest(signed({ signature: null })), "missing");
});

test("★ a timestamp too far from our clock, either way, is refused", () => {
  assert.equal(verifyBotRequest(signed({ nowSeconds: NOW + MAX_SKEW_SECONDS })), "ok");
  assert.equal(verifyBotRequest(signed({ nowSeconds: NOW - MAX_SKEW_SECONDS })), "ok");
  assert.equal(verifyBotRequest(signed({ nowSeconds: NOW + MAX_SKEW_SECONDS + 1 })), "stale");
  assert.equal(verifyBotRequest(signed({ nowSeconds: NOW - MAX_SKEW_SECONDS - 1 })), "stale");
});

test("★ no secret, or one too short to be safe, means the endpoint is off", () => {
  assert.equal(botSecret({}), null);
  assert.equal(botSecret({ BOT_SIGNUP_SECRET: "" }), null);
  assert.equal(botSecret({ BOT_SIGNUP_SECRET: "short-secret" }), null);
  assert.equal(botSecret({ BOT_SIGNUP_SECRET: ` ${SECRET} ` }), SECRET);
});

test("botAuthFailure reads the headers and path off a real Request", async () => {
  const body = '{"wechatName":"小明"}';
  const ts = String(NOW);
  const make = (signature: string, url = "http://localhost/api/bot/signup") =>
    new Request(url, { method: "POST", headers: { "x-bot-timestamp": ts, "x-bot-signature": signature }, body });
  assert.equal(botAuthFailure(make(signBotRequest(SECRET, ts, "POST", "/api/bot/signup", body)), SECRET, body, NOW), null);
  const denied = botAuthFailure(make("0".repeat(64)), SECRET, body, NOW);
  assert.equal(denied?.status, 401);
  assert.deepEqual(await denied?.json(), { ok: false, error: "unauthorized" });
  const stale = botAuthFailure(make(signBotRequest(SECRET, ts, "POST", "/api/bot/signup", body)), SECRET, body, NOW + 3600);
  assert.equal((await stale?.json()).error, "stale_timestamp");
});

// ── The request body ─────────────────────────────────────────────────────

test("the display name is required; the name defaults to it; Thursday is the default session", () => {
  assert.deepEqual(parseBotSignup({}), { ok: false, error: "missing_wechat_name" });
  assert.deepEqual(parseBotSignup({ wechatName: "  小明  " }), {
    ok: true,
    value: { wechatName: "小明", name: "小明", wechat: null, email: null, want: "thursday" },
  });
  const full = parseBotSignup({ wechatName: "小明", name: "Xiao Ming", wechat: "xiaoming_2026", email: "x@example.com", session: "tuesday" });
  assert.ok(full.ok && full.value.name === "Xiao Ming" && full.value.wechat === "xiaoming_2026" && full.value.want === "tuesday");
});

test("★ a display name sent as a WeChat ID is refused, never stored in the wechat column", () => {
  assert.deepEqual(parseBotSignup({ wechatName: "小明", wechat: "小明 🌊" }), { ok: false, error: "invalid_wechat" });
  assert.deepEqual(parseBotSignup({ wechatName: "小明", email: "not-an-email" }), { ok: false, error: "invalid_email" });
  assert.deepEqual(parseBotSignup({ wechatName: "小明", session: "friday" }), { ok: false, error: "invalid_session" });
  assert.deepEqual(parseBotSignup(null), { ok: false, error: "invalid_json" });
});

// ── Which session ─────────────────────────────────────────────────────────

const THURSDAY = "2026-11-19";
const tuesday = (date: string, extra: Partial<SpecialSession> = {}): SpecialSession => ({ date, kind: "tuesday", endHour: 12, cap: 12, ...extra });
const offer = (specials: SpecialSession[]) => ({
  thursdays: [THURSDAY, "2026-11-26"],
  specials,
  bookable: [THURSDAY, "2026-11-26", ...specials.map((session) => session.date)].sort(),
});

test("★ no session asked for: the next bookable Thursday", () => {
  assert.deepEqual(chooseBotSession("thursday", offer([])), {
    ok: true,
    session: { date: THURSDAY, kind: "thursday", online: false, fee: null, membersOnly: false },
  });
});

test("★ Tuesday with none on offer: no_tuesday", () => {
  assert.deepEqual(chooseBotSession("tuesday", offer([])), { ok: false, status: "no_tuesday" });
});

test("★ an online Tuesday is members-only, unless it is the open trial", () => {
  const membersOnly = chooseBotSession("tuesday", offer([tuesday("2026-12-01", { online: true, cap: 200, closesEveHour: 20 })]));
  assert.ok(membersOnly.ok);
  assert.equal(membersOnly.session.membersOnly, true);
  assert.equal(membersOnly.session.online, true);
  // 2026-11-10 is the real open-trial Tuesday (OPEN_TRIAL_TUESDAYS).
  const trial = chooseBotSession("tuesday", offer([tuesday("2026-11-10", { online: true, cap: 200 })]));
  assert.ok(trial.ok);
  assert.equal(trial.session.membersOnly, false);
});

test("★ a paid Tuesday (fixture) carries its fee", () => {
  const paid = chooseBotSession("tuesday", offer([tuesday("2026-11-24", { fee: 30 })]));
  assert.deepEqual(paid, { ok: true, session: { date: "2026-11-24", kind: "tuesday", online: false, fee: 30, membersOnly: false } });
});

test("Tuesday means the soonest one", () => {
  const two = chooseBotSession("tuesday", offer([tuesday("2026-11-24", { fee: 30 }), tuesday("2026-12-01", { online: true })]));
  assert.ok(two.ok && two.session.date === "2026-11-24");
});

test("★ a date: booked only if the form offers it, otherwise closed", () => {
  const specials = [tuesday("2026-11-24", { fee: 30 })];
  assert.deepEqual(chooseBotSession("2026-11-26", offer(specials)), {
    ok: true,
    session: { date: "2026-11-26", kind: "thursday", online: false, fee: null, membersOnly: false },
  });
  const tue = chooseBotSession("2026-11-24", offer(specials));
  assert.ok(tue.ok && tue.session.kind === "tuesday" && tue.session.fee === 30);
  assert.deepEqual(chooseBotSession("2026-11-12", offer(specials)), { ok: false, status: "closed" });
  assert.deepEqual(chooseBotSession("2026-11-25", offer(specials)), { ok: false, status: "closed" });
});

// ── Dedupe and idempotency ───────────────────────────────────────────────

test("★ the dedupe key ignores width, case and every kind of space", () => {
  assert.equal(botNameKey("Test  Person"), botNameKey("test person"));
  assert.equal(botNameKey("小明　同学"), botNameKey("小明同学"));
  assert.equal(botNameKey("ＡＢＣ"), botNameKey("abc"));
  assert.notEqual(botNameKey("小明"), botNameKey("小明同学"));
});

test("★ a display name finds its earlier bot row; another name finds nothing", () => {
  const rows = [
    { id: "1", wechat_name: "小明", sessions: ["2026-11-19"], waitlist: [] },
    { id: "2", wechat_name: "Test Person", sessions: [], waitlist: [] },
  ];
  assert.equal(findBotRow(rows, " 小明 ", "2026-11-19")?.id, "1");
  assert.equal(findBotRow(rows, "test person", "2026-11-19")?.id, "2");
  assert.equal(findBotRow(rows, "小明同学", "2026-11-19"), undefined, "a longer name is someone else");
  assert.equal(findBotRow(rows, "   ", "2026-11-19"), undefined);
});

test("★ the row holding the session is preferred, so a repeat is \"already\"", () => {
  // After a merge the display name lives on the signup with the WeChat ID;
  // `saveBotSignup` reads those rows only for this "already" answer.
  const merged = [{ id: "7", wechat_name: "小明", sessions: ["2026-11-19"], waitlist: [] }];
  assert.equal(botAlready(findBotRow(merged, "小明", "2026-11-19"), "2026-11-19"), "booked");
  const two = [
    { id: "3", wechat_name: "小明", sessions: [], waitlist: [] },
    { id: "8", wechat_name: "小明", sessions: [], waitlist: ["2026-11-26"] },
  ];
  assert.equal(findBotRow(two, "小明", "2026-11-26")?.id, "8");
  assert.equal(findBotRow(two, "小明", "2026-12-03")?.id, "3");
});

test("★ a display name never writes to, or reads details of, a row with contact details", () => {
  const db = readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf8");
  const save = db.slice(db.indexOf("export async function saveBotSignup"), db.indexOf("export async function findSignupByContact"));
  assert.match(save, /findBotRow\(botOnly,/);
  assert.match(save, /contactRow: true/);
  const route = readFileSync(path.join(process.cwd(), "src/app/api/bot/signup/route.ts"), "utf8");
  assert.match(route, /own = !saved\.contactRow;/);
  assert.match(readFileSync(path.join(process.cwd(), "src/app/api/bot/cancel/route.ts"), "utf8"), /exactSignupName\(name, known\.name\)/);
});

test("★ idempotent on (display name, session): the same session again is already, another session is not", () => {
  const row = { sessions: ["2026-11-19"], waitlist: ["2026-11-26"] };
  assert.equal(botAlready(row, "2026-11-19"), "booked");
  assert.equal(botAlready(row, "2026-11-26"), "waitlisted");
  assert.equal(botAlready(row, "2026-12-03"), null);
  assert.equal(botAlready(undefined, "2026-11-19"), null);
});

// ── Admin ────────────────────────────────────────────────────────────────

test("★ a bot row is paired with a signup with contact details under the same name, either order", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  const base = { email: null, wechat: null, wechat_name: null, source: "signup" };
  const out = botSignupMatches(
    [
      { ...base, id: "5", name: "小明", wechat_name: "小明", source: BOT_SOURCE, created_at: "2026-11-18T00:00:00Z" },
      { ...base, id: "6", name: "小明同学", wechat: "xiaoming_2026", created_at: "2026-11-19T00:00:00Z" },
      { ...base, id: "7", name: "Ada", wechat: "ada_2026", created_at: "2026-11-19T00:00:00Z" },
      // A bot row that already has contact details is a normal row now.
      { ...base, id: "8", name: "Ada", wechat_name: "Ada", wechat: "ada_other", source: BOT_SOURCE, created_at: "2026-11-18T00:00:00Z" },
    ],
    now,
    BOT_SOURCE,
  );
  assert.deepEqual(out, [{ bot: { id: "5", name: "小明", wechatName: "小明" }, candidates: [{ id: "6", name: "小明同学" }] }]);
});

test("★ bot sign-ups do not trip the unverified-signup alert, and the admin shows the display name", () => {
  const admin = readFileSync(path.join(process.cwd(), "src/app/admin/page.tsx"), "utf8");
  assert.match(admin, /row\.bot_check !== "verified" &&\s*(\/\/[^\n]*\n\s*)*row\.bot_check !== BOT_CHECK/);
  assert.match(admin, /群昵称：\{row\.wechat_name\}/);
  assert.match(admin, /botSignupMatches\(signups/);
  assert.equal(BOT_CHECK, "wechat-bot");
  // ensureSchema adds the column, idempotently.
  assert.match(readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf8"), /ADD COLUMN IF NOT EXISTS wechat_name text/);
});

// ── The routes, as far as they go without a database ────────────────────

type Handler = (request: Request) => Promise<Response>;
const route = async (file: string, method: string) =>
  ((await import(path.join(process.cwd(), file))) as Record<string, Handler>)[method];

function botRequest(url: string, method: string, body: string, secret = SECRET, ip = "203.0.113.7"): Request {
  const ts = String(Math.floor(Date.now() / 1000));
  const pathname = new URL(url).pathname;
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "x-bot-timestamp": ts,
      "x-bot-signature": signBotRequest(secret, ts, method, pathname, body),
    },
    body: method === "GET" ? undefined : body,
  });
}

test("★ both routes are 404 with no secret set", async () => {
  const saved = process.env.BOT_SIGNUP_SECRET;
  delete process.env.BOT_SIGNUP_SECRET;
  try {
    const post = await route("src/app/api/bot/signup/route.ts", "POST");
    assert.equal((await post(botRequest("http://localhost/api/bot/signup", "POST", "{}"))).status, 404);
    const get = await route("src/app/api/bot/sessions/route.ts", "GET");
    assert.equal((await get(botRequest("http://localhost/api/bot/sessions", "GET", ""))).status, 404);
  } finally {
    if (saved !== undefined) process.env.BOT_SIGNUP_SECRET = saved;
  }
});

test("★ a bad signature is 401 on both routes; a good one reaches validation", async () => {
  process.env.BOT_SIGNUP_SECRET = SECRET;
  const post = await route("src/app/api/bot/signup/route.ts", "POST");
  const wrong = await post(botRequest("http://localhost/api/bot/signup", "POST", '{"wechatName":"小明"}', `${SECRET}x`));
  assert.equal(wrong.status, 401);
  const unsigned = await post(new Request("http://localhost/api/bot/signup", { method: "POST", body: "{}" }));
  assert.equal(unsigned.status, 401);
  // Signed, but no display name: a 400 from validation, before any database.
  const invalid = await post(botRequest("http://localhost/api/bot/signup", "POST", '{"name":"x"}'));
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { ok: false, error: "missing_wechat_name" });

  const get = await route("src/app/api/bot/sessions/route.ts", "GET");
  assert.equal((await get(botRequest("http://localhost/api/bot/sessions", "GET", "", `${SECRET}x`))).status, 401);
  // A signature made for the sign-up endpoint does not open this one.
  const reused = botRequest("http://localhost/api/bot/signup", "GET", "");
  assert.equal((await get(new Request("http://localhost/api/bot/sessions", { headers: reused.headers }))).status, 401);
});

test("★ the bot's own bucket: 60 signed sign-ups an hour in all, however many addresses", async () => {
  process.env.BOT_SIGNUP_SECRET = SECRET;
  const post = await route("src/app/api/bot/signup/route.ts", "POST");
  const statuses: number[] = [];
  // Invalid bodies, so nothing reaches the database; each still spends a slot.
  // The earlier test above already spent one.
  for (let i = 0; i < 61; i += 1) {
    statuses.push((await post(botRequest("http://localhost/api/bot/signup", "POST", "{}", SECRET, `198.51.100.${i}`))).status);
  }
  assert.equal(statuses.filter((status) => status === 400).length, 59);
  assert.equal(statuses.at(-1), 429);
});

// ── Cancelling ───────────────────────────────────────────────────────────

test("★ a display name alone only cancels a bot-only row, never a normal signup", () => {
  assert.equal(cancellableByName({ source: BOT_SOURCE, has_contact: false }), true);
  assert.equal(cancellableByName({ source: BOT_SOURCE, has_contact: true }), false, "bot row that has a WeChat ID now");
  assert.equal(cancellableByName({ source: "signup", has_contact: true }), false, "normal signup, e.g. after a merge");
  assert.equal(cancellableByName({ source: "signup", has_contact: false }), false);
  assert.equal(cancellableByName({ source: null, has_contact: false }), false);
});

test("★ which session a cancel means: next held Thursday by default, never a past one", () => {
  const isSpecial = (date: string) => date === "2026-11-24" || date === "2026-12-01";
  const held = ["2026-11-12", "2026-11-26", "2026-11-19", "2026-12-01"];
  assert.equal(pickCancelDate("thursday", held, "2026-11-18", isSpecial), "2026-11-19");
  assert.equal(pickCancelDate("tuesday", held, "2026-11-18", isSpecial), "2026-12-01");
  assert.equal(pickCancelDate("2026-11-26", held, "2026-11-18", isSpecial), "2026-11-26");
  assert.equal(pickCancelDate("2026-11-12", held, "2026-11-18", isSpecial), null, "already past");
  assert.equal(pickCancelDate("2026-12-03", held, "2026-11-18", isSpecial), null, "not held");
  assert.equal(pickCancelDate("tuesday", ["2026-11-19"], "2026-11-18", isSpecial), null);
  assert.equal(pickCancelDate("thursday", [], "2026-11-18", isSpecial), null);
});

test("★ a paid session, or one they said they transferred for, is left to the organiser", () => {
  assert.equal(feeBlocksCancel(null), false);
  assert.equal(feeBlocksCancel({ status: "pending", claimed: false }), false);
  assert.equal(feeBlocksCancel({ status: "waived", claimed: false }), false);
  assert.equal(feeBlocksCancel({ status: "paid", claimed: false }), true);
  assert.equal(feeBlocksCancel({ status: "pending", claimed: true }), true);
});

test("★ the cancel route is 404 with no secret and 401 with a bad signature", async () => {
  const cancel = await route("src/app/api/bot/cancel/route.ts", "POST");
  const saved = process.env.BOT_SIGNUP_SECRET;
  delete process.env.BOT_SIGNUP_SECRET;
  try {
    assert.equal((await cancel(botRequest("http://localhost/api/bot/cancel", "POST", "{}"))).status, 404);
  } finally {
    process.env.BOT_SIGNUP_SECRET = saved ?? SECRET;
  }
  assert.equal((await cancel(botRequest("http://localhost/api/bot/cancel", "POST", "{}", `${SECRET}x`))).status, 401);
  // A sign-up signature does not open cancel.
  const body = '{"wechatName":"小明"}';
  const signup = botRequest("http://localhost/api/bot/signup", "POST", body);
  assert.equal((await cancel(new Request("http://localhost/api/bot/cancel", { method: "POST", headers: signup.headers, body }))).status, 401);
  const invalid = await cancel(botRequest("http://localhost/api/bot/cancel", "POST", '{"wechatName":"小明","session":"someday"}'));
  assert.equal(invalid.status, 400);
});

test("★ no path books or cancels for someone other than the caller: one identity per request", () => {
  for (const file of ["src/app/api/bot/signup/route.ts", "src/app/api/bot/cancel/route.ts"]) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /onBehalf|forOther|target(Name|Wechat)|people\s*:/i, file);
  }
});
