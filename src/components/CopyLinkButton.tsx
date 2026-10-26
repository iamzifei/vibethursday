"use client";

import { useState } from "react";

type Props = {
  /** The absolute URL to copy. */
  url: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
};

/**
 * Shows a link and copies it with one tap (2026-10-27), for /login on a phone
 * outside WeChat: the person pastes it into WeChat and opens it there, where
 * the service account's login works.
 */
export function CopyLinkButton({ url, label, copiedLabel, failedLabel }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      // Clipboard refused (older browsers, no user gesture): fall back to a long-press.
      setState("failed");
    }
  };

  return (
    <div className="stack-3">
      <p className="body" style={{ margin: 0, wordBreak: "break-all", userSelect: "all" }}>
        {url}
      </p>
      <div>
        <button className="btn btn--wechat" type="button" onClick={copy}>
          {label}
        </button>
      </div>
      {state !== "idle" && (
        <p className="body-sm" role="status" style={{ margin: 0, color: state === "copied" ? "var(--fg2)" : "var(--warning)" }}>
          {state === "copied" ? copiedLabel : failedLabel}
        </p>
      )}
    </div>
  );
}
