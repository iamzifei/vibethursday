/**
 * Guards on the two "who is in the room" questions: how familiar with AI, and
 * which industry (#7), and on the per-session composition /admin builds from
 * them (#8).
 *
 * The signup form is the one entry point that must never break, so most of
 * this file pins one rule: both questions are optional, and a signup without
 * them — including one from a page opened before they existed — goes through
 * exactly as before.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { copy } from "../src/lib/content.ts";
import { AI_LEVELS, INDUSTRIES, parseSignupProfile } from "../src/lib/signup-profile.ts";
import { compositionPerSession, countPerSession, type ComposableSignup } from "../src/lib/signup-stats.ts";

const LANGS = ["zh", "en"] as const;

const ROUTE = readFileSync(new URL("../src/app/api/signup/route.ts", import.meta.url), "utf8");
const FORM = readFileSync(new URL("../src/components/SignupForm.tsx", import.meta.url), "utf8");
const DB = readFileSync(new URL("../src/lib/db.ts", import.meta.url), "utf8");

/* ── Parsing: with and without the new fields ─────────────────────────────── */

test("a body without either field parses to two nulls (a page from before the deploy)", () => {
  assert.deepEqual(parseSignupProfile({ name: "甲", wechat: "wx_a" }), { aiLevel: null, industry: null });
});

test("a body with both fields keeps them", () => {
  assert.deepEqual(parseSignupProfile({ aiLevel: "daily", industry: "food" }), {
    aiLevel: "daily",
    industry: "food",
  });
});

test("what the form sends when both are skipped is treated as unanswered", () => {
  // FormData.get returns null for an unpicked radio and "" for the select's skip option.
  assert.deepEqual(parseSignupProfile({ aiLevel: null, industry: "" }), { aiLevel: null, industry: null });
});

test("one answered and one skipped keeps the one that was answered", () => {
  assert.deepEqual(parseSignupProfile({ aiLevel: "none", industry: "" }), { aiLevel: "none", industry: null });
  assert.deepEqual(parseSignupProfile({ industry: "tech" }), { aiLevel: null, industry: "tech" });
});

test("crafted or malformed values become null instead of an error", () => {
  for (const junk of [123, true, {}, [], ["daily"], "DAILY", "daily; drop table", "x".repeat(10_000)]) {
    assert.deepEqual(parseSignupProfile({ aiLevel: junk, industry: junk }), { aiLevel: null, industry: null });
  }
});

test("the route reads the profile through the parser and never rejects on it", () => {
  assert.match(ROUTE, /parseSignupProfile\(body\)/, "the route does not use parseSignupProfile");
  assert.match(ROUTE, /aiLevel,\s*\n\s*industry,/, "the route does not pass both answers to saveSignupWithResult");
  assert.ok(!/missing_(ai_?level|industry)/i.test(ROUTE), "the route rejects a signup over one of these questions");
});

/* ── The form ─────────────────────────────────────────────────────────────── */

test("the options both languages offer are exactly the values the server accepts, in the same order", () => {
  for (const lang of LANGS) {
    const fields = copy[lang].signup.fields;
    assert.deepEqual(fields.aiLevelOptions.map((option) => option.value), [...AI_LEVELS], `${lang} aiLevel`);
    assert.deepEqual(fields.industryOptions.map((option) => option.value), [...INDUSTRIES], `${lang} industry`);
    assert.ok(fields.aiLevel.trim() && fields.industry.trim() && fields.industrySkip.trim(), `${lang} copy`);
  }
});

test("the form sends both answers and pre-selects neither", () => {
  assert.match(FORM, /aiLevel: data\.get\("aiLevel"\)/);
  assert.match(FORM, /industry: data\.get\("industry"\)/);

  const radios = /name="aiLevel"[\s\S]{0,300}/.exec(FORM);
  assert.ok(radios, "the form no longer renders the AI-level radio group");
  assert.ok(!/defaultChecked/.test(radios[0]), "the AI-level question pre-selects an option");
  assert.match(FORM, /name="industry" defaultValue=""/, "the industry select does not default to skip");
});

test("the form never blocks submit over these questions", () => {
  // The only client-side gates are contact, WeChat format and purpose; none of
  // them may start reading these two fields as a requirement.
  assert.ok(!/!data\.get\("aiLevel"\)/.test(FORM), "the form refuses to submit without an AI level");
  assert.ok(!/!data\.get\("industry"\)/.test(FORM), "the form refuses to submit without an industry");
});

/* ── Storage ──────────────────────────────────────────────────────────────── */

