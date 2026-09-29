/**
 * "Has somebody already asked this?" — checked when a question is posted.
 *
 * ★ Done here, by counting shared characters, not by a model. The site's one
 * third party is the drafting coach, and its box tells people their draft
 * leaves the server only when they press that button. Posting a question must
 * not quietly become a second way out.
 *
 * The cost of that is recall: two sentences that mean the same thing in
 * different words ("用AI工作" / "如何使用AI") may be missed. That is the cheap
 * mistake — the organiser can still merge by hand from /admin. The expensive one
 * is a false match, so the threshold is set high and the asker always gets a
 * one-tap way out of a merge they disagree with.
 */

import { ConverterBuilder } from "opencc-js/core";
import * as Locale from "opencc-js/preset/t2cn";

/** Traditional to Simplified, characters only, so 做些什麼 and 做些什么 compare equal. */
const toSimplified = ConverterBuilder(Locale)({ from: "tw", to: "cn" });

/**
 * Words that say nothing about what is being asked. Removed before comparing,
 * longest first. ⚠️ Whole words only — removing single characters such as 用
 * or 在 breaks the words they are part of (使用 → 使).
 */
const FILLER = [
  "想看看", "想听听", "想了解", "想学习", "了解一下", "学习一下", "看一下",
  "大家", "别人", "其他人", "别的", "他人", "各位", "如何", "怎么", "怎样", "什么", "哪些",
  "想", "看看", "听听", "看", "我", "的", "了", "吗", "呢", "都",
];

/** A sentence reduced to what carries meaning: width, case, punctuation and filler gone. */
export function essence(text: string): string {
  const strip = (value: string) => FILLER.reduce((acc, word) => acc.split(word).join(""), value);
  // Filler out before converting as well as after: the converter reads an
  // already-simplified 么 as Traditional and turns it into 幺.
  let s = text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  s = strip(toSimplified(strip(s)));
  return s;
}

/** Adjacent-character pairs, the standard unit for comparing short Chinese text. */
function pairs(s: string): string[] {
  const chars = [...s];
  if (chars.length < 2) return chars;
  const out: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) out.push(chars[i] + chars[i + 1]);
  return out;
}

/** Dice coefficient over character pairs, 0–1. */
export function similarity(a: string, b: string): number {
  const x = pairs(essence(a));
  const y = pairs(essence(b));
  if (x.length === 0 || y.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const p of x) counts.set(p, (counts.get(p) ?? 0) + 1);
  let shared = 0;
  for (const p of y) {
    const n = counts.get(p) ?? 0;
    if (n > 0) {
      shared += 1;
      counts.set(p, n - 1);
    }
  }
  return (2 * shared) / (x.length + y.length);
}

/** At or above this, two questions are treated as the same one. See the tests for where it sits. */
export const SAME_QUESTION = 0.5;

export type Candidate = { id: string; text: string; answers: number };

/** The closest question on the board, if it is close enough to count as the same. */
export function findSimilar<C extends Candidate>(text: string, candidates: readonly C[]): C | null {
  let best: C | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = similarity(text, candidate.text);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= SAME_QUESTION ? best : null;
}
