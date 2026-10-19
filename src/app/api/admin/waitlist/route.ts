import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { getMySignup, getOrCreateSessionFee, isMember, promoteFromWaitlist } from "@/lib/db";
import { feeFor, formatSession, sameWeekSessions } from "@/lib/sessions";
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

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const id = form?.get("id");
  const session = form?.get("session");

  if (typeof id !== "string" || !/^\d+$/.test(id) || typeof session !== "string" || !isSessionDate(session)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const origin = await requestOrigin();
  await promoteFromWaitlist(id, session);

  // Off a paid Tuesday's waitlist (2026-10-19): the place is held for them,
  // not given, until they pay — for a day, since they hear about it from the
  // organiser rather than on a page they are looking at. Whatever else they
  // hold that week is kept until then. The organiser gets the link to send.
  if (feeFor(session) !== null && stripeEnabled()) {
    try {
      if (!(await isMember(id))) {
        const mine = await getMySignup(id);
        const replaces = mine ? sameWeekSessions(session, [...mine.sessions, ...mine.waitlist.map((entry) => entry.session)]) : [];
        const fee = await getOrCreateSessionFee(session, id, newFeeRef(), PROMOTION_HOLD_MINUTES, replaces);
        if (fee.status === "pending") {
          const url = new URL("/admin", origin);
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

  return NextResponse.redirect(new URL(`/admin#waitlist`, origin), 303);
}
