import { NextResponse } from "next/server";
import { setLearnerIntro } from "@/lib/learn-db";
import { cleanText, NAME_MAX, NOTE_MAX } from "@/lib/learn";
import { currentLearner } from "@/lib/learn-session";
import { boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

export const dynamic = "force-dynamic";

const MAX_BODY = 2 * 1024;

/**
 * A waiting learner says who they are, so the organiser can tell whom to let
 * in: WeChat's silent login gives an id and nothing else. Form post, 303 back
 * to /learn.
 */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const limited = tooMany(request, "learn-apply", 20);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const lang = form?.get("lang") === "en" ? "?lang=en" : "";

  const learner = await currentLearner();
  const name = cleanText(form?.get("name"), NAME_MAX);
  if (learner && name) await setLearnerIntro(learner.id, name, cleanText(form?.get("note"), NOTE_MAX));
  return NextResponse.redirect(new URL(`/learn${lang}`, origin), 303);
}
