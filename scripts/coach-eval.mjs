#!/usr/bin/env node
/**
 * Grades the ask-box helper against real drafts.
 *
 *   npm run coach:eval            一遍
 *   npm run coach:eval -- 3       每条跑三遍，同时量稳定性
 *
 * ★ Why this exists. "The answers feel bad" is not something you can act on: it
 * cannot tell you whether an edit helped, and every prompt change after it is a
 * guess. This turns the complaint into two numbers — how often the model names
 * the right gap, and how often it gives the same answer twice — and prints the
 * rows it got wrong so the next edit has somewhere to aim.
 *
 * ⚠️ It spends money, one call per draft per round. Twenty drafts times three
 * rounds is sixty calls, a fraction of a cent. It does NOT go through the daily
 * budget in the app, because it does not go through the route — so do not leave
 * it in a loop.
 */
import { readFileSync } from "node:fs";
import { coachDraft } from "../src/lib/coach.ts";

const ROUNDS = Number(process.argv[2] ?? 1);
const { drafts } = JSON.parse(readFileSync("tests/fixtures/coach-drafts.json", "utf8"));

if (!process.env.DEEPSEEK_API_KEY) {
  console.error("DEEPSEEK_API_KEY is not set. Try: export $(grep DEEPSEEK .env.local | xargs)");
  process.exit(1);
}

const rows = await Promise.all(
  drafts.map(async (row) => {
    const runs = [];
    for (let i = 0; i < ROUNDS; i += 1) runs.push(await coachDraft(row.draft));

    const accepted = new Set([row.gap, ...(row.alsoOk ?? [])]);
    const gaps = runs.map((r) => r?.gap ?? "—");

    return {
      ...row,
      gaps,
      // Right on the first run is the headline; the rest measure steadiness.
      hit: accepted.has(gaps[0]),
      steady: new Set(gaps).size === 1,
      ask: runs[0]?.ask ?? "",
    };
  }),
);

const hits = rows.filter((r) => r.hit).length;
const steady = rows.filter((r) => r.steady).length;

console.log(`\n判对缺哪一项  ${hits}/${rows.length}  (${Math.round((hits / rows.length) * 100)}%)`);
if (ROUNDS > 1) {
  console.log(`${ROUNDS} 次答案一致  ${steady}/${rows.length}  (${Math.round((steady / rows.length) * 100)}%)`);
}

// The misses are the whole output. A bare percentage tells you nothing about
// what to change.
const wrong = rows.filter((r) => !r.hit || !r.steady);

if (wrong.length === 0) {
  console.log("\n没有错的，也没有飘的。");
} else {
  console.log(`\n${wrong.length} 条要看：\n`);
  for (const r of wrong) {
    const flag = !r.hit ? "✗ 判错" : "~ 不稳";
    console.log(`${flag}  「${r.draft}」`);
    console.log(`      应该是 ${[r.gap, ...(r.alsoOk ?? [])].join(" 或 ")}，它给了 ${r.gaps.join(" / ")}`);
    if (r.ask) console.log(`      问的是：${r.ask}`);
    if (r.why) console.log(`      理由：${r.why}`);
    console.log();
  }
}

// Everything it asked, so a person can judge the questions themselves — the
// score only grades the category, and a right category can still be a limp
// question.
console.log("─".repeat(64));
for (const r of rows) {
  console.log(`${r.hit ? " " : "✗"} ${r.gaps[0].padEnd(11)} 「${r.draft}」`);
  if (r.ask) console.log(`               → ${r.ask}`);
}
