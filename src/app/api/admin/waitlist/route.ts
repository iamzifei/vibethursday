import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { promoteFromWaitlist } from "@/lib/db";
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

  await promoteFromWaitlist(id, session);

  return NextResponse.redirect(new URL(`/admin#waitlist`, await requestOrigin()), 303);
}
