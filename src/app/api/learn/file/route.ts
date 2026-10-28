import { NextResponse } from "next/server";
import { handoutLink, ossConfigured } from "@/lib/aliyun";
import { getLesson, getLessonFile } from "@/lib/learn-db";
import { canAccessLessons, downloadName } from "@/lib/learn";
import { currentLearner } from "@/lib/learn-session";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DOWNLOADS_PER_HOUR = 100;

/**
 * Downloads one handout: a 302 to a signed link that works for ten minutes.
 * The link is minted per request, so what an approved learner can pass on
 * stops working almost at once.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d{1,18}$/.test(id)) return new Response("Bad request", { status: 400 });

  const learner = await currentLearner();
  if (!learner || !canAccessLessons(learner)) return new Response("Forbidden", { status: 403 });
  if (!checkRateLimit(`learn-file:${learner.id}`, DOWNLOADS_PER_HOUR).allowed) return new Response("Too many requests", { status: 429 });

  const file = await getLessonFile(id);
  const lesson = file ? await getLesson(file.lessonId) : null;
  if (!file || !lesson?.published) return new Response("Not found", { status: 404 });
  if (!ossConfigured()) return new Response("Unavailable", { status: 503 });

  return NextResponse.redirect(handoutLink(file.objectKey, downloadName(file.title, file.ext)), {
    status: 302,
    headers: { "Cache-Control": "no-store, private" },
  });
}
