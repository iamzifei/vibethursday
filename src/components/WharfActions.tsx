"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Round } from "@/lib/coach";
import type { Copy } from "@/lib/content";

type WharfCopy = Copy["wharf"];

/**
 * The controls on a question: coming, answering, closing.
 *
 * Client components rather than plain forms because the route answers in JSON
 * and a no-script form would need it to answer in redirects — which would mean
 * the API and the page knowing about each other's URLs. The rest of the board
 * is server-rendered; only the buttons are here.
 *
 * Nobody who is not signed in sees any of this. The page does not render it.
 */

/** Longest edge, and the quality. A screenshot of a dashboard survives this. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Shrinks a picture in the browser before it is ever uploaded.
 *
 * The same reasoning as the avatar's: the server cap exists to catch requests
 * that did not come from here, and this is what makes sure a normal one never
 * approaches it. A phone screenshot is routinely three megabytes and carries
 * nothing at that size that this page can show.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );

  if (!blob) throw new Error("toBlob failed");
  return blob;
}

async function post(body: FormData): Promise<string | null> {
  const response = await fetch("/api/wharf", { method: "POST", body });
  if (response.ok) return null;

  const payload = await response.json().catch(() => ({}));
  return typeof payload.error === "string" ? payload.error : "server_error";
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: FormData, after?: () => void) {
    setBusy(true);
    setError(null);

    const failure = await post(body);

    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }

    after?.();
    router.refresh();
  }

  return { busy, error, run };
}

/** "I'll be there for this one" — and it has to name a Thursday. */
export function ComingButton({
  questionId,
  sessions,
  copy,
}: {
  questionId: string;
  /** Upcoming Thursdays as `{ value, label }`, future ones only. */
  sessions: { value: string; label: string }[];
  copy: WharfCopy;
}) {
  const { busy, error, run } = useAction();
  const [session, setSession] = useState(sessions[0]?.value ?? "");

  if (sessions.length === 0) return null;

  return (
    <div className="qa">
      <select
        className="field qa__session"
        value={session}
        onChange={(event) => setSession(event.target.value)}
        aria-label={copy.comingSession}
      >
        {sessions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={busy}
        onClick={() => {
          const body = new FormData();
          body.set("action", "coming");
          body.set("question", questionId);
          body.set("session", session);
          void run(body);
        }}
      >
        {busy ? copy.working : copy.comingCta}
      </button>

      {error && <span className="qa__error">{copy.failed}</span>}
    </div>
  );
}

/** Answering on the page, optionally with one picture. */
export function AnswerForm({ questionId, copy }: { questionId: string; copy: WharfCopy }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (!open) {
    return (
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(true)}>
        {copy.answerCta}
      </button>
    );
  }

  return (
    <div className="qa qa--form">
      <textarea
        className="field"
        rows={4}
        value={body}
        placeholder={copy.answerPlaceholder}
        onChange={(event) => setBody(event.target.value)}
        aria-label={copy.answerCta}
      />

      <div className="qa__row">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="qa__file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => input.current?.click()}
        >
          {file ? copy.imageChosen : copy.imageCta}
        </button>

        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy || body.trim().length === 0}
          onClick={async () => {
            const form = new FormData();
            form.set("action", "answer");
            form.set("question", questionId);
            form.set("body", body);

            if (file) {
              try {
                form.set("image", new File([await shrink(file)], "answer.jpg", { type: "image/jpeg" }));
              } catch (failure) {
                console.error("[wharf] could not shrink the picture", failure);
              }
            }

            void run(form, () => {
              setBody("");
              setFile(null);
              setOpen(false);
            });
          }}
        >
          {busy ? copy.working : copy.answerSubmit}
        </button>
      </div>

      {/* ⚠️ The line that matters more than anything else about this feature.
          A screenshot of "my dashboard" routinely carries revenue, customer
          names, other tabs and sometimes a key, and this page is public. */}
      <p className="qa__warn">{copy.imageWarning}</p>

      {error && <span className="qa__error">{copy.failed}</span>}
    </div>
  );
}

