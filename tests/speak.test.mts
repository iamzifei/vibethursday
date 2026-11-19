/**
 * /speak — a picked speaker hands in their talk, and may ask for an AI read.
 *
 * Three things are tested here because each can quietly stop holding:
 * the link (bound to one person and one morning, gone at the end of that day),
 * the reading of the model's answer (a malformed one must give no advice, not
 * a guess), and the two caps on reads (per speaker, and per day for the site).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { speakerToken, speakerTokenExpiry, verifySpeakerToken } from "../src/lib/speak-token.ts";
import {
  buildReviewInput,
  normaliseSlideText,
  readBrief,
  readReview,
  REVIEW_ITEMS,
  SPEAKER_REVIEW_LIMIT,
  SPEAKER_REVIEW_SQL,
  SPEAKER_REFUND_SQL,
  spendSpeakerReview,
  storedReview,
  VERDICT_FIX,
  VERDICT_OK,
  type CapQuery,
} from "../src/lib/speak.ts";
import { REVIEW_BUDGET_SQL, spendFrom } from "../src/lib/coach-budget.ts";
import { copy } from "../src/lib/content.ts";

const KEY = "test-secret-for-speak";
const SESSION = "2026-11-26";

// ── The link ─────────────────────────────────────────────────────────────

test("a link names the speaker and the morning it was issued for", () => {
  const token = speakerToken("42", SESSION, KEY);
  const now = Date.parse("2026-11-20T09:00:00Z");
  assert.deepEqual(verifySpeakerToken(token, now, KEY), { signupId: "42", session: SESSION });
  assert.match(token, /^[A-Za-z0-9_.-]+$/, "only characters that survive a URL and a WeChat message");
});

test("★ a link works through the session's day, Sydney time, and not a moment after", () => {
  const token = speakerToken("42", SESSION, KEY);
  // 27 Nov 00:00 in Sydney (daylight saving, UTC+11) is 26 Nov 13:00 UTC.
  const end = speakerTokenExpiry(SESSION).getTime();
  assert.equal(end, Date.parse("2026-11-26T13:00:00Z"));

  assert.ok(verifySpeakerToken(token, Date.parse("2026-11-26T01:00:00Z"), KEY), "during the morning itself");
  assert.ok(verifySpeakerToken(token, end - 1000, KEY), "until the last second of that day");
  assert.equal(verifySpeakerToken(token, end, KEY), null, "gone at midnight");
  assert.equal(verifySpeakerToken(token, end + 86_400_000, KEY), null);
});

test("outside daylight saving the day still ends at Sydney midnight", () => {
  // 3 Jul 00:00 in Sydney (UTC+10) is 2 Jul 14:00 UTC.
  assert.equal(speakerTokenExpiry("2026-07-02").getTime(), Date.parse("2026-07-02T14:00:00Z"));
});

test("★ a link cannot be moved to another morning or another person", () => {
  const token = speakerToken("42", SESSION, KEY);
  const now = Date.parse("2026-11-20T09:00:00Z");
  assert.equal(verifySpeakerToken(token.replace(SESSION, "2026-12-03"), now, KEY), null, "another session");
  assert.equal(verifySpeakerToken(token.replace(/^42\./, "41."), now, KEY), null, "another speaker");
  assert.equal(verifySpeakerToken(token, now, "another-key"), null, "another key");
});

test("a /my token is not a speaker link", async () => {
  const { myToken } = await import("../src/lib/my-signup.ts");
  const now = Date.parse("2026-11-20T09:00:00Z");
  assert.equal(verifySpeakerToken(myToken("42", now, KEY), now, KEY), null);
});

test("garbage is not a link", () => {
  for (const value of [undefined, null, "", "42", "42.2026-11-26", `42.2026-13-45.${"a".repeat(32)}`, "x".repeat(500)]) {
    assert.equal(verifySpeakerToken(value, Date.parse("2026-11-20T09:00:00Z"), KEY), null);
  }
});

// ── The answers and slide text ────────────────────────────────────────────

test("the four answers are read as bounded strings, and anything else is refused", () => {
  assert.deepEqual(readBrief({ before: "  a ", numbers: "b" }), { before: "a", numbers: "b", failed: "", copyable: "" });
  assert.equal(readBrief({ before: 3 }), null);
  assert.equal(readBrief(null), null);
  assert.equal(readBrief(["a"]), null);
  assert.equal(readBrief({ before: "x".repeat(5000) })!.before.length, 1000);
});

test("slide text is collapsed, bounded, and safe for Postgres", () => {
  assert.equal(normaliseSlideText("  a\n\n b\u0000c  "), "a bc");
  assert.equal(normaliseSlideText(undefined), "");
  assert.equal(normaliseSlideText(42), "");
  assert.equal(normaliseSlideText("x".repeat(9000)).length, 2000);
});

test("slides with no text are read from the answers only, and the model is told so", () => {
  const input = buildReviewInput({ theme: null, brief: readBrief({ before: "手工" })!, slideText: ["", ""] });
  assert.match(input, /只按四问判断/);
  const withText = buildReviewInput({ theme: "报价", brief: readBrief({})!, slideText: ["", "省了三小时"] });
  assert.match(withText, /本周主题：报价/);
  assert.match(withText, /第 2 页：省了三小时/);
});

// ── The model's answer ────────────────────────────────────────────────────

function answer(overrides: Record<string, unknown> = {}, verdict: unknown = VERDICT_OK) {
  const items = Object.fromEntries(REVIEW_ITEMS.map((key) => [key, { ok: true, fix: "" }]));
  return JSON.stringify({ verdict, items: { ...items, ...overrides } });
}

test("a well-formed answer is read as given", () => {
  const review = readReview(answer());
  assert.equal(review?.verdict, VERDICT_OK);
  assert.deepEqual(Object.keys(review!.items), [...REVIEW_ITEMS]);
});

test("an answer wrapped in a fenced block is still read", () => {
  assert.equal(readReview("```json\n" + answer() + "\n```")?.verdict, VERDICT_OK);
});

test("★ malformed answers give no review at all, never a guessed one", () => {
  for (const raw of [
    "",
    "not json",
    "{",
    "[]",
    JSON.stringify({ verdict: VERDICT_OK }),
    JSON.stringify({ verdict: VERDICT_OK, items: [] }),
    answer({ pitch: undefined }),
    answer({ pitch: { ok: "yes", fix: "" } }),
    answer({ plain: "ok" }),
  ]) {
    assert.equal(readReview(raw), null, `refused: ${raw.slice(0, 60)}`);
  }
});

test("★ the verdict follows the lines: one line not ok means 建议改一改", () => {
  const review = readReview(answer({ pitch: { ok: false, fix: "删掉报价那页" } }, VERDICT_OK));
  assert.equal(review?.verdict, VERDICT_FIX);
  assert.equal(review?.items.pitch.fix, "删掉报价那页");
});

test("a verdict outside the two allowed values is not passed through", () => {
  assert.equal(readReview(answer({}, "很好"))?.verdict, VERDICT_OK);
  assert.equal(readReview(answer({}, VERDICT_FIX))?.verdict, VERDICT_FIX);
  assert.equal(readReview(answer({ theme: { ok: false } }, "很好"))?.verdict, VERDICT_FIX);
});

test("a fix is bounded, and a stored review reads back the same", () => {
  const review = readReview(answer({ theme: { ok: false, fix: "长".repeat(500) } }))!;
  assert.ok(review.items.theme.fix.length <= 160);
  assert.deepEqual(storedReview(JSON.parse(JSON.stringify(review))), review);
  assert.equal(storedReview(null), null);
  assert.equal(storedReview("x"), null);
});

// ── The caps ──────────────────────────────────────────────────────────────

function fakeQuery(rowCount: number | null) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query: CapQuery = async (sql, params) => {
    calls.push({ sql, params });
    return { rowCount };
  };
  return { query, calls };
}

test("a speaker's read is paid for when the row comes back, and refused when it does not", async () => {
  const yes = fakeQuery(1);
  assert.equal(await spendSpeakerReview(yes.query, SESSION, "42"), true);
  assert.deepEqual(yes.calls[0].params, [SESSION, "42", SPEAKER_REVIEW_LIMIT]);
  assert.equal(SPEAKER_REVIEW_LIMIT, 10);

  assert.equal(await spendSpeakerReview(fakeQuery(0).query, SESSION, "42"), false);
  assert.equal(await spendSpeakerReview(fakeQuery(null).query, SESSION, "42"), false);
});

test("★ the per-speaker SQL still carries the clause that makes it a cap", () => {
  assert.match(SPEAKER_REVIEW_SQL, /review_count\s*<\s*\$3/);
  assert.match(SPEAKER_REVIEW_SQL, /session\s*=\s*\$1::date AND signup_id\s*=\s*\$2::bigint/);
  assert.equal(SPEAKER_REVIEW_SQL.split(";").length, 1, "one statement, or the check is not atomic");
});

test("a mistyped per-speaker limit fails closed", async () => {
  const { query, calls } = fakeQuery(1);
  assert.equal(await spendSpeakerReview(query, SESSION, "42", Number.NaN), false);
  assert.equal(await spendSpeakerReview(query, SESSION, "42", 0), false);
  assert.equal(calls.length, 0);
});

test("★ the site's daily cap on reads has its own counter, with the same guard", async () => {
  assert.match(REVIEW_BUDGET_SQL, /INSERT INTO review_budget/);
  assert.match(REVIEW_BUDGET_SQL, /WHERE\s+review_budget\.calls\s*<\s*\$1/);
  assert.equal(REVIEW_BUDGET_SQL.split(";").length, 1);

  const { query, calls } = fakeQuery(1);
  assert.equal(await spendFrom(query, 60, REVIEW_BUDGET_SQL), true);
  assert.equal(calls[0].sql, REVIEW_BUDGET_SQL);
  assert.equal(await spendFrom(fakeQuery(0).query, 60, REVIEW_BUDGET_SQL), false);
  assert.equal(await spendFrom(query, Number("sixty"), REVIEW_BUDGET_SQL), false, "a typo is no cap, so no reads");
});

/** The executable body of a file: imports and comments removed (see coach-budget.test.mts). */
function body(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line) && !/^\s*\/\//.test(line))
    .join("\n");
}

