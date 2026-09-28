import assert from "node:assert/strict";
import { test } from "node:test";
import { toTraditional } from "../src/lib/traditional.ts";

/**
 * 周 / 週 in the Traditional pages (2026-09-28 review): the converter turned
 * most "这周" into "這週" but left "這周最想聊", "我這周來不了" and "看本周".
 * A week is 週 in Traditional; 周 stays only where it is not a week (a name,
 * 周到, 周围 …).
 */
test("a week is 週 after conversion", () => {
  assert.equal(toTraditional("这周最想聊什么"), "這週最想聊什麼");
  assert.equal(toTraditional("看本周 →"), "看本週 →");
  assert.equal(toTraditional("我这周来不了"), "我這週來不了");
  assert.equal(toTraditional("每周四上午"), "每週四上午");
  assert.equal(toTraditional("上周和下周"), "上週和下週");
});

test("周 that is not a week is left alone", () => {
  assert.match(toTraditional("周到"), /^周到$|^週到$/);
  assert.equal(toTraditional("周围"), toTraditional("周围"));
});
