/**
 * Recorded lessons (2026-10-28): who may watch, the learner cookie, email
 * codes, and what people are allowed to type. All pure.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canAccessLessons,
  canIntroduceSelf,
  cleanText,
  downloadName,
  emailCodeMatches,
  formatDuration,
  handoutKey,
  hashEmailCode,
  LEARN_TTL_SECONDS,
  learnerToken,
  looksLikeEmailCode,
  looksLikeLessonSlug,
  looksLikeVideoId,
  newEmailCode,
  normaliseEmail,
  readLearnerToken,
} from "../src/lib/learn.ts";

const KEY = "test-key-not-a-secret";

test("★ only an approved learner may access lessons", () => {
  assert.equal(canAccessLessons({ status: "approved" }), true);
  assert.equal(canAccessLessons({ status: "pending" }), false);
  assert.equal(canAccessLessons({ status: "revoked" }), false);
  assert.equal(canAccessLessons(null), false);
  assert.equal(canAccessLessons(undefined), false);
});

test("★ a learner cookie round-trips, and nothing else reads as one", () => {
  const now = 1_800_000_000_000;
  const token = learnerToken("42", now, KEY);
  assert.equal(readLearnerToken(token, now, KEY), "42");

  // Another key, another id under the same signature, a trimmed signature.
  assert.equal(readLearnerToken(token, now, "other-key"), null);
  assert.equal(readLearnerToken(token.replace(/^42\./, "43."), now, KEY), null);
  assert.equal(readLearnerToken(token.slice(0, -1), now, KEY), null);
  assert.equal(readLearnerToken("", now, KEY), null);
  assert.equal(readLearnerToken(undefined, now, KEY), null);
  assert.equal(readLearnerToken("not.a.token", now, KEY), null);
});

test("★ a learner cookie stops working when it expires", () => {
  const now = 1_800_000_000_000;
  const token = learnerToken("7", now, KEY);
  assert.equal(readLearnerToken(token, now + (LEARN_TTL_SECONDS - 60) * 1000, KEY), "7");
  assert.equal(readLearnerToken(token, now + (LEARN_TTL_SECONDS + 1) * 1000, KEY), null);
});

test("★ an email code only matches its own address", () => {
  const hash = hashEmailCode("a@example.com", "123456", KEY);
  assert.equal(emailCodeMatches("a@example.com", "123456", hash, KEY), true);
  assert.equal(emailCodeMatches("a@example.com", "123457", hash, KEY), false);
  assert.equal(emailCodeMatches("b@example.com", "123456", hash, KEY), false);
  assert.equal(emailCodeMatches("a@example.com", "123456", hash, "other-key"), false);
  // Never the code itself.
  assert.ok(!hash.includes("123456"));
});

test("new codes are six digits", () => {
  for (let i = 0; i < 200; i += 1) assert.match(newEmailCode(), /^\d{6}$/);
  assert.equal(looksLikeEmailCode("012345"), true);
  assert.equal(looksLikeEmailCode("12345"), false);
  assert.equal(looksLikeEmailCode("12345a"), false);
});

test("emails are normalised, and junk is refused", () => {
  assert.equal(normaliseEmail("  Me@Example.COM "), "me@example.com");
  assert.equal(normaliseEmail("me@example"), null);
  assert.equal(normaliseEmail("me example@x.com"), null);
  assert.equal(normaliseEmail("a<b>@x.com"), null);
  assert.equal(normaliseEmail(42), null);
  assert.equal(normaliseEmail(`${"a".repeat(250)}@x.com`), null);
});

test("typed text is trimmed, cut, and stripped of control characters", () => {
  assert.equal(cleanText("  hi  ", 10), "hi");
  assert.equal(cleanText("   ", 10), null);
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText("a\u0000b\u0007c", 10), "abc");
  assert.equal(cleanText("line one\nline two", 40), "line one\nline two");
  assert.equal(cleanText(null, 10), null);
  // Invisible format characters: a name made only of them would blank the
  // watermark, and bidi overrides can disguise one name as another.
  assert.equal(cleanText("\u200B", 10), null);
  assert.equal(cleanText("\u2066\u202Eab\u2069", 10), "ab");
  assert.equal(cleanText("a\uFEFFb", 10), "ab");
});

test("lesson slugs and video ids", () => {
  assert.equal(looksLikeLessonSlug("lesson-01"), true);
  assert.equal(looksLikeLessonSlug("Lesson-01"), false);
  assert.equal(looksLikeLessonSlug("lesson--01"), false);
  assert.equal(looksLikeLessonSlug("../etc"), false);
  assert.equal(looksLikeVideoId("0123456789abcdef0123456789abcdef"), true);
  assert.equal(looksLikeVideoId("0123456789abcdef"), false);
});

test("handout names never escape their folder or break a file system", () => {
  assert.equal(handoutKey("3", "abc", "pdf"), "learn/3/abc.pdf");
  assert.equal(downloadName("第 1 课 / 教案: 草稿?", "pdf"), "第 1 课 教案 草稿.pdf");
  assert.equal(downloadName("   ", "pdf"), "handout.pdf");
});

test("durations read like a video player's", () => {
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3725), "1:02:05");
  assert.equal(formatDuration(0), null);
  assert.equal(formatDuration(null), null);
});

test("only a waiting learner can introduce themselves (an approved name is fixed)", () => {
  assert.equal(canIntroduceSelf("pending"), true);
  assert.equal(canIntroduceSelf("approved"), false);
  assert.equal(canIntroduceSelf("revoked"), false);
});
