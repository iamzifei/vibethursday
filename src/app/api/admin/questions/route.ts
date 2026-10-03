import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { saveSessionQuestions } from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { parseQuestionList } from "@/lib/session-questions";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 64 * 1024;

export const dynamic = "force-dynamic";

/**
 * The organiser saving this week's Q&A shortlist: one question per line, a
 * leading "*" for the ones the group voted for. A plain form post with a 303
 * back, like every other /admin action.
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

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const session = form?.get("session");
  const raw = form?.get("questions");

  if (typeof session !== "string" || !isSessionDate(session)) {
    return NextResponse.json({ error: "bad_session" }, { status: 400 });
  }

  await saveSessionQuestions(session, parseQuestionList(typeof raw === "string" ? raw.slice(0, 5000) : ""));

  return NextResponse.redirect(new URL(`/admin#questions`, await requestOrigin()), 303);
}
