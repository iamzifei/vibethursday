import assert from "node:assert/strict";
import { test } from "node:test";
import { findSimilar, similarity, SAME_QUESTION } from "../src/lib/wharf-similar.ts";

/**
 * "Has somebody already asked this?" (`src/lib/wharf-similar.ts`).
 *
 * Every pair below is a real sentence from the board (2026-09-29). The ones
 * that must NOT match matter more than the ones that must: a false match puts
 * somebody's name under a question they did not ask.
 */

const SAME: [string, string][] = [
  ["想看别人的工作流", "看看别人的ai工作流"],
  ["想看别人的工作流", "看看如何构建工作流"],
  ["想看看大家都在用AI做什么", "想看看别的都在用ai做些什么"],
  ["会计事务所 ai 税务系统", "会计事务所 ai 流程化"],
  ["用AI工作", "如何使用AI"],
];

const DIFFERENT: [string, string][] = [
  ["想找会ios的合伙人", "想找同频共振，创业合伙人"],
  ["想看别人的工作流", "看看视频工作流，什么平台可以cut片子"],
  ["AI 在地产行业的应用", "ai 在增长领域的应用"],
  ["AI 在地产行业的应用", "教培和AI结合"],
  ["自媒体运营", "交流ai使用经验"],
  ["想看别人的工作流", "想建立自己的工作流-电气工程领域，也想看看在这领域的人如何搭建自己的AI应用"],
  ["想看别人的AI工作流，想了解税务申报抵扣相关", "想看别人的工作流"],
];

test("★ the same question in different words is recognised", () => {
  for (const [a, b] of SAME) assert.ok(similarity(a, b) >= SAME_QUESTION, `${a} / ${b}: ${similarity(a, b)}`);
});

test("★ questions that only share a topic word are not merged", () => {
  for (const [a, b] of DIFFERENT) assert.ok(similarity(a, b) < SAME_QUESTION, `${a} / ${b}: ${similarity(a, b)}`);
});

test("Traditional and Simplified compare as the same text", () => {
  assert.equal(similarity("想看看大家都在做什麼", "想看看大家都在做什么"), 1);
});

test("findSimilar returns the closest match, or nothing", () => {
  const board = [
    { id: "1", text: "想找会ios的合伙人", answers: 0 },
    { id: "2", text: "看看别人的ai工作流", answers: 1 },
  ];
  assert.equal(findSimilar("想看别人的工作流", board)?.id, "2");
  assert.equal(findSimilar("自媒体运营", board), null);
  assert.equal(findSimilar("任何问题", []), null);
});
