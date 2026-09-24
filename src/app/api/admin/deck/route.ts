import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isDeckCode } from "@/lib/deck";
import { deleteDeck } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Closing a room from /admin.
 *
 * A plain form post with a redirect, the same as the Wharf's admin actions:
 * /admin has no client JavaScript and there is no reason for it to grow some.
 *
 * There is no confirmation step. Closing a room destroys slides somebody
 * uploaded, but only ever their own copy of a deck they still have — this is a
 * screen for a ten-minute talk, not a place anything is kept.
 */
export async function POST(request: Request) {
  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const key = form.get("key");
  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 401 });
  }

  const code = form.get("code");
  if (typeof code !== "string" || !isDeckCode(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  await deleteDeck(code);

  return NextResponse.redirect(
    new URL(`/admin#deck`, await requestOrigin()),
    { status: 303 },
  );
}
