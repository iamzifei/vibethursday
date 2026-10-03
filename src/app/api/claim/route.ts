import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { claimMember } from "@/lib/db";
import { cookieOptions, issueToken, MEMBER_COOKIE } from "@/lib/member-auth";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { text } from "@/lib/members";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 16 * 1024;

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
  // Refused before the body is read (2026-09-28 review: parsing first let one
  // oversized POST balloon the process). See `bodyTooLarge`.
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  // The proxy appends the real address last; see `callerIp` in rate-limit.ts.
  const remoteIp = clientIp(request);

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