test("★ the route checks the link, then the speaker's cap, then the day's, all before the call", () => {
  const route = body("src/app/api/speak/route.ts");
  const verify = route.indexOf("verifySpeakerToken(");
  const perAddress = route.indexOf('"speak-review"');
  const speaker = route.indexOf("spendSpeakerReviewCall(");
  const day = route.indexOf("spendReviewCall(");
  const call = route.indexOf("reviewBrief(");

  for (const [name, at] of Object.entries({ verify, perAddress, speaker, day, call })) assert.ok(at > 0, `${name} is in the route`);
  assert.ok(verify < perAddress && perAddress < speaker && speaker < day && day < call, "in that order");
  assert.match(route, /fromThisSite\(/, "same-origin check");
  assert.match(route, /bodyTooLarge\(/);
});

test("both languages carry the same speak keys, and the rubric has a label for every line", () => {
  const keys = (value: object) => Object.keys(value).sort();
  assert.deepEqual(keys(copy.zh.speak), keys(copy.en.speak));
  assert.equal(copy.zh.speak.rules.length, copy.en.speak.rules.length);
  for (const item of REVIEW_ITEMS) {
    assert.ok(copy.zh.speak.items[item] && copy.en.speak.items[item], `label for ${item}`);
  }
  assert.equal(copy.zh.speak.verdict.ok, VERDICT_OK, "the Chinese verdicts are the stored values");
  assert.equal(copy.zh.speak.verdict.fix, VERDICT_FIX);
});

test("the page says screenshot-only slides are read from the answers alone", () => {
  assert.match(copy.zh.speak.slidesTextNote, /截图/);
  assert.match(copy.en.speak.slidesTextNote, /screenshots/);
});

// 2026-11-19 review: when the day's cap refused (or the model failed), the
// speaker's own allowance had already gone down and was never given back, so
// ten presses on a busy day could lock a speaker out for the whole morning.
test("★ the speaker's read is given back when the day's cap refuses or the model fails", () => {
  const route = body("src/app/api/speak/route.ts");
  const day = route.indexOf("spendReviewCall(");
  const call = route.indexOf("reviewBrief(");
  const refunds = [...route.matchAll(/refundSpeakerReviewCall\(/g)].map((m) => m.index ?? -1);
  assert.ok(refunds.some((at) => at > day && at < call), "refund when the day's cap refuses");
  assert.ok(refunds.some((at) => at > call), "refund when the model gives nothing back");
});

test("the refund never takes a speaker below zero, in one statement", () => {
  assert.match(SPEAKER_REFUND_SQL, /review_count\s*=\s*review_count\s*-\s*1/);
  assert.match(SPEAKER_REFUND_SQL, /review_count\s*>\s*0/);
  assert.equal(SPEAKER_REFUND_SQL.split(";").length, 1);
});

test("the site's daily review count turns over at Sydney midnight, not UTC", () => {
  assert.match(REVIEW_BUDGET_SQL, /Australia\/Sydney/);
});
