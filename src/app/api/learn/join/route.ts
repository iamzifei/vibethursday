import { NextResponse } from "next/server";
import { redeemInvite } from "@/lib/learn-db";
import { cleanText, looksLikeInviteToken, NAME_MAX } from "@/lib/learn";
import { currentLearner } from "@/lib/learn-session";
import { boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

export const dynamic = "force-dynamic";

const MAX_BODY = 2 * 1024;

/**
 * A waiting learner joins through an invite link and gives their name. Form
 * post, 303 to /learn on success, back to the invite page if the link stopped
 * working in the meantime. redeemInvite checks the invite and the learner's
 * status in one statement.
 */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const limited = tooMany(request, "learn-join", 20);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const lang = form?.get("lang") === "en" ? "en" : null;
  const token = form?.get("token");
  const name = cleanText(form?.get("name"), NAME_MAX);

  const learner = await currentLearner();
  if (!learner || !looksLikeInviteToken(token)) {
    return NextResponse.redirect(new URL(`/learn${lang ? "?lang=en" : ""}`, origin), 303);
  }
  if (!name || !(await redeemInvite(token, learner.id, name))) {
    return NextResponse.redirect(new URL(`/learn/join/${token}?err=1${lang ? "&lang=en" : ""}`, origin), 303);
  }
  return NextResponse.redirect(new URL(`/learn${lang ? "?lang=en" : ""}`, origin), 303);
}
