import { NextResponse } from "next/server";
import { checkoutUrlFor } from "@/lib/card-pay";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { kindOfRef, stripeEnabled } from "@/lib/stripe-pay";

const MAX_BODY = 2 * 1024;

export const dynamic = "force-dynamic";

/**
 * "Pay by card" on the Tuesday and dinner payment pages (2026-10-19). A plain
 * form post, answered with a redirect to Stripe's Checkout page — or back to
 * the payment page, which explains why there was nothing to pay.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  const origin = await requestOrigin();
  if (!fromThisSite(bounded, origin)) return new Response("Forbidden", { status: 403 });
  if (!checkRateLimit(`pay-checkout:${clientIp(bounded)}`, 30).allowed) return new Response("Too many", { status: 429 });

  const form = await bounded.formData().catch(() => null);
  const ref = form?.get("ref");
  const kind = typeof ref === "string" ? kindOfRef(ref) : null;
  if (typeof ref !== "string" || !kind) return NextResponse.redirect(new URL("/", origin), 303);

  const back = new URL(`/${kind === "tuesday" ? "tuesday" : "dinner"}/pay`, origin);
  back.searchParams.set("ref", ref);
  if (!stripeEnabled()) return NextResponse.redirect(back, 303);

  try {
    return NextResponse.redirect(await checkoutUrlFor(ref, kind, origin), 303);
  } catch (error) {
    console.error("[pay] could not open a Checkout page", error);
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, 303);
  }
}
