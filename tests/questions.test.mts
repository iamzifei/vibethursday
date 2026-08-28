/**
 * The Wharf's questions: which lane, and what state.
 *
 * The lane rule is the one worth pinning down, because it is a heuristic making
 * a judgement about somebody's sentence and the two ways of being wrong cost
 * very different amounts. The cases below are real lines out of the sign-up
 * form, which is the only reason to trust the rule at all.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { SINK_AFTER_DAYS, canClaim, canEdit, classifyLane, statusOf } from "../src/lib/questions.ts";

test("a question with no question mark is still a question", () => {
  // The case that kills every "must end in ?" rule: written by somebody who
  // wanted an answer, and containing no question mark at all.
  assert.equal(classifyLane("想看别人的AI工作流，想了解税务申报抵扣相关"), "question");
  assert.equal(classifyLane("了解他人的产品 distribution 渠道都是怎样的"), "question");
  assert.equal(classifyLane("ai 在增长领域的应用"), "question");
});

test("pure social intent goes to the other lane", () => {
  assert.equal(classifyLane("想看看别人都在做什么，像大神学习一下"), "chat");
  assert.equal(classifyLane("先观察"), "chat");
  assert.equal(classifyLane("结交认识新的伙伴，思想碰撞"), "chat");
  assert.equal(classifyLane("交流ai使用经验"), "chat");
});

test("anything shaped like a question wins, whatever else is in it", () => {
  // "学习" is a social marker and "有没有" is an asking one. The asking marker
  // has to win, or a real question gets filed away for containing one word.
  assert.equal(classifyLane("想学习一下，有没有能稳定复现的做法？"), "question");
});

test("what it is unsure about stays answerable", () => {
  // The asymmetry: filing a real question wrongly costs an introduction,
  // filing a social line wrongly costs a row in the other list.
  assert.equal(classifyLane("教培和AI结合"), "question");
  assert.equal(classifyLane("AI Security 落地"), "question");
});

test("an empty line is not a question", () => {
  assert.equal(classifyLane("   "), "chat");
});

// ── State ───────────────────────────────────────────────────────────

const now = new Date("2026-09-10T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

test("state is derived, and closing wins over everything", () => {
  assert.equal(
    statusOf({ closed_at: daysAgo(1), created_at: daysAgo(30), claims: 0, answers: 0 }, now),
    "closed",
  );
});

test("somebody coming, or an answer, is the same state", () => {
  const base = { closed_at: null, created_at: daysAgo(2) };
  assert.equal(statusOf({ ...base, claims: 1, answers: 0 }, now), "claimed");
  assert.equal(statusOf({ ...base, claims: 0, answers: 1 }, now), "claimed");
});

test("nobody for three weeks and it sinks — but only with nobody on it", () => {
  assert.equal(
    statusOf({ closed_at: null, created_at: daysAgo(SINK_AFTER_DAYS), claims: 0, answers: 0 }, now),
    "sunk",
  );
  // Age alone must not sink it: an old question somebody has answered is not
  // abandoned, it is answered.
  assert.equal(
    statusOf({ closed_at: null, created_at: daysAgo(60), claims: 0, answers: 3 }, now),
    "claimed",
  );
  assert.equal(
    statusOf({ closed_at: null, created_at: daysAgo(SINK_AFTER_DAYS - 1), claims: 0, answers: 0 }, now),
    "open",
  );
});

test("a sunk question can still be picked up", () => {
  // Sinking is about where it sits on the page, not about it being over. The
  // whole point of an old question being claimable is that the claim is what
  // brings the two people into a room.
  assert.ok(canClaim("sunk"));
  assert.ok(canClaim("open"));
  assert.ok(!canClaim("closed"));
});

test("★ a question is editable only while nothing hangs off it", () => {
  // The harm is to the answerer, not the asker: rewriting a question somebody
  // has already answered silently re-parents their words.
  assert.equal(canEdit("open"), true);
  // Nobody picked it up, so rewriting it is the right response to that.
  assert.equal(canEdit("sunk"), true);
  assert.equal(canEdit("claimed"), false);
  assert.equal(canEdit("closed"), false);
});
