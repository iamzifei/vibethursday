import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { approveSessionPhoto, deleteSessionPhoto, rejectAllPendingPhotos, rejectSessionPhoto } from "@/lib/db";
import { isCrossSite } from "@/lib/session-photos";
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
 * The organiser's review of uploaded session photos: approve (it appears on
 * the session's page), reject (it stops showing and its bytes are dropped), or
 * delete (the row goes too). Plus one bulk action, rejecting everything still
 * waiting, for the day somebody floods the queue. Same shape as the other admin routes — a plain
 * form post, checked against the admin session, answered with a redirect.
 */
export async function POST(request: Request) {
  // A second layer behind the SameSite=Lax admin cookie: a browser that says
  // this came from another site is refused before anything else.
  if (isCrossSite(request)) return NextResponse.json({ error: "cross_site" }, { status: 403 });

  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const key = form.get("key");
  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 401 });
  }

  const action = form.get("action");

  // The flood button: no id, so above the per-row guard.
  if (action === "reject-all-pending") {
    await rejectAllPendingPhotos();
    return NextResponse.redirect(new URL("/admin#photos", await requestOrigin()), { status: 303 });
  }

  const id = form.get("id");
  if (typeof id !== "string" || !/^\d{1,18}$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  if (action === "approve") await approveSessionPhoto(id);
  else if (action === "reject") await rejectSessionPhoto(id);
  else if (action === "delete") await deleteSessionPhoto(id);
  else return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  return NextResponse.redirect(new URL("/admin#photos", await requestOrigin()), { status: 303 });
}
