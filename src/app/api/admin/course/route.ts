import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { setCourseOrderStatus } from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

/** The most this route reads from a request body (see `boundedRequest`). */
const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/** Marks a class sign-up paid, cancelled or back to pending. Form post, 303 back to /admin. */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  // This one records payments: refuse anything posted from another site,
  // on top of the admin cookie.
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

  const id = form?.get("id");
  const status = form?.get("status");
  if (typeof id !== "string" || !/^\d+$/.test(id) || (status !== "paid" && status !== "cancelled" && status !== "pending")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await setCourseOrderStatus(id, status);
  return NextResponse.redirect(new URL("/admin#course", await requestOrigin()), 303);
}
