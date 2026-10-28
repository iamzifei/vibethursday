import { NextResponse } from "next/server";
import { addComment, getLessonBySlug } from "@/lib/learn-db";
import { canAccessLessons, cleanText, COMMENT_MAX, looksLikeLessonSlug } from "@/lib/learn";
import { currentLearner } from "@/lib/learn-session";
import { boundedRequest, checkRateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

export const dynamic = "force-dynamic";

const MAX_BODY = 12 * 1024;

/** Comments per learner per hour. A conversation, not a flood. */
const COMMENTS_PER_HOUR = 30;

/** A comment or reply under a lesson, from an approved learner. Form post, 303 back to the lesson. */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const slug = form?.get("lesson");
  if (!looksLikeLessonSlug(slug)) return new Response("Bad request", { status: 400 });

  const learner = await currentLearner();
  if (!learner || !canAccessLessons(learner)) return new Response("Forbidden", { status: 403 });

  const lang = form?.get("lang") === "en" ? "?lang=en" : "";
  const back = NextResponse.redirect(new URL(`/learn/${slug}${lang}#comments`, origin), 303);

  if (!checkRateLimit(`learn-comment:${learner.id}`, COMMENTS_PER_HOUR).allowed) return back;
  const lesson = await getLessonBySlug(slug);
  const body = cleanText(form?.get("body"), COMMENT_MAX);
  if (!lesson?.published || !body) return back;

  const parent = form?.get("parent");
  await addComment({
    lessonId: lesson.id,
    learnerId: learner.id,
    byAdmin: false,
    parentId: typeof parent === "string" && /^\d+$/.test(parent) ? parent : null,
    body,
  });
  return back;
}
