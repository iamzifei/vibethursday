/**
 * Telling a WeChat ID from a nickname.
 *
 * Tightened 2026-09-28: a signup left a five-letter English nickname in the
 * WeChat ID box. It passed the old check (letters only), could not be found in
 * WeChat, and could not be looked up on /my with the real ID. WeChat IDs are
 * 6–20 characters starting with a letter or underscore; phone and QQ numbers
 * also find people, so all-digit values pass too.
 *
 * The examples below are made up — none is anybody's real ID or nickname.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { looksLikeWechatId } from "../src/lib/wechat-id.ts";

test("nicknames and near-misses are flagged", () => {
  for (const value of [
    "Lily", // too short to be an ID
    "Momo5", // five characters
    "Kate Li", // space
    "小王", // Chinese
    "tom_dev（视频号）", // a note appended
    "9abcdefg", // IDs cannot start with a digit unless all digits
    "a".repeat(21), // too long
    "",
  ]) {
    assert.equal(looksLikeWechatId(value), false, `should flag ${JSON.stringify(value)}`);
  }
});

test("real ID shapes pass", () => {
  for (const value of [
    "tom_dev88",
    "Lily-2020",
    "_underscore1",
    "wxid_abc123xyz", // WeChat's own generated IDs
    "0412345678", // an Australian mobile
    "13812345678", // a Chinese mobile
    "12345678", // a QQ number
    "  tom_dev88  ", // surrounding space is trimmed, not held against it
  ]) {
    assert.equal(looksLikeWechatId(value), true, `should accept ${JSON.stringify(value)}`);
  }
});
