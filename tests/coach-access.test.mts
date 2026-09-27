import assert from "node:assert/strict";
import { test } from "node:test";
import { coachRateKey, coachReply, VISITOR_CALLS_PER_HOUR } from "../src/lib/coach-access.ts";

/**
 * Who may press "help me ask this better", and against which allowance
 * (`src/lib/coach-access.ts`).
 *
 * Until 2026-09-28 the button needed a member cookie, so it only existed on the
 * Wharf. The signup form is where most vague questions are written, and most
 * people filling it in have no card yet — so visitors now get it too, limited
 * by address. The site-wide daily cap in `coach-budget.ts` is still what bounds
 * the bill; these keys only stop one person or one room using all of it.
 */

test("a member is limited as a member, exactly as before", () => {
  assert.deepEqual(coachRateKey("42", "1.2.3.4"), { key: "coach:42", max: undefined });
});

test("★ a visitor without a card is no longer refused, but limited by address", () => {
  assert.deepEqual(coachRateKey(null, "1.2.3.4"), { key: "coach-ip:1.2.3.4", max: VISITOR_CALLS_PER_HOUR });
});

test("the visitor allowance fits a room on one Wi-Fi without being unbounded", () => {
  // A café full of phones is one address; a handful of presses each must fit.
  assert.ok(VISITOR_CALLS_PER_HOUR >= 10);
  // …and it is still a limit, well under the site-wide daily cap.
  assert.ok(VISITOR_CALLS_PER_HOUR <= 50);
});

test("member and visitor keys can never collide", () => {
  assert.notEqual(coachRateKey("1.2.3.4", "x").key, coachRateKey(null, "1.2.3.4").key);
});

test("★ a failed call is never reported as 'already specific enough'", () => {
  // Measured 2026-09-28: with the upstream call failing, "想了解了解" — the
  // vaguest sentence there is — came back as "这句已经够具体了". `coachDraft`
  // returns null on every failure, and the route passed that on as
  // `{ hint: null, gap: null }`, which the page reads as praise.
  assert.deepEqual(coachReply(null), { status: 503, body: { error: "unavailable" } });
});

test("a real answer still comes back as a hint and a gap", () => {
  assert.deepEqual(coachReply({ gap: "object", ask: "具体是哪一类客户？" }), {
    status: 200,
    body: { hint: "具体是哪一类客户？", gap: "object" },
  });
  // "Nothing to ask" is a real answer, not a failure.
  assert.deepEqual(coachReply({ gap: "none", ask: "" }), { status: 200, body: { hint: null, gap: "none" } });
});
