import { NextResponse } from "next/server";
import { claimSessionFee } from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { looksLikeFeeRef } from "@/lib/tuesday-fee";

const MAX_BODY = 2 * 1024;

export const dynamic = "force-dynamic";

/**
 * "I've transferred" on the Tuesday payment page (2026-10-14). Records the
 * moment so the organiser knows whose transfer to look for. The person's
 * word, not a payment: "paid" is set on /admin by hand.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  const origin = await requestOrigin();
  if (!fromThisSite(bounded, origin)) return new Response("Forbidden", { status: 403 });
  if (!checkRateLimit(`tuesday-claim:${clientIp(bounded)}`, 30).allowed) return new Response("Too many", { status: 429 });

  const form = await bounded.formData().catch(() => null);
  const ref = form?.get("ref");
  if (!looksLikeFeeRef(ref)) return NextResponse.redirect(new URL("/tuesday", origin), 303);

  try {
    await claimSessionFee(ref);
  } catch (error) {
    console.error("[tuesday] could not record the transfer claim", error);
  }
  const url = new URL("/tuesday/pay", origin);
  url.searchParams.set("ref", ref);
  return NextResponse.redirect(url, 303);
}
