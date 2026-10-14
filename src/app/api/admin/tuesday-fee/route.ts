import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { getOrCreateSessionFee, setSessionFeeStatus } from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { newFeeRef } from "@/lib/tuesday-fee";

const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/**
 * Marks a Tuesday fee paid, waived or back to pending (2026-10-14). Form post,
 * 303 back to /admin. Takes the person and the Tuesday rather than a fee id,
 * so someone booked without a fee row yet (moved in from a Thursday, or off
 * the waitlist) can be marked paid at the door all the same.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  // This one records payments: refuse anything posted from another site, on top of the admin cookie.
  if (!fromThisSite(request, await requestOrigin())) return new Response("Forbidden", { status: 403 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const key = form?.get("key");

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const session = form?.get("session");
  const signupId = form?.get("signupId");
  const status = form?.get("status");
  if (
    typeof session !== "string" ||
    !isSessionDate(session) ||
    typeof signupId !== "string" ||
    !/^\d+$/.test(signupId) ||
    (status !== "paid" && status !== "waived" && status !== "pending")
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const fee = await getOrCreateSessionFee(session, signupId, newFeeRef());
    await setSessionFeeStatus(fee.id, status);
  } catch {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  return NextResponse.redirect(new URL("/admin#tuesday-fees", await requestOrigin()), 303);
}
