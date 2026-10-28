import { NextResponse } from "next/server";
import { videoPlayAuth, vodConfigured } from "@/lib/aliyun";
import { getLessonBySlug } from "@/lib/learn-db";
import { canAccessLessons, looksLikeLessonSlug } from "@/lib/learn";
import { currentLearner } from "@/lib/learn-session";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Play authorisations per learner per hour: every page load and every retry asks for one. */
const PLAYS_PER_HOUR = 120;

const NO_STORE = { "Cache-Control": "no-store, private" };

/**
 * A play authorisation for one lesson's video, for the player on that
 * lesson's page. Only for an approved learner, only for a published lesson;
 * everyone else gets a 403 and never learns the video id.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("lesson");
  if (!looksLikeLessonSlug(slug)) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });

  const learner = await currentLearner();
  if (!learner || !canAccessLessons(learner)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  if (!checkRateLimit(`learn-play:${learner.id}`, PLAYS_PER_HOUR).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const lesson = await getLessonBySlug(slug);
  if (!lesson?.published || !lesson.videoId) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  if (!vodConfigured()) return NextResponse.json({ error: "off" }, { status: 503, headers: NO_STORE });

  try {
    const { playAuth } = await videoPlayAuth(lesson.videoId);
    return NextResponse.json({ videoId: lesson.videoId, playAuth }, { headers: NO_STORE });
  } catch (error) {
    console.error("[learn/play] could not get a play authorisation", error);
    return NextResponse.json({ error: "unavailable" }, { status: 502, headers: NO_STORE });
  }
}
