/**
 * The first online Tuesday is an open trial (2026-11-06).
 *
 * 10 November, the first Tuesday of cohort 1, is open to anyone who signs up
 * for it, member or not, so newcomers can try one morning. Every other online
 * Tuesday stays members and mentors only.
 *
 * The signup form already asks what they bring ("a need: something I want AI
 * to do for me" + one line), which is how the morning's demo is chosen.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { isOnlineSession, isOpenTrialSession, upcomingOpenTrial } from "../src/lib/sessions.ts";
import { MEMBERSHIP_COHORTS } from "../src/lib/course.ts";
import { copy } from "../src/lib/content.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ only 10 November is an open trial, and it is an online Tuesday", () => {
  assert.equal(isOpenTrialSession("2026-11-10"), true);
  assert.equal(isOnlineSession("2026-11-10"), true);
  for (const date of ["2026-11-17", "2026-11-24", "2026-12-01", "2026-11-12", "2026-11-03"]) {
    assert.equal(isOpenTrialSession(date), false, date);
  }
});

test("the trial is the first Tuesday of cohort 1", () => {
  assert.equal(MEMBERSHIP_COHORTS[0].tuesdays[0], "2026-11-10");
});

test("upcomingOpenTrial returns a trial date or null, never another Tuesday", () => {
  const next = upcomingOpenTrial();
  assert.ok(next === null || isOpenTrialSession(next));
});

test("★ entitlement lets anyone into a trial Tuesday before any database lookup", () => {
  const db = read("src/lib/db.ts");
  const fn = db.slice(db.indexOf("export async function canJoinOnlineTuesday"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /canJoinOnlineTuesday\(signupId: string, session\?: string\)/);
  const trialAt = body.indexOf("isOpenTrialSession(session)");
  assert.ok(trialAt > 0, "checks the trial");
  assert.ok(trialAt < body.indexOf("ensureSchema"), "before touching the database");
});

test("★ every caller passes the session, so the trial is honoured everywhere", () => {
  assert.match(read("src/app/api/signup/route.ts"), /canJoinOnlineTuesday\(signupId, firstSession\)/);
  assert.match(read("src/app/api/quick/route.ts"), /canJoinOnlineTuesday\(id, session\)/);
  assert.match(read("src/app/my/page.tsx"), /isOpenTrialSession\(entry\.session\)/);
});

test("★ trial copy in both languages: open to non-members, bring a need, joined via the WeChat group", () => {
  assert.match(copy.zh.tuesday.trialNote, /\{date\}/);
  assert.match(copy.zh.tuesday.trialNote, /试听/);
  assert.match(copy.zh.tuesday.trialNote, /不是会员也能来/);
  assert.match(copy.zh.tuesday.trialNote, /需求|想让 AI/);
  assert.match(copy.en.tuesday.trialNote, /\{date\}/);
  assert.match(copy.en.tuesday.trialNote, /trial/i);
  assert.match(copy.en.tuesday.trialNote, /not a member|non-member/i);
  for (const lang of ["zh", "en"] as const) {
    assert.doesNotMatch(copy[lang].tuesday.trialNote, /30 澳元|A\$30\b|599/, `${lang}: the trial names no price`);
  }
});

test("★ during the trial the signup lede does not tell non-members to join first", () => {
  assert.doesNotMatch(copy.zh.tuesday.signupLedeTrial, /先办共创会员|会员/);
  assert.doesNotMatch(copy.en.tuesday.signupLedeTrial, /member/i);
  assert.match(read("src/app/tuesday/page.tsx"), /trialNote \? t\.signupLedeTrial : t\.signupLede/);
});

test("the English note quotes the real option label", () => {
  const label = copy.en.signup.fields.tuesdayBringOptions.find((o: { value: string }) => o.value === "need")!.label;
  assert.ok(label.startsWith("A need"));
  assert.match(copy.en.tuesday.trialNote, /"A need"/);
});

test("/tuesday and /join show the trial only while it is upcoming", () => {
  const tuesday = read("src/app/tuesday/page.tsx");
  assert.match(tuesday, /isOpenTrialSession\(/);
  assert.match(tuesday, /trialNote/);
  const join = read("src/app/join/page.tsx");
  assert.match(join, /upcomingOpenTrial\(\)/);
  assert.match(join, /\/tuesday#signup/);
});
