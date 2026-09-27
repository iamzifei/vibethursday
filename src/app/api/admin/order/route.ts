import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { deleteOrder } from "@/lib/db";
import { tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * The organiser removing one line from the drinks sheet: a duplicate, a test,
 * or somebody who said they are not coming after all.
 *
 * A plain form post with a 303 back, like every other /admin action.
 */
export async function POST(request: Request) {
  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const key = form?.get("key");

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const id = form?.get("id");

  if (typeof id !== "string" || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  await deleteOrder(id);

  return NextResponse.redirect(new URL(`/admin#orders`, await requestOrigin()), 303);
}
