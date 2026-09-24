import assert from "node:assert/strict";
import { test } from "node:test";
import { checkinCode, verifyCheckinCode } from "../src/lib/checkin.ts";
import {
  canGiveFeedback,
  feedbackCode,
  isRecommend,
  parseRating,
  summarise,
  verifyFeedbackCode,
  WINDOW_DAYS,
  type FeedbackRow,
} from "../src/lib/feedback.ts";

/**
 * Feedback on a session (`src/lib/feedback.ts`).
 *
 * Three things in here fail silently rather than loudly, which is why each has
 * a test: a code that opens the wrong door, a window that is off by a day, and
 * an average computed against the wrong denominator. None of them throws, none
 * shows up in a screenshot, and the third is worse than an error because it
 * produces a plausible number.
 */

const KEY = "test-key-not-a-real-secret";
const SESSION = "2026-09-24";

const day = 24 * 60 * 60 * 1000;

/** `n` days after a session, as an ISO date. */
function after(session: string, n: number): string {
  return new Date(Date.parse(`${session}T00:00:00Z`) + n * day).toISOString().slice(0, 10);
}

test("a code verifies for its own session and nothing else", () => {
  const code = feedbackCode(SESSION, KEY);

  assert.ok(verifyFeedbackCode(SESSION, code, KEY));
  assert.ok(!verifyFeedbackCode("2026-10-01", code, KEY));
  assert.ok(!verifyFeedbackCode(SESSION, `${code}x`, KEY));
  assert.ok(!verifyFeedbackCode(SESSION, "", KEY));
  assert.ok(!verifyFeedbackCode(SESSION, null, KEY));
  // A different key is a different code, which is what makes the secret a secret.
  assert.ok(!verifyFeedbackCode(SESSION, code, "another-key"));
  // Not a date at all.
  assert.ok(!verifyFeedbackCode("2026-02-31", feedbackCode("2026-02-31", KEY), KEY));
});

test("★ a feedback code cannot check anybody in, and a check-in code cannot leave feedback", () => {
  // The two are HMACs of the same date under the same key; only the label
  // inside them differs. Drop the label and the link handed round after a
  // session becomes a working check-in code for it — which would let anyone
  // who was sent the feedback link add themselves to that morning's wall.
  const feedback = feedbackCode(SESSION, KEY);
  const checkin = checkinCode(SESSION, KEY);

  assert.notEqual(feedback, checkin);
  assert.ok(!verifyCheckinCode(SESSION, feedback, KEY));
  assert.ok(!verifyFeedbackCode(SESSION, checkin, KEY));
});

