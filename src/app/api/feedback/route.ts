import { NextResponse } from "next/server";
import { LANG_PARAM, resolveLang } from "@/lib/content";
import { saveFeedback } from "@/lib/db";
import { canGiveFeedback, isRecommend, isSessionDate, parseRating, verifyFeedbackCode } from "@/lib/feedback";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { sydneyToday } from "@/lib/sessions";

// Writes to Postgres; never prerender or cache.
export const dynamic = "force-dynamic";

/**
 * Same shape of allowance as check-in, and for the same reason: a room full of
 * phones on one café Wi-Fi is a single address, and everyone fills this in
 * within a few minutes of each other.
 */
const ROOM_FORMS_PER_HOUR = 200;

/** Trims, drops empties, caps length. */
function clean(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Takes one feedback form.
 *
 * A plain form post with a 303 back to `/feedback`, like `/api/checkin`: the
 * page it answers has no script, a 307 would repost on reload, and a JSON body
 * would need script to read.
 *
 * The order of the checks is the order they are cheapest and most important
 * in: the code is the door and is checked before anything else is read; the
 * window is checked against today rather than against the date in the link;
 * then the rate limit; then the body.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);

  const session = clean(form?.get("session") ?? null, 10) ?? "";
  const code = clean(form?.get("code") ?? null, 40) ?? "";
  const lang = resolveLang(clean(form?.get("lang") ?? null, 10) ?? undefined);
  const origin = await requestOrigin();

  const back = (extra: Record<string, string>) => {
    const url = new URL("/feedback", origin);
    url.searchParams.set("s", session);
    url.searchParams.set("k", code);
    const param = LANG_PARAM[lang];
    if (param) url.searchParams.set("lang", param);
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  if (!isSessionDate(session) || !verifyFeedbackCode(session, code)) {
    return back({ err: "code" });
  }

  // ⚠️ Checked here as well as on the page. The page decides what to render;
  // this decides what gets stored, and a form left open in a tab over the
  // weekend would otherwise post a week later and file itself under a session
  // whose window had closed.
  if (!canGiveFeedback(session, sydneyToday().toISOString().slice(0, 10))) {
    return back({ err: "code" });
  }

  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(`feedback:${remoteIp}`, ROOM_FORMS_PER_HOUR).allowed) {
    return back({ err: "rate" });
  }

  // Both scales are whitelisted rather than trusted: the form is a POST body,
  // and "rating=9" is one curl away. An unparseable answer is a skipped one.
  const rating = parseRating(clean(form?.get("rating") ?? null, 4));
  const recommendRaw = clean(form?.get("recommend") ?? null, 10);
  const recommend = isRecommend(recommendRaw) ? recommendRaw : null;

  const best = clean(form?.get("best") ?? null, 2000);
  const better = clean(form?.get("better") ?? null, 2000);
  const name = clean(form?.get("name") ?? null, 100);
  const wechat = clean(form?.get("wechat") ?? null, 100);

  // A form where every question was skipped says nothing and would still be a
  // row in the count — which would then make a session look like it got
  // responses it did not. A name or a WeChat ID on its own is not an answer
  // either: it is somebody saying who they are, not what they thought.
  if (rating === null && recommend === null && !best && !better) {
    return back({ err: "empty" });
  }

  try {
    await saveFeedback({ session, rating, recommend, best, better, name, wechat, lang });
    return back({ done: "1" });
  } catch (error) {
    console.error("[feedback] failed", error);
    return back({ err: "failed" });
  }
}
