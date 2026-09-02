"use client";

import { useEffect, useRef, useState } from "react";
import type { Copy } from "@/lib/content";
import { KeepAwake } from "./KeepAwake";

type DeckCopy = Copy["deck"];

type Props = {
  code: string;
  copy: DeckCopy;
  initialIndex: number;
  initialSlideCount: number;
  initialRev: number;
};

/**
 * The audience's screen.
 *
 * Follows the presenter by default and lets anyone drop out of that to look
 * back at a page they missed — which is the whole reason a viewer has controls
 * at all. Reading *ahead* is not possible: `next` stops at the presenter's
 * page. That is not a technical limit, it is the point of a shared screen.
 */
export function DeckViewer({ code, copy, initialIndex, initialSlideCount, initialRev }: Props) {
  const [room, setRoom] = useState({
    index: initialIndex,
    slideCount: initialSlideCount,
    rev: initialRev,
  });
  const [turned, setTurned] = useState(false);

  /**
   * The page this viewer has chosen to sit on, or `null` for "whatever the
   * room is showing".
   *
   * Following is therefore the *absence* of a choice rather than a second
   * piece of state kept in step with the first. The version of this that
   * stored a page number and a boolean had to copy the room's page into the
   * local one every time either changed, which is a synchronisation problem
   * with no upside — and one whose failure mode is a phone quietly showing
   * the wrong slide.
   */
  const [pinned, setPinned] = useState<number | null>(null);

  const lastPage = Math.max(0, room.slideCount - 1);
  // Clamped because a deck can shrink underneath a pinned viewer: the
  // presenter clearing and re-uploading is a normal thing to do.
  const viewIndex = Math.min(pinned ?? room.index, lastPage);
  const following = pinned === null;

  // The revision is part of the URL so that a deck the presenter threw away and
  // rebuilt is refetched rather than read from the `immutable` cache — see the
  // `rev` column in `db.ts`.
  const slideUrl = (idx: number) => `/api/deck/${code}/slide/${idx}?v=${room.rev}`;

  /**
   * Stay in step with the room.
   *
   * The event-stream is the fast path and the poll is the floor. Both are
   * running, always: on a table of phones with no wifi, a stream that has
   * silently stopped delivering looks identical to a presenter who has not
   * turned the page in a while, and there is no moment at which it would be
   * safe to notice. Ten seconds of duplicated work per phone is a much smaller
   * cost than one person watching the wrong slide for the rest of a talk.
   */
  useEffect(() => {
    const source = new EventSource(`/api/deck/${code}/stream`);

    source.onmessage = (event) => {
      try {
        setRoom(JSON.parse(event.data));
      } catch {
        // A truncated frame. The next one, or the poll, corrects it.
      }
    };

    const poll = setInterval(async () => {
      try {
        const response = await fetch(`/api/deck/${code}`, { cache: "no-store" });
        if (response.ok) setRoom(await response.json());
      } catch {
        // Offline for a moment. Nothing to do but wait for the next tick.
      }
    }, 10_000);

    return () => {
      source.close();
      clearInterval(poll);
    };
  }, [code]);

  /**
   * Fetch the neighbouring pages before they are asked for.
   *
   * Only the neighbours. Pulling the whole deck would defeat the reason the
   * slides are served one at a time — on mobile data the first page has to
   * appear now, not after twenty others have downloaded.
   */
  useEffect(() => {
    for (const idx of [viewIndex + 1, viewIndex - 1]) {
      if (idx < 0 || idx >= room.slideCount) continue;
      const image = new Image();
      image.src = `/api/deck/${code}/slide/${idx}?v=${room.rev}`;
    }
  }, [code, viewIndex, room.slideCount, room.rev]);

  const back = () => {
    if (viewIndex <= 0) return;
    setPinned(viewIndex - 1);
  };

  const forward = () => {
    // The ceiling is the room's page, not the deck's length: this is a shared
    // screen, so reading ahead is not a feature that was left out.
    if (viewIndex >= room.index) return;
    const next = viewIndex + 1;
    // Catching back up re-joins the room, so nobody has to notice the follow
    // button in order to stop being behind.
    setPinned(next >= room.index ? null : next);
  };

  const rejoin = () => setPinned(null);

  // Swipe, guarded to one finger so it never fights a pinch-zoom.
  const touch = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) {
      touch.current = null;
      return;
    }
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;

    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;

    // Mostly horizontal, and far enough to be a swipe rather than a tap that
    // moved. When the frame is turned, the slide is sideways but the phone is
    // not, so the gesture stays in screen space on purpose.
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;

    if (dx < 0) forward();
    else back();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") forward();
      if (event.key === "ArrowLeft") back();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (room.slideCount === 0) {
    return (
      <div className="deck">
        <div className="deck__notice stack-4">
          <p className="deck__code-big">{code}</p>
          <p>{copy.waiting}</p>
        </div>
      </div>
    );
  }

  const behind = !following;

  return (
    <div className="deck" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <KeepAwake />

      <div className="deck__stage">
        <div className={turned ? "deck__frame deck__frame--turned" : "deck__frame"}>
          {/* eslint-disable-next-line @next/next/no-img-element -- bytes from a
              route handler, sized by the browser; the image optimiser has
              nothing to add and would put a resize hop in front of every page
              turn. */}
          <img
            className="deck__slide"
            src={slideUrl(viewIndex)}
            alt={copy.page.replace("{n}", String(viewIndex + 1)).replace("{total}", String(room.slideCount))}
            draggable={false}
          />
        </div>

        {/* Invisible halves of the screen. They are real buttons so the page
            is operable without the gesture, which is also what puts them in
            the accessibility tree — hence labels that say what they do rather
            than borrowing whatever string was nearby. */}
        <button className="deck__zone deck__zone--prev" onClick={back} aria-label={copy.prev} />
        <button className="deck__zone deck__zone--next" onClick={forward} aria-label={copy.next} />
      </div>

      <div className="deck__bar">
        <button className="deck__btn" onClick={() => setTurned(!turned)}>
          {turned ? copy.rotateBack : copy.rotate}
        </button>

        <span className="deck__count">
          {copy.page
            .replace("{n}", String(viewIndex + 1))
            .replace("{total}", String(room.slideCount))}
        </span>

        {behind ? (
          <button className="deck__btn deck__btn--follow" onClick={rejoin}>
            {copy.follow}
          </button>
        ) : (
          <span className="deck__count">{copy.following}</span>
        )}
      </div>
    </div>
  );
}
