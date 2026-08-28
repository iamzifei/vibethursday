#!/usr/bin/env node
/**
 * Sorts the questions already on the board by whether anybody can act on them.
 *
 *   npm run coach:triage           看一遍，不写库
 *   npm run coach:triage -- --apply  真的改
 *
 * ★ Why this is a script you run and not something the site does by itself.
 * Demoting somebody's question out of the main list is a judgement about their
 * writing, made by a model that is right about four times in five. Four in five
 * is fine for a suggestion and not fine for something that happens quietly to
 * twenty people's sentences while nobody is looking. So it prints first, writes
 * only when told, and everything it does is reversible from /admin.
 *
 * ⚠️ It will not touch a question that is closed, or that somebody has claimed
 * or answered. Somebody acting on a question is stronger evidence that it was
 * answerable than any opinion about its wording.
 */
import { coachDraft } from "../src/lib/coach.ts";
import { listTriageCandidates, setQuestionLane } from "../src/lib/db.ts";

const APPLY = process.argv.includes("--apply");

if (!process.env.DEEPSEEK_API_KEY) {
  console.error("DEEPSEEK_API_KEY is not set.");
  process.exit(1);
}

const candidates = await listTriageCandidates();
console.log(`${candidates.length} 条待判（未结帖、没人接过、还在问题栏）\n`);

const moves = [];

for (const row of candidates) {
  const coaching = await coachDraft(row.text);

  // No answer at all means no opinion, and no opinion must never demote a row.
  if (!coaching) {
    console.log(`  ?  「${row.text.slice(0, 40)}」 — 判不出来，留在问题栏`);
    continue;
  }

  const lane =
    coaching.gap === "social" ? "chat" : coaching.gap === "none" ? "question" : "vague";

  if (lane === "question") {
    console.log(`  ✓  「${row.text.slice(0, 40)}」`);
    continue;
  }

  moves.push({ ...row, lane, ask: coaching.ask, gap: coaching.gap });
  console.log(`  →  「${row.text.slice(0, 40)}」  ${row.lane} → ${lane}  (${coaching.gap})`);
  if (coaching.ask) console.log(`        缺的是：${coaching.ask}`);
}

console.log(`\n${moves.length} 条要动，${candidates.length - moves.length} 条留在问题栏。`);

if (!APPLY) {
  console.log("这是预演。真要改加 --apply。");
  process.exit(0);
}

for (const move of moves) {
  await setQuestionLane(move.id, move.lane, move.ask || null);
}

console.log(`已写入 ${moves.length} 条。全部可以在 /admin 上改回去。`);
process.exit(0);
