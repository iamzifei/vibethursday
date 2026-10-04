import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSignupInterest } from "@/lib/db";
import { readRememberToken, REMEMBER_COOKIE } from "@/lib/my-signup";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { parseInterest } from "@/lib/signup-interest";

/**
 * The one-tap "what else would you come to" on the signup confirmation
 * (`signup-interest.ts`).
 *
 * Whose answer it is comes only from the "this phone remembers you" cookie the
 * signup itself just set — never from a name or ID in the body — so one person
 * cannot answer for another. No cookie, no save: the confirmation only shows
 * the question when the signup response said the cookie was set.
 */

export const dynamic = "force-dynamic";

/** One short JSON field. */
const MAX_BODY = 1024;

export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  // JSON only, like the signup route: a plain form on another site cannot send
  // it without a preflight, so a third-party page cannot post on someone's
  // behalf with their cookie.
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  // Its own key, so these taps never use up anyone's signup allowance.
  const rate = checkRateLimit(`interest:${clientIp(request)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = (await bounded.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const interest = parseInterest(body?.interest);
  if (!interest) return NextResponse.json({ error: "invalid_interest" }, { status: 400 });

  const signupId = readRememberToken((await cookies()).get(REMEMBER_COOKIE)?.value);
  if (!signupId) return NextResponse.json({ error: "not_remembered" }, { status: 401 });

  try {
    await setSignupInterest(signupId, interest);
  } catch (error) {
    console.error("[signup/interest] failed to save", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