/** Only the asker sees this. Closing is the question's terminal state. */
export function CloseForm({
  questionId,
  replies,
  copy,
}: {
  questionId: string;
  /** Who could be thanked: everyone who came or answered. */
  replies: { id: string; name: string }[];
  copy: WharfCopy;
}) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [thanked, setThanked] = useState(replies[0]?.id ?? "");

  if (!open) {
    return (
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(true)}>
        {copy.closeCta}
      </button>
    );
  }

  return (
    <div className="qa qa--form">
      <input
        className="field"
        value={outcome}
        placeholder={copy.outcomePlaceholder}
        onChange={(event) => setOutcome(event.target.value)}
        aria-label={copy.outcomeLabel}
      />

      <div className="qa__row">
        {replies.length > 0 && (
          <select
            className="field qa__session"
            value={thanked}
            onChange={(event) => setThanked(event.target.value)}
            aria-label={copy.thankLabel}
          >
            <option value="">{copy.thankNobody}</option>
            {replies.map((reply) => (
              <option key={reply.id} value={reply.id}>
                {reply.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy}
          onClick={() => {
            const form = new FormData();
            form.set("action", "close");
            form.set("question", questionId);
            if (outcome.trim()) form.set("outcome", outcome);
            if (thanked) form.set("thanked", thanked);
            void run(form, () => setOpen(false));
          }}
        >
          {busy ? copy.working : copy.closeSubmit}
        </button>
      </div>

      {error && <span className="qa__error">{copy.failed}</span>}
    </div>
  );
}

/**
 * Rewriting your own question, while it is still only yours to rewrite.
 *
 * Shown to the author, and only while nothing is attached — the page decides
 * that with `canEdit`, and the server checks it again in the UPDATE's WHERE,
 * because a check the client makes is a check a crafted request skips.
 *
 * This is the other half of the "还没问清楚" lane. Telling somebody their
 * question does not say enough, and then giving them no way to add it, is worse
 * than saying nothing: it is a complaint with no door out of it.
 */
export function EditForm({
  questionId,
  text: current,
  copy,
}: {
  questionId: string;
  /** What it says now, so the box opens on their own words rather than empty. */
  text: string;
  copy: WharfCopy;
}) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);

  if (!open) {
    return (
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(true)}>
        {copy.editCta}
      </button>
    );
  }

  return (
    <div className="qa qa--form">
      <textarea
        className="field"
        rows={2}
        value={draft}
        placeholder={copy.editPlaceholder}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={copy.editCta}
      />

      <div className="qa__row">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy || draft.trim().length === 0 || draft.trim() === current.trim()}
          onClick={() => {
            const form = new FormData();
            form.set("action", "edit");
            form.set("question", questionId);
            form.set("text", draft);
            void run(form, () => setOpen(false));
          }}
        >
          {busy ? copy.working : copy.editSubmit}
        </button>
      </div>

      {error && (
        <span className="qa__error">
          {error === "duplicate" ? copy.editDuplicate : copy.failed}
        </span>
      )}
    </div>
  );
}

/**
 * Asking directly, rather than waiting for the next sign-up form.
 *
 * One unfinished question each, enforced on the server. That rule is doing the
 * work a rate limit would do badly: it makes a question cost its author
 * something, and it does not punish somebody who closes what they asked.
 */
