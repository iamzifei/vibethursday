import assert from "node:assert/strict";
import { test } from "node:test";
import { readHint } from "../src/lib/coach.ts";

/**
 * The parsing half of the ask-box helper. The request half is not tested here
 * on purpose: it would need a key and a network, and everything that can go
 * wrong in it has exactly one outcome anyway — null, and the button did
 * nothing.
 */

test("a follow-up question comes through as written", () => {
  assert.equal(readHint("你在推的是什么东西，现在卡在哪一步"), "你在推的是什么东西，现在卡在哪一步");
});

test("the leave-it-alone token means there is nothing to say", () => {
  assert.equal(readHint("OK"), null);
  assert.equal(readHint(" ok "), null);
  // Observed: the token sometimes arrives with punctuation stuck to it.
  assert.equal(readHint("OK。"), null);
});

test("quotes the model wrapped around its one-liner are stripped", () => {
  assert.equal(readHint('"你在做什么"'), "你在做什么");
  assert.equal(readHint("「你在做什么」"), "你在做什么");
});

test("an empty or blank answer is nothing, not an empty hint", () => {
  assert.equal(readHint(""), null);
  assert.equal(readHint("   \n "), null);
});

test("a question mark survives — it is the point of the sentence", () => {
  assert.equal(readHint("你在哪个国家报税？"), "你在哪个国家报税？");
});

test("a model that ignores the length rule is cut, not passed through", () => {
  const rambling = "啊".repeat(200);
  const hint = readHint(rambling);
  assert.ok(hint && hint.length <= 80);
});
