import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate-limit";
import { ADMIN_COOKIE, ADMIN_SESSION_DAYS, adminSessionValue, isAdmin } from "@/lib/admin-auth";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Trades the admin link for a session cookie, then gets the token out of the
 * address bar.
 *
 * `/admin?key=…` still works exactly as it always has — the page sends it
 * here, this sets the cookie, and the browser lands on a plain `/admin`. The
 * token is in the URL for one redirect instead of for the whole session.
 *
 * A Route Handler rather than the page itself because this version of Next
 * only lets Route Handlers and Server Functions set cookies; a Server
 * Component can read them but not write them.
 */
export async function GET(request: Request) {
  const limited = tooMany(request, "admin-session", 10);
  if (limited) return limited;

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? undefined;
  const origin = await requestOrigin();

  // Only ever back into /admin: an open redirect on the one route that hands
  // out the organiser's session would be the worst place to have one.
  const next = url.searchParams.get("next") ?? "/admin";
  const target = new URL(next.startsWith("/admin") ? next : "/admin", origin);

  if (!isAdmin(key)) {
    return NextResponse.redirect(new URL("/admin", origin), 303);
  }

  const response = NextResponse.redirect(target, 303);

  response.cookies.set(ADMIN_COOKIE, adminSessionValue()!, {
    httpOnly: true,
    // Secure everywhere but a plain-http local run, where the browser would
    // otherwise refuse to store it and the smoke stack could never sign in.
    secure: origin.startsWith("https://"),
    // Lax, not Strict. Strict drops the cookie on any navigation that starts
    // on another site — opening /admin from a link in a chat would look signed
    // out. Lax still withholds it from cross-site POSTs, which is what keeps
    // the admin forms safe from being submitted by somebody else's page.
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_DAYS * 24 * 60 * 60,
  });

  // The request carrying the token must not be cached anywhere on the way.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