export function AskBox({
  sessions,
  atLimit,
  coach,
  copy,
}: {
  sessions: { value: string; label: string }[];
  atLimit: boolean;
  /** Whether this deployment has a key for the follow-up question. */
  coach: boolean;
  copy: WharfCopy;
}) {
  const { busy, error, run } = useAction();
  const [text, setText] = useState("");
  const [session, setSession] = useState("");

  // Three states, not two: no hint yet, a hint, or "this one is fine as it is".
  // The third has to be distinguishable, otherwise pressing the button on an
  // already-good question looks like the button is broken.
  /**
   * The rounds so far, oldest first.
   *
   * ★ This is what makes it feel like sharpening rather than a slot machine.
   * Before, each press replaced the last answer, so the screen never showed
   * that anything had moved — and neither did the model, which saw every press
   * as its first sight of the sentence. Keeping the rounds fixes both halves:
   * the person sees their own sentence getting sharper, and the rounds go back
   * with the next request so the follow-up builds on the last one.
   *
   * Client-side only. A half-written question is not something this site should
   * store, so closing the tab forgets it — which is the right amount of memory
   * for something nobody has decided to publish.
   */
  const [rounds, setRounds] = useState<Round[]>([]);
  const [verdict, setVerdict] = useState<"none" | "social" | "spent" | null>(null);
  const [thinking, setThinking] = useState(false);

  function clearAdvice() {
    setRounds([]);
    setVerdict(null);
  }

  async function askTheCoach() {
    setThinking(true);
    setVerdict(null);

    const body = new FormData();
    body.set("text", text);
    body.set("history", JSON.stringify(rounds));

    try {
      const response = await fetch("/api/wharf/coach", { method: "POST", body });

      if (response.status === 429) {
        // Either this person's own hourly allowance or the whole site's daily
        // one. The difference does not change what they should do next.
        setVerdict("spent");
      } else {
        const payload = await response.json();

        // ★ Three outcomes, not two. "Nothing to ask" splits into "this is
        //   already answerable" and "this is not a question at all", and only
        //   the first of those is praise.
        if (typeof payload.hint === "string") {
          setRounds((previous) => [
            ...previous,
            { draft: text, gap: payload.gap ?? "object", ask: payload.hint },
          ]);
        } else if (payload.gap === "social") {
          setVerdict("social");
        } else {
          setVerdict("none");
        }
      }
    } catch (failure) {
      // ★ Nothing happens, and posting is unaffected. This button is help,
      //   never a gate — see the note at the top of src/lib/coach.ts.
      console.error("[wharf] the coach did not answer", failure);
      setVerdict("spent");
    }

    setThinking(false);
  }

  if (atLimit) {
    return <p className="wharf-empty">{copy.oneAtATime}</p>;
  }

  return (
    <div className="qa qa--form">
      <textarea
        className="field"
        rows={2}
        value={text}
        placeholder={copy.askPlaceholder}
        onChange={(event) => setText(event.target.value)}
        aria-label={copy.askCta}
      />

      {/* The rounds, oldest first. Each one shows what they wrote and what
          came back, because the point being made is that the sentence is
          moving — and a single line that keeps getting replaced makes exactly
          the opposite point. The answer is a question, deliberately: there is
          nothing here to accept or reject, only something to read and then
          write one more sentence about. */}
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
        /* Something has to move while it waits. The button going quiet reads
           as a button that did not work — and this call routinely takes two or
           three seconds, which is a long time to wonder. */
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

      <div className="qa__row">
        <select
          className="field qa__session"
          value={session}
          onChange={(event) => setSession(event.target.value)}
          aria-label={copy.askSession}
        >
          <option value="">{copy.askNoSession}</option>
          {sessions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {coach && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={thinking || text.trim().length === 0}
            onClick={() => void askTheCoach()}
          >
            {rounds.length > 0 ? copy.coachAgain : copy.coachCta}
          </button>
        )}

        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy || text.trim().length === 0}
          onClick={() => {
            const form = new FormData();
            form.set("action", "ask");
            form.set("text", text);
            if (session) form.set("session", session);
            void run(form, () => {
              setText("");
              clearAdvice();
            });
          }}
        >
          {busy ? copy.working : copy.askCta}
        </button>
      </div>

      {/* ⚠️ The draft leaves this server when — and only when — the button
          above is pressed. Nothing else on this site sends anything anywhere,
          so this line is the whole disclosure and it has to stay visible. */}
      {coach && <p className="qa__note">{copy.coachNote}</p>}

      {error && (
        <span className="qa__error">{error === "one_at_a_time" ? copy.oneAtATime : copy.failed}</span>
      )}
    </div>
  );
}
