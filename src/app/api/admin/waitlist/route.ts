import { NextResponse } from "next/server";
import { authorise } from "@/lib/staff";
import { isSessionDate } from "@/lib/checkin";
import { capFor } from "@/lib/capacity";
import { getOrCreateSessionFee, promoteFromWaitlist, isTuesdayFree, signupCountsBySession } from "@/lib/db";
import { feeFor, formatSession } from "@/lib/sessions";
import { PROMOTION_HOLD_MINUTES, stripeEnabled } from "@/lib/stripe-pay";
import { newFeeRef } from "@/lib/tuesday-fee";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 16 * 1024;

export const dynamic = "force-dynamic";

/**
 * "Give them a place": moves one waitlisted signup onto the session. Until
 * this existed the only way was a walk-in check-in on the day. A plain form
 * post with a 303 back, like every other /admin action.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const form = await request.formData().catch(() => null);
  const key = form?.get("key");

  const role = await authorise(request, "waitlist", typeof key === "string" ? key : null);
  if (!role) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const id = form?.get("id");
  const session = form?.get("session");

  if (typeof id !== "string" || !/^\d+$/.test(id) || typeof session !== "string" || !isSessionDate(session)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const origin = await requestOrigin();

  // Going over the cap is the admin's call (2026-11-02): an assistant can
  // give out a place only while one is free.
  if (role !== "admin") {
    const booked = (await signupCountsBySession()).get(session) ?? 0;
    if (booked >= capFor(session)) {
      const url = new URL("/admin/waitlist", origin);
      url.searchParams.set("msg", "已经满了：超员放人要管理员来点。");
      return NextResponse.redirect(url, 303);
    }
  }

  await promoteFromWaitlist(id, session);

  // Off a paid Tuesday's waitlist (2026-10-19): the place is held for them,
  // not given, until they pay — for a day, since they hear about it from the
  // organiser rather than on a page they are looking at. Whatever else they
  // hold that week is kept until then. The organiser gets the link to send.
  if (feeFor(session) !== null && stripeEnabled()) {
    try {
      if (!(await isTuesdayFree(id))) {
        // Nothing else that week is given up (2026-11-02).
        const fee = await getOrCreateSessionFee(session, id, newFeeRef(), PROMOTION_HOLD_MINUTES);
        if (fee.status === "pending") {
          const url = new URL("/admin/waitlist", origin);
          url.searchParams.set(
            "msg",
            `已给位子（${formatSession(session, "zh")}），24 小时内付款才锁定，没付自动放回。把付款链接发给他：${origin}/tuesday/pay?ref=${fee.ref}`,
          );
          return NextResponse.redirect(url, 303);
        }
      }
    } catch (error) {
      console.error("[admin] promoted, but could not set up the Tuesday payment", error);
    }
  }

  return NextResponse.redirect(new URL("/admin/waitlist", origin), 303);
}
