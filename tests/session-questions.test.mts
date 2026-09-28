import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_QUESTIONS, parseQuestionList, questionsMode } from "../src/lib/session-questions.ts";

/**
 * This week's Q&A questions (`src/lib/session-questions.ts`).
 *
 * The organiser pastes the candidates into /admin one per line, marking the
 * ones the group voted for with a leading "*". /go shows them: the candidates
 * before the day, "today we talk about these two" on the morning itself.
 */

test("one per line, * marks the chosen ones, numbering and blanks are dropped", () => {
  const list = parseQuestionList(`
1. 不会拍也不会剪，用 AI 做短视频最小的流程是什么
* 2、一个人没有营销团队，怎么用 AI 每周稳定出内容

*③ 内容发出去之后，怎么把刷到的人变成客户
  4) 做 B2B 的，内容获客还有没有用
`);

  assert.deepEqual(list, [
    { text: "不会拍也不会剪，用 AI 做短视频最小的流程是什么", chosen: false },
    { text: "一个人没有营销团队，怎么用 AI 每周稳定出内容", chosen: true },
    { text: "内容发出去之后，怎么把刷到的人变成客户", chosen: true },
    { text: "做 B2B 的，内容获客还有没有用", chosen: false },
  ]);
});

test("capped in count and length, and empty input is an empty list", () => {
  const many = Array.from({ length: 12 }, (_, i) => `问题 ${i + 1}`).join("\n");
  assert.equal(parseQuestionList(many).length, MAX_QUESTIONS);
  assert.equal(parseQuestionList("长".repeat(500))[0].text.length, 200);
  assert.deepEqual(parseQuestionList("   \n\n  "), []);
  // A line that is only a marker is not a question.
  assert.deepEqual(parseQuestionList("*\n1.\n"), []);
});

test("before the day: candidates; on the day and until one: today's; after: nothing", () => {
  assert.equal(questionsMode("before", false), "candidates");
  assert.equal(questionsMode("day", false), "today");
  assert.equal(questionsMode("day", true), "today");
  assert.equal(questionsMode("after", true), "today");
  assert.equal(questionsMode("after", false), "hidden");
});
