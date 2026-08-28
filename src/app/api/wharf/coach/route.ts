import { NextResponse } from "next/server";
import { coachAvailable, coachDraft, type Round } from "@/lib/coach";
import { spendCoachCall } from "@/lib/db";
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

/** Rounds accepted from the page. The model is told to stop well before this. */
const MAX_ROUNDS = 4;

/**
 * How many of these the whole site may make in a day. Not per member — total.
 *
 * ★ This is the cap that actually holds. The per-member limit above bounds one
 * person; it does not bound the bill, because anybody can mint themselves a
 * fresh member cookie with two requests (see `spendCoachCall` in db.ts). The
 * number of members is not a fixed quantity an attacker has to respect.
 *
 * 300 is chosen against what this meetup is: about twenty people a week, most
 * of whom will press the button once or twice. Twenty people pressing it five
 * times each is 100. So 300 is generous for real use and cheap when it is not —
 * at roughly 300 input plus 60 output tokens a call, a fully spent day costs a
 * few cents, and a fully spent month costs about a dollar.
 *
 * ⚠️ This is the software half of the answer, and software can have bugs. The
 * half that does not depend on this file being right is the balance on the
 * DeepSeek account: keep it small and do not turn on auto top-up. That is the
 * ceiling that holds even if everything here is wrong.
 */
const CALLS_PER_DAY = Number(process.env.COACH_DAILY_LIMIT ?? 300);

/**
 * Reads the rounds the page sent back, dropping anything malformed.
 *
 * ⚠️ This arrives from the browser, so it is not evidence of anything — a
 * crafted request could claim any history it likes. That is fine here and worth
 * being explicit about: the history only steers what one person is asked next
 * about their own sentence. It reaches no database and grants nothing. What it
 * must not do is grow without bound, hence the slice.
 */
function readHistory(raw: FormDataEntryValue | null | undefined): Round[] {
  if (typeof raw !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (round): round is Round =>
          !!round &&
          typeof round === "object" &&
          typeof (round as Round).draft === "string" &&
          typeof (round as Round).ask === "string" &&
          typeof (round as Round).gap === "string",
      )
      .slice(-MAX_ROUNDS)
      .map((round) => ({
        draft: round.draft.slice(0, MAX_DRAFT),
        gap: round.gap,
        ask: round.ask.slice(0, 200),
      }));
  } catch {
    return [];
  }
}

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

  // The rounds so far, sent by the page. Held on the client rather than stored
  // because a half-finished sentence is not something this site should keep:
  // close the tab and the draft is gone, which is the correct amount of memory
  // for something somebody has not decided to publish yet.
  const history = readHistory(form?.get("history"));

  // Charged before the call, not after: a request that fails upstream has still
  // been paid for by then, and a counter that only counts successes is a
  // counter an attacker can drive to zero cost by making the calls fail.
  if (!(await spendCoachCall(CALLS_PER_DAY))) {
    return NextResponse.json({ error: "spent" }, { status: 429 });
  }

  const coaching = await coachDraft(draft.trim().slice(0, MAX_DRAFT), history);

  // ⚠️ `gap` goes back with the hint because "nothing to ask" is two different
  // findings and the box has to tell them apart. Collapsing them shipped a lie:
  // somebody typed three bare topics, the model correctly said "this is not a
  // question", and the box answered "this one is specific enough".
  return NextResponse.json({ hint: coaching?.ask || null, gap: coaching?.gap ?? null });
}