test("★ both modules take their key from the same environment", () => {
  // `feedback.ts` deliberately repeats `checkin.ts`'s three-line key lookup
  // rather than importing it. This is the test that keeps the copies honest:
  // if one ever starts reading a different variable, every code it has already
  // handed out stops verifying, and nothing else would say so.
  const saved = { member: process.env.MEMBER_SECRET, admin: process.env.ADMIN_TOKEN };

  try {
    delete process.env.MEMBER_SECRET;
    process.env.ADMIN_TOKEN = "admin-only";

    assert.equal(feedbackCode(SESSION), feedbackCode(SESSION, "admin-only"));
    assert.equal(checkinCode(SESSION), checkinCode(SESSION, "admin-only"));

    // MEMBER_SECRET wins when both are set — for both modules, or not at all.
    process.env.MEMBER_SECRET = "member-wins";

    assert.equal(feedbackCode(SESSION), feedbackCode(SESSION, "member-wins"));
    assert.equal(checkinCode(SESSION), checkinCode(SESSION, "member-wins"));

    delete process.env.MEMBER_SECRET;
    delete process.env.ADMIN_TOKEN;

    assert.throws(() => feedbackCode(SESSION));
    assert.throws(() => checkinCode(SESSION));
  } finally {
    if (saved.member === undefined) delete process.env.MEMBER_SECRET;
    else process.env.MEMBER_SECRET = saved.member;

    if (saved.admin === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = saved.admin;
  }
});

test("the window opens on the day and closes before the next session", () => {
  assert.equal(WINDOW_DAYS, 7);

  // Nothing to say about a morning that has not happened.
  assert.ok(!canGiveFeedback(SESSION, after(SESSION, -1)));

  assert.ok(canGiveFeedback(SESSION, SESSION));
  assert.ok(canGiveFeedback(SESSION, after(SESSION, 1)));
  assert.ok(canGiveFeedback(SESSION, after(SESSION, 6)));

  // Day 7 is the next Thursday. From here on, a form handed in would be
  // filed under the wrong session.
  assert.ok(!canGiveFeedback(SESSION, after(SESSION, 7)));
  assert.ok(!canGiveFeedback(SESSION, after(SESSION, 40)));

  // Daylight saving: Sydney moves its clocks on 2026-10-04, inside the window
  // of the session before it. The dates are compared as UTC midnights, so the
  // shift must not move the boundary.
  assert.ok(canGiveFeedback("2026-10-01", "2026-10-06"));
  assert.ok(!canGiveFeedback("2026-10-01", "2026-10-08"));

  assert.ok(!canGiveFeedback("not-a-date", SESSION));
  assert.ok(!canGiveFeedback(SESSION, "not-a-date"));
});

test("answers that are not answers are rejected, not coerced", () => {
  assert.equal(parseRating("4"), 4);
  assert.equal(parseRating("1"), 1);
  assert.equal(parseRating("5"), 5);

  // Each of these would otherwise arrive as a number and be stored as one.
  assert.equal(parseRating("0"), null);
  assert.equal(parseRating("6"), null);
  assert.equal(parseRating("4.5"), null);
  assert.equal(parseRating(""), null);
  assert.equal(parseRating(null), null);
  assert.equal(parseRating("banana"), null);

  assert.ok(isRecommend("yes"));
  assert.ok(isRecommend("maybe"));
  assert.ok(isRecommend("no"));
  assert.ok(!isRecommend("Yes"));
  assert.ok(!isRecommend(""));
  assert.ok(!isRecommend(null));
});

test("★ a summary counts each answer against its own denominator", () => {
  const rows: FeedbackRow[] = [
    { session: "2026-09-17", rating: 5, recommend: "yes" },
    { session: "2026-09-17", rating: 4, recommend: "maybe" },
    // Handed the form in, answered neither question. Must count as one form
    // and as nothing else — treating a skipped rating as a zero would put this
    // session at 3.0 instead of 4.5.
    { session: "2026-09-17", rating: null, recommend: null },
    { session: "2026-09-24", rating: 3, recommend: "no" },
  ];

  const [newest, older] = summarise(rows);

  // Newest session first: the page's first row is the morning just gone.
  assert.equal(newest.session, "2026-09-24");
  assert.equal(older.session, "2026-09-17");

  assert.equal(older.count, 3);
  assert.equal(older.rated, 2);
  assert.equal(older.average, 4.5);
  assert.equal(older.asked, 2);
  assert.equal(older.yes, 1);

  assert.equal(newest.count, 1);
  assert.equal(newest.average, 3);
  assert.equal(newest.yes, 0);
});

test("a summary of nothing is empty, not a row of zeroes and NaNs", () => {
  assert.deepEqual(summarise([]), []);

  // Everybody skipped both questions: one real form, no average to show.
  const [only] = summarise([
    { session: SESSION, rating: null, recommend: null },
    { session: SESSION, rating: null, recommend: null },
  ]);

  assert.equal(only.count, 2);
  assert.equal(only.rated, 0);
  assert.equal(only.asked, 0);
  assert.equal(only.average, null, "0/0 must not reach the page as NaN");
  assert.ok(!Number.isNaN(only.average as unknown as number));
});

test("the average is rounded for display, not silently truncated", () => {
  // 4, 4, 5 is 4.333…; the table has room for one decimal.
  const [row] = summarise([
    { session: SESSION, rating: 4, recommend: null },
    { session: SESSION, rating: 4, recommend: null },
    { session: SESSION, rating: 5, recommend: null },
  ]);

  assert.equal(row.average, 4.3);
});
