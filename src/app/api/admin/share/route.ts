import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { setSessionShare } from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/**
 * Picks or unpicks someone to share at the start of a Thursday (2026-10-15).
 * Form post, 303 back to /admin. The picks show on /go for that morning.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
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
  const pick = form?.get("pick");
  if (typeof session !== "string" || !isSessionDate(session) || typeof signupId !== "string" || !/^\d+$/.test(signupId) || (pick !== "1" && pick !== "0")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    await setSessionShare(session, signupId, pick === "1");
  } catch {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  return NextResponse.redirect(new URL("/admin#shares", await requestOrigin()), 303);
}
