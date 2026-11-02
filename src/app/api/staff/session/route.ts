import { NextResponse } from "next/server";
import { readStaffToken, STAFF_COOKIE, staffInviteValid, staffSessionToken } from "@/lib/admin-auth";
import { assistantStamp } from "@/lib/db";
import { tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/** How long an assistant stays signed in on one phone. */
const STAFF_SESSION_DAYS = 60;

/**
 * Trades an assistant's personal link for the staff cookie (2026-11-02), then
 * lands on "today". A bad, old or revoked link lands on /staff,
 * which says what to do.
 */
export async function GET(request: Request) {
  const limited = tooMany(request, "staff-session", 10);
  if (limited) return limited;

  const origin = await requestOrigin();
  const refuse = () => {
    const response = NextResponse.redirect(new URL("/staff?bad=1", origin), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const invite = new URL(request.url).searchParams.get("invite");
  const named = readStaffToken(invite);
  if (!invite || !named) return refuse();

  let stamp: string | null = null;
  try {
    stamp = await assistantStamp(named.signupId);
  } catch (error) {
    console.error("[staff] could not check the invite", error);
    return refuse();
  }
  if (!stamp || !staffInviteValid(invite, named.signupId, stamp)) return refuse();

  const pass = staffSessionToken(named.signupId, stamp);
  if (!pass) return refuse();

  const response = NextResponse.redirect(new URL("/admin/today", origin), 303);
  response.cookies.set(STAFF_COOKIE, pass, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_DAYS * 24 * 60 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
