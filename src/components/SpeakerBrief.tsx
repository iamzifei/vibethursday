"use client";

import { useState, type ReactNode } from "react";
import type { Copy } from "@/lib/content";
import { BRIEF_FIELDS, MAX_BRIEF_FIELD, REVIEW_ITEMS, VERDICT_OK, type Brief, type Review } from "@/lib/speak";

type SpeakCopy = Copy["speak"];

type Props = {
  token: string;
  copy: SpeakCopy;
  initialBrief: Brief;
  initialReview: Review | null;
  /** True when the brief was edited after the last read. */
  initialStale: boolean;
  reviewsLeft: number;
  /** False when this deployment has no model key: the button is replaced by a line saying so. */
  reviewOn: boolean;
  /** The slide uploader, rendered by the page between the answers and the read. */
  slides: ReactNode;
};

type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * The four answers and the AI read, for /speak (2026-11-19).
 *
 * Nothing here blocks: saving works whatever the AI does, and every way the
 * read can fail ends in one line of text and the answers still saved.
 */
export function SpeakerBrief({ token, copy, initialBrief, initialReview, initialStale, reviewsLeft, reviewOn, slides }: Props) {
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [save, setSave] = useState<SaveState>("idle");
  const [review, setReview] = useState<Review | null>(initialReview);
  const [stale, setStale] = useState(initialStale);
  const [left, setLeft] = useState(reviewsLeft);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function send(withReview: boolean): Promise<Response | null> {
    try {
      return await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, brief, review: withReview }),
      });
    } catch {
      return null;
    }
  }

  async function onSave() {
    setSave("saving");
    const response = await send(false);
    setSave(response?.ok ? "saved" : "failed");
    if (response?.ok && review) setStale(true);
  }

  async function onReview() {
    setReviewError(null);
    if (!BRIEF_FIELDS.some((field) => brief[field].trim())) {
      setReviewError(copy.reviewEmpty);
      return;
    }

    setReviewing(true);
    const response = await send(true);
    const payload = response ? await response.json().catch(() => ({})) : {};
    setReviewing(false);

    // The brief is saved before any read is attempted, whatever comes next.
    if (payload.ok) setSave("saved");
    if (typeof payload.left === "number") setLeft(payload.left);

    if (response?.ok && payload.review) {
      setReview(payload.review);
      setStale(false);
      return;
    }

    setReviewError(
      payload.error === "used_up"
        ? copy.reviewUsedUp
        : payload.error === "spent"
          ? copy.reviewSpent
          : payload.error === "off"
            ? copy.reviewOff
            : payload.error === "empty"
              ? copy.reviewEmpty
              : payload.ok === undefined
                ? copy.saveFailed
                : copy.reviewFailed,
    );
  }

  return (
    <div className="stack-12">
      <section className="stack-6">
        <h2 className="h3" style={{ margin: 0 }}>{copy.questionsTitle}</h2>

        {BRIEF_FIELDS.map((field) => (
          <label className="stack-2" key={field}>
            <span className="label">{copy.fields[field].label}</span>
            <textarea
              className="field"
              rows={4}
              maxLength={MAX_BRIEF_FIELD}
              value={brief[field]}
              placeholder={copy.fields[field].placeholder}
              onChange={(event) => {
                const value = event.target.value;
                setBrief((current) => ({ ...current, [field]: value }));
                setSave("idle");
              }}
            />
          </label>
        ))}

        <div className="deck-build__join">
          <button className="btn btn--secondary" type="button" onClick={() => void onSave()} disabled={save === "saving"}>
            {save === "saving" ? copy.saving : copy.save}
          </button>
          {save === "saved" && <span className="body-sm" role="status">{copy.saved}</span>}
          {save === "failed" && <span className="body-sm hl" role="status">{copy.saveFailed}</span>}
        </div>
      </section>

      {slides}

      <section className="stack-4">
        <h2 className="h3" style={{ margin: 0 }}>{copy.reviewTitle}</h2>

        {!reviewOn ? (
          <p className="body-sm">{copy.reviewOff}</p>
        ) : (
          <>
            <p className="body-sm">{copy.reviewLede}</p>
            <div className="deck-build__join">
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => void onReview()}
                disabled={reviewing || left <= 0}
              >
                {reviewing ? copy.reviewing : copy.reviewButton}
              </button>
              <span className="body-sm">{left > 0 ? copy.reviewLeft.replace("{n}", String(left)) : copy.reviewUsedUp}</span>
            </div>
            <p className="field-hint">{copy.reviewDisclosure}</p>
            {reviewError && <p className="field-hint hl" role="status">{reviewError}</p>}
          </>
        )}

        {review && (
          <div className="card stack-4" aria-live="polite">
            <div className="group-head">
              <p className="label" style={{ margin: 0 }}>{copy.reviewAt}</p>
              <span className={review.verdict === VERDICT_OK ? "pill pill--live" : "pill"}>
                {review.verdict === VERDICT_OK ? copy.verdict.ok : copy.verdict.fix}
              </span>
            </div>
            {stale && <p className="field-hint">{copy.reviewStale}</p>}
            <ul className="stack-3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {REVIEW_ITEMS.map((key) => (
                <li key={key} className="stack-1">
                  <span className="body">
                    {review.items[key].ok ? "✅" : "⚠️"} {copy.items[key]}
                  </span>
                  {review.items[key].fix && <span className="body-sm">{review.items[key].fix}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
