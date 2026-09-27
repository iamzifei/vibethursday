"use client";

import { useState } from "react";
import type { Round } from "@/lib/coach";

/**
 * "Help me ask this better", shared by the Wharf's ask box and the signup form.
 *
 * Moved here from `AskBox` on 2026-09-28 unchanged, so the signup form's "what
 * do you most want to ask" box could have it: that box is where most of the
 * vague questions are written ("想了解了解", "AI 和地产怎么相关"), and nobody
 * can pick up a sentence like that on the day.
 *
 * ★ Never rewrites and never blocks — see the note at the top of `lib/coach.ts`.
 * It returns one follow-up question; the person edits their own sentence, or
 * ignores it and carries on.
 */

/** The strings this needs. Passed in, so client components never import the copy bundle. */
export type CoachCopy = {
  coachCta: string;
  coachAgain: string;
  coachEnough: string;
  coachSharper: string;
  coachSocial: string;
  coachSpent: string;
  coachNote: string;
  working: string;
};

export type CoachVerdict = "none" | "social" | "spent" | null;

/**
 * The rounds so far and the call that adds one.
 *
 * ★ Rounds are kept, oldest first, and sent back with each request: the person
 * sees their sentence getting sharper, and the model builds on its last
 * question instead of seeing every press as its first sight of the sentence.
 * Client-side only — a half-written question is not something to store.
 */
export function useCoach() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [verdict, setVerdict] = useState<CoachVerdict>(null);
  const [thinking, setThinking] = useState(false);

  function clear() {
    setRounds([]);
    setVerdict(null);
  }

  async function ask(text: string) {
    setThinking(true);
    setVerdict(null);

    const body = new FormData();
    body.set("text", text);
    body.set("history", JSON.stringify(rounds));

    try {
      const response = await fetch("/api/wharf/coach", { method: "POST", body });

      if (!response.ok) {
        // Over an allowance (429), or the call itself failed (503). Either way
        // there is no answer — and "no answer" must never be shown as "this is
        // already specific enough".
        setVerdict("spent");
      } else {
        const payload = await response.json();

        // Three outcomes, not two: "nothing to ask" splits into "already
        // answerable" and "not a question at all", and only the first is praise.
        if (typeof payload.hint === "string") {
          setRounds((previous) => [...previous, { draft: text, gap: payload.gap ?? "object", ask: payload.hint }]);
        } else if (payload.gap === "social") {
          setVerdict("social");
        } else {
          setVerdict("none");
        }
      }
    } catch (failure) {
      // Nothing happens and submitting is unaffected: this is help, never a gate.
      console.error("[coach] did not answer", failure);
      setVerdict("spent");
    }

    setThinking(false);
  }

  return { rounds, verdict, thinking, ask, clear };
}

/** What came back: each round as "what you wrote → the question back", and the verdicts. */
export function CoachRounds({
  rounds,
  verdict,
  thinking,
  copy,
}: {
  rounds: Round[];
  verdict: CoachVerdict;
  thinking: boolean;
  copy: CoachCopy;
}) {
  return (
    <>
      {rounds.length > 0 && (
        <ol className="coach">
          {rounds.map((round, index) => (
            <li key={index} className="coach__round">
              <span className="coach__draft">{round.draft}</span>
              <span className="coach__ask">{round.ask}</span>
            </li>
          ))}
        </ol>
      )}

      {thinking && (
        /* Something has to move while it waits: the call routinely takes two or
           three seconds, and a button that goes quiet reads as one that failed. */
        <p className="coach__thinking" role="status" aria-label={copy.working}>
          <span />
          <span />
          <span />
        </p>
      )}

      {verdict === "none" && (
        <p className="qa__hint qa__hint--fine" role="status">
          {rounds.length > 0 ? copy.coachSharper : copy.coachEnough}
        </p>
      )}
      {verdict === "social" && (
        <p className="qa__hint qa__hint--fine" role="status">
          {copy.coachSocial}
        </p>
      )}
      {verdict === "spent" && (
        <p className="qa__hint qa__hint--fine" role="status">
          {copy.coachSpent}
        </p>
      )}
    </>
  );
}
