import { NextResponse } from "next/server";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, HELPER_COOKIE, isAdminRequest, isHelperSession } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { checkIn, undoCheckin } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";
import { deskReturnPath } from "@/lib/desk";

/** A form field as text, or null. */
const text = (form: FormData | null | undefined, name: string) => {
  const value = form?.get(name);
  return typeof value === "string" ? value : null;
};

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 64 * 1024;

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
  // Refused before the body is read (2026-09-28 review: parsing first let one
  // oversized POST balloon the process). See `bodyTooLarge`.
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const form = await request.formData().catch(() => null);
  const key = form?.get("key");

  // The organiser, or the helper at the door (2026-11-02, admin-auth.ts).
  const jar = await cookies();
  const admin = isAdminRequest(jar.get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null);
  if (!admin && !isHelperSession(jar.get(HELPER_COOKIE)?.value)) {
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

  // The check-in desk (2026-11-02) sends `back=desk` to come back to itself,
  // on the same session and row. Only this one fixed path, never an address
  // from the form.
  const back = form?.get("back");
  if (back === "desk") {
    return NextResponse.redirect(new URL(deskReturnPath(session, signupId, text(form, "q"), text(form, "show")), await requestOrigin()), 303);
  }

  return NextResponse.redirect(
    new URL(`/admin#checkin`, await requestOrigin()),
    303,
  );
}
