import { NextResponse } from "next/server";
import { checkoutUrlFor } from "@/lib/card-pay";
import { admission, capFor } from "@/lib/capacity";
import { findMySignup, getOrCreateSessionFee, isTuesdayFree, saveSignupWithResult, sessionHeadcount } from "@/lib/db";
import { REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import { parseQuick, quickSession } from "@/lib/quick-signup";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isTurnstileConfigured, verifyTurnstile } from "@/lib/turnstile";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { bookableSessions, isSpecialSession } from "@/lib/sessions";
import { HOLD_MINUTES, stripeEnabled } from "@/lib/stripe-pay";
import { newFeeRef } from "@/lib/tuesday-fee";

const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/**
 * The quick sign-up (2026-11-02, quick-signup.ts). A plain form post from
 * /quick; answers with a 303 so it works in WeChat's browser without script.
 *
 * Books the next open session of that day the way the full form does
 * (waitlist when full), then:
 * - Tuesday, fee owed: a fee row with the usual payment hold, and straight on
 *   to Stripe Checkout. Stripe brings them back to /tuesday/pay, which shows
 *   the place and the address once paid.
 * - Tuesday, nothing owed (member, mentor, volunteer), or Thursday: back to
 *   /quick with what happened.
 * Turnstile like the full form, but stricter: a missing token is refused,
 * because two fields are all it takes to hold a seat. Rate-limited per IP
 * generously (the whole room shares the venue Wi-Fi), answering with a page
 * that explains, not a bare 429.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const back = (params: Record<string, string>) => NextResponse.redirect(new URL(`/quick?${new URLSearchParams(params)}`, origin), 303);

  const input = form ? parseQuick(form) : null;
  const day = form?.get("day") === "thu" ? "thu" : "tue";

  const ip = clientIp(request);
  if (!checkRateLimit(`quick-signup:${ip}`, 40).allowed) return back({ d: day, err: "rate" });

  if (!input) return back({ d: day, err: "missing" });

  if (isTurnstileConfigured()) {
    const token = form?.get("turnstileToken");
    const { verdict } = await verifyTurnstile(typeof token === "string" && token ? token.slice(0, 2048) : null, ip === "unknown" ? null : ip);
    // "unavailable" (Cloudflare unreachable) lets people through, as on the full form.
    if (verdict === "rejected" || verdict === "skipped") return back({ d: day, err: "bot" });
  }

  // Read first, write after (review 2026-11-02): a WeChat ID on file under
  // another name is turned away before anything is saved, so nobody can put
  // someone else on a session — let alone a Tuesday seat with no fee behind it.
  const known = await findMySignup(input.name, input.wechat).catch(() => null);
  if (known && "nameHint" in known) return back({ d: day, err: "name", h: known.nameHint });

  const session = quickSession(input.day, bookableSessions(6), isSpecialSession);
  if (!session) return back({ d: day, err: "closed" });

  try {
    let waitlisted = false;
    try {
      const { count, alreadyIn } = await sessionHeadcount(session, null, input.wechat);
      waitlisted = admission(count, alreadyIn, capFor(session)) === "waitlist";
    } catch (error) {
      // As the full form: a signup lost to a counting error is worse than one over a soft cap.
      console.error("[quick] could not count the session; booking anyway", error);
    }

    const { id, profileUpdated, exactName } = await saveSignupWithResult({
      name: input.name,
      email: null,
      wechat: input.wechat,
      building: null,
      demoIntent: null,
      topic: null,
      firstSession: session,
      source: "quick",
      availability: [],
      aiModels: [],
      aiSpend: null,
      purpose: null,
      lang: "zh",
      botCheck: isTurnstileConfigured() ? "verified" : "unavailable",
      waitlisted,
    });

    // This WeChat ID signed up before under another name: the session is
    // recorded (as on the full form), but no payment is opened against
    // someone else's record — ask for the name they used.
    if (!profileUpdated) return back({ d: day, err: "name" });

    const done = (params: Record<string, string>) => {
      const response = back({ d: day, s: session, ...params });
      if (exactName) response.cookies.set(REMEMBER_COOKIE, rememberToken(id), rememberCookieOptions(origin.startsWith("https://")));
      return response;
    };

    if (waitlisted) return done({ done: "waitlist" });
    if (!isSpecialSession(session)) return done({ done: "booked" });
    if (await isTuesdayFree(id)) return done({ done: "free" });

    const fee = await getOrCreateSessionFee(session, id, newFeeRef(), stripeEnabled() ? HOLD_MINUTES : null, []);
    if (fee.status !== "pending") return done({ done: "free" });
    if (!stripeEnabled()) return NextResponse.redirect(new URL(`/tuesday/pay?ref=${fee.ref}`, origin), 303);
    const response = NextResponse.redirect(await checkoutUrlFor(fee.ref, "tuesday", origin), 303);
    if (exactName) response.cookies.set(REMEMBER_COOKIE, rememberToken(id), rememberCookieOptions(origin.startsWith("https://")));
    return response;
  } catch (error) {
    console.error("[quick] could not sign up", error);
    return back({ d: day, err: "failed" });
  }
}
