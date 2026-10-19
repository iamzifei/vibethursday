import { NextResponse } from "next/server";
import { amountFor } from "@/lib/card-pay";
import { compWithCode, getDinnerByRef, getSessionFeeByRef } from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { expireCheckoutPage, isFullDiscountCode, kindOfRef, stripeEnabled } from "@/lib/stripe-pay";

const MAX_BODY = 2 * 1024;

export const dynamic = "force-dynamic";

/**
 * "Have a code?" on the Tuesday and dinner payment pages (2026-10-19). A code
 * that Stripe says is an active 100%-off promotion code settles the place with
 * no payment; anything else goes back with an error. Rate-limited hard, since
 * a wrong answer is the only thing a guesser learns from.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  const origin = await requestOrigin();
  if (!fromThisSite(bounded, origin)) return new Response("Forbidden", { status: 403 });

  const form = await bounded.formData().catch(() => null);
  const ref = form?.get("ref");
  const code = form?.get("code");
  const kind = typeof ref === "string" ? kindOfRef(ref) : null;
  if (typeof ref !== "string" || !kind) return NextResponse.redirect(new URL("/", origin), 303);

  const back = new URL(`/${kind === "tuesday" ? "tuesday" : "dinner"}/pay`, origin);
  back.searchParams.set("ref", ref);
  if (!checkRateLimit(`pay-code:${clientIp(bounded)}`, 10).allowed) {
    back.searchParams.set("code", "rate");
    return NextResponse.redirect(back, 303);
  }

  const cleaned = typeof code === "string" ? code.trim().toUpperCase().slice(0, 40) : "";
  try {
    const row = kind === "tuesday" ? await getSessionFeeByRef(ref) : await getDinnerByRef(ref);
    if (!row || amountFor(kind, row) === null || !stripeEnabled() || !cleaned || !(await isFullDiscountCode(cleaned))) {
      back.searchParams.set("code", "bad");
      return NextResponse.redirect(back, 303);
    }
    await compWithCode(kind, ref);
    // A Checkout page opened earlier must not still be able to take money.
    if (row.stripe_session) await expireCheckoutPage(row.stripe_session).catch(() => {});
    console.log("[pay] settled with a promotion code", kind, ref);
  } catch (error) {
    console.error("[pay] could not check the code", error);
    back.searchParams.set("code", "bad");
  }
  return NextResponse.redirect(back, 303);
}
