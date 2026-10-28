"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatDuration, type Chapter } from "@/lib/learn-time";

/**
 * The lesson video (2026-10-28): Alibaba Cloud's web player, given a play
 * authorisation fetched from /api/learn/play for this lesson.
 *
 * Alibaba's own player because the videos are privately encrypted, and only
 * its player can decrypt them — a downloaded copy of the stream does not play.
 * Loaded from Alibaba's CDN, which is reachable from China and from Australia.
 *
 * The viewer's name floats over the picture: it cannot stop a screen
 * recording, but it does say whose account a leaked recording came from.
 */

// Pinned below 2.28: from 2.28.0 the player refuses to play without a paid
// licence and covers the picture with a "License params are required" banner.
// 2.27.1 plays privately encrypted streams the same way.
const PLAYER_VERSION = "2.27.1";
const PLAYER_BASE = `https://g.alicdn.com/apsara-media-box/imp-web-player/${PLAYER_VERSION}`;

type AliplayerInstance = {
  dispose: () => void;
  on: (event: string, handler: () => void) => void;
  seek: (seconds: number) => void;
  play: () => void;
  getCurrentTime: () => number;
};
type AliplayerFactory = (options: Record<string, unknown>, ready?: () => void) => AliplayerInstance;

declare global {
  interface Window {
    Aliplayer?: AliplayerFactory;
  }
}

/** Loads the player script and stylesheet once per page, however many players mount. */
let loading: Promise<AliplayerFactory> | null = null;

function loadPlayer(): Promise<AliplayerFactory> {
  if (window.Aliplayer) return Promise.resolve(window.Aliplayer);
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${PLAYER_BASE}/skins/default/aliplayer-min.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `${PLAYER_BASE}/aliplayer-min.js`;
    script.async = true;
    script.onload = () => (window.Aliplayer ? resolve(window.Aliplayer) : reject(new Error("player missing")));
    script.onerror = () => {
      loading = null;
      reject(new Error("player script failed"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

type Props = {
  lesson: string;
  watermark: string;
  /** Where the video can be jumped to; shown as a list under the picture. */
  chapters?: Chapter[];
  /** Start here on the first play, from a shared `?t=` link. */
  startAt?: number | null;
  messages: { coming: string; error: string; chapters: string };
};

/** Index of the chapter playing at `seconds`, or -1 before the first one. */
function chapterAt(chapters: Chapter[], seconds: number): number {
  let index = -1;
  for (let i = 0; i < chapters.length && chapters[i].startS <= seconds; i++) index = i;
  return index;
}

export function LearnPlayer({ lesson, watermark, chapters = [], startAt = null, messages }: Props) {
  const elementId = `player-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const playerRef = useRef<AliplayerInstance | null>(null);
  // A jump asked for before the video was ready, or the shared `?t=` time.
  const pendingSeek = useRef<number | null>(startAt);
  const [state, setState] = useState<"loading" | "ready" | "coming" | "error">("loading");
  const [current, setCurrent] = useState(-1);

  /** Jumps to a time and plays from there; waits for the player if it is still loading. */
  const jumpTo = useCallback((seconds: number) => {
    const player = playerRef.current;
    if (!player) {
      pendingSeek.current = seconds;
      return;
    }
    player.seek(seconds);
    player.play();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/learn/play?lesson=${encodeURIComponent(lesson)}`, { cache: "no-store" });
        if (response.status === 404 || response.status === 503) {
          if (!cancelled) setState("coming");
          return;
        }
        if (!response.ok) throw new Error(`play ${response.status}`);
        const { videoId, playAuth } = (await response.json()) as { videoId: string; playAuth: string };
        const Aliplayer = await loadPlayer();
        if (cancelled) return;

        setState("ready");
        playerRef.current = Aliplayer({
          id: elementId,
          vid: videoId,
          playauth: playAuth,
          encryptType: 1,
          width: "100%",
          height: "auto",
          autoplay: false,
          isLive: false,
          playsinline: true,
          preload: true,
          // Ticks on the progress bar at each chapter.
          progressMarkers: chapters.map((c) => ({ offset: c.startS, isCustomized: false, text: c.title })),
        });
        const player = playerRef.current;
        player.on("error", () => setState("error"));
        // Apply a waiting jump on the first play: seeking an untouched player
        // is ignored by some mobile browsers until playback has started.
        player.on("play", () => {
          if (pendingSeek.current === null) return;
          const seconds = pendingSeek.current;
          pendingSeek.current = null;
          player.seek(seconds);
        });
        if (chapters.length > 0) {
          player.on("timeupdate", () => setCurrent(chapterAt(chapters, player.getCurrentTime())));
        }
      } catch (error) {
        console.error("[learn] player failed", error);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      playerRef.current?.dispose();
      playerRef.current = null;
    };
    // Chapters come from the server and only change with the lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, elementId]);

  return (
    <div className="stack-3">
    <div style={{ position: "relative", background: "#000", borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "16 / 9" }}>
      <div id={elementId} style={{ width: "100%", height: "100%" }} />
      {state !== "ready" && state !== "loading" && (
        <p className="body-sm" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", padding: "1rem", textAlign: "center" }}>
          {state === "coming" ? messages.coming : messages.error}
        </p>
      )}
      {state === "ready" && watermark && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "12%",
            right: "6%",
            color: "rgba(255,255,255,0.28)",
            fontSize: "0.85rem",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 10,
          }}
        >
          {watermark}
        </span>
      )}
    </div>
    {chapters.length > 0 && (
      <nav aria-label={messages.chapters}>
        <ol className="stack-1" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {chapters.map((chapter, i) => (
            <li key={chapter.startS}>
              {/* A real link, so a chapter can be copied and shared; clicking jumps in place. */}
              <a
                href={`?t=${chapter.startS}`}
                aria-current={i === current ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  jumpTo(chapter.startS);
                }}
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  color: "inherit",
                  background: i === current ? "var(--accent-subtle)" : "transparent",
                  fontWeight: i === current ? 600 : 400,
                }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "4.5em", opacity: 0.7 }}>
                  {formatDuration(chapter.startS) ?? "0:00"}
                </span>
                <span>{chapter.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    )}
    </div>
  );
}
