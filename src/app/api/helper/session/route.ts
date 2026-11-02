import { NextResponse } from "next/server";
import { ADMIN_SESSION_DAYS, HELPER_COOKIE, helperSessionValue, isHelperKey } from "@/lib/admin-auth";
import { tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Trades the helper's link for the helper cookie and lands on the check-in
 * desk (2026-11-02), the same way /admin?key= works for the organiser.
 */
export async function GET(request: Request) {
  const limited = tooMany(request, "admin-session", 10);
  if (limited) return limited;
  const origin = await requestOrigin();
  const key = new URL(request.url).searchParams.get("key");
  if (!isHelperKey(key)) return NextResponse.redirect(new URL("/admin/desk", origin), 303);

  const response = NextResponse.redirect(new URL("/admin/desk", origin), 303);
  response.cookies.set(HELPER_COOKIE, helperSessionValue()!, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_DAYS * 24 * 60 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
