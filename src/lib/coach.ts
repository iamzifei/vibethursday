/**
 * One follow-up question, asked back at somebody who is still drafting theirs.
 *
 * The board has a real problem this is aimed at: roughly two thirds of what
 * arrives is too general to act on. "怎么做增长" cannot be claimed by anybody,
 * because nobody knows whether they are the right person for it. The specific
 * ones get picked up; the vague ones sink after three weeks.
 *
 * ★ **This never rewrites and never blocks.** It returns one short question and
 * nothing else, and the person edits their own sentence — or ignores it and
 * posts what they had. Two reasons, and the second is the important one:
 *
 *   1. A rewritten question is no longer in the asker's voice, and this board's
 *      whole claim is that the sentences on it are what people actually wrote.
 *      /wharf says so out loud: "问题都是本人写的，原样放在这儿，一个字没改".
 *   2. A gate that rejects a question teaches people to stop asking. The cost of
 *      a vague question is one row nobody claims. The cost of a rejected one is
 *      a person who does not come back to the form.
 *
 * So the failure mode is deliberately "nothing happens". Every error path below
 * returns null, and the button that calls this is opt-in.
 *
 * ⚠️ **This is the only third party any visitor's writing reaches.** The site
 * has no analytics, no fonts from a CDN, no embeds. A draft sent here leaves the
 * server, so the box that calls it says so in the copy — that disclosure is part
 * of the feature, not decoration around it.
 */

import { buildSystem, readCoaching, type Coaching } from "./coach-prompt.ts";

/** OpenAI-shaped, which is why there is no SDK here: one POST and one field. */
const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

/** Longer than this and the person has already gone back to typing. */
const TIMEOUT_MS = 8_000;

/**
 * Whether the feature exists at all in this deployment.
 *
 * The page calls this and hides the button when it is false, so the site runs
 * unchanged with no key set — which is what local development and any fork of
 * this repo will have.
 */
export function coachAvailable(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

// The instruction and its examples live in coach-prompt.ts, where they have
// tests and a score. See `npm run coach:eval`.

/**
 * Asks the model what is missing. Returns null when there is nothing to say —
 * and also when anything at all goes wrong.
 */
export async function coachDraft(draft: string): Promise<Coaching | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  // AbortSignal.timeout rather than a manual controller: the request is fire
  // and forget from the caller's point of view, and a hung socket here would
  // otherwise hold a Next.js request open for the platform's full timeout.
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        // ⚠️ Zero, not 0.3. The old value was justified as "let the same draft
        // surface a different gap next time", which is precisely the behaviour
        // that turned out to be the bug: one draft, asked three times, came
        // back in three different categories. Which piece is missing from a
        // sentence is a fact about the sentence, so it should not roll dice.
        temperature: 0,
        max_tokens: 120,
        // The contract is a two-field object; ask for it rather than hope.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystem() },
          { role: "user", content: `草稿：${draft}` },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[coach] upstream said", response.status);
      return null;
    }

    const payload = await response.json();
    const raw: unknown = payload?.choices?.[0]?.message?.content;

    return typeof raw === "string" ? readCoaching(raw) : null;
  } catch (error) {
    // Timeout, DNS, a malformed body — all the same outcome to the person
    // typing, which is that the button did nothing.
    console.error("[coach] could not reach the model", error);
    return null;
  }
}

/** Just the follow-up, for the route. Empty verdicts come back as null. */
export async function coachQuestion(draft: string): Promise<string | null> {
  const coaching = await coachDraft(draft);
  return coaching?.ask ? coaching.ask : null;
}
