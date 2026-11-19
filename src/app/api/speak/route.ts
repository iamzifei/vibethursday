import { NextResponse } from "next/server";
import {
  getSpeakerShare,
  listDeckSlideText,
  saveSpeakerBrief,
  saveSpeakerReview,
  spendReviewCall,
  spendSpeakerReviewCall,
} from "@/lib/db";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { briefStarted, BRIEF_FIELDS, MAX_BRIEF_FIELD, readBrief, SPEAKER_REVIEW_LIMIT } from "@/lib/speak";
import { verifySpeakerToken } from "@/lib/speak-token";
import { reviewAvailable, reviewBrief } from "@/lib/speak-review";

/**
 * Four answers of up to MAX_BRIEF_FIELD characters, three bytes each at worst,
 * plus the token and the JSON around them.
 */
const MAX_BODY = BRIEF_FIELDS.length * MAX_BRIEF_FIELD * 3 + 4 * 1024;

export const dynamic = "force-dynamic";

/**
 * How many speaker reads the whole site may make in a day, apart from the ask
 * box's allowance. A week has two or three speakers with ten reads each, so
 * this is far above honest use; what it bounds is a leaked link being pressed
 * all day. A call is one system prompt (~1,000 tokens), the brief and up to
 * 8,000 characters of slide text, and at most 700 tokens back.
 */
const REVIEWS_PER_DAY = Number(process.env.SPEAK_REVIEW_DAILY_LIMIT ?? 60);

/**
 * /speak's one write: save the four answers, and optionally ask for the AI
 * read of them. JSON `{ token, brief, review? }`.
 *
 * The token is the whole authorisation (speak.ts): it names one picked
 * speaker and one morning, and stops working at the end of that day. A pick
 * that has since been undone on /admin is refused even with a good token.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "speak", 120);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  // After the bounded read, so an oversize body is refused on size alone.
  if (!fromThisSite(request, await requestOrigin())) return new Response("Forbidden", { status: 403 });
  request = bounded;
  const body = await request.json().catch(() => null);

  const who = verifySpeakerToken(typeof body?.token === "string" ? body.token : null);
  if (!who) return NextResponse.json({ error: "bad_token" }, { status: 403 });

  const brief = readBrief(body?.brief);
  if (!brief) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (!(await saveSpeakerBrief(who.session, who.signupId, brief))) {
    return NextResponse.json({ error: "not_picked" }, { status: 404 });
  }

  if (body?.review !== true) return NextResponse.json({ ok: true });

  // ── The AI read. Advice only; every refusal below still leaves the brief saved.
  if (!reviewAvailable()) return NextResponse.json({ ok: true, error: "off" }, { status: 503 });
  if (!briefStarted(brief)) return NextResponse.json({ ok: true, error: "empty" }, { status: 400 });

  // Per address first, so a guessed or leaked link cannot burn anybody's
  // allowance faster than this.
  const perAddress = tooMany(request, "speak-review", 30);
  if (perAddress) return NextResponse.json({ ok: true, error: "rate_limited" }, { status: 429 });

  // ★ Both caps are charged before the call, never after: a counter that only
  // counts successes can be emptied for free by making the calls fail. The
  // speaker's own allowance comes first, so a speaker who has used theirs does
  // not take a read out of everybody else's day as well.
  if (!(await spendSpeakerReviewCall(who.session, who.signupId))) {
    return NextResponse.json({ ok: true, error: "used_up", left: 0 }, { status: 429 });
  }
  if (!(await spendReviewCall(REVIEWS_PER_DAY))) {
    return NextResponse.json({ ok: true, error: "spent" }, { status: 429 });
  }

  const share = await getSpeakerShare(who.session, who.signupId);
  const slideText = share?.deckCode ? await listDeckSlideText(share.deckCode).catch(() => []) : [];

  const result = await reviewBrief({ theme: share?.theme ?? null, brief, slideText });
  console.info("[speak] review", {
    ok: Boolean(result.review),
    ms: result.ms,
    promptTokens: result.usage?.prompt_tokens ?? null,
    completionTokens: result.usage?.completion_tokens ?? null,
  });

  const left = Math.max(0, SPEAKER_REVIEW_LIMIT - (share?.reviewCount ?? SPEAKER_REVIEW_LIMIT));
  if (!result.review) return NextResponse.json({ ok: true, error: "failed", left }, { status: 502 });

  await saveSpeakerReview(who.session, who.signupId, result.review);
  return NextResponse.json({ ok: true, review: result.review, left });
}
