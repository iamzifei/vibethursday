"use client";

import { useEffect, useId, useRef, useState } from "react";

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

const PLAYER_VERSION = "2.28.4";
const PLAYER_BASE = `https://g.alicdn.com/apsara-media-box/imp-web-player/${PLAYER_VERSION}`;

type AliplayerInstance = { dispose: () => void; on: (event: string, handler: () => void) => void };
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
  messages: { coming: string; error: string };
};

export function LearnPlayer({ lesson, watermark, messages }: Props) {
  const elementId = `player-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const playerRef = useRef<AliplayerInstance | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "coming" | "error">("loading");

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
        });
        playerRef.current.on("error", () => setState("error"));
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
  }, [lesson, elementId]);

  return (
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
  );
}
