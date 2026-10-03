import { NextResponse } from "next/server";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isDeckCode } from "@/lib/deck";
import { deleteDeck } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 64 * 1024;

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
  // Refused before the body is read (2026-09-28 review: parsing first let one
  // oversized POST balloon the process). See `bodyTooLarge`.
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
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
