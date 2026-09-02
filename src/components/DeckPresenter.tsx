"use client";

import { useEffect, useRef, useState } from "react";
import type { Copy } from "@/lib/content";
import { MAX_SLIDES } from "@/lib/deck";
import { expandToPages } from "./deck-pages";
import { KeepAwake } from "./KeepAwake";

type DeckCopy = Copy["deck"];

type Props = {
  code: string;
  presenterKey: string;
  copy: DeckCopy;
  /** The viewer's address, rendered as a QR on the server. */
  joinUrl: string;
  qrDataUrl: string;
  initialSlideCount: number;
  initialRev: number;
  /** The page the room is on. Not always zero — see `index` below. */
  initialIndex: number;
};

export function DeckPresenter({
  code,
  presenterKey,
  copy,
  joinUrl,
  qrDataUrl,
  initialSlideCount,
  initialRev,
  initialIndex,
}: Props) {
  const [slideCount, setSlideCount] = useState(initialSlideCount);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  /**
   * The page the presenter is on, seeded from the room rather than from zero.
   *
   * ⚠️ Starting at zero is wrong in the case that actually happens: the phone
   * sleeps or the browser reloads the presenter link halfway through a talk.
   * The room is on page seven, this component thinks it is on page one, and
   * the next tap sends everybody back to page two.
   */
  const [index, setIndex] = useState(initialIndex);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [viewers, setViewers] = useState(0);
  // The deck's cache generation, as the server knows it. Slide paths repeat
  // (`/slide/0` is always page one) and are served `immutable`, so a rebuilt
  // deck needs a new URL or every browser keeps the old pictures.
  const [rev, setRev] = useState(initialRev);

  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Uploads whatever was chosen, one page at a time and in filename order.
   *
   * Sequential rather than parallel for two reasons: the server appends, so
   * the order pages arrive in is the order the deck ends up in, and on a
   * congested mobile connection six concurrent uploads finish later than six
   * consecutive ones while making the progress count meaningless.
   */
  async function upload(files: File[]) {
    setError(null);
    // A PDF has to be opened before its page count is known, and on a phone
    // that is a visible pause. Say so rather than showing a button that has
    // gone quiet.
    setProgress({ done: 0, total: 0 });

    let pages;
    try {
      pages = await expandToPages(files);
    } catch {
      setError(copy.badFile);
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setProgress({ done: 0, total: pages.length });

    let count = slideCount;

    for (const [position, page] of pages.entries()) {
      if (count >= MAX_SLIDES) {
        setError(copy.tooMany.replace("{n}", String(MAX_SLIDES)));
        break;
      }

      try {
        const body = new FormData();
        body.append("key", presenterKey);
        body.append("slide", await page(), "slide.jpg");

        const response = await fetch(`/api/deck/${code}/slides`, { method: "POST", body });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setError(
            payload.error === "too_large"
              ? copy.tooLarge
              : payload.error === "bad_type"
                ? copy.badType
                : payload.error === "too_many_slides"
                  ? copy.tooMany.replace("{n}", String(MAX_SLIDES))
                  : copy.failed,
          );
          break;
        }

        const result = await response.json();
        count = result.slideCount;
        setSlideCount(count);
      } catch {
        setError(copy.failed);
        break;
      }

      setProgress({ done: position + 1, total: pages.length });
    }

    setProgress(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function clearAll() {
    if (!window.confirm(copy.clearConfirm)) return;

    const response = await fetch(`/api/deck/${code}/slides`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: presenterKey }),
    });

    const result = await response.json().catch(() => ({}));

    setSlideCount(0);
    setIndex(0);
    setPreviewIdx(0);
    if (typeof result.rev === "number") setRev(result.rev);
  }

  /** Tells the room which page to be on. Unconditional — `goTo` is the one
   *  that skips no-ops. */
  async function push(target: number) {
    await fetch(`/api/deck/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: presenterKey, index: target }),
    }).catch(() => {
      // The room is a page behind until the next turn lands. Better than
      // stalling the presenter's screen mid-sentence.
    });
  }

  /** Turns the page. Local state moves first so the presenter's own screen
   *  never waits on the network. */
  async function goTo(next: number) {
    const target = Math.min(Math.max(next, 0), slideCount - 1);
    if (target === index) return;

    setIndex(target);
    await push(target);
  }

  // How many phones are following. Read while presenting *and* while setting
  // up, because the useful moment for this number is just before starting.
  useEffect(() => {
    const read = async () => {
      try {
        const response = await fetch(`/api/deck/${code}`, { cache: "no-store" });
        if (response.ok) setViewers((await response.json()).viewers ?? 0);
      } catch {
        // Leave the last known count on screen.
      }
    };

    void read();
    const timer = setInterval(read, 5_000);
    return () => clearInterval(timer);
  }, [code]);

  useEffect(() => {
    if (!presenting) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") void goTo(index + 1);
      if (event.key === "ArrowLeft") void goTo(index - 1);
      if (event.key === "Escape") setPresenting(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const touch = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    touch.current =
      event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;

    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;

    void goTo(dx < 0 ? index + 1 : index - 1);
  };

  const slideUrl = (idx: number) => `/api/deck/${code}/slide/${idx}?v=${rev}`;
  const viewerLine = viewers > 0 ? copy.viewers.replace("{n}", String(viewers)) : copy.viewersNone;

  if (presenting) {
    return (
      <div className="deck" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <KeepAwake />

        <div className="deck__stage">
          <div className="deck__frame">
            {/* eslint-disable-next-line @next/next/no-img-element -- see DeckViewer */}
            <img className="deck__slide" src={slideUrl(index)} alt="" draggable={false} />
          </div>

          <button
            className="deck__zone deck__zone--prev"
            onClick={() => void goTo(index - 1)}
            aria-label={copy.prev}
          />
          <button
            className="deck__zone deck__zone--next"
            onClick={() => void goTo(index + 1)}
            aria-label={copy.next}
          />
        </div>

        <div className="deck__bar">
          <button className="deck__btn" onClick={() => setPresenting(false)}>
            {copy.exit}
          </button>
          <span className="deck__count">
            {copy.page.replace("{n}", String(index + 1)).replace("{total}", String(slideCount))}
          </span>
          <span className="deck__count">{viewerLine}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-8">
      <div className="card stack-4">
        <div className="deck-build__join">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL
              built on the server; there is nothing for the optimiser to fetch. */}
          <img className="deck-build__qr" src={qrDataUrl} alt={copy.scanHint} />

          <div className="stack-2">
            <p className="label">{copy.codeLabel}</p>
            <p className="deck__code-big">{code}</p>
            <p className="body-sm">
              {copy.orOpen} <span className="mono hl">{joinUrl}</span>
            </p>
            <p className="body-sm">{viewerLine}</p>
          </div>
        </div>
      </div>

      <div className="stack-4">
        <input
          ref={fileInput}
          className="deck-build__file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void upload(files);
          }}
        />

        <div className="deck-build__join">
          <button
            className="btn btn--primary"
            onClick={() => fileInput.current?.click()}
            disabled={progress !== null}
          >
            {!progress
              ? copy.add
              : progress.total === 0
                ? copy.reading
                : copy.adding
                    .replace("{done}", String(progress.done))
                    .replace("{total}", String(progress.total))}
          </button>

          {slideCount > 0 && (
            <>
              <span className="deck__count">
                {copy.slideCount.replace("{n}", String(slideCount))}
              </span>
              <button className="btn btn--secondary" onClick={() => void clearAll()}>
                {copy.clear}
              </button>
            </>
          )}
        </div>

        <p className="field-hint">{copy.addHint}</p>
        {error && <p className="field-hint hl">{error}</p>}
      </div>

      {slideCount === 0 ? (
        <p className="body-sm">{copy.empty}</p>
      ) : (
        <>
          <div className="deck-build__strip">
            {Array.from({ length: slideCount }, (_, idx) => (
              <button
                key={idx}
                className={
                  idx === previewIdx ? "deck-build__thumb deck-build__thumb--on" : "deck-build__thumb"
                }
                onClick={() => setPreviewIdx(idx)}
                aria-label={copy.page
                  .replace("{n}", String(idx + 1))
                  .replace("{total}", String(slideCount))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see DeckViewer */}
                <img src={slideUrl(idx)} alt="" />
              </button>
            ))}
          </div>

          <div className="stack-4">
            <p className="label">{copy.preview}</p>

            <div className="deck-build__join">
              <div className="deck-build__preview">
                {/* eslint-disable-next-line @next/next/no-img-element -- see DeckViewer */}
                <img src={slideUrl(Math.min(previewIdx, slideCount - 1))} alt="" />
              </div>

              <p className="body-sm" style={{ maxWidth: "22rem" }}>
                {copy.previewHint}
              </p>
            </div>
          </div>

          <div className="stack-3">
            <button
              className="btn btn--primary"
              onClick={() => {
                setPresenting(true);
                // Push the current page even though it may not have changed, so
                // that anyone who scanned in early is looking at the same slide
                // the presenter is about to talk about.
                void push(index);
              }}
            >
              {copy.start}
            </button>
            <p className="field-hint">{copy.keepAwakeNote}</p>
          </div>
        </>
      )}
    </div>
  );
}
