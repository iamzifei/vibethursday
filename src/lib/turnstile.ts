/**
 * Cloudflare Turnstile server-side verification.
 *
 * Advisory, not mandatory. The widget does not complete in every browser —
 * WeChat's in-app browser is the case that broke a real signup, and it is this
 * community's main sharing channel — so a submission with no token is accepted
 * and marked unverified rather than rejected. A token that IS present must
 * still be valid: that is what catches a bot replaying a stale or forged one.
 *
 * Blocking on the challenge would trade real signups for spam protection on a
 * form with no account and no payment behind it. That trade is the wrong way
 * round, and making it was a genuine mistake the first time.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerdict =
  /** A valid token was presented. */
  | "verified"
  /** No token at all — the challenge never completed in that browser. */
  | "skipped"
  /** A token was presented and Cloudflare rejected it. */
  | "rejected"
  /** We could not ask Cloudflare, or we are not configured to. */
  | "unavailable";

export type TurnstileResult = { verdict: TurnstileVerdict };

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export async function verifyTurnstile(
  token: string | null,
  remoteIp: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set — submissions are unverified");
    return { verdict: "unavailable" };
  }

  if (!token) {
    return { verdict: "skipped" };
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
    return { verdict: "unavailable" };
  }

  if (!payload.success) {
    console.warn("[turnstile] rejected", payload["error-codes"]);
    return { verdict: "rejected" };
  }

  return { verdict: "verified" };
}
