// Relative, not "@/": the tests load this through Node's type stripper.
import type { GoPhase } from "./go.ts";

/**
 * This week's Q&A questions.
 *
 * The questions are voted on in the WeChat group before each session, and only
 * the top two are talked through. On the morning people want to see, on their
 * phone, which two those are and what else was on the list. The organiser
 * pastes the list into /admin; /go shows it. Nothing here is the vote itself —
 * that stays in the group.
 */

export type SessionQuestion = { text: string; chosen: boolean };

/** More than this is not a shortlist. */
export const MAX_QUESTIONS = 8;

/** Long enough for a real question, short enough to read on a phone. */
const MAX_LENGTH = 200;

/**
 * The organiser's textarea, as a list.
 *
 * One question per line. A leading "*" marks one the group chose. List
 * numbering typed or pasted from the group message ("1.", "2、", "③", "4)") is
 * dropped, as are blank lines and lines that are only a marker.
 */
export function parseQuestionList(raw: string): SessionQuestion[] {
  const list: SessionQuestion[] = [];

  for (const line of raw.split(/\r?\n/)) {
    let text = line.trim();
    const chosen = text.startsWith("*") || text.startsWith("＊");
    if (chosen) text = text.slice(1).trim();

    text = text
      .replace(/^[①-⑳]\s*/, "")
      .replace(/^\d+\s*[.、．)）:：]\s*/, "")
      .trim()
      .slice(0, MAX_LENGTH);

    if (text) list.push({ text, chosen });
    if (list.length === MAX_QUESTIONS) break;
  }

  return list;
}

/** The list back as the organiser typed it, for the textarea. */
export function formatQuestionList(list: readonly SessionQuestion[]): string {
  return list.map((question) => `${question.chosen ? "* " : ""}${question.text}`).join("\n");
}

/**
 * What /go shows of the list.
 *
 * - before the day: every candidate, and a pointer to the vote in the group
 * - on the morning, and until the check-in link closes at one: today's two first
 * - afterwards: nothing — by then what people want is the write-up in the group
 */
export function questionsMode(phase: GoPhase, checkinOpen: boolean): "candidates" | "today" | "hidden" {
  if (phase === "before") return "candidates";
  if (phase === "day" || checkinOpen) return "today";
  return "hidden";
}
