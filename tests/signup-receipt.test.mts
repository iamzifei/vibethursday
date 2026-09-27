/**
 * Guards on how a signup tells people it worked, and on the WeChat ID check.
 *
 * People were asking in the group whether their signup had gone through, and
 * then failing to claim their card because they had typed a nickname, or had
 * appended a note to their ID, and could not reproduce it later.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { copy } from "../src/lib/content.ts";
import { looksLikeWechatId } from "../src/lib/wechat-id.ts";

const LANGS = ["zh", "en"] as const;

test("real WeChat IDs pass, including phone numbers", () => {
  for (const id of ["alex2026", "sam_lee_AU", "Kai-Chen", "_0412345678", "0400000000", "  jdoe  "]) {
    assert.ok(looksLikeWechatId(id), `${id} should pass`);
  }
});

test("nicknames and annotated IDs are flagged", () => {
  for (const id of ["小王（视频号）", "Sam读书人", "Alex 0101", "abc(视频号)", ""]) {
    assert.ok(!looksLikeWechatId(id), `${id} should be flagged`);
  }
});

test("both languages say plainly that the signup worked, and repeat what is on record", () => {
  for (const lang of LANGS) {
    const s = copy[lang].signup;
    for (const key of [
      "successTitle",
      "successSession",
      "successNoSession",
      "successBody",
      "successBodyNoEmail",
      "successRecap",
      "successRecapName",
      "successRecapWechat",
      "successRecapEmail",
      "successRecapHint",
      "errorWechatId",
    ] as const) {
      assert.ok(s[key].trim().length > 0, `${lang}.signup.${key} is empty`);
    }
  }
});

test("the Chinese success message does not promise an email to someone who left none", () => {
  assert.ok(!copy.zh.signup.successBodyNoEmail.includes("邮箱"));
});
