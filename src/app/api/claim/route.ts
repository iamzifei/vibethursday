import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { claimMember } from "@/lib/db";
import { cookieOptions, issueToken, MEMBER_COOKIE } from "@/lib/member-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { text } from "@/lib/members";

// Reads a cookie and writes to Postgres, so it must never be cached.
export const dynamic = "force-dynamic";

/**
 * Claims the member card behind an existing signup.
 *
 * The match is deliberately a soft one — name plus one contact method — for the
 * reasons set out in claimMember(). The rate limit is what keeps it from being
 * a way to enumerate who has signed up: six attempts an hour per IP is plenty
 * for someone mistyping their own WeChat ID and useless for anything else.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

  const rate = checkRateLimit(`claim:${remoteIp}`);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const name = text(body.name, 100);
  const contact = text(body.contact, 200);

  if (!name || !contact) {
    return NextResponse.json({ error: "missing_required" }, { status: 400 });
  }

  let memberId: string | null;

  try {
    memberId = await claimMember(name, contact);
  } catch (error) {
    console.error("[claim] lookup failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (!memberId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  (await cookies()).set(MEMBER_COOKIE, issueToken(memberId), cookieOptions());

  return NextResponse.json({ ok: true });
}
