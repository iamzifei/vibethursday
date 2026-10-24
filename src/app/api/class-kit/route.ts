import { parseKitSubmission } from "@/lib/class-kit";
import { COURSE } from "@/lib/course";
import { saveCourseKit } from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

/**
 * The longest body read. The spec box takes 20,000 characters, which is up to
 * about 60 KB of UTF-8 Chinese; the rest of the form is small.
 */
const MAX_BODY = 96 * 1024;

// Writes to Postgres; never prerender or cache.
export const dynamic = "force-dynamic";

/**
 * A whole classroom on one venue Wi-Fi is a single address, everyone hands in
 * the card within the same few minutes, and some will hand it in twice.
 */
const ROOM_FORMS_PER_HOUR = 600;

/**
 * Takes a handed-in card or spec from the class workbook (`ClassKitForm`).
 *
 * JSON in, JSON out: unlike `/feedback`, these pages already need script (they
 * save as you type and build a file to download), so a fetch costs nothing and
 * keeps what the person typed on screen after it is sent.
 *
 * Only the card and the spec are accepted (`parseKitSubmission`); the profile
 * and the industry pack never leave the browser.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return Response.json({ error: "large" }, { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return Response.json({ error: "large" }, { status: 413 });
  request = bounded;

  if (!fromThisSite(request, await requestOrigin())) return Response.json({ error: "origin" }, { status: 403 });

  // The proxy appends the real address last; see `callerIp` in rate-limit.ts.
  if (!checkRateLimit(`class-kit:${clientIp(request)}`, ROOM_FORMS_PER_HOUR).allowed) {
    return Response.json({ error: "rate" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { kind?: unknown; values?: unknown } | null;
  const submission = parseKitSubmission(body?.kind, body?.values);
  if (!submission) return Response.json({ error: "invalid" }, { status: 400 });

  try {
    await saveCourseKit({ course: COURSE.id, ...submission });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[class-kit] failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
