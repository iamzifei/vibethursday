import { NextResponse } from "next/server";
import { adminHref } from "@/lib/admin-nav";
import { authorise } from "@/lib/staff";
import { isSessionDate } from "@/lib/checkin";
import { setSessionTheme } from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

const MAX_BODY = 4 * 1024;

/** One line, as voted in the group. */
const MAX_THEME = 120;

export const dynamic = "force-dynamic";

/**
 * Sets this week's theme for a Thursday (2026-11-19). Form post, 303 back to
 * the shares section of /admin. Shown to that morning's speakers on /speak
 * and given to the AI read of their briefs. Blank clears it.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  // After the bounded read, so an oversize body is refused on size alone.
  if (!fromThisSite(request, await requestOrigin())) return new Response("Forbidden", { status: 403 });
  const form = await bounded.formData().catch(() => null);
  const key = form?.get("key");

  if (!(await authorise(request, "admin", typeof key === "string" ? key : null))) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const session = form?.get("session");
  const theme = form?.get("theme");
  if (typeof session !== "string" || !isSessionDate(session) || typeof theme !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await setSessionTheme(session, theme.replace(/\s+/g, " ").trim().slice(0, MAX_THEME));
  return NextResponse.redirect(new URL(adminHref("shares"), await requestOrigin()), 303);
}
