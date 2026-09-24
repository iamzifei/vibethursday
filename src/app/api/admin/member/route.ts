import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { requestOrigin } from "@/lib/request-origin";
import { setMemberHidden } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Takes a member card off the wall, or puts it back.
 *
 * This exists because the claim check is deliberately soft: anyone who knows a
 * person's name and WeChat ID can edit their card. That trade was made on the
 * grounds that the organiser could undo it — which was not true until now, and
 * saying so in a design document without checking was the actual mistake.
 *
 * A plain form post rather than fetch(), so /admin keeps working with no client
 * JavaScript at all, like the rest of that page.
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
  const hidden = form?.get("hidden") === "true";

  if (typeof id !== "string" || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  await setMemberHidden(id, hidden);

  // 303 so the browser follows with GET; a 307 would repost the form on reload.
  return NextResponse.redirect(new URL(`/admin#members`, await requestOrigin()), 303);
}