test("the two columns are added at startup as nullable text, nothing else", () => {
  assert.match(DB, /ADD COLUMN IF NOT EXISTS ai_level text`/);
  assert.match(DB, /ADD COLUMN IF NOT EXISTS industry text`/);
});

test("a later signup without an answer does not wipe an earlier one", () => {
  assert.match(DB, /ai_level\s*=\s*COALESCE\(\$18, ai_level\)/);
  assert.match(DB, /industry\s*=\s*COALESCE\(\$19, industry\)/);
});

/* ── /admin composition ───────────────────────────────────────────────────── */

function row(sessions: string[], ai_level: string | null, industry: string | null, purposes = ""): ComposableSignup {
  return { sessions, ai_level, industry, purposes };
}

test("each session counts its own people by level, industry and that session's purpose", () => {
  const [a, b] = compositionPerSession(
    [
      row(["2026-10-08"], "daily", "tech", "2026-10-08=tech"),
      row(["2026-10-08", "2026-10-15"], "none", "food", "2026-10-08=biz 2026-10-15=learn"),
      row(["2026-10-15"], "none", null, ""),
    ],
    ["2026-10-08", "2026-10-15"],
  );

  assert.equal(a.total, 2);
  assert.deepEqual(a.aiLevel, { daily: 1, none: 1 });
  assert.deepEqual(a.industry, { tech: 1, food: 1 });
  assert.deepEqual(a.purpose, { tech: 1, biz: 1 });
  assert.deepEqual(a.unanswered, { aiLevel: 0, industry: 0, purpose: 0 });

  assert.equal(b.total, 2);
  assert.deepEqual(b.aiLevel, { none: 2 });
  assert.deepEqual(b.industry, { food: 1 });
  // The second person's purpose for this week, not last week's.
  assert.deepEqual(b.purpose, { learn: 1 });
  assert.deepEqual(b.unanswered, { aiLevel: 0, industry: 1, purpose: 1 });
});

test("rows from before the questions existed are unanswered, not an answer", () => {
  const [only] = compositionPerSession([row(["2026-09-24"], null, null)], ["2026-09-24"]);
  assert.deepEqual(only.aiLevel, {});
  assert.deepEqual(only.industry, {});
  assert.deepEqual(only.unanswered, { aiLevel: 1, industry: 1, purpose: 1 });
});

test("the composition total matches the headcount, and a duplicated date counts once", () => {
  const signups = [row(["2026-10-08", "2026-10-08"], "daily", "tech"), row(["2026-10-08"], null, null)];
  const [composition] = compositionPerSession(signups, ["2026-10-08"]);
  const [headcount] = countPerSession(
    signups.map((signup) => ({ sessions: signup.sessions, demo_intent: null })),
    ["2026-10-08"],
  );
  assert.equal(composition.total, headcount.total);
  assert.equal(composition.total, 2);
});

test("a requested session nobody has signed up for comes back empty, not missing", () => {
  const result = compositionPerSession([], ["2026-10-22"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].total, 0);
});

/* ── Review follow-ups ────────────────────────────────────────────────────── */

const ADMIN = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");

test("the admin's short purpose labels cover exactly the codes the route accepts", () => {
  const route = /const PURPOSES = new Set\(\[([^\]]*)\]/.exec(ROUTE);
  const admin = /const PURPOSE_SHORT = \[([\s\S]*?)\];/.exec(ADMIN);
  assert.ok(route && admin, "PURPOSES or PURPOSE_SHORT moved");
  const codes = (text: string, re: RegExp) => [...text.matchAll(re)].map((match) => match[1]);
  assert.deepEqual(codes(admin[1], /value: "([^"]+)"/g), codes(route[1], /"([^"]+)"/g));
});

test("someone whose name does not match cannot rewrite another person's answers", () => {
  // Same gate as building and topic in the UPDATE's parameter list.
  assert.match(DB, /trusted \? \(input\.aiLevel \?\? null\) : null,\s*\n\s*trusted \? \(input\.industry \?\? null\) : null,/);
});

test("the INSERT names as many columns as it supplies values", () => {
  const insert = /INSERT INTO signups \(([^)]*)\)\s*VALUES \(([\s\S]*?)\)\s*RETURNING/.exec(DB);
  assert.ok(insert, "the signup INSERT moved");
  const columns = insert[1].split(",").length;
  // Top-level values: plain $N placeholders plus one CASE … END per computed column.
  const values = insert[2].replace(/--[^\n]*/g, "").replace(/CASE[\s\S]*?END/g, "X").split(",").length;
  assert.equal(values, columns);
});
