import { NextResponse } from "next/server";
import {
  answerQuestion,
  askQuestion,
  editQuestion,
  claimQuestion,
  closeQuestion,
  openQuestionCount,
} from "@/lib/db";
import { sniffImage } from "@/lib/image-sniff";
import { currentMemberId } from "@/lib/member-auth";
import { classifyLane } from "@/lib/questions";
import { checkRateLimit } from "@/lib/rate-limit";
import { nextThursdays } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * Everything anybody writes to the Wharf: claiming, answering, closing, asking.
 *
 * One route with an `action` rather than four, because all four share the same
 * three lines of gate and differ only in the last five. The gate is the design:
 *
 * ★ **There is no anti-spam system here and there does not need to be one.**
 * Every action requires the member cookie, which is only issued at /claim, and
 * /claim only matches somebody who already signed up for a session. A stranger
 * cannot reach any of this — not slowly, not with a script. The only genuinely
 * open surface on this site is the sign-up form, which has Turnstile and an IP
 * limit of its own. What is left to bound is one member being enthusiastic, and
 * that is what the per-member rate limit below is for.
 */

/** Server-side ceiling. The browser resizes to 1600px and re-encodes first. */
const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_ANSWER = 2000;
const MAX_QUESTION = 300;
const MAX_OUTCOME = 300;

/** How many unfinished questions one person may have on the board at a time. */
const OPEN_QUESTIONS_EACH = 1;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  if (!checkRateLimit(`wharf:${memberId}`).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const action = form.get("action");
  const questionId = text(form.get("question"), 32);

  try {
    if (action === "coming") {
      if (!questionId) return NextResponse.json({ error: "missing_question" }, { status: 400 });

      const session = text(form.get("session"), 10);

      // Only a Thursday that has not happened yet. A claim naming a past
      // session is a promise that cannot be kept, and offering it would make
      // the board's most important number — who is coming for this — a lie.
      if (!session || !nextThursdays(8).includes(session)) {
        return NextResponse.json({ error: "bad_session" }, { status: 400 });
      }

      await claimQuestion(questionId, memberId, session);
      return NextResponse.json({ ok: true });
    }

    if (action === "answer") {
      if (!questionId) return NextResponse.json({ error: "missing_question" }, { status: 400 });

      const body = text(form.get("body"), MAX_ANSWER);
      if (!body) return NextResponse.json({ error: "missing_body" }, { status: 400 });

      let image: { bytes: Buffer; mime: string } | null = null;
      const file = form.get("image");

      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: "too_large" }, { status: 413 });
        }

        const bytes = Buffer.from(await file.arrayBuffer());
        const mime = sniffImage(bytes);

        if (!mime) return NextResponse.json({ error: "not_an_image" }, { status: 415 });
        image = { bytes, mime };
      }

      await answerQuestion(questionId, memberId, body, image);
      return NextResponse.json({ ok: true });
    }

    if (action === "close") {
      if (!questionId) return NextResponse.json({ error: "missing_question" }, { status: 400 });

      const closed = await closeQuestion(
        questionId,
        memberId,
        text(form.get("outcome"), MAX_OUTCOME),
        text(form.get("thanked"), 32),
      );

      // Not theirs, or already closed. Both are "no" and neither is worth
      // telling apart to the caller.
      if (!closed) return NextResponse.json({ error: "not_yours" }, { status: 403 });
      return NextResponse.json({ ok: true });
    }

    if (action === "edit") {
      if (!questionId) return NextResponse.json({ error: "missing_question" }, { status: 400 });

      const body = text(form.get("text"), MAX_QUESTION);
      if (!body) return NextResponse.json({ error: "missing_body" }, { status: 400 });

      // ★ The lane is recomputed rather than kept. A question filed under
      //   "还没问清楚" and then rewritten must not keep wearing that label:
      //   the verdict was about words that no longer exist. If the new wording
      //   is still vague, the next triage pass will say so — with a reason
      //   that matches what is actually written.
      const outcome = await editQuestion(questionId, memberId, body, classifyLane(body));

      if (outcome === "duplicate") {
        return NextResponse.json({ error: "duplicate" }, { status: 409 });
      }

      // Not theirs, closed, or somebody has already claimed or answered it.
      // All three mean "no", and telling them apart would only tell a stranger
      // which questions have replies.
      if (outcome === "not_yours") {
        return NextResponse.json({ error: "not_yours" }, { status: 403 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "ask") {
      const body = text(form.get("text"), MAX_QUESTION);
      if (!body) return NextResponse.json({ error: "missing_body" }, { status: 400 });

      // One unfinished question each. This is the whole rate limit that matters
      // for asking: it makes every question cost something to its author, and
      // it is a much better rule than a per-hour cap because it does not punish
      // somebody who closes what they asked.
      if ((await openQuestionCount(memberId)) >= OPEN_QUESTIONS_EACH) {
        return NextResponse.json({ error: "one_at_a_time" }, { status: 409 });
      }

      const session = text(form.get("session"), 10);

      await askQuestion(
        memberId,
        body,
        session && nextThursdays(8).includes(session) ? session : null,
        classifyLane(body),
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    console.error("[wharf] write failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
