import { NextResponse } from "next/server";
import { coachAvailable, coachQuestion } from "@/lib/coach";
import { currentMemberId } from "@/lib/member-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * "Help me ask this better" — one follow-up question back, nothing written.
 *
 * Separate from /api/wharf because it is the one route on this site that costs
 * money per call and reaches a third party, and because it stores nothing:
 * there is no row anywhere after this returns. Keeping it apart means the write
 * route's gate stays a gate on writes.
 *
 * Same member cookie as everything else on the board, plus its own rate-limit
 * key so that burning the hourly allowance on drafts cannot stop somebody
 * actually posting.
 */

const MAX_DRAFT = 300;

export async function POST(request: Request) {
  if (!coachAvailable()) return NextResponse.json({ error: "off" }, { status: 404 });

  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  if (!checkRateLimit(`coach:${memberId}`).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const draft = form?.get("text");

  if (typeof draft !== "string" || !draft.trim()) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }

  const hint = await coachQuestion(draft.trim().slice(0, MAX_DRAFT));

  // null is a real answer, not a failure: it means the draft is already good
  // enough to leave alone. The box says so rather than showing an error.
  return NextResponse.json({ hint });
}
