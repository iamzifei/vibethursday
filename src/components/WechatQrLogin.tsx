"use client";

import { useEffect, useRef, useState } from "react";
import type { Copy } from "@/lib/content";

type Props = {
  copy: Copy["login"];
  /** Where to go once logged in: a same-site path, already checked by the page. */
  next: string;
};

type State =
  | { kind: "loading" }
  | { kind: "showing"; token: string; image: string; pin: string; expiresAt: number }
  | { kind: "expired" }
  | { kind: "done" }
  | { kind: "error" };

/** One new code from the server, as the state to show. Never throws. */
async function loadCode(): Promise<State> {
  try {
    const response = await fetch("/api/wechat/qr", { method: "POST" });
    if (!response.ok) return { kind: "error" };
    const body = (await response.json()) as { token: string; image: string; pin: string; expiresIn: number };
    // Only ever a PNG data URL from our own server; anything else is an error.
    if (typeof body.image !== "string" || !body.image.startsWith("data:image/png;base64,")) return { kind: "error" };
    if (!/^\d{2}$/.test(String(body.pin))) return { kind: "error" };
    return { kind: "showing", token: body.token, image: body.image, pin: String(body.pin), expiresAt: Date.now() + body.expiresIn * 1000 };
  } catch {
    return { kind: "error" };
  }
}

/** How often the computer asks whether the phone has confirmed. */
const POLL_MS = 2_000;

/**
 * The computer half of "scan to log in" (`/api/wechat/qr`): shows a code,
 * asks every two seconds whether a phone has confirmed it, and on success
 * goes on to `next` — by then the server has set the ordinary remember cookie,
 * so the page that loads already knows who this is.
 *
 * Stops asking when the code expires or the tab is closed; a new code is one
 * tap. The image is a PNG data URL from our own server, shown in a plain
 * <img> — no markup is ever put into the page.
 */
export function WechatQrLogin({ copy, next }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bumped by "get a new code"; each value fetches one code.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void loadCode().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.kind !== "showing") return;
    let stopped = false;

    const ask = async () => {
      if (stopped) return;
      if (Date.now() > state.expiresAt) {
        setState({ kind: "expired" });
        return;
      }
      try {
        const response = await fetch(`/api/wechat/qr?t=${state.token}`, { cache: "no-store" });
        const body = (await response.json()) as { status: string };
        if (body.status === "done") {
          setState({ kind: "done" });
          window.location.assign(next);
          return;
        }
        // "rejected": the phone picked the wrong number, and the code is spent.
        if (body.status === "expired" || body.status === "used" || body.status === "missing" || body.status === "rejected") {
          setState({ kind: "expired" });
          return;
        }
      } catch {
        // A dropped request: just ask again next time.
      }
      if (!stopped) timer.current = setTimeout(ask, POLL_MS);
    };

    timer.current = setTimeout(ask, POLL_MS);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, next]);

  return (
    <div className="card stack-4" style={{ alignItems: "center", textAlign: "center", maxWidth: "360px" }}>
      {state.kind === "showing" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL; next/image adds nothing here */}
          <img
            src={state.image}
            alt={copy.qrWaiting}
            width={220}
            height={220}
            style={{ background: "#ffffff", padding: "8px", borderRadius: "8px" }}
          />
          <p className="body" style={{ margin: 0 }}>{copy.qrWaiting}</p>
          {/* The number the phone has to pick: proof the person confirming can
              see this screen, not just a link someone sent them. */}
          <p className="mono" style={{ margin: 0, fontSize: "2.5rem", fontWeight: 700, letterSpacing: "0.1em" }} aria-live="polite">
            {state.pin}
          </p>
        </>
      )}
      {state.kind === "loading" && <p className="body" style={{ margin: 0 }}>…</p>}
      {state.kind === "done" && <p className="body" style={{ margin: 0 }} role="status">{copy.qrDone}</p>}
      {state.kind === "error" && <p className="body" style={{ margin: 0 }} role="alert">{copy.qrError}</p>}
      {state.kind === "expired" && (
        <>
          <p className="body" style={{ margin: 0 }}>{copy.qrExpired}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {copy.qrRefresh}
          </button>
        </>
      )}
    </div>
  );
}
