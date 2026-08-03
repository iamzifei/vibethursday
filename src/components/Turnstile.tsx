"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      theme?: "auto" | "light" | "dark";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback";

/**
 * Resolves once the Turnstile API exists on window.
 *
 * Module-scoped and created once, which is the whole point: the script's
 * `onload` fires exactly once, so an effect that registers a callback and is
 * then torn down (React StrictMode runs effects twice in development, and any
 * remount does the same) can consume that single firing with a stale closure
 * and leave the widget permanently unrendered. A promise keeps its resolved
 * value, so every later caller is served immediately whether it arrives before
 * or after the script finished loading.
 */
let turnstileReady: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  turnstileReady ??= new Promise<TurnstileApi>((resolve, reject) => {
    const settle = () => {
      if (window.turnstile) resolve(window.turnstile);
    };

    window.onloadTurnstileCallback = settle;

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      // A previous mount already started the download. Listen for its load in
      // case the onload hook has been reassigned, and re-check right away in
      // case it has already finished.
      existing.addEventListener("load", settle);
      settle();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", settle);
    script.addEventListener("error", () => {
      // Let a later mount retry instead of caching the failure forever.
      turnstileReady = null;
      script.remove();
      reject(new Error("Turnstile script failed to load"));
    });

    document.head.appendChild(script);
  });

  return turnstileReady;
}

type Props = {
  siteKey: string;
  lang: "zh" | "en";
  /** Receives the token, or null when it expires or errors and must be re-solved. */
  onToken: (token: string | null) => void;
};

/**
 * Renders the Turnstile widget explicitly rather than through the automatic
 * `cf-turnstile` class scan — React owns this DOM node, and the implicit mode
 * races with React's own rendering.
 */
export function Turnstile({ siteKey, lang, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Held in a ref so a new function identity from the parent never tears the
  // widget down and re-renders it.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current || widgetIdRef.current) return;

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: lang === "zh" ? "zh-cn" : "en",
          theme: "dark",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch((error) => {
        console.error("[turnstile]", error);
        onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, lang]);

  return <div ref={containerRef} />;
}
