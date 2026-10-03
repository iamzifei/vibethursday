import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { approveSessionPhoto, deleteSessionPhoto, rejectSessionPhoto } from "@/lib/db";
import { bodyTooLarge, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * The organiser's review of uploaded session photos: approve (it appears on
 * the session's page), reject (it stops showing and its bytes are dropped), or
 * delete (the row goes too). Same shape as the other admin routes — a plain
 * form post, checked against the admin session, answered with a redirect.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, 16 * 1024)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const key = form.get("key");
  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 401 });
  }

  const id = form.get("id");
  if (typeof id !== "string" || !/^\d{1,18}$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const action = form.get("action");
  if (action === "approve") await approveSessionPhoto(id);
  else if (action === "reject") await rejectSessionPhoto(id);
  else if (action === "delete") await deleteSessionPhoto(id);
  else return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  return NextResponse.redirect(new URL("/admin#photos", await requestOrigin()), { status: 303 });
}
