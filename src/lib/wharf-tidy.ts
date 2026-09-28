// Relative, not "@/": the tests load this through Node's type stripper.
import type { Lane, QuestionStatus } from "./questions.ts";

/**
 * What the Wharf shows, and what it folds away.
 *
 * Measured on production 2026-09-28: 51 questions and 20 "想聊的" on one page.
 * Two things made it unreadable, and neither was a bad question:
 *
 * 1. **The same sentence, again and again.** Every signup copies the topic box
 *    onto the board, keyed by session, so a regular who never changes it gets a
 *    fresh row every week — one person's "自媒体运营" was up four times.
 * 2. **Questions nobody had touched in weeks.** "Sunk" (three weeks, no claim,
 *    no answer) was already a status; it just stayed on the page.
 *
 * ★ Nothing here deletes anything. Duplicates are grouped into one entry and
 * the rest are folded under a "see earlier" disclosure, so a wrong call costs a
 * tap, not a row. Answered questions are never folded: the answer is the most
 * useful thing on the page.
 */

export type TidyRow = {
  question: {
    id: string;
    member_id: string;
    text: string;
    lane: Lane;
    session: string | null;
    created_at: string;
  };
  status: QuestionStatus;
  answers: number;
  claims: number;
};

export type TidyEntry<R extends TidyRow = TidyRow> = R & {
  /** How many rows this entry stands for — the same person asking it N weeks running. */
  times: number;
};

/** A sentence as it is compared for sameness: width, spacing and case ignored. */
function sameness(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Newest first, by creation time. */
function newestFirst<T extends { question: { created_at: string } }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.question.created_at < b.question.created_at ? 1 : -1));
}

/**
 * Groups duplicates and splits the board into what is shown and what is folded.
 *
 * - One entry per (author, sentence). The copy kept is the one with the most
 *   engagement (answers, then claims); among equals, the newest.
 * - Folded: questions that have sunk, closed ones nobody answered, and "想聊的"
 *   lines from sessions older than `recentSessions`.
 */
export function tidyBoard<R extends TidyRow>(
  rows: readonly R[],
  recentSessions: readonly string[],
): { shown: TidyEntry<R>[]; folded: TidyEntry<R>[] } {
  const groups = new Map<string, R[]>();

  for (const row of rows) {
    const key = `${row.question.member_id} ${sameness(row.question.text)}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const entries: TidyEntry<R>[] = [...groups.values()].map((group) => {
    const kept = newestFirst(group).sort(
      (a, b) => b.answers - a.answers || b.claims - a.claims,
    )[0];
    // A duplicate that has not sunk keeps the entry live, even when the copy
    // kept for its answer is older.
    const live = group.find((row) => row.status === "open" || row.status === "claimed");
    const status = kept.status === "sunk" && live ? live.status : kept.status;
    return { ...kept, status, times: group.length };
  });

  const recent = new Set(recentSessions);

  const folds = (entry: TidyEntry<R>): boolean => {
    if (entry.answers > 0) return false;
    if (entry.status === "sunk" || entry.status === "closed") return true;
    if (entry.question.lane === "chat") return !entry.question.session || !recent.has(entry.question.session);
    return false;
  };

  return {
    shown: newestFirst(entries.filter((entry) => !folds(entry))),
    folded: newestFirst(entries.filter(folds)),
  };
}
