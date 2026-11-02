"use client";

import { useState } from "react";
import { Turnstile } from "@/components/Turnstile";

type Props = { siteKey: string | null; label: string };

/**
 * The human check and the submit button for /quick (2026-11-02).
 *
 * The quick form books a seat with two fields, so it needs Turnstile where the
 * full form has it. The widget shows only when Cloudflare wants a click
 * (`interaction-only`); the button waits for the token, with a line saying
 * so, rather than letting a submit through that the server would turn away.
 * With no site key configured (local dev) the button is plain.
 */
export function QuickBotCheck({ siteKey, label }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const waiting = Boolean(siteKey) && !token;
  return (
    <>
      {siteKey && <Turnstile siteKey={siteKey} lang="zh" onToken={setToken} />}
      <input type="hidden" name="turnstileToken" value={token ?? ""} />
      <button className="btn btn--primary btn--block" type="submit" disabled={waiting} style={{ fontSize: "1.1rem" }}>
        {waiting ? "正在确认你不是机器人…" : label}
      </button>
    </>
  );
}
