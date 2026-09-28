import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { clientIp, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * What the proxy in front of this app actually sends about the caller's address.
 *
 * ★ Every rate limit on the site keys on `clientIp()`, which takes the first
 * entry of `X-Forwarded-For`. Whether that is the caller's real address or a
 * value the caller wrote themselves depends on whether the hosting proxy
 * replaces the header or appends to it — and that cannot be read off the code,
 * only off a real request. This returns the headers so the question can be
 * answered by looking rather than guessing. Organiser only.
 */
export async function GET(request: Request) {
  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const relevant: Record<string, string> = {};
  for (const [name, value] of request.headers.entries()) {
    if (/ip|forward|real|client|via/i.test(name)) relevant[name] = value;
  }

  return NextResponse.json(
    { clientIp: clientIp(request), headers: relevant },
    { headers: { "Cache-Control": "no-store" } },
  );
}
