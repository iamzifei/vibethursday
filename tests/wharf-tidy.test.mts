import assert from "node:assert/strict";
import { test } from "node:test";
import { tidyBoard, type TidyRow } from "../src/lib/wharf-tidy.ts";

/**
 * Keeping the Wharf readable (`src/lib/wharf-tidy.ts`).
 *
 * Measured on production 2026-09-28: 51 questions and 20 "想聊的", with the
 * same person's same sentence on the board up to four times — every signup
 * re-imports the topic box, so a regular who never changes it gets a fresh row
 * each week — and the bottom half made of questions nobody had touched in over
 * three weeks. Nothing is deleted: rows are grouped and folded, and every
 * folded one is still one tap away.
 */

let id = 0;
function row(over: Partial<TidyRow["question"]> & { status?: TidyRow["status"]; answers?: number; claims?: number }): TidyRow {
  id += 1;
  const { status = "open", answers = 0, claims = 0, ...question } = over;
  return {
    status,
    answers,
    claims,
    question: {
      id: String(id),
      member_id: "m1",
      name: "M1",
      slug: "m1",
      merged_into: null,
      text: "看看如何构建工作流",
      lane: "question",
      session: "2026-09-24",
      created_at: `2026-09-${String(10 + id).padStart(2, "0")}T00:00:00Z`,
      ...question,
    },
  };
}

const RECENT = ["2026-10-01", "2026-09-24"];

test("★ the same person's same sentence shows once, however many times it was imported", () => {
  const rows = [
    row({ text: "自媒体运营", session: "2026-09-03", status: "sunk" }),
    row({ text: "自媒体运营", session: "2026-09-17" }),
    row({ text: " 自媒体运营 ", session: "2026-09-24" }),
  ];
  const { shown, folded } = tidyBoard(rows, RECENT);

  assert.equal(shown.length, 1);
  assert.equal(shown[0].question.session, "2026-09-24", "the newest one is the one kept");
  assert.equal(shown[0].times, 3);
  assert.equal(folded.length, 0, "duplicates are merged, not folded");
});

test("the copy that has an answer wins over a newer bare copy", () => {
  const answered = row({ text: "产品 distribution 渠道", session: "2026-08-27", status: "claimed", answers: 1 });
  const rows = [answered, row({ text: "产品 distribution 渠道", session: "2026-09-24" })];
  const { shown } = tidyBoard(rows, RECENT);

  assert.equal(shown.length, 1);
  assert.equal(shown[0].question.id, answered.question.id);
  assert.equal(shown[0].times, 2);
});

test("two people asking the same thing are two entries", () => {
  const rows = [row({ member_id: "a", text: "AI工作流" }), row({ member_id: "b", text: "AI工作流" })];
  assert.equal(tidyBoard(rows, RECENT).shown.length, 2);
});

test("★ questions nobody touched in three weeks are folded, not deleted", () => {
  const rows = [row({ text: "旧问题", status: "sunk" }), row({ text: "新问题" })];
  const { shown, folded } = tidyBoard(rows, RECENT);

  assert.deepEqual(shown.map((r) => r.question.text), ["新问题"]);
  assert.deepEqual(folded.map((r) => r.question.text), ["旧问题"]);
});

test("closed questions fold unless someone answered them", () => {
  const rows = [
    row({ text: "关了没答", status: "closed" }),
    row({ text: "关了有答", status: "closed", answers: 1 }),
  ];
  const { shown, folded } = tidyBoard(rows, RECENT);

  assert.deepEqual(shown.map((r) => r.question.text), ["关了有答"]);
  assert.deepEqual(folded.map((r) => r.question.text), ["关了没答"]);
});

test("'want to chat' lines only stay up for the two most recent sessions", () => {
  const rows = [
    row({ lane: "chat", text: "交流 AI 使用经验", session: "2026-09-24" }),
    row({ lane: "chat", text: "来学习学习", session: "2026-08-20", member_id: "m2" }),
    row({ lane: "chat", text: "没有场次的", session: null, member_id: "m3" }),
  ];
  const { shown, folded } = tidyBoard(rows, RECENT);

  assert.deepEqual(shown.map((r) => r.question.text), ["交流 AI 使用经验"]);
  assert.deepEqual(folded.map((r) => r.question.text).sort(), ["来学习学习", "没有场次的"].sort());
});

test("order is newest first within what is shown", () => {
  const rows = [row({ text: "a", member_id: "x" }), row({ text: "b", member_id: "y" })];
  assert.deepEqual(tidyBoard(rows, RECENT).shown.map((r) => r.question.text), ["b", "a"]);
});

test("★ questions merged by hand show once, with every asker's name under the kept one", () => {
  const kept = row({ member_id: "a", name: "Amy", slug: "amy", text: "想看看别人的 AI 工作流" });
  const rows = [
    kept,
    row({ member_id: "b", name: "Bob", text: "看看别人工作流", merged_into: kept.question.id }),
    row({ member_id: "c", name: "Cat", text: "AI工作流", lane: "chat", merged_into: kept.question.id }),
  ];
  const { shown, folded } = tidyBoard(rows, RECENT);

  assert.equal(shown.length, 1);
  assert.equal(folded.length, 0);
  assert.equal(shown[0].question.id, kept.question.id, "the kept wording is the one shown");
  assert.deepEqual(shown[0].askers.map((a) => a.name), ["Amy", "Bob", "Cat"]);
});

test("the same person merged twice is one name, not two", () => {
  const kept = row({ member_id: "a", name: "Amy", text: "用AI工作" });
  const rows = [kept, row({ member_id: "a", name: "Amy", text: "如何使用AI", merged_into: kept.question.id })];
  const { shown } = tidyBoard(rows, RECENT);

  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].askers.map((a) => a.name), ["Amy"]);
});

test("★ a merged sentence re-imported next week joins its merge instead of popping back up", () => {
  const kept = row({ member_id: "a", name: "Amy", text: "想看看别人的 AI 工作流" });
  const rows = [
    kept,
    row({ member_id: "b", name: "Bob", text: "看看别人工作流", session: "2026-09-24", merged_into: kept.question.id }),
    row({ member_id: "b", name: "Bob", text: "看看别人工作流", session: "2026-10-01" }),
  ];
  const { shown } = tidyBoard(rows, RECENT);

  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].askers.map((a) => a.name), ["Amy", "Bob"]);
});

test("a sunk kept question comes back up when a merged one is live", () => {
  const kept = row({ member_id: "a", name: "Amy", text: "工作流", status: "sunk", session: "2026-09-03" });
  const rows = [kept, row({ member_id: "b", name: "Bob", text: "看工作流", merged_into: kept.question.id })];
  const { shown, folded } = tidyBoard(rows, RECENT);

  assert.equal(folded.length, 0);
  assert.equal(shown[0].status, "open");
});

test("unmerged rows have their author as the only asker", () => {
  const { shown } = tidyBoard([row({ name: "Solo", text: "独立的问题" })], RECENT);
  assert.deepEqual(shown[0].askers.map((a) => a.name), ["Solo"]);
});
