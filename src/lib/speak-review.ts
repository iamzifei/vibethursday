/**
 * The AI read of a speaker's brief on /speak (2026-11-19).
 *
 * Same provider and the same one-POST shape as the ask-box helper in coach.ts.
 * What differs is the job: a fixed five-line rubric (see `REVIEW_SYSTEM` in
 * speak.ts) returning JSON, two possible verdicts, and a one-line fix per line.
 *
 * ★ **Advice, never a gate.** Every failure below returns null and the page
 * says "try again later"; nothing on the site waits on this answer, and the
 * organiser decides who speaks whatever it says.
 *
 * ⚠️ What a speaker writes leaves the server here, to the model provider. The
 * page says so next to the button, the same disclosure the ask box carries.
 */

import { buildReviewInput, readReview, REVIEW_SYSTEM, type Brief, type Review } from "./speak.ts";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

/** A longer input than the ask box, so a longer wait; still well under a page timeout. */
const TIMEOUT_MS = 30_000;

/** Five short lines of JSON. The cap keeps a runaway answer from costing more. */
const MAX_TOKENS = 700;

/** Whether this deployment has a key at all. Without one the page says the read is unavailable. */
export function reviewAvailable(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export type ReviewResult = {
  review: Review | null;
  /** For the server log: how long it took and what it used, never the text. */
  ms: number;
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export async function reviewBrief(input: {
  theme: string | null;
  brief: Brief;
  slideText: readonly string[];
}): Promise<ReviewResult> {
  const started = Date.now();
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { review: null, ms: 0, usage: null };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        // The same brief should get the same read; see the note in coach.ts.
        temperature: 0,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: REVIEW_SYSTEM },
          { role: "user", content: buildReviewInput(input) },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[speak] upstream said", response.status);
      return { review: null, ms: Date.now() - started, usage: null };
    }

    const payload = await response.json();
    const raw: unknown = payload?.choices?.[0]?.message?.content;
    const usage = payload?.usage ?? null;
    const review = typeof raw === "string" ? readReview(raw) : null;
    if (!review) console.error("[speak] the model's answer did not fit the rubric");

    return { review, ms: Date.now() - started, usage };
  } catch (error) {
    console.error("[speak] could not reach the model", error);
    return { review: null, ms: Date.now() - started, usage: null };
  }
}
