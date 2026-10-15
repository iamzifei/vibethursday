import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { setDinnerStatus } from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/** Marks a dinner seat paid, back to pending, or cancelled (2026-10-15). Form post, 303 back to /admin. */
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

  const id = form?.get("id");
  const status = form?.get("status");
  if (typeof id !== "string" || !/^\d+$/.test(id) || (status !== "paid" && status !== "pending" && status !== "cancelled")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await setDinnerStatus(id, status);
  return NextResponse.redirect(new URL("/admin#dinner", await requestOrigin()), 303);
}
