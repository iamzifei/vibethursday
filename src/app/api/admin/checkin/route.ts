import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { checkIn, undoCheckin } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * The organiser's hand on the check-in list: tick someone who did not scan,
 * or untick a tap that was a mistake.
 *
 * Not bound to today the way the room's own check-in is — the day after,
 * with the list in front of you, is when "she was there too" gets fixed.
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

  const session = form?.get("session");
  const signupId = form?.get("signupId");
  const action = form?.get("action");

  if (typeof session !== "string" || !isSessionDate(session)) {
    return NextResponse.json({ error: "bad_session" }, { status: 400 });
  }

  if (typeof signupId !== "string" || !/^\d+$/.test(signupId)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  try {
    if (action === "undo") {
      await undoCheckin(session, signupId);
    } else {
      // The organiser ticking a name is a headcount, not a consent: they
      // cannot answer "show my name on the page" for somebody else.
      await checkIn({ session, signupId, onWall: false, source: "admin" });
    }
  } catch {
    // An id that is not a signup fails the foreign key; a stale form, not a
    // server fault.
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  return NextResponse.redirect(
    new URL(`/admin#checkin`, await requestOrigin()),
    303,
  );
}
