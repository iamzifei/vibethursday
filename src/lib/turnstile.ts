/**
 * Cloudflare Turnstile server-side verification.
 *
 * Deliberately fails closed: with no secret configured, nothing verifies. The
 * alternative — quietly accepting every submission when the key goes missing —
 * looks identical to working, which is the worst of both worlds. The admin
 * page surfaces whether protection is actually on so a dropped variable is
 * visible rather than guessed at.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "missing_token" | "rejected" | "unreachable" };

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export async function verifyTurnstile(
  token: string | null,
  remoteIp: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set — refusing to accept submissions");
    return { ok: false, reason: "not_configured" };
  }

  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams({ secret, response: token });

  // Cloudflare uses this only for its own risk scoring; it is optional and the
  // header can be absent or spoofed, so it is never treated as trustworthy.
  if (remoteIp) body.set("remoteip", remoteIp);

  let payload: { success?: boolean; "error-codes"?: string[] };

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Without a timeout a stalled verification would hold the request open
      // until the platform kills it, which reads to the visitor as a hang.
      signal: AbortSignal.timeout(8_000),
    });
    payload = await response.json();
  } catch (error) {
    console.error("[turnstile] verification request failed", error);
    return { ok: false, reason: "unreachable" };
  }

  if (!payload.success) {
    console.warn("[turnstile] rejected", payload["error-codes"]);
    return { ok: false, reason: "rejected" };
  }

  return { ok: true };
}
